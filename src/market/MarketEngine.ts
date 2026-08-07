/**
 * MarketEngine — the single owner of the authenticated Deriv session.
 *
 *   Deriv WebSocket → TickStream → Rolling Buffer → Analysis Engines
 *                                → Prediction Engine → Dashboard
 *
 * One socket. One tick subscription. One rolling buffer. Everything the UI
 * renders is derived from this engine's snapshot.
 */
import { ConnectionManager } from "@/websocket/ConnectionManager";
import type { WebSocketManager } from "@/websocket/WebSocketManager";
import { computeDigitStats, computeLiveStatistics, computeMarketQuality, computeTransitionMatrix, extractDigit } from "@/analysis/statistics";
import { runStrategies } from "@/analysis/strategies";
import { ModelCalibrationEngine } from "@/analysis/calibration";
import { buildPrediction, strategyAgreement } from "@/analysis/prediction";
import type { AnalysisSnapshot, Prediction, Tick } from "@/analysis/types";

const MAX_BUFFER = 1000;

const PIP_FALLBACK: Record<string, number> = {
  R_10: 3,
  R_25: 3,
  R_50: 4,
  R_75: 4,
  R_100: 2,
  "1HZ10V": 2,
  "1HZ25V": 2,
  "1HZ50V": 2,
  "1HZ75V": 2,
  "1HZ100V": 2,
};

export type AccountInfo = {
  fullname: string;
  loginid: string;
  email: string;
  currency: string;
  isVirtual: boolean;
  landingCompany: string;
  balance: number;
  availableBalance: number;
  status: string;
  scopes: string[];
  authorised: boolean;
};

export type Diagnostics = {
  socket: "idle" | "connecting" | "connected" | "error";
  authorised: boolean;
  feed: "idle" | "connecting" | "streaming" | "error";
  subscriptionId: string | null;
  symbol: string;
  lastTickAt: number | null;
  tickRate: number;
  latency: number;
  lastPingAt: number | null;
  serverTime: number | null;
  bufferSize: number;
  lastRawTick: string;
  tradingPermission: boolean;
};

export type EntryStatus = {
  armed: boolean;
  confirmed: boolean;
  confirmedAt: number | null;
  ticksObserved: number;
  expired: boolean;
};

type Listener = () => void;

class MarketEngineImpl {
  private socket: WebSocketManager | null = null;
  private unsubscribe: (() => void) | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private rateTimer: ReturnType<typeof setInterval> | null = null;
  private pingSentAt = 0;
  private starting: Promise<void> | null = null;

  private buffer: Tick[] = [];
  private processed = 0;
  private recentTimes: number[] = [];
  private window = 100;
  private symbol = "R_100";
  private token: string | null = null;
  private pipSize = 2;

  readonly calibration = new ModelCalibrationEngine();

  private listeners = new Set<Listener>();
  private frame: number | null = null;

  account: AccountInfo = {
    fullname: "",
    loginid: "",
    email: "",
    currency: "USD",
    isVirtual: false,
    landingCompany: "",
    balance: 0,
    availableBalance: 0,
    status: "unknown",
    scopes: [],
    authorised: false,
  };

  diagnostics: Diagnostics = {
    socket: "idle",
    authorised: false,
    feed: "idle",
    subscriptionId: null,
    symbol: "R_100",
    lastTickAt: null,
    tickRate: 0,
    latency: 0,
    lastPingAt: null,
    serverTime: null,
    bufferSize: 0,
    lastRawTick: "",
    tradingPermission: false,
  };

  snapshot: AnalysisSnapshot = emptySnapshot("R_100", 100);
  prediction: Prediction | null = null;
  entry: EntryStatus = { armed: false, confirmed: false, confirmedAt: null, ticksObserved: 0, expired: false };
  version = 0;

  /* ---------------------------------------------------------------- lifecycle */

  async start(token: string | null, symbol: string, window: number) {
    this.token = token;
    this.window = window;
    if (this.starting) await this.starting;
    this.starting = this.boot(symbol);
    await this.starting;
    this.starting = null;
  }

  private async boot(symbol: string) {
    this.diagnostics = { ...this.diagnostics, socket: "connecting", feed: "connecting" };
    this.emit();
    try {
      const socket = await ConnectionManager.connect(1);
      this.socket = socket;
      this.diagnostics = { ...this.diagnostics, socket: "connected" };

      this.unsubscribe?.();
      this.unsubscribe = socket.subscribe((data) => this.handle(data));

      if (this.token) socket.send({ authorize: this.token });
      this.startHeartbeat();
      this.startRateSampler();
      this.subscribeSymbol(symbol);
    } catch {
      this.diagnostics = { ...this.diagnostics, socket: "error", feed: "error" };
      this.emit();
    }
  }

  /** Swap the streamed symbol without tearing down the socket. */
  subscribeSymbol(symbol: string) {
    this.symbol = symbol;
    this.pipSize = PIP_FALLBACK[symbol] ?? 2;
    this.buffer = [];
    this.processed = 0;
    this.recentTimes = [];
    this.prediction = null;
    this.entry = { armed: false, confirmed: false, confirmedAt: null, ticksObserved: 0, expired: false };
    this.diagnostics = { ...this.diagnostics, symbol, feed: "connecting", subscriptionId: null, bufferSize: 0 };
    this.snapshot = emptySnapshot(symbol, this.window);

    const socket = this.socket;
    if (!socket) return;
    socket.send({ forget_all: "ticks" });
    socket.send({
      ticks_history: symbol,
      end: "latest",
      count: MAX_BUFFER,
      style: "ticks",
      subscribe: 1,
    });
    this.emit();
  }

  /** Window changes only re-slice the existing buffer — no reconnect. */
  setWindow(window: number) {
    this.window = window;
    this.recompute();
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.rateTimer) clearInterval(this.rateTimer);
    this.pingTimer = null;
    this.rateTimer = null;
    this.socket?.send({ forget_all: ["ticks", "balance"] });
  }

  private startHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      this.pingSentAt = performance.now();
      this.socket?.send({ ping: 1 });
      this.socket?.send({ time: 1 });
    }, 8000);
  }

  private startRateSampler() {
    if (this.rateTimer) clearInterval(this.rateTimer);
    this.rateTimer = setInterval(() => {
      const cutoff = Date.now() - 10000;
      this.recentTimes = this.recentTimes.filter((t) => t > cutoff);
      const rate = this.recentTimes.length / 10;
      if (Math.abs(rate - this.diagnostics.tickRate) > 0.01) {
        this.diagnostics = { ...this.diagnostics, tickRate: rate };
        this.emit();
      }
    }, 1000);
  }

  /* ------------------------------------------------------------- socket data */

  private handle(data: Record<string, unknown>) {
    const type = data["msg_type"] as string | undefined;

    if (type === "authorize") {
      const a = data["authorize"] as Record<string, unknown> | undefined;
      if (a) {
        this.account = {
          fullname: (a["fullname"] as string) || (a["loginid"] as string) || "Trader",
          loginid: (a["loginid"] as string) ?? "",
          email: (a["email"] as string) ?? "",
          currency: (a["currency"] as string) ?? "USD",
          isVirtual: Boolean(a["is_virtual"]),
          landingCompany: (a["landing_company_fullname"] as string) ?? "",
          balance: Number(a["balance"] ?? 0),
          availableBalance: Number(a["balance"] ?? 0),
          status: Array.isArray(a["account_list"]) ? "active" : "active",
          scopes: (a["scopes"] as string[]) ?? [],
          authorised: true,
        };
        this.diagnostics = {
          ...this.diagnostics,
          authorised: true,
          tradingPermission: ((a["scopes"] as string[]) ?? []).includes("trade"),
        };
        this.socket?.send({ balance: 1, subscribe: 1 });
        this.emit();
      }
      return;
    }

    if (type === "balance") {
      const b = data["balance"] as Record<string, unknown> | undefined;
      if (b) {
        const balance = Number(b["balance"] ?? 0);
        this.account = {
          ...this.account,
          balance,
          availableBalance: balance,
          currency: (b["currency"] as string) ?? this.account.currency,
          loginid: (b["loginid"] as string) ?? this.account.loginid,
        };
        this.emit();
      }
      return;
    }

    if (type === "ping" || data["ping"]) {
      this.diagnostics = {
        ...this.diagnostics,
        latency: Math.max(1, Math.round(performance.now() - this.pingSentAt)),
        lastPingAt: Date.now(),
      };
      this.emit();
      return;
    }

    if (type === "time") {
      this.diagnostics = { ...this.diagnostics, serverTime: Number(data["time"]) * 1000 };
      this.emit();
      return;
    }

    if (type === "history") {
      const history = data["history"] as { prices?: number[]; times?: number[] } | undefined;
      const prices = history?.prices ?? [];
      const times = history?.times ?? [];
      this.pipSize = inferPipSize(prices, this.pipSize);
      this.buffer = prices.map((quote, i) => ({
        epoch: times[i] ?? Date.now() / 1000,
        quote,
        digit: extractDigit(quote, this.pipSize),
        pipSize: this.pipSize,
        receivedAt: Date.now(),
      }));
      this.processed = this.buffer.length;
      const sub = data["subscription"] as { id?: string } | undefined;
      this.diagnostics = {
        ...this.diagnostics,
        feed: "streaming",
        subscriptionId: sub?.id ?? this.diagnostics.subscriptionId,
        bufferSize: this.buffer.length,
      };
      this.recompute();
      return;
    }

    if (type === "tick") {
      const t = data["tick"] as Record<string, unknown> | undefined;
      if (!t || typeof t["quote"] !== "number") return;
      if (t["symbol"] && t["symbol"] !== this.symbol) return;

      const pip = typeof t["pip_size"] === "number" ? (t["pip_size"] as number) : this.pipSize;
      this.pipSize = pip;
      const tick: Tick = {
        epoch: Number(t["epoch"] ?? Date.now() / 1000),
        quote: t["quote"] as number,
        digit: extractDigit(t["quote"] as number, pip),
        pipSize: pip,
        receivedAt: Date.now(),
      };

      this.buffer.push(tick);
      if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
      this.processed += 1;
      this.recentTimes.push(Date.now());

      const sub = data["subscription"] as { id?: string } | undefined;
      this.diagnostics = {
        ...this.diagnostics,
        feed: "streaming",
        subscriptionId: sub?.id ?? this.diagnostics.subscriptionId,
        lastTickAt: Date.now(),
        serverTime: tick.epoch * 1000,
        bufferSize: this.buffer.length,
        lastRawTick: JSON.stringify(t),
      };

      this.recompute(tick);
    }
  }

  /* -------------------------------------------------------------- analysis */

  private recompute(incoming?: Tick) {
    const ticks = this.buffer.slice(-this.window);
    const digits = ticks.map((t) => t.digit);
    const stats = computeDigitStats(digits);
    const transition = computeTransitionMatrix(digits);
    const rate = this.diagnostics.tickRate;
    const live = computeLiveStatistics(ticks, stats, this.processed, rate);
    const strategies = runStrategies({
      digits,
      stats,
      transition,
      noise: live.noise,
      entropy: live.entropy,
      volatility: live.volatility,
    });

    const consensus = strategies.length
      ? strategies.reduce<Record<number, number>>((acc, s) => {
          acc[s.best] = (acc[s.best] ?? 0) + 1;
          return acc;
        }, {})
      : {};
    const topAgreement = Math.max(0, ...Object.values(consensus)) / (strategies.length || 1);
    const quality = computeMarketQuality(digits, stats, live, this.window, topAgreement);

    this.snapshot = {
      symbol: this.symbol,
      window: this.window,
      digits,
      stats,
      live,
      quality,
      strategies,
      transition,
      updatedAt: Date.now(),
    };

    if (incoming) {
      this.calibration.observe(strategies, incoming.digit);
      this.evaluateEntry(incoming);
    }

    this.emit();
  }

  private evaluateEntry(tick: Tick) {
    const prediction = this.prediction;
    if (!prediction || !this.entry.armed) return;

    const ticksObserved = this.entry.ticksObserved + 1;
    if (!this.entry.confirmed && tick.digit === prediction.entryTrigger) {
      this.entry = { ...this.entry, confirmed: true, confirmedAt: Date.now(), ticksObserved };
      return;
    }
    const expired = !this.entry.confirmed && ticksObserved >= prediction.lifetimeTicks;
    this.entry = { ...this.entry, ticksObserved, expired, armed: !expired || this.entry.confirmed };
  }

  /** Run every model and produce one recommendation package. */
  predict(): Prediction | null {
    if (this.buffer.length < 20) return null;
    const prediction = buildPrediction(this.snapshot, this.calibration);
    prediction.strategyAgreement = Math.round(strategyAgreement(this.snapshot, prediction.targetDigit) * 100);
    this.prediction = prediction;
    this.entry = { armed: true, confirmed: false, confirmedAt: null, ticksObserved: 0, expired: false };
    this.emit();
    return prediction;
  }

  clearPrediction() {
    this.prediction = null;
    this.entry = { armed: false, confirmed: false, confirmedAt: null, ticksObserved: 0, expired: false };
    this.emit();
  }

  resetCalibration() {
    this.calibration.reset();
    this.emit();
  }

  /* ------------------------------------------------------------ subscription */

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Batched through requestAnimationFrame so renders never outpace paint. */
  private emit() {
    this.version += 1;
    if (typeof window === "undefined") return;
    if (this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.listeners.forEach((l) => l());
    });
  }
}

function inferPipSize(prices: number[], fallback: number) {
  let max = 0;
  for (const price of prices.slice(-40)) {
    const text = String(price);
    const dot = text.indexOf(".");
    if (dot >= 0) max = Math.max(max, text.length - dot - 1);
  }
  return max || fallback;
}

export function emptySnapshot(symbol: string, window: number): AnalysisSnapshot {
  const digits: number[] = [];
  const stats = computeDigitStats(digits);
  const live = computeLiveStatistics([], stats, 0, 0);
  return {
    symbol,
    window,
    digits,
    stats,
    live,
    quality: computeMarketQuality(digits, stats, live, window, 0),
    strategies: [],
    transition: computeTransitionMatrix(digits),
    updatedAt: Date.now(),
  };
}

export const MarketEngine = new MarketEngineImpl();

/**
 * MarketEngine — the single owner of the authenticated Deriv session.
 *
 *   Deriv WebSocket → TickStream → Rolling Buffer → Analysis Engines
 *                                → Prediction Engine → Dashboard
 *
 * One socket. One tick subscription. One rolling buffer. Everything the UI
 * renders — on BOTH the Analysis page and the Manual Trade page — is derived
 * from this engine's snapshot. Nothing downstream recalculates anything.
 */
import { ConnectionManager } from "@/websocket/ConnectionManager";
import type { WebSocketManager } from "@/websocket/WebSocketManager";
import { DERIV_CONFIG, SYMBOL_PIPS } from "@/config/app";
import {
  computeDigitStats,
  computeLiveStatistics,
  computeMarketQuality,
  computeTransitionMatrix,
  extractDigit,
} from "@/analysis/statistics";
import { runStrategies } from "@/analysis/strategies";
import { ModelCalibrationEngine } from "@/analysis/calibration";
import { buildPrediction, strategyAgreement } from "@/analysis/prediction";
import type { AnalysisSnapshot, Prediction, Tick } from "@/analysis/types";
import type { DerivAccount } from "@/types";

const MAX_BUFFER = 1000;
/** If no tick arrives within this window we switch to the fallback stream. */
const HISTORY_TIMEOUT = 6000;
/** A feed with no tick for this long is considered stalled and re-subscribed. */
const STALL_TIMEOUT = 25000;

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

export type SymbolMeta = {
  symbol: string;
  displayName: string;
  pip: number;
  open: boolean;
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
  lastError: string | null;
  symbolsLoaded: number;
  feedMode: "history" | "fallback" | "poll" | "none";
  reconnects: number;
};

export type EntryStatus = {
  armed: boolean;
  confirmed: boolean;
  confirmedAt: number | null;
  ticksObserved: number;
  expired: boolean;
};

type Listener = () => void;
type TickListener = (tick: Tick) => void;

class MarketEngineImpl {
  private socket: WebSocketManager | null = null;
  private unsubscribe: (() => void) | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private rateTimer: ReturnType<typeof setInterval> | null = null;
  private stallTimer: ReturnType<typeof setInterval> | null = null;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private pingSentAt = 0;
  private starting: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private buffer: Tick[] = [];
  private processed = 0;
  private recentTimes: number[] = [];
  private window = 100;
  private symbol = "R_100";
  private token: string | null = null;
  private pipSize = 2;

  readonly calibration = new ModelCalibrationEngine();

  private listeners = new Set<Listener>();
  private tickListeners = new Set<TickListener>();
  private frame: number | null = null;

  /** Authoritative symbol metadata from the `active_symbols` handshake. */
  symbols: SymbolMeta[] = [];
  /** Every account the user owns, from `authorize`.account_list. */
  accounts: DerivAccount[] = [];

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
    lastError: null,
    symbolsLoaded: 0,
    feedMode: "none",
    reconnects: 0,
  };

  snapshot: AnalysisSnapshot = emptySnapshot("R_100", 100);
  prediction: Prediction | null = null;
  entry: EntryStatus = {
    armed: false,
    confirmed: false,
    confirmedAt: null,
    ticksObserved: 0,
    expired: false,
  };
  version = 0;

  /* ---------------------------------------------------------------- lifecycle */

  async start(token: string | null, symbol: string, window: number) {
    this.token = token;
    this.window = window;
    if (this.starting) await this.starting;
    if (this.socket?.isOpen) {
      this.useToken(token);
      if (this.symbol !== symbol) this.subscribeSymbol(symbol);
      this.setWindow(window);
      return;
    }
    this.starting = this.boot(symbol);
    await this.starting;
    this.starting = null;
  }

  private async boot(symbol: string) {
    this.diagnostics = { ...this.diagnostics, socket: "connecting", feed: "connecting" };
    this.emit();
    try {
      ConnectionManager.onDrop = () => this.handleDrop();
      const socket = await ConnectionManager.connect(DERIV_CONFIG.appId);
      this.socket = socket;
      this.reconnectAttempts = 0;
      this.diagnostics = { ...this.diagnostics, socket: "connected", lastError: null };

      this.unsubscribe?.();
      this.unsubscribe = socket.subscribe((data) => this.handle(data));

      // 1. Active symbols handshake — authoritative pip sizes and availability.
      socket.send({ active_symbols: "brief", product_type: "basic" });
      // 2. Authorize (populates account, balance and account_list).
      if (this.token) socket.send({ authorize: this.token });

      this.startHeartbeat();
      this.startRateSampler();
      this.startStallWatch();
      this.subscribeSymbol(symbol);
    } catch (error) {
      this.diagnostics = {
        ...this.diagnostics,
        socket: "error",
        feed: "error",
        lastError: error instanceof Error ? error.message : "Connection failed",
      };
      this.emit();
      this.scheduleReconnect();
    }
  }

  /** Exponential-backoff reconnect after an unexpected socket drop. */
  private handleDrop() {
    this.socket = null;
    this.diagnostics = {
      ...this.diagnostics,
      socket: "error",
      feed: "error",
      authorised: false,
      lastError: "Connection lost — reconnecting",
    };
    this.emit();
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= 10) return;
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.diagnostics = { ...this.diagnostics, reconnects: this.diagnostics.reconnects + 1 };
      void this.boot(this.symbol);
    }, delay);
  }

  /** Re-authorize on a different account without tearing down the socket. */
  useToken(token: string | null) {
    if (token === this.token) return;
    this.token = token;
    this.account = { ...this.account, authorised: false };
    this.diagnostics = { ...this.diagnostics, authorised: false };
    const socket = this.socket;
    if (socket && token) {
      socket.send({ forget_all: "balance" });
      socket.send({ authorize: token });
    }
    this.emit();
  }

  /** Swap the streamed symbol without tearing down the socket. */
  subscribeSymbol(symbol: string) {
    this.symbol = symbol;
    this.pipSize = this.pipFor(symbol);
    this.buffer = [];
    this.processed = 0;
    this.recentTimes = [];
    this.prediction = null;
    this.entry = {
      armed: false,
      confirmed: false,
      confirmedAt: null,
      ticksObserved: 0,
      expired: false,
    };
    this.diagnostics = {
      ...this.diagnostics,
      symbol,
      feed: "connecting",
      subscriptionId: null,
      bufferSize: 0,
      feedMode: "history",
      lastError: null,
    };
    this.snapshot = emptySnapshot(symbol, this.window);

    const socket = this.socket;
    if (!socket) {
      this.emit();
      return;
    }

    socket.send({ forget_all: "ticks" });
    socket.send({
      ticks_history: symbol,
      end: "latest",
      count: MAX_BUFFER,
      style: "ticks",
      subscribe: 1,
    });

    // Buffering fallback: if the history request yields nothing in time, fall
    // back to the plain tick stream and build the buffer incrementally.
    if (this.historyTimer) clearTimeout(this.historyTimer);
    this.historyTimer = setTimeout(() => this.startFallbackFeed(), HISTORY_TIMEOUT);

    this.emit();
  }

  /** Plain `ticks` subscription — used when `ticks_history` is unavailable. */
  private startFallbackFeed() {
    if (this.buffer.length > 0) return;
    const socket = this.socket;
    if (!socket) return;
    this.diagnostics = {
      ...this.diagnostics,
      feedMode: "fallback",
      lastError: "History unavailable — streaming live ticks only",
    };
    socket.send({ forget_all: "ticks" });
    socket.send({ ticks: this.symbol, subscribe: 1 });
    this.emit();
  }

  /**
   * Last-resort live feed: Deriv rejects *streaming* subscriptions for symbols
   * outside the session's landing company, but non-subscribing `ticks_history`
   * still returns real quotes. Poll it so the workspace always shows genuine
   * Deriv data instead of an error (never synthetic/fake ticks).
   */
  private startPollFeed() {
    const socket = this.socket;
    if (!socket) return;
    if (this.pollTimer) return;
    this.polling = true;
    this.diagnostics = {
      ...this.diagnostics,
      feedMode: "poll",
      feed: this.buffer.length ? "streaming" : "connecting",
      lastError: "Streaming unavailable for this account — polling live Deriv quotes",
    };
    const poll = () => {
      if (!this.socket?.isOpen) return;
      this.socket.send({
        ticks_history: this.symbol,
        end: "latest",
        count: this.buffer.length ? 30 : MAX_BUFFER,
        style: "ticks",
      });
    };
    poll();
    this.pollTimer = setInterval(poll, 1000);
    this.emit();
  }

  private stopPollFeed() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.polling = false;
  }


  private pipFor(symbol: string) {
    const meta = this.symbols.find((s) => s.symbol === symbol);
    return meta?.pip ?? SYMBOL_PIPS[symbol] ?? 2;
  }

  /** Window changes only re-slice the existing buffer — no reconnect. */
  setWindow(window: number) {
    this.window = window;
    this.recompute();
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    [this.pingTimer, this.rateTimer, this.stallTimer].forEach((t) => t && clearInterval(t));
    if (this.historyTimer) clearTimeout(this.historyTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.pingTimer = null;
    this.rateTimer = null;
    this.stallTimer = null;
    this.historyTimer = null;
    this.reconnectTimer = null;
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

  /** Detects a silently dead subscription and re-subscribes. */
  private startStallWatch() {
    if (this.stallTimer) clearInterval(this.stallTimer);
    this.stallTimer = setInterval(() => {
      const last = this.diagnostics.lastTickAt;
      if (!last || Date.now() - last < STALL_TIMEOUT) return;
      if (!this.socket?.isOpen) return;
      this.diagnostics = { ...this.diagnostics, lastError: "Feed stalled — re-subscribing" };
      this.subscribeSymbol(this.symbol);
    }, 10000);
  }

  /* ------------------------------------------------------------- socket data */

  private handle(data: Record<string, unknown>) {
    const type = data["msg_type"] as string | undefined;

    // ---- Surface API errors instead of silently swallowing them. ----
    const error = data["error"] as { code?: string; message?: string } | undefined;
    if (error) {
      const message = error.message ?? error.code ?? "Deriv API error";
      this.diagnostics = { ...this.diagnostics, lastError: message };
      if (error.code === "InvalidSymbol" || error.code === "MarketIsClosed") {
        this.diagnostics = { ...this.diagnostics, feed: "error" };
      }
      if (type === "authorize" || error.code === "InvalidToken") {
        this.diagnostics = { ...this.diagnostics, authorised: false };
        this.account = { ...this.account, authorised: false, status: "unauthorised" };
      }
      // A failed history request should immediately fall back.
      if (type === "history" || type === "candles") this.startFallbackFeed();
      this.emit();
      return;
    }

    if (type === "active_symbols") {
      const list = (data["active_symbols"] as Record<string, unknown>[] | undefined) ?? [];
      this.symbols = list
        .filter((s) => /^(R_|1HZ)/.test(String(s["symbol"])))
        .map((s) => {
          const pip = Number(s["pip"] ?? 0.01);
          return {
            symbol: String(s["symbol"]),
            displayName: String(s["display_name"] ?? s["symbol"]),
            // Deriv reports pip as a magnitude (0.01) — convert to decimals.
            pip: pip > 0 ? Math.round(-Math.log10(pip)) : 2,
            open: Boolean(s["exchange_is_open"] ?? 1),
          };
        });
      this.diagnostics = { ...this.diagnostics, symbolsLoaded: this.symbols.length };
      // Re-derive the active symbol's pip now that we have the real value.
      const resolved = this.pipFor(this.symbol);
      if (resolved !== this.pipSize) {
        this.pipSize = resolved;
        this.buffer = this.buffer.map((t) => ({
          ...t,
          pipSize: resolved,
          digit: extractDigit(t.quote, resolved),
        }));
        this.recompute();
      }
      this.emit();
      return;
    }

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
          status: "active",
          scopes: (a["scopes"] as string[]) ?? [],
          authorised: true,
        };

        // account_list exposes every real/demo account on this login.
        const rawList = (a["account_list"] as Record<string, unknown>[] | undefined) ?? [];
        this.accounts = rawList.map((r) => ({
          loginid: String(r["loginid"] ?? ""),
          currency: String(r["currency"] ?? "USD"),
          accountType: String(r["account_type"] ?? (r["is_virtual"] ? "demo" : "real")),
          isVirtual: Boolean(r["is_virtual"]),
          balance: 0,
        }));

        this.diagnostics = {
          ...this.diagnostics,
          authorised: true,
          lastError: null,
          tradingPermission: ((a["scopes"] as string[]) ?? []).includes("trade"),
        };
        // Subscribe to balance for ALL accounts so the switcher stays live.
        this.socket?.send({ balance: 1, subscribe: 1, account: "all" });
        this.emit();
      }
      return;
    }

    if (type === "balance") {
      const b = data["balance"] as Record<string, unknown> | undefined;
      if (b) {
        const loginid = (b["loginid"] as string) ?? this.account.loginid;
        const balance = Number(b["balance"] ?? 0);
        const currency = (b["currency"] as string) ?? this.account.currency;

        if (!loginid || loginid === this.account.loginid) {
          this.account = {
            ...this.account,
            balance,
            availableBalance: balance,
            currency,
            loginid: loginid || this.account.loginid,
          };
        }
        this.accounts = this.accounts.map((acc) =>
          acc.loginid === loginid ? { ...acc, balance, currency } : acc,
        );

        // `account: "all"` reports sibling balances under total/accounts.
        const perAccount = b["accounts"] as Record<string, Record<string, unknown>> | undefined;
        if (perAccount) {
          this.accounts = this.accounts.map((acc) => {
            const entry = perAccount[acc.loginid];
            return entry
              ? {
                  ...acc,
                  balance: Number(entry["balance"] ?? acc.balance),
                  currency: String(entry["currency"] ?? acc.currency),
                }
              : acc;
          });
        }
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
      if (this.historyTimer) clearTimeout(this.historyTimer);
      const history = data["history"] as { prices?: number[]; times?: number[] } | undefined;
      const prices = history?.prices ?? [];
      const times = history?.times ?? [];

      if (!prices.length) {
        this.startFallbackFeed();
        return;
      }

      this.pipSize = this.pipFor(this.symbol);
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
        feedMode: "history",
        subscriptionId: sub?.id ?? this.diagnostics.subscriptionId,
        bufferSize: this.buffer.length,
        lastTickAt: Date.now(),
      };
      this.recompute();
      return;
    }

    if (type === "tick") {
      const t = data["tick"] as Record<string, unknown> | undefined;
      if (!t || typeof t["quote"] !== "number") return;
      if (t["symbol"] && t["symbol"] !== this.symbol) return;

      if (this.historyTimer) clearTimeout(this.historyTimer);

      // Prefer the pip_size the API reports on the tick itself.
      const pip =
        typeof t["pip_size"] === "number" ? (t["pip_size"] as number) : this.pipFor(this.symbol);
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
        lastError: null,
      };

      this.recompute(tick);
      this.tickListeners.forEach((l) => l(tick));
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
    prediction.strategyAgreement = Math.round(
      strategyAgreement(this.snapshot, prediction.targetDigit) * 100,
    );
    this.prediction = prediction;
    this.entry = {
      armed: true,
      confirmed: false,
      confirmedAt: null,
      ticksObserved: 0,
      expired: false,
    };
    this.emit();
    return prediction;
  }

  clearPrediction() {
    this.prediction = null;
    this.entry = {
      armed: false,
      confirmed: false,
      confirmedAt: null,
      ticksObserved: 0,
      expired: false,
    };
    this.emit();
  }

  resetCalibration() {
    this.calibration.reset();
    this.emit();
  }

  /** Last N digits, newest last — powers the live tape. */
  recentDigits(count = 100): number[] {
    return this.buffer.slice(-count).map((t) => t.digit);
  }

  /* ------------------------------------------------------------ subscription */

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Per-tick hook for consumers that must not miss a single tick. */
  onTick(listener: TickListener) {
    this.tickListeners.add(listener);
    return () => {
      this.tickListeners.delete(listener);
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

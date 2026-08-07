import { buildPrediction } from "@/analysis/prediction";
import {
  computeDigitStats,
  computeLiveStatistics,
  computeMarketQuality,
  computeTransitionMatrix,
  extractDigit,
} from "@/analysis/statistics";
import { runStrategies } from "@/analysis/strategies";
import type { AnalysisSnapshot, Prediction, Tick } from "@/analysis/types";
import { ModelCalibrationEngine } from "@/analysis/calibration";
import { ConnectionManager } from "@/websocket/ConnectionManager";
import type { WebSocketManager } from "@/websocket/WebSocketManager";
import type { SymbolMeta } from "@/market/MarketEngine";
import { evaluateTradeEligibility, type EligibilityResult } from "./TradeEligibilityEngine";

const BUFFER_SIZE = 500;
const WINDOW_SIZE = 200;

export type MarketOpportunity = {
  symbol: string;
  displayName: string;
  open: boolean;
  live: boolean;
  lastTickAt: number | null;
  snapshot: AnalysisSnapshot;
  prediction: Prediction | null;
  eligibility: EligibilityResult | null;
  opportunityScore: number;
  status: "warming" | "watching" | "qualified" | "selected" | "unavailable";
};

type SymbolState = {
  meta: SymbolMeta;
  buffer: Tick[];
  processed: number;
  lastTickAt: number | null;
  calibration: ModelCalibrationEngine;
  snapshot: AnalysisSnapshot;
  subscriptionId: string | null;
};

type Listener = () => void;

export class MultiSymbolScanner {
  private socket: WebSocketManager | null = null;
  private unsubscribe: (() => void) | null = null;
  private states = new Map<string, SymbolState>();
  private listeners = new Set<Listener>();
  private minimumConfidence = 90;
  private selectedSymbol: string | null = null;
  version = 0;

  async start(symbols: SymbolMeta[], minimumConfidence: number) {
    this.minimumConfidence = minimumConfidence;
    this.socket = await ConnectionManager.connect();
    this.unsubscribe?.();
    this.unsubscribe = this.socket.subscribe((data) => this.handle(data));

    const available = symbols.filter((symbol) => symbol.open).slice(0, 20);
    this.states.clear();
    for (const meta of available) {
      this.states.set(meta.symbol, {
        meta,
        buffer: [],
        processed: 0,
        lastTickAt: null,
        calibration: new ModelCalibrationEngine(),
        snapshot: this.emptySnapshot(meta.symbol),
        subscriptionId: null,
      });
      this.socket.send({
        ticks_history: meta.symbol,
        end: "latest",
        count: BUFFER_SIZE,
        style: "ticks",
        subscribe: 1,
        passthrough: { scanner_symbol: meta.symbol },
      });
    }
    this.emit();
  }

  stop() {
    for (const state of this.states.values()) {
      if (state.subscriptionId) this.socket?.send({ forget: state.subscriptionId });
    }
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.selectedSymbol = null;
    this.emit();
  }

  setMinimumConfidence(value: number) {
    this.minimumConfidence = value;
    this.emit();
  }

  select(symbol: string | null) {
    this.selectedSymbol = symbol;
    this.emit();
  }

  get opportunities(): MarketOpportunity[] {
    return Array.from(this.states.values())
      .map((state) => this.toOpportunity(state))
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  get strongest() {
    return this.opportunities.find((opportunity) => opportunity.eligibility?.eligible) ?? null;
  }

  private handle(data: Record<string, unknown>) {
    const type = data["msg_type"] as string | undefined;
    if (data["error"]) return;

    if (type === "history") {
      const echo = data["echo_req"] as { passthrough?: { scanner_symbol?: string } } | undefined;
      const passthrough =
        (data["passthrough"] as { scanner_symbol?: string } | undefined) ?? echo?.passthrough;
      const symbol = passthrough?.scanner_symbol;
      if (!symbol) return;
      const state = this.states.get(symbol);
      const history = data["history"] as { prices?: number[]; times?: number[] } | undefined;
      if (!state || !history?.prices?.length) return;
      const prices = history.prices;
      const times = history.times ?? [];
      state.buffer = prices.map((quote, index) => ({
        quote,
        epoch: times[index] ?? Date.now() / 1000,
        digit: extractDigit(quote, state.meta.pip),
        pipSize: state.meta.pip,
        receivedAt: Date.now(),
      }));
      state.processed = state.buffer.length;
      state.lastTickAt = Date.now();
      const subscription = data["subscription"] as { id?: string } | undefined;
      state.subscriptionId = subscription?.id ?? state.subscriptionId;
      this.recompute(state);
      return;
    }

    if (type !== "tick") return;
    const raw = data["tick"] as Record<string, unknown> | undefined;
    if (!raw) return;
    const symbol = typeof raw?.["symbol"] === "string" ? raw["symbol"] : "";
    const quote = raw?.["quote"];
    const state = this.states.get(symbol);
    if (!state || typeof quote !== "number") return;
    const pip = typeof raw["pip_size"] === "number" ? raw["pip_size"] : state.meta.pip;
    const tick: Tick = {
      quote,
      epoch: Number(raw["epoch"] ?? Date.now() / 1000),
      digit: extractDigit(quote, pip),
      pipSize: pip,
      receivedAt: Date.now(),
    };
    state.buffer.push(tick);
    if (state.buffer.length > BUFFER_SIZE) state.buffer.shift();
    state.processed += 1;
    state.lastTickAt = Date.now();
    const subscription = data["subscription"] as { id?: string } | undefined;
    state.subscriptionId = subscription?.id ?? state.subscriptionId;
    this.recompute(state, tick);
  }

  private recompute(state: SymbolState, incoming?: Tick) {
    const ticks = state.buffer.slice(-WINDOW_SIZE);
    const digits = ticks.map((tick) => tick.digit);
    const stats = computeDigitStats(digits);
    const transition = computeTransitionMatrix(digits);
    const live = computeLiveStatistics(ticks, stats, state.processed, 0);
    const strategies = runStrategies({
      digits,
      stats,
      transition,
      noise: live.noise,
      entropy: live.entropy,
      volatility: live.volatility,
    });
    const votes = new Map<number, number>();
    for (const strategy of strategies) votes.set(strategy.best, (votes.get(strategy.best) ?? 0) + 1);
    const agreement = Math.max(0, ...votes.values()) / Math.max(1, strategies.length);
    state.snapshot = {
      symbol: state.meta.symbol,
      window: WINDOW_SIZE,
      digits,
      stats,
      live,
      strategies,
      transition,
      quality: computeMarketQuality(digits, stats, live, WINDOW_SIZE, agreement),
      updatedAt: Date.now(),
    };
    if (incoming) state.calibration.observe(strategies, incoming.digit);
    this.emit();
  }

  private toOpportunity(state: SymbolState): MarketOpportunity {
    const live = Boolean(state.lastTickAt && Date.now() - state.lastTickAt < 15_000);
    const prediction = state.buffer.length >= 100 ? buildPrediction(state.snapshot, state.calibration) : null;
    const eligibility = prediction
      ? evaluateTradeEligibility({
          snapshot: state.snapshot,
          prediction,
          minimumConfidence: this.minimumConfidence,
          feedLive: live,
          marketOpen: state.meta.open,
          calibratedSamples: state.calibration.snapshot().sessionSamples,
        })
      : null;
    const opportunityScore = prediction
      ? Math.round(
          prediction.confidence * 0.35 +
            prediction.strategyAgreement * 0.25 +
            prediction.predictionHealth * 0.2 +
            state.snapshot.quality.overall * 0.2,
        )
      : 0;
    let status: MarketOpportunity["status"] = state.meta.open ? "warming" : "unavailable";
    if (prediction) status = eligibility?.eligible ? "qualified" : "watching";
    if (this.selectedSymbol === state.meta.symbol) status = "selected";
    return {
      symbol: state.meta.symbol,
      displayName: state.meta.displayName,
      open: state.meta.open,
      live,
      lastTickAt: state.lastTickAt,
      snapshot: state.snapshot,
      prediction,
      eligibility,
      opportunityScore,
      status,
    };
  }

  private emptySnapshot(symbol: string): AnalysisSnapshot {
    const stats = computeDigitStats([]);
    const live = computeLiveStatistics([], stats, 0, 0);
    return {
      symbol,
      window: WINDOW_SIZE,
      digits: [],
      stats,
      live,
      strategies: [],
      transition: computeTransitionMatrix([]),
      quality: computeMarketQuality([], stats, live, WINDOW_SIZE, 0),
      updatedAt: Date.now(),
    };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }
}
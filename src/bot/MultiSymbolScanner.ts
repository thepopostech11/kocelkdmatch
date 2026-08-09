import { MarketEngine, emptySnapshot, type SymbolMeta } from "@/market/MarketEngine";
import { evaluateTradeEligibility, type EligibilityResult } from "./TradeEligibilityEngine";
import type { AnalysisSnapshot, Prediction } from "@/analysis/types";

type Listener = () => void;

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

export class MultiSymbolScanner {
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<Listener>();
  private minimumConfidence = 90;
  private selectedSymbol: string | null = null;
  version = 0;

  async start(_symbols: SymbolMeta[], minimumConfidence: number) {
    this.minimumConfidence = minimumConfidence;
    this.selectedSymbol = null;
    this.unsubscribe?.();
    this.unsubscribe = MarketEngine.subscribe(() => this.emit());
    this.emit();
  }

  stop() {
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
    return MarketEngine.symbols
      .map((meta) => this.toOpportunity(meta))
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  get strongest() {
    return this.opportunities.find((opportunity) => opportunity.eligibility?.eligible) ?? null;
  }

  private toOpportunity(meta: SymbolMeta): MarketOpportunity {
    const isActiveSymbol = meta.symbol === MarketEngine.snapshot.symbol;
    const prediction = isActiveSymbol ? MarketEngine.prediction : null;
    const snapshot = isActiveSymbol
      ? MarketEngine.snapshot
      : emptySnapshot(meta.symbol, MarketEngine.snapshot.window);
    const live = isActiveSymbol && Boolean(
      MarketEngine.diagnostics.lastTickAt && Date.now() - MarketEngine.diagnostics.lastTickAt < 15_000,
    );
    const eligibility = prediction
      ? evaluateTradeEligibility({
          snapshot,
          prediction,
          minimumConfidence: this.minimumConfidence,
          feedLive: live,
          marketOpen: meta.open,
          calibratedSamples: MarketEngine.calibration.snapshot().sessionSamples,
        })
      : null;
    const opportunityScore = prediction
      ? Math.round(
          prediction.confidence * 0.35 +
            prediction.strategyAgreement * 0.25 +
            prediction.predictionHealth * 0.2 +
            snapshot.quality.overall * 0.2,
        )
      : 0;
    let status: MarketOpportunity["status"] = meta.open ? "warming" : "unavailable";
    if (prediction) status = eligibility?.eligible ? "qualified" : "watching";
    if (this.selectedSymbol === meta.symbol) status = "selected";
    return {
      symbol: meta.symbol,
      displayName: meta.displayName,
      open: meta.open,
      live,
      lastTickAt: MarketEngine.diagnostics.lastTickAt,
      snapshot,
      prediction,
      eligibility,
      opportunityScore,
      status,
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
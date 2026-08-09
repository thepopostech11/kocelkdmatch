import { MarketEngine } from "@/market/MarketEngine";
import { evaluateTradeEligibility, type EligibilityResult } from "./TradeEligibilityEngine";
import type { AnalysisSnapshot, Prediction } from "@/analysis/types";
import { useAnalysisStateStore, type AnalysisMarketState } from "@/stores/analysisStateStore";

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

  async start(minimumConfidence: number) {
    this.minimumConfidence = minimumConfidence;
    this.selectedSymbol = null;
    this.unsubscribe?.();
    this.unsubscribe = useAnalysisStateStore.subscribe(() => this.emit());
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
    return useAnalysisStateStore
      .getState()
      .markets.map((market) => this.toOpportunity(market))
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  get strongest() {
    return this.opportunities.find((opportunity) => opportunity.eligibility?.eligible) ?? null;
  }

  private toOpportunity(market: AnalysisMarketState): MarketOpportunity {
    const prediction = market.prediction;
    const snapshot = market.snapshot;
    const live = market.isLive;
    const eligibility = prediction
      ? evaluateTradeEligibility({
          snapshot,
          prediction,
          minimumConfidence: this.minimumConfidence,
          feedLive: live,
          marketOpen: market.open,
          calibratedSamples: MarketEngine.calibration.snapshot().sessionSamples,
        })
      : null;
    const opportunityScore = market.opportunityScore;
    let status: MarketOpportunity["status"] = market.open ? "warming" : "unavailable";
    if (prediction) status = eligibility?.eligible ? "qualified" : "watching";
    if (this.selectedSymbol === market.symbol) status = "selected";
    return {
      symbol: market.symbol,
      displayName: market.displayName,
      open: market.open,
      live,
      lastTickAt: market.lastTickAt,
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
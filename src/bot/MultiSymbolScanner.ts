import { MarketEngine, type MarketState } from "@/market/MarketEngine";
import { evaluateTradeEligibility, type EligibilityResult } from "./TradeEligibilityEngine";
import type { AnalysisSnapshot, Prediction } from "@/analysis/types";

type Listener = () => void;

export type MarketOpportunity = {
  symbol: string;
  displayName: string;
  open: boolean;
  live: boolean;
  ready: boolean;
  bufferSize: number;
  lastTickAt: number | null;
  snapshot: AnalysisSnapshot;
  prediction: Prediction | null;
  eligibility: EligibilityResult | null;
  /** Confidence exactly as produced by the shared Analysis Engine. */
  confidence: number;
  opportunityScore: number;
  qualified: boolean;
  status: "warming" | "below-threshold" | "qualified" | "best" | "selected" | "unavailable";
};

/**
 * The Bot's read-only view of the shared Analysis Engine state.
 * It never analyses anything — it filters and ranks what the engine produced.
 */
export class MultiSymbolScanner {
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<Listener>();
  private minimumConfidence = 1;
  private selectedSymbol: string | null = null;
  subscribed = false;
  version = 0;

  async start(_symbols: unknown, minimumConfidence: number) {
    this.minimumConfidence = minimumConfidence;
    this.selectedSymbol = null;
    this.unsubscribe?.();
    this.unsubscribe = MarketEngine.subscribe(() => this.emit());
    this.subscribed = true;
    this.emit();
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.subscribed = false;
    this.selectedSymbol = null;
    this.emit();
  }

  setMinimumConfidence(value: number) {
    this.minimumConfidence = value;
    this.emit();
  }

  get threshold() {
    return this.minimumConfidence;
  }

  select(symbol: string | null) {
    this.selectedSymbol = symbol;
    this.emit();
  }

  /** All shared analysis markets, ranked by the engine's own scores. */
  get opportunities(): MarketOpportunity[] {
    const ranked = MarketEngine.markets
      .map((market) => this.toOpportunity(market))
      .sort((a, b) => {
        if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
        return b.opportunityScore - a.opportunityScore;
      });
    const best = ranked.find((item) => item.qualified);
    return ranked.map((item) => {
      if (this.selectedSymbol === item.symbol) return { ...item, status: "selected" };
      if (best && item.symbol === best.symbol) return { ...item, status: "best" };
      return item;
    });
  }

  /** Same list in a stable display order for the live scanner UI. */
  get markets(): MarketOpportunity[] {
    const byRank = this.opportunities;
    return MarketEngine.markets
      .map((market) => byRank.find((item) => item.symbol === market.symbol))
      .filter((item): item is MarketOpportunity => Boolean(item));
  }

  get strongest() {
    return this.opportunities.find((opportunity) => opportunity.qualified) ?? null;
  }

  private toOpportunity(market: MarketState): MarketOpportunity {
    const { snapshot, prediction } = market;
    const eligibility = prediction
      ? evaluateTradeEligibility({
          snapshot,
          prediction,
          minimumConfidence: this.minimumConfidence,
          feedLive: market.live,
          marketOpen: market.open,
          calibratedSamples: MarketEngine.calibration.snapshot().sessionSamples,
        })
      : null;
    // Confidence is taken verbatim from the Analysis Engine — never adjusted.
    const confidence = prediction?.confidence ?? 0;
    // This is the Analysis Engine's own opportunity output. The Bot does not
    // manufacture a competing score or confidence system.
    const opportunityScore = prediction?.entryOpportunity ?? 0;
    const qualified = Boolean(
      prediction && confidence >= this.minimumConfidence && eligibility?.eligible,
    );

    let status: MarketOpportunity["status"] = "warming";
    if (!market.open) status = "unavailable";
    else if (!prediction) status = "warming";
    else if (qualified) status = "qualified";
    else status = "below-threshold";

    return {
      symbol: market.symbol,
      displayName: market.displayName,
      open: market.open,
      live: market.live,
      ready: market.ready,
      bufferSize: market.bufferSize,
      lastTickAt: market.lastTickAt,
      snapshot,
      prediction,
      eligibility,
      confidence,
      opportunityScore,
      qualified,
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

import { MarketEngine } from "@/market/MarketEngine";

/**
 * AnalysisState — a minimal read-only adapter that exposes the authoritative
 * MarketEngine surface as a single shared API for consumers like the Bot.
 *
 * This intentionally does not duplicate analysis logic; it only forwards
 * getters and subscription hooks so callers can rely on one stable entrypoint.
 */
export const AnalysisState = {
  get symbols() {
    return MarketEngine.symbols;
  },
  get snapshot() {
    return MarketEngine.snapshot;
  },
  get prediction() {
    return MarketEngine.prediction;
  },
  get entry() {
    return MarketEngine.entry;
  },
  get calibration() {
    return MarketEngine.calibration;
  },
  get diagnostics() {
    return MarketEngine.diagnostics;
  },
  subscribe(listener: () => void) {
    return MarketEngine.subscribe(listener);
  },
  onTick(listener: (t: any) => void) {
    return MarketEngine.onTick(listener);
  },
};

export default AnalysisState;

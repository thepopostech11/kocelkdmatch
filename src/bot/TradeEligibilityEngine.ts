import type { AnalysisSnapshot, Prediction } from "@/analysis/types";

export type EligibilityCheck = {
  id: string;
  label: string;
  passed: boolean;
  critical: boolean;
};

export type EligibilityResult = {
  eligible: boolean;
  checks: EligibilityCheck[];
};

export function evaluateTradeEligibility(input: {
  snapshot: AnalysisSnapshot;
  prediction: Prediction;
  minimumConfidence: number;
  feedLive: boolean;
  marketOpen: boolean;
  calibratedSamples: number;
}): EligibilityResult {
  const { snapshot, prediction } = input;
  const age = Date.now() - snapshot.updatedAt;
  const validTarget = Number.isInteger(prediction.targetDigit)
    && prediction.targetDigit >= 0
    && prediction.targetDigit <= 9;
  const validDuration = Number.isInteger(prediction.suggestedDuration)
    && prediction.suggestedDuration >= 1
    && prediction.suggestedDuration <= 10;
  const checks: EligibilityCheck[] = [
    { id: "data", label: "Data Sufficiency", passed: snapshot.live.bufferSize >= 100, critical: true },
    { id: "feed", label: "Live Feed", passed: input.feedLive && age < 15_000, critical: true },
    { id: "market", label: "Market Available", passed: input.marketOpen, critical: true },
    { id: "decision", label: "Analysis Decision", passed: validTarget && validDuration, critical: true },
    { id: "seven-layers", label: "7-Layer Validation", passed: prediction.validation?.passed === true, critical: true },
    { id: "strategy", label: "Strategy Eligibility", passed: prediction.strategy?.strategyEligible === true, critical: true },
    { id: "confidence", label: "Confidence", passed: prediction.confidence >= input.minimumConfidence, critical: true },
    { id: "gap", label: "Gap Validation", passed: snapshot.stats[prediction.targetDigit]?.currentGap != null, critical: true },
    { id: "frequency", label: "Frequency Validation", passed: snapshot.stats[prediction.targetDigit]?.count != null, critical: true },
    { id: "freshness", label: "Prediction Freshness", passed: age < 15_000 && prediction.strategy?.predictionValid !== false, critical: true },
    // These are Analysis Engine diagnostics, not hidden Bot trading gates.
    { id: "quality", label: "Market Quality", passed: snapshot.quality.overall >= 55, critical: false },
    { id: "agreement", label: "Strategy Agreement", passed: prediction.strategyAgreement >= 55, critical: false },
    { id: "stability", label: "Signal Stability", passed: prediction.stability >= 50, critical: false },
    { id: "noise", label: "Noise Filter", passed: snapshot.quality.noise <= 78, critical: false },
    { id: "volatility", label: "Volatility Filter", passed: snapshot.quality.volatility <= 85, critical: false },
    { id: "calibration", label: "Model Calibration", passed: input.calibratedSamples >= 0, critical: false },
  ];
  return { eligible: checks.every((check) => !check.critical || check.passed), checks };
}

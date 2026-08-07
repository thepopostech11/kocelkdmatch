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
  const checks: EligibilityCheck[] = [
    { id: "data", label: "Data Sufficiency", passed: snapshot.live.bufferSize >= 100, critical: true },
    { id: "feed", label: "Live Feed", passed: input.feedLive && age < 15_000, critical: true },
    { id: "market", label: "Market Available", passed: input.marketOpen, critical: true },
    { id: "quality", label: "Market Quality", passed: snapshot.quality.overall >= 55, critical: true },
    { id: "agreement", label: "Strategy Agreement", passed: prediction.strategyAgreement >= 55, critical: true },
    { id: "confidence", label: "Confidence", passed: prediction.confidence >= input.minimumConfidence, critical: true },
    { id: "stability", label: "Signal Stability", passed: prediction.stability >= 50, critical: true },
    { id: "noise", label: "Noise Filter", passed: snapshot.quality.noise <= 78, critical: true },
    { id: "volatility", label: "Volatility Filter", passed: snapshot.quality.volatility <= 85, critical: true },
    { id: "gap", label: "Gap Validation", passed: snapshot.stats[prediction.targetDigit]?.currentGap != null, critical: true },
    { id: "frequency", label: "Frequency Validation", passed: snapshot.stats[prediction.targetDigit]?.count != null, critical: true },
    { id: "freshness", label: "Prediction Freshness", passed: age < 15_000, critical: true },
    { id: "calibration", label: "Model Calibration", passed: input.calibratedSamples >= 0, critical: false },
  ];
  return { eligible: checks.every((check) => !check.critical || check.passed), checks };
}
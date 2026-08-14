import type { AnalysisSnapshot, Prediction } from "./types";

type LayerResult = {
  name: string;
  passed: boolean;
  score: number;
  threshold: number;
};

export function validate7Layers(snapshot: AnalysisSnapshot, prediction: Prediction) {
  const s = prediction.strategy;
  const stat = snapshot.stats[prediction.targetDigit];
  const components = s?.components ?? {};

  const layers: LayerResult[] = [];

  // Layer 1: Digit Frequency
  const freq = stat?.percentage ?? 0;
  const minFreq = 12;
  layers.push({ name: "Digit Frequency", passed: freq >= minFreq, score: freq, threshold: minFreq });

  // Layer 2: Gap / Drought
  const gapScore = components.gapScore ?? 0;
  layers.push({ name: "Gap / Drought", passed: gapScore >= 35, score: gapScore, threshold: 35 });

  // Layer 3: Repeat / Recurrence
  const repeatScore = components.repeatScore ?? 0;
  layers.push({ name: "Repeat / Recurrence", passed: repeatScore >= 20, score: repeatScore, threshold: 20 });

  // Layer 4: Frequency Momentum
  const momentum = components.momentumScore ?? 0;
  layers.push({ name: "Frequency Momentum", passed: momentum >= 30, score: momentum, threshold: 30 });

  // Layer 5: Multi-Window Consensus
  const agreement = prediction.strategyAgreement ?? 0;
  layers.push({ name: "Multi-Window Consensus", passed: agreement >= 40, score: agreement, threshold: 40 });

  // Layer 6: Tick-Duration Probability (transition strength)
  const transition = components.transitionScore ?? 0;
  layers.push({ name: "Tick-Duration Probability", passed: transition >= 25, score: transition, threshold: 25 });

  // Layer 7: Distribution Validation (market quality)
  const quality = snapshot.quality?.overall ?? snapshot.quality?.entropy ?? 0;
  const qualityScore = snapshot.quality?.entropy ? 100 - snapshot.quality.entropy : (snapshot.quality?.overall ?? 0);
  layers.push({ name: "Distribution Validation", passed: qualityScore >= 30, score: qualityScore, threshold: 30 });

  const passed = layers.every((l) => l.passed);

  return {
    passed,
    layers,
    summary: {
      confidence: prediction.confidence,
      marketQuality: snapshot.quality?.overall ?? prediction.marketQuality,
    },
  };
}

export type ValidatorResult = ReturnType<typeof validate7Layers>;

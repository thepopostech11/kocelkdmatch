import type { AnalysisSnapshot, Prediction } from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type LayerResult = {
  name: string;
  status: "PASS" | "FAIL" | "ANALYZING";
  score: number;
  threshold: number;
  reason: string;
  metrics: Record<string, number | string>;
  timestamp: number;
};

function buildLayer(
  name: string,
  score: number,
  threshold: number,
  pass: boolean,
  reason: string,
  metrics: Record<string, number | string>,
): LayerResult {
  return {
    name,
    status: pass ? "PASS" : "FAIL",
    score: clamp(Math.round(score), 0, 100),
    threshold,
    reason,
    metrics,
    timestamp: Date.now(),
  };
}

export function validate7Layers(snapshot: AnalysisSnapshot, prediction: Prediction) {
  const targetDigit = prediction.targetDigit;
  const safeSnapshot = snapshot ?? ({} as AnalysisSnapshot);
  const safeStats = safeSnapshot.stats ?? [];
  const safeQuality = safeSnapshot.quality ?? { overall: 0, entropy: 0, dataSufficiency: 0 };
  const safeLive = safeSnapshot.live ?? { currentDigit: 0, bufferSize: 0 };
  const safeTransition = safeSnapshot.transition ?? [];

  const stat = safeStats[targetDigit] ?? null;
  const digits = safeSnapshot.digits ?? [];
  const history = safeSnapshot.history?.length ? safeSnapshot.history : digits;
  const totalTicks = history.length || digits.length || 1;
  const currentDigit = safeLive.currentDigit ?? 0;
  const transitionValue = Array.isArray(safeTransition[currentDigit]) ? safeTransition[currentDigit][targetDigit] ?? 0 : 0;

  const recentWindow = history.slice(-50);
  const mediumWindow = history.slice(-Math.max(100, safeSnapshot.window || 100));
  const longWindow = history.slice(-Math.max(250, safeSnapshot.window * 3 || 250));

  const recentPct = recentWindow.length ? (recentWindow.filter((d) => d === targetDigit).length / recentWindow.length) * 100 : 0;
  const mediumPct = mediumWindow.length ? (mediumWindow.filter((d) => d === targetDigit).length / mediumWindow.length) * 100 : 0;
  const longPct = longWindow.length ? (longWindow.filter((d) => d === targetDigit).length / longWindow.length) * 100 : 0;
  const momentumScore = clamp(((recentPct - longPct) + 20) * 2.5, 0, 100);

  const repeatWindow = history.slice(-30);
  const repeatHits = repeatWindow.filter((d) => d === targetDigit).length;
  const repeatScore = clamp((repeatHits / Math.max(repeatWindow.length, 1)) * 100, 0, 100);

  const frequencyScore = clamp((stat?.percentage ?? 0), 0, 100);
  const frequencyPass = frequencyScore >= 12;

  const gapMetric = stat ? Math.abs(Math.max(0, stat.currentGap - stat.averageGap)) : 0;
  const gapScore = clamp(100 - (gapMetric / Math.max(1, stat?.averageGap ?? 1)) * 65, 0, 100);
  const gapPass = gapScore >= 35;

  const recurrenceScore = repeatScore;
  const recurrencePass = recurrenceScore >= 20;

  const momentumPass = momentumScore >= 30;

  const multiWindowWindow = [recentWindow, mediumWindow, longWindow]
    .map((window) => ({ length: window.length, pct: window.length ? (window.filter((d) => d === targetDigit).length / window.length) * 100 : 0 }))
    .filter((entry) => entry.length > 0);
  const consensusScore = multiWindowWindow.length
    ? (multiWindowWindow.reduce((total, entry) => total + entry.pct, 0) / multiWindowWindow.length)
    : 0;
  const consensusPass = consensusScore >= 12;

  const durationProbability = clamp((transitionValue ?? 0) * 100 + (frequencyScore * 0.25), 0, 100);
  const durationPass = durationProbability >= 25;

  const distributionScore = clamp(
    (safeQuality.overall * 0.5) +
      ((100 - (safeQuality.entropy || 0)) * 0.3) +
      ((safeQuality.dataSufficiency ?? 0) * 0.2),
    0,
    100,
  );
  const distributionPass = distributionScore >= 35;

  const layers: LayerResult[] = [
    buildLayer(
      "Digit Frequency",
      frequencyScore,
      12,
      frequencyPass,
      `Digit ${targetDigit} appears ${stat?.count ?? 0} times in ${totalTicks} ticks (${frequencyScore.toFixed(1)}%).`,
      { digit: targetDigit, count: stat?.count ?? 0, percentage: frequencyScore },
    ),
    buildLayer(
      "Gap / Drought",
      gapScore,
      35,
      gapPass,
      `Gap behaviour is ${gapScore.toFixed(1)}% of the ideal range; current gap ${stat?.currentGap ?? 0} vs average ${stat?.averageGap ?? 0}.`,
      { currentGap: stat?.currentGap ?? 0, averageGap: stat?.averageGap ?? 0, score: gapScore },
    ),
    buildLayer(
      "Repeat / Recurrence",
      recurrenceScore,
      20,
      recurrencePass,
      `Recent recurrence hit rate is ${recurrenceScore.toFixed(1)}% within the short recurrence window.`,
      { repeatHits, windowSize: repeatWindow.length, score: recurrenceScore },
    ),
    buildLayer(
      "Frequency Momentum",
      momentumScore,
      30,
      momentumPass,
      `Short-window momentum is ${momentumScore.toFixed(1)}% vs ${longPct.toFixed(1)}% long-window baseline.`,
      { recentPct, longPct, score: momentumScore },
    ),
    buildLayer(
      "Multi-Window Consensus",
      consensusScore,
      12,
      consensusPass,
      `Consensus across recent windows is ${consensusScore.toFixed(1)}% for digit ${targetDigit}.`,
      { recentPct, mediumPct, longPct, score: consensusScore },
    ),
    buildLayer(
      "Tick-Duration Probability",
      durationProbability,
      25,
      durationPass,
      `The live transition + duration likelihood for digit ${targetDigit} is ${durationProbability.toFixed(1)}%.`,
      { transitionProbability: transitionValue * 100, duration: prediction.suggestedDuration, score: durationProbability },
    ),
    buildLayer(
      "Distribution Validation",
      distributionScore,
      35,
      distributionPass,
      `Market distribution score is ${distributionScore.toFixed(1)}% with entropy ${(safeQuality.entropy ?? 0).toFixed(1)}%.`,
      { overall: safeQuality.overall, entropy: safeQuality.entropy ?? 0, score: distributionScore },
    ),
  ];

  const passed = layers.every((layer) => layer.status === "PASS");

  return {
    passed,
    layers,
    summary: {
      passedLayers: layers.filter((layer) => layer.status === "PASS").length,
      failedLayers: layers.filter((layer) => layer.status === "FAIL").length,
      confidence: prediction.confidence,
      marketQuality: safeQuality.overall ?? prediction.marketQuality,
      targetDigit,
      predictedTicks: prediction.suggestedDuration,
      noTrade: !passed,
    },
  };
}

export type ValidatorResult = ReturnType<typeof validate7Layers>;

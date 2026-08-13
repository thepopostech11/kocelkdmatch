/**
 * KOCEL MATCHES STRATEGY ENGINE — the single source of strategy truth.
 *
 * It consumes ONLY the existing live analysis snapshot (digits, history,
 * statistics, transition matrix, quality) produced by the shared Analysis
 * Engine. It never fetches ticks, never opens sockets and never executes.
 *
 * Components (each votes independently):
 *   A. Rolling frequency          G. Transition behaviour
 *   B. Short-term frequency       H. Distribution stability
 *   C. Weighted recent frequency  I. Entropy / noise
 *   D. Frequency momentum         J. Signal persistence
 *   E. Drought / gap behaviour    K. Multi-window agreement
 *   F. Repeat behaviour           L. Prediction freshness
 *
 * The engine is allowed — and expected — to return NO TRADE.
 */
import { DIGITS } from "./statistics";
import type { AnalysisSnapshot } from "./types";
import type { ModelCalibrationEngine } from "./calibration";
import { useSettingsStore } from "@/stores/settingsStore";

export type StrategySettings = {
  /** Minimum frequency (%) the selected target digit must reach. */
  minHighestFrequency: number;
  /** Fallback / maximum contract duration in ticks. */
  duration: number;
  /** Maximum recovery attempts (0 or 1). */
  maxRecoveryAttempts: number;
  /** How many ticks a generated opportunity stays valid. */
  signalExpirationTicks: number;
  /** Minimum signal stability (%) required before trading. */
  minSignalStability: number;
};

export type StrategySignalStatus =
  | "NO TRADE"
  | "WAITING FOR ENTRY"
  | "WAITING FOR RECOVERY ENTRY"
  | "SIGNAL EXPIRED";

export type StrategyComponentScores = {
  frequencyScore: number;
  weightedFrequencyScore: number;
  momentumScore: number;
  transitionScore: number;
  gapScore: number;
  repeatScore: number;
  entropyScore: number;
  distributionScore: number;
  stabilityScore: number;
  agreementScore: number;
  separationScore: number;
};

export type StrategyDecision = {
  symbol: string;
  strategyEligible: boolean;
  eligible: boolean;
  targetDigit: number;
  entryTrigger: number;
  /** Backwards-compatible aliases used by the existing prediction/bot layers. */
  firstEntryDigit: number;
  recoveryEntryDigit: number;
  highestDigitFrequency: number;
  secondHighestDigitFrequency: number;
  lowestDigitFrequency: number;
  attempt: number;
  recommendedDuration: number;
  signalStatus: StrategySignalStatus;
  confidence: number;
  rawConfidence: number;
  opportunityScore: number;
  marketQuality: number;
  signalStability: number;
  strategyAgreement: number;
  separation: number;
  predictionTimestamp: number;
  predictionAge: number;
  validUntilTicks: number;
  predictionValid: boolean;
  scores: number[];
  components: StrategyComponentScores;
  windowFrequencies: { window: number; percentage: number; rank: number }[];
  rejectionReasons: string[];
};

export function getStrategySettings(): StrategySettings {
  const s = useSettingsStore.getState();
  return {
    minHighestFrequency: s.strategyMinHighestFrequency,
    duration: s.strategyDuration,
    maxRecoveryAttempts: s.strategyMaxRecoveryAttempts,
    signalExpirationTicks: s.strategySignalExpirationTicks,
    minSignalStability: s.strategyMinSignalStability,
  };
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const UNIFORM = 10; // % expected frequency per digit

const SHORT_WINDOW = 50;
const MEDIUM_WINDOW = 100;
const LONG_WINDOW = 500;
/** Recency half-life (ticks) for the weighted frequency model. */
const HALF_LIFE = 120;

/* ------------------------------------------------------------------ helpers */

function frequencies(digits: number[]): number[] {
  const counts = DIGITS.map(() => 0);
  for (const d of digits) if (d >= 0 && d <= 9) counts[d] = counts[d]! + 1;
  const n = digits.length || 1;
  return counts.map((c) => (c / n) * 100);
}

function ranksOf(percentages: number[]): number[] {
  const order = DIGITS.slice().sort((a, b) => percentages[b]! - percentages[a]!);
  const ranks = DIGITS.map(() => 10);
  order.forEach((digit, index) => {
    ranks[digit] = index + 1;
  });
  return ranks;
}

/** Exponentially weighted frequency — recent ticks matter more, never dominate. */
function weightedFrequencies(digits: number[]): number[] {
  const totals = DIGITS.map(() => 0);
  let weightSum = 0;
  const n = digits.length;
  for (let i = 0; i < n; i += 1) {
    const age = n - 1 - i;
    const weight = 0.25 + Math.pow(0.5, age / HALF_LIFE); // floor keeps old data alive
    const d = digits[i]!;
    if (d >= 0 && d <= 9) totals[d] = totals[d]! + weight;
    weightSum += weight;
  }
  return weightSum ? totals.map((t) => (t / weightSum) * 100) : DIGITS.map(() => UNIFORM);
}

/** Short-term recurrence: how often the digit came back within 6 ticks lately. */
function repeatStrength(digits: number[]): number[] {
  const recent = digits.slice(-120);
  const scores = DIGITS.map(() => 0);
  const lastSeen = DIGITS.map(() => -1);
  for (let i = 0; i < recent.length; i += 1) {
    const d = recent[i]!;
    if (d < 0 || d > 9) continue;
    const previous = lastSeen[d]!;
    if (previous >= 0 && i - previous <= 6) scores[d] = scores[d]! + 1;
    lastSeen[d] = i;
  }
  const max = Math.max(1, ...scores);
  return scores.map((s) => (s / max) * 100);
}

/* --------------------------------------------------- signal stability memory */

type StabilityMemory = { targets: number[]; lastUpdatedAt: number };
const stabilityMemory = new Map<string, StabilityMemory>();

function trackStability(symbol: string, target: number, updatedAt: number): number {
  const memory = stabilityMemory.get(symbol) ?? { targets: [], lastUpdatedAt: 0 };
  if (updatedAt !== memory.lastUpdatedAt) {
    memory.targets = [...memory.targets, target].slice(-12);
    memory.lastUpdatedAt = updatedAt;
    stabilityMemory.set(symbol, memory);
  }
  if (memory.targets.length < 3) return 45; // unknown yet — neutral-low
  const same = memory.targets.filter((t) => t === target).length;
  return clamp((same / memory.targets.length) * 100, 0, 100);
}

export function resetStrategyMemory() {
  stabilityMemory.clear();
}

/* ------------------------------------------------------------------- engine */

export function evaluateStrategy(
  snapshot: AnalysisSnapshot,
  settings: StrategySettings = getStrategySettings(),
  attempt = 1,
  calibration?: ModelCalibrationEngine,
): StrategyDecision {
  const rejectionReasons: string[] = [];
  const history = (snapshot.history?.length ? snapshot.history : snapshot.digits) ?? [];
  const digits = snapshot.digits ?? [];
  const now = Date.now();
  const age = now - snapshot.updatedAt;
  const bufferSize = snapshot.live.bufferSize;

  const shortDigits = history.slice(-SHORT_WINDOW);
  const mediumDigits = history.slice(-Math.max(MEDIUM_WINDOW, snapshot.window || MEDIUM_WINDOW));
  const longDigits = history.slice(-LONG_WINDOW);

  const shortFreq = frequencies(shortDigits);
  const mediumFreq = frequencies(mediumDigits);
  const longFreq = frequencies(longDigits);
  const weighted = weightedFrequencies(longDigits);
  const repeats = repeatStrength(history);

  const shortRank = ranksOf(shortFreq);
  const mediumRank = ranksOf(mediumFreq);
  const longRank = ranksOf(longFreq);

  const currentDigit = snapshot.live.currentDigit;
  const transitionRow = snapshot.transition[currentDigit] ?? DIGITS.map(() => 0.1);

  const entropyEdge = clamp((100 - snapshot.quality.entropy) * 10, 0, 100); // low entropy = structure
  const noisePenalty = clamp(snapshot.quality.noise, 0, 100);
  const distribution = clamp(100 - Math.abs(snapshot.quality.distributionBalance - 100), 0, 100);

  /* ---- per-digit combined probability model ---- */
  const scores = DIGITS.map((d) => {
    const stat = snapshot.stats[d];
    const freq = mediumFreq[d]!;
    const w = weighted[d]!;
    const momentum = shortFreq[d]! - longFreq[d]!;
    const agreement =
      (shortRank[d]! <= 3 ? 1 : 0) + (mediumRank[d]! <= 3 ? 1 : 0) + (longRank[d]! <= 3 ? 1 : 0);
    const transition = (transitionRow[d] ?? 0.1) * 100;
    const gapRatio = stat && stat.averageGap > 0 ? stat.currentGap / stat.averageGap : 1;
    // Gap is a mild feature only — no gambler's fallacy.
    const gap = clamp(100 - Math.abs(gapRatio - 1) * 45, 0, 100);
    const repeat = repeats[d]!;

    return (
      clamp((freq - UNIFORM) * 12 + 50, 0, 100) * 0.2 +
      clamp((w - UNIFORM) * 12 + 50, 0, 100) * 0.15 +
      clamp(momentum * 10 + 50, 0, 100) * 0.12 +
      (agreement / 3) * 100 * 0.15 +
      clamp((transition - UNIFORM) * 8 + 50, 0, 100) * 0.16 +
      gap * 0.07 +
      repeat * 0.07 +
      distribution * 0.04 +
      clamp(entropyEdge, 0, 100) * 0.04 -
      noisePenalty * 0.05
    );
  });

  const ordered = DIGITS.slice().sort((a, b) => scores[b]! - scores[a]!);
  const target = ordered[0]!;
  const runnerUp = ordered[1]!;
  const separation = scores[target]! - scores[runnerUp]!;

  /* ---- component votes (strategy agreement) ---- */
  const votes = [
    ordered[0],
    DIGITS.slice().sort((a, b) => shortFreq[b]! - shortFreq[a]!)[0],
    DIGITS.slice().sort((a, b) => mediumFreq[b]! - mediumFreq[a]!)[0],
    DIGITS.slice().sort((a, b) => weighted[b]! - weighted[a]!)[0],
    DIGITS.slice().sort((a, b) => shortFreq[b]! - longFreq[b]! - (shortFreq[a]! - longFreq[a]!))[0],
    DIGITS.slice().sort((a, b) => (transitionRow[b] ?? 0) - (transitionRow[a] ?? 0))[0],
    DIGITS.slice().sort((a, b) => repeats[b]! - repeats[a]!)[0],
  ];
  const strategyAgreement = clamp(
    (votes.filter((v) => v === target).length / votes.length) * 100,
    0,
    100,
  );

  /* ---- entry trigger: which current digit best leads into the target ---- */
  const triggerCandidates = DIGITS.map((d) => {
    const into = (snapshot.transition[d]?.[target] ?? 0) * 100;
    const availability = mediumFreq[d]!; // the trigger must actually occur
    const edge = into - UNIFORM;
    return { digit: d, into, availability, score: edge * 3 + clamp(availability, 0, 30) };
  }).sort((a, b) => b.score - a.score);
  const trigger = triggerCandidates[0]!;
  const triggerValid = trigger.into >= UNIFORM * 1.1 && trigger.availability >= 4;

  // Recovery trigger — the next best independent path into the SAME target.
  const recoveryTrigger = (triggerCandidates.find((c) => c.digit !== trigger.digit) ?? trigger).digit;

  /* ---- duration: pick the horizon with the strongest expected persistence ---- */
  const blended = (mediumFreq[target]! * 0.5 + weighted[target]! * 0.3 + shortFreq[target]! * 0.2) / 100;
  const pTrigger = (snapshot.transition[trigger.digit]?.[target] ?? blended);
  const maxDuration = clamp(Math.round(settings.duration) || 3, 1, 5);
  let recommendedDuration = 1;
  let bestExpected = -1;
  for (let n = 1; n <= Math.max(1, maxDuration); n += 1) {
    const decay = 1 / n;
    const expected = pTrigger * decay + blended * (1 - decay) - (n - 1) * 0.0015;
    if (expected > bestExpected + 1e-9) {
      bestExpected = expected;
      recommendedDuration = n;
    }
  }

  /* ---- market quality + stability ---- */
  const signalStability = trackStability(snapshot.symbol, target, snapshot.updatedAt);
  const dataSufficiency = clamp((history.length / LONG_WINDOW) * 100, 0, 100);
  const marketQuality = clamp(
    snapshot.quality.overall * 0.35 +
      snapshot.quality.frequencyStability * 0.15 +
      signalStability * 0.15 +
      strategyAgreement * 0.15 +
      clamp(separation * 6, 0, 100) * 0.1 +
      dataSufficiency * 0.1 -
      snapshot.quality.noise * 0.05,
    0,
    100,
  );

  /* ---- confidence (weighted per component, then calibrated) ---- */
  const components: StrategyComponentScores = {
    frequencyScore: clamp((mediumFreq[target]! - UNIFORM) * 14 + 40, 0, 100),
    weightedFrequencyScore: clamp((weighted[target]! - UNIFORM) * 14 + 40, 0, 100),
    momentumScore: clamp((shortFreq[target]! - longFreq[target]!) * 12 + 50, 0, 100),
    transitionScore: clamp((pTrigger * 100 - UNIFORM) * 9 + 40, 0, 100),
    gapScore: (() => {
      const stat = snapshot.stats[target];
      const ratio = stat && stat.averageGap > 0 ? stat.currentGap / stat.averageGap : 1;
      return clamp(100 - Math.abs(ratio - 1) * 45, 0, 100);
    })(),
    repeatScore: repeats[target]!,
    entropyScore: entropyEdge,
    distributionScore: distribution,
    stabilityScore: signalStability,
    agreementScore: strategyAgreement,
    separationScore: clamp(separation * 8, 0, 100),
  };

  const multiWindowAgreement = clamp(
    100 -
      (Math.max(shortRank[target]!, mediumRank[target]!, longRank[target]!) - 1) * 14,
    0,
    100,
  );

  const rawConfidence = clamp(
    components.frequencyScore * 0.2 +
      multiWindowAgreement * 0.15 +
      components.weightedFrequencyScore * 0.1 +
      components.momentumScore * 0.1 +
      components.transitionScore * 0.15 +
      components.gapScore * 0.05 +
      components.repeatScore * 0.05 +
      components.distributionScore * 0.05 +
      components.entropyScore * 0.05 +
      components.stabilityScore * 0.1,
    0,
    98,
  );

  // Real penalties — weak separation and stale/noisy data must cost confidence.
  const separationFactor = clamp(0.45 + separation * 0.09, 0.45, 1);
  const dataFactor = clamp(0.5 + (dataSufficiency / 100) * 0.5, 0.5, 1);
  const freshnessFactor = clamp(1 - age / 20_000, 0.3, 1);
  const noiseFactor = clamp(1 - snapshot.quality.noise / 260, 0.6, 1);
  let confidence = rawConfidence * separationFactor * dataFactor * freshnessFactor * noiseFactor;

  // Historical calibration by confidence bucket (uses the existing engine).
  const calibrated = calibration?.calibrateConfidence(confidence);
  if (typeof calibrated === "number") confidence = calibrated;
  confidence = Math.round(clamp(confidence, 0, 98));

  /* ---- no-trade engine ---- */
  if (bufferSize < 100) rejectionReasons.push(`Only ${bufferSize} ticks analysed — waiting for a full window.`);
  if (history.length < SHORT_WINDOW) rejectionReasons.push("Insufficient tick history for multi-window analysis.");
  if (age > 15_000) rejectionReasons.push("Analysis data is stale.");
  if (mediumFreq[target]! < settings.minHighestFrequency) {
    rejectionReasons.push(
      `TARGET FREQUENCY BELOW ${settings.minHighestFrequency}% (currently ${mediumFreq[target]!.toFixed(1)}%).`,
    );
  }
  if (separation < 1.2) rejectionReasons.push("No meaningful probability separation between the top digits.");
  if (strategyAgreement < 30) rejectionReasons.push("Model components disagree on the target digit.");
  if (snapshot.quality.entropy > 99.2) rejectionReasons.push("Distribution is effectively uniform — no exploitable edge.");
  if (snapshot.quality.noise > 88) rejectionReasons.push("Market noise is too high for a reliable MATCH signal.");
  if (!triggerValid) rejectionReasons.push("No statistically useful entry trigger is available.");
  if (signalStability < Math.max(settings.minSignalStability, 25)) {
    rejectionReasons.push(
      `Signal stability ${Math.round(signalStability)}% is below the required ${Math.max(settings.minSignalStability, 25)}%.`,
    );
  }
  if (marketQuality < 35) rejectionReasons.push("Market quality is unsuitable for this strategy.");

  const predictionValid = age <= 15_000;
  if (!predictionValid) rejectionReasons.push("Prediction is no longer valid.");

  const eligible = rejectionReasons.length === 0;
  const entryDigit = attempt >= 2 ? recoveryTrigger : trigger.digit;

  const opportunityScore = Math.round(
    clamp(confidence * 0.5 + marketQuality * 0.2 + strategyAgreement * 0.15 + signalStability * 0.15, 0, 100),
  );

  const orderedFreq = DIGITS.slice().sort((a, b) => mediumFreq[b]! - mediumFreq[a]!);

  return {
    symbol: snapshot.symbol,
    strategyEligible: eligible,
    eligible,
    targetDigit: target,
    entryTrigger: entryDigit,
    firstEntryDigit: trigger.digit,
    recoveryEntryDigit: recoveryTrigger,
    highestDigitFrequency: mediumFreq[target]!,
    secondHighestDigitFrequency: mediumFreq[orderedFreq[1]!]!,
    lowestDigitFrequency: mediumFreq[orderedFreq[9]!]!,
    attempt,
    recommendedDuration,
    signalStatus: eligible
      ? attempt >= 2
        ? "WAITING FOR RECOVERY ENTRY"
        : "WAITING FOR ENTRY"
      : predictionValid
        ? "NO TRADE"
        : "SIGNAL EXPIRED",
    confidence,
    rawConfidence: Math.round(rawConfidence),
    opportunityScore,
    marketQuality: Math.round(marketQuality),
    signalStability: Math.round(signalStability),
    strategyAgreement: Math.round(strategyAgreement),
    separation: Number(separation.toFixed(2)),
    predictionTimestamp: snapshot.updatedAt,
    predictionAge: age,
    validUntilTicks: Math.max(recommendedDuration, settings.signalExpirationTicks),
    predictionValid,
    scores,
    components,
    windowFrequencies: [
      { window: SHORT_WINDOW, percentage: shortFreq[target]!, rank: shortRank[target]! },
      { window: mediumDigits.length, percentage: mediumFreq[target]!, rank: mediumRank[target]! },
      { window: longDigits.length, percentage: longFreq[target]!, rank: longRank[target]! },
    ],
    rejectionReasons,
  };
}

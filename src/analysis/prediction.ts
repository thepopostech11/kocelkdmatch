/**
 * Unified AI Decision Engine — fuses every strategy into a single
 * recommendation package (target digit, entry trigger, duration, reasoning).
 */
import { DIGITS } from "./statistics";
import type { ModelCalibrationEngine } from "./calibration";
import type { AnalysisSnapshot, Prediction } from "./types";

export function fuseScores(
  snapshot: AnalysisSnapshot,
  calibration: ModelCalibrationEngine,
): number[] {
  const totals = DIGITS.map(() => 0);
  let weightSum = 0;
  for (const strategy of snapshot.strategies) {
    const weight = calibration.weightFor(strategy.id);
    weightSum += weight;
    for (const d of DIGITS) totals[d] = totals[d]! + strategy.scores[d]! * weight;
  }
  return weightSum ? totals.map((t) => t / weightSum) : totals;
}

/** Strategy agreement = share of models whose top pick equals the consensus. */
export function strategyAgreement(snapshot: AnalysisSnapshot, target: number): number {
  if (!snapshot.strategies.length) return 0;
  const agree = snapshot.strategies.filter((s) => s.best === target).length;
  return agree / snapshot.strategies.length;
}

/**
 * Entry trigger — the digit whose appearance historically precedes the target
 * most strongly. Derived from the transition matrix column of the target,
 * tempered by how often that trigger actually shows up.
 */
function deriveEntryTrigger(snapshot: AnalysisSnapshot, target: number) {
  const scored = DIGITS.map((d) => {
    const probability = snapshot.transition[d]?.[target] ?? 0.1;
    const availability = (snapshot.stats[d]?.percentage ?? 10) / 100;
    const freshness = 1 / (1 + (snapshot.stats[d]?.currentGap ?? 0) / 25);
    return { digit: d, score: probability * 0.65 + availability * 0.2 + freshness * 0.15, probability };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0]!;
  return { digit: top.digit, probability: top.probability, score: top.score };
}

export function buildPrediction(
  snapshot: AnalysisSnapshot,
  calibration: ModelCalibrationEngine,
): Prediction {
  const fused = fuseScores(snapshot, calibration);
  const ordered = DIGITS.map((d) => ({ digit: d, score: fused[d]! })).sort((a, b) => b.score - a.score);
  const target = ordered[0]!.digit;
  const margin = ordered[0]!.score - (ordered[1]?.score ?? 0);

  const agreement = strategyAgreement(snapshot, target);
  const trigger = deriveEntryTrigger(snapshot, target);
  const stat = snapshot.stats[target]!;

  const suggestedDuration = Math.max(
    1,
    Math.min(10, Math.round(stat.averageGap > 0 ? Math.min(stat.averageGap, 9) : 3)),
  );
  const observationWindow = Math.max(suggestedDuration * 2, Math.round(stat.averageGap * 2) || 8);

  const confidence = Math.round(
    Math.max(
      5,
      Math.min(
        99,
        margin * 190 +
          agreement * 45 +
          snapshot.quality.predictionReliability * 0.28 -
          snapshot.quality.noise * 0.1,
      ),
    ),
  );

  const entryOpportunity = Math.round(
    Math.max(0, Math.min(100, trigger.probability * 220 + snapshot.quality.gapStability * 0.3)),
  );

  const predictionHealth = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        snapshot.quality.dataSufficiency * 0.3 +
          snapshot.quality.signalStability * 0.25 +
          confidence * 0.25 +
          snapshot.quality.frequencyStability * 0.2,
      ),
    ),
  );

  const ranked = [...snapshot.strategies]
    .map((s) => ({ s, contribution: s.scores[target]! * calibration.weightFor(s.id) }))
    .sort((a, b) => b.contribution - a.contribution);

  const winning = ranked[0]?.s;
  const supporting = ranked.slice(1, 5).map((r) => r.s.name);

  const reasoning: string[] = [];
  if (stat.currentGap > stat.averageGap)
    reasoning.push(
      `Digit ${target} is ${stat.currentGap} ticks into a gap versus an ${stat.averageGap.toFixed(1)} tick average.`,
    );
  if (stat.currentDrought >= stat.longestDrought * 0.7 && stat.longestDrought > 0)
    reasoning.push(
      `Drought of ${stat.currentDrought} ticks approaches its session maximum of ${stat.longestDrought}.`,
    );
  reasoning.push(
    `Transition probability from trigger ${trigger.digit} to ${target} is ${(trigger.probability * 100).toFixed(1)}%.`,
  );
  reasoning.push(
    snapshot.quality.entropy < 92
      ? `Entropy at ${snapshot.quality.entropy.toFixed(1)}% shows an exploitable skew.`
      : `Entropy at ${snapshot.quality.entropy.toFixed(1)}% indicates near-uniform randomness — treat with care.`,
  );
  reasoning.push(
    snapshot.quality.volatility < 55
      ? `Volatility is stable at ${snapshot.quality.volatility.toFixed(1)}%.`
      : `Volatility is elevated at ${snapshot.quality.volatility.toFixed(1)}%.`,
  );
  reasoning.push(
    `${Math.round(agreement * 100)}% of ${snapshot.strategies.length} models agree on digit ${target}.`,
  );
  if (winning) reasoning.push(`${winning.name}: ${winning.note}.`);

  return {
    id: `${Date.now()}-${target}`,
    createdAt: Date.now(),
    symbol: snapshot.symbol,
    window: snapshot.window,
    targetDigit: target,
    entryTrigger: trigger.digit,
    suggestedDuration,
    observationWindow,
    confidence,
    entryOpportunity,
    marketQuality: Math.round(snapshot.quality.overall),
    predictionHealth,
    winningStrategy: winning?.name ?? "Unified Consensus",
    supportingStrategies: supporting,
    reasoning,
    lifetimeTicks: observationWindow,
    strategyAgreement: Math.round(agreement * 100),
    stability: Math.round(snapshot.quality.signalStability),
    bufferSizeAtRun: snapshot.live.bufferSize,
  };
}

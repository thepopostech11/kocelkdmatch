/**
 * Unified AI Decision Engine — fuses every strategy into a single
 * recommendation package (target digit, entry trigger, duration, reasoning).
 */
import { DIGITS } from "./statistics";
import { evaluateStrategy, getStrategySettings } from "./strategy";
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


export function buildPrediction(
  snapshot: AnalysisSnapshot,
  calibration: ModelCalibrationEngine,
  attempt = 1,
): Prediction {
  // The new Strategy Engine is the single source of strategy truth.
  const strategy = evaluateStrategy(snapshot, getStrategySettings(), attempt);
  const target = strategy.targetDigit;
  const entryDigit = attempt >= 2 ? strategy.recoveryEntryDigit : strategy.firstEntryDigit;

  const agreement = strategyAgreement(snapshot, target);
  const trigger = {
    digit: entryDigit,
    probability: snapshot.transition[entryDigit]?.[target] ?? 0.1,
  };
  const stat = snapshot.stats[target]!;

  const suggestedDuration = strategy.recommendedDuration;
  const observationWindow = Math.max(suggestedDuration, strategy.attempt ? getStrategySettings().signalExpirationTicks : 30);

  const confidence = strategy.confidence;

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

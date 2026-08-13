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
  // The Matches Strategy Engine is the single source of strategy truth.
  const strategy = evaluateStrategy(snapshot, getStrategySettings(), attempt, calibration);
  const target = strategy.targetDigit;
  const entryDigit = strategy.entryTrigger;

  const agreement = strategy.strategyAgreement / 100;
  const trigger = {
    digit: entryDigit,
    probability: snapshot.transition[entryDigit]?.[target] ?? 0.1,
  };
  const stat = snapshot.stats[target]!;

  const suggestedDuration = strategy.recommendedDuration;
  const observationWindow = Math.max(suggestedDuration, strategy.validUntilTicks);

  const confidence = strategy.confidence;
  const entryOpportunity = strategy.opportunityScore;
  const predictionHealth = Math.round(
    Math.max(0, Math.min(100, strategy.marketQuality * 0.5 + strategy.signalStability * 0.3 + confidence * 0.2)),
  );

  const ranked = [...snapshot.strategies]
    .map((s) => ({ s, contribution: s.scores[target]! * calibration.weightFor(s.id) }))
    .sort((a, b) => b.contribution - a.contribution);

  const winning = ranked[0]?.s;
  const supporting = ranked.slice(1, 5).map((r) => r.s.name);

  const reasoning: string[] = [];
  if (strategy.eligible) {
    reasoning.push(
      `MATCH target ${target} scored ${strategy.scores[target]!.toFixed(1)} — ${strategy.separation.toFixed(2)} points clear of the runner-up.`,
    );
    reasoning.push(
      `Entry trigger ${entryDigit} → ${target} transition probability ${(trigger.probability * 100).toFixed(1)}% · duration ${suggestedDuration} tick${suggestedDuration === 1 ? "" : "s"}.`,
    );
  } else {
    reasoning.push("NO QUALIFIED MATCH SIGNAL — the strategy rejected this setup.");
  }
  for (const reason of strategy.rejectionReasons) reasoning.push(reason);

  const windows = strategy.windowFrequencies
    .map((w) => `${w.window}t ${w.percentage.toFixed(1)}% (#${w.rank})`)
    .join(" · ");
  reasoning.push(`Multi-window frequency for ${target}: ${windows}.`);
  reasoning.push(
    `Weighted-recency ${strategy.components.weightedFrequencyScore.toFixed(0)} · momentum ${strategy.components.momentumScore.toFixed(0)} · transition ${strategy.components.transitionScore.toFixed(0)} · gap ${strategy.components.gapScore.toFixed(0)} · repeat ${strategy.components.repeatScore.toFixed(0)}.`,
  );
  if (stat.currentGap > stat.averageGap)
    reasoning.push(
      `Digit ${target} is ${stat.currentGap} ticks into a gap versus an ${stat.averageGap.toFixed(1)} tick average (supporting feature only).`,
    );
  reasoning.push(
    snapshot.quality.entropy < 92
      ? `Entropy at ${snapshot.quality.entropy.toFixed(1)}% shows an exploitable skew.`
      : `Entropy at ${snapshot.quality.entropy.toFixed(1)}% indicates near-uniform randomness — treat with care.`,
  );
  reasoning.push(
    `${strategy.strategyAgreement}% component agreement · signal stability ${strategy.signalStability}% · market quality ${strategy.marketQuality}%.`,
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
    marketQuality: strategy.marketQuality,
    predictionHealth,
    winningStrategy: winning?.name ?? "Matches Strategy Engine",
    supportingStrategies: supporting,
    reasoning,
    lifetimeTicks: observationWindow,
    strategyAgreement: Math.round(agreement * 100),
    stability: strategy.signalStability,
    bufferSizeAtRun: snapshot.live.bufferSize,
    strategy,
  };
}

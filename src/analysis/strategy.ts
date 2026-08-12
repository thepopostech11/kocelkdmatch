/**
 * KOCEL DMATCH Strategy Engine — the single source of strategy truth.
 *
 * Rules:
 *  - Highest-frequency digit must reach the configured minimum frequency.
 *  - That highest digit becomes the MATCH TARGET.
 *  - The lowest-frequency digit becomes the FIRST ENTRY TRIGGER.
 *  - On a first-attempt loss, the SECOND highest-frequency digit becomes the
 *    RECOVERY ENTRY TRIGGER — the target never changes.
 *  - Default duration 3 ticks, maximum 2 attempts per opportunity.
 *
 * It consumes only the existing live analysis snapshot (digits, frequencies,
 * ranking, quality) — it never fetches or computes its own market data.
 */
import { DIGITS } from "./statistics";
import type { AnalysisSnapshot } from "./types";
import { useSettingsStore } from "@/stores/settingsStore";

export type StrategySettings = {
  /** Minimum frequency (%) the highest digit must reach. */
  minHighestFrequency: number;
  /** Contract duration in ticks. */
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

export type StrategyDecision = {
  strategyEligible: boolean;
  targetDigit: number;
  firstEntryDigit: number;
  recoveryEntryDigit: number;
  highestDigitFrequency: number;
  secondHighestDigitFrequency: number;
  lowestDigitFrequency: number;
  attempt: number;
  recommendedDuration: number;
  signalStatus: StrategySignalStatus;
  confidence: number;
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

/**
 * Evaluate the strategy against a live analysis snapshot.
 * `attempt` is 1 for the first entry and 2 for the recovery entry.
 */
export function evaluateStrategy(
  snapshot: AnalysisSnapshot,
  settings: StrategySettings = getStrategySettings(),
  attempt = 1,
): StrategyDecision {
  const rejectionReasons: string[] = [];
  const ranked = DIGITS.map((d) => ({
    digit: d,
    percentage: snapshot.stats[d]?.percentage ?? 0,
    stat: snapshot.stats[d],
  })).sort((a, b) => b.percentage - a.percentage);

  const highest = ranked[0]!;
  const second = ranked[1]!;
  const lowest = ranked[ranked.length - 1]!;

  const duration = clamp(Math.round(settings.duration) || 3, 1, 10);
  const bufferSize = snapshot.live.bufferSize;
  const age = Date.now() - snapshot.updatedAt;

  if (bufferSize < 100) rejectionReasons.push(`Only ${bufferSize} ticks analysed — waiting for a full window.`);
  if (age > 15_000) rejectionReasons.push("Analysis data is stale.");
  if (highest.percentage < settings.minHighestFrequency) {
    rejectionReasons.push(
      `HIGHEST FREQUENCY BELOW ${settings.minHighestFrequency}% (currently ${highest.percentage.toFixed(1)}%).`,
    );
  }
  if (highest.digit === lowest.digit || second.digit === highest.digit) {
    rejectionReasons.push("Entry structure is invalid — the distribution is flat.");
  }

  // ---- Confidence: quality of this specific setup, never a fixed number ----
  const separation = highest.percentage - second.percentage; // top-vs-next edge
  const spread = highest.percentage - lowest.percentage; // distribution skew
  const targetStat = highest.stat;
  const entryStat = (attempt >= 2 ? second.stat : lowest.stat);
  const targetStability =
    targetStat && targetStat.averageGap > 0
      ? clamp(100 - (Math.abs(targetStat.currentGap - targetStat.averageGap) / targetStat.averageGap) * 60, 0, 100)
      : 40;
  const entryAvailability =
    entryStat && entryStat.averageGap > 0
      ? clamp(100 - (entryStat.currentGap / (entryStat.averageGap * 3)) * 100, 0, 100)
      : 40;
  const recentSupport = targetStat ? clamp(targetStat.recentPercentage * 6, 0, 100) : 40;
  const freshness = clamp(100 - age / 150, 0, 100);
  const dataDepth = clamp((bufferSize / (snapshot.window || 100)) * 100, 0, 100);

  const edge = clamp((highest.percentage - settings.minHighestFrequency) * 14, 0, 100);

  const confidence = Math.round(
    clamp(
      edge * 0.2 +
        clamp(separation * 22, 0, 100) * 0.14 +
        clamp(spread * 10, 0, 100) * 0.08 +
        targetStability * 0.12 +
        entryAvailability * 0.12 +
        recentSupport * 0.08 +
        snapshot.quality.overall * 0.1 +
        snapshot.quality.signalStability * 0.06 +
        freshness * 0.05 +
        dataDepth * 0.05,
      0,
      99,
    ),
  );

  const stability = Math.round(snapshot.quality.signalStability);
  if (stability < settings.minSignalStability) {
    rejectionReasons.push(
      `Signal stability ${stability}% is below the required ${settings.minSignalStability}%.`,
    );
  }

  const eligible = rejectionReasons.length === 0;

  return {
    strategyEligible: eligible,
    targetDigit: highest.digit,
    firstEntryDigit: lowest.digit,
    recoveryEntryDigit: second.digit,
    highestDigitFrequency: highest.percentage,
    secondHighestDigitFrequency: second.percentage,
    lowestDigitFrequency: lowest.percentage,
    attempt,
    recommendedDuration: duration,
    signalStatus: eligible
      ? attempt >= 2
        ? "WAITING FOR RECOVERY ENTRY"
        : "WAITING FOR ENTRY"
      : "NO TRADE",
    confidence: eligible ? confidence : 0,
    rejectionReasons,
  };
}

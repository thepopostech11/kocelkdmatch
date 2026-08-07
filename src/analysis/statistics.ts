/** Pure statistical helpers for the rolling digit buffer. */
import type { DigitStat, LiveStatistics, MarketQuality, Tick } from "./types";

export const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const EXPECTED = 10;

export function extractDigit(quote: number, pipSize: number): number {
  const text = quote.toFixed(pipSize);
  const last = text[text.length - 1] ?? "0";
  const value = Number(last);
  return Number.isFinite(value) ? value : 0;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

/** Intervals between successive occurrences of each digit + absence runs. */
function occurrenceProfile(digits: number[], digit: number) {
  const positions: number[] = [];
  for (let i = 0; i < digits.length; i += 1) if (digits[i] === digit) positions.push(i);

  const intervals: number[] = [];
  for (let i = 1; i < positions.length; i += 1) intervals.push(positions[i]! - positions[i - 1]!);

  const last = positions.length ? positions[positions.length - 1]! : -1;
  const currentGap = last < 0 ? digits.length : digits.length - 1 - last;
  const droughts = intervals.map((i) => i - 1).filter((d) => d >= 0);

  return {
    count: positions.length,
    intervals,
    currentGap,
    averageGap: intervals.length ? mean(intervals) : digits.length,
    largestGap: intervals.length ? Math.max(...intervals) : digits.length,
    currentDrought: currentGap,
    averageDrought: droughts.length ? mean(droughts) : digits.length,
    longestDrought: droughts.length ? Math.max(...droughts) : digits.length,
  };
}

export function computeDigitStats(digits: number[]): DigitStat[] {
  const n = digits.length || 1;
  const recent = digits.slice(-Math.max(20, Math.floor(digits.length / 3)));
  const older = digits.slice(0, Math.max(1, digits.length - recent.length));

  const raw = DIGITS.map((digit) => {
    const profile = occurrenceProfile(digits, digit);
    const percentage = (profile.count / n) * 100;
    const recentPct = recent.length
      ? (recent.filter((d) => d === digit).length / recent.length) * 100
      : 0;
    const olderPct = older.length
      ? (older.filter((d) => d === digit).length / older.length) * 100
      : percentage;
    const delta = recentPct - olderPct;
    return {
      digit,
      count: profile.count,
      percentage,
      deviation: percentage - EXPECTED,
      currentGap: profile.currentGap,
      averageGap: profile.averageGap,
      largestGap: profile.largestGap,
      currentDrought: profile.currentDrought,
      averageDrought: profile.averageDrought,
      longestDrought: profile.longestDrought,
      recentPercentage: recentPct,
      trend: (delta > 1.5 ? "up" : delta < -1.5 ? "down" : "flat") as DigitStat["trend"],
      rank: 0,
    };
  });

  const ordered = [...raw].sort((a, b) => b.count - a.count || a.digit - b.digit);
  ordered.forEach((stat, index) => {
    stat.rank = index + 1;
  });

  return raw;
}

/** 10x10 transition matrix: P(next = j | current = i). */
export function computeTransitionMatrix(digits: number[]): number[][] {
  const counts = DIGITS.map(() => DIGITS.map(() => 0));
  for (let i = 1; i < digits.length; i += 1) {
    const from = digits[i - 1]!;
    const to = digits[i]!;
    counts[from]![to] = counts[from]![to]! + 1;
  }
  return counts.map((row) => {
    const total = row.reduce((a, b) => a + b, 0);
    return total ? row.map((v) => v / total) : row.map(() => 0.1);
  });
}

export function shannonEntropy(stats: DigitStat[]): number {
  const probs = stats.map((s) => s.percentage / 100).filter((p) => p > 0);
  if (!probs.length) return 0;
  const h = -probs.reduce((acc, p) => acc + p * Math.log2(p), 0);
  return clamp((h / Math.log2(10)) * 100);
}

export function computeNoise(digits: number[]): number {
  if (digits.length < 3) return 0;
  let sum = 0;
  for (let i = 1; i < digits.length; i += 1) sum += Math.abs(digits[i]! - digits[i - 1]!);
  return clamp((sum / (digits.length - 1) / 3.3) * 100);
}

export function computeVolatility(ticks: Tick[]): number {
  if (ticks.length < 3) return 0;
  const returns: number[] = [];
  for (let i = 1; i < ticks.length; i += 1) {
    const prev = ticks[i - 1]!.quote;
    if (prev) returns.push(((ticks[i]!.quote - prev) / prev) * 100);
  }
  return clamp(stdev(returns) * 220);
}

export function computeRepeatRate(digits: number[]): number {
  if (digits.length < 2) return 0;
  let repeats = 0;
  for (let i = 1; i < digits.length; i += 1) if (digits[i] === digits[i - 1]) repeats += 1;
  return (repeats / (digits.length - 1)) * 100;
}

export function computeLiveStatistics(
  ticks: Tick[],
  stats: DigitStat[],
  processed: number,
  ticksPerSecond: number,
): LiveStatistics {
  const digits = ticks.map((t) => t.digit);
  const lastTick = ticks[ticks.length - 1];
  const leader = [...stats].sort((a, b) => b.count - a.count)[0]?.digit ?? 0;
  const laggard = [...stats].sort((a, b) => a.count - b.count)[0]?.digit ?? 0;

  return {
    currentTick: processed,
    currentPrice: lastTick?.quote ?? 0,
    currentDigit: lastTick?.digit ?? 0,
    bufferSize: ticks.length,
    ticksProcessed: processed,
    ticksPerSecond,
    repeatRate: computeRepeatRate(digits),
    digitLeader: leader,
    digitLaggard: laggard,
    entropy: shannonEntropy(stats),
    noise: computeNoise(digits),
    volatility: computeVolatility(ticks),
    averageGap: mean(stats.map((s) => s.averageGap)),
    largestGap: Math.max(...stats.map((s) => s.largestGap), 0),
    averageDrought: mean(stats.map((s) => s.averageDrought)),
    longestDrought: Math.max(...stats.map((s) => s.longestDrought), 0),
  };
}

export function computeMarketQuality(
  digits: number[],
  stats: DigitStat[],
  live: LiveStatistics,
  window: number,
  strategyAgreement: number,
): MarketQuality {
  const n = digits.length || 1;
  const expected = n / 10;
  const chi = stats.reduce((acc, s) => acc + (s.count - expected) ** 2 / (expected || 1), 0);
  const distributionBalance = clamp(100 - (chi / 30) * 100);

  const gapCv = stats.map((s) => (s.averageGap ? Math.abs(s.currentGap - s.averageGap) / s.averageGap : 1));
  const gapStability = clamp(100 - mean(gapCv) * 55);

  const half = Math.floor(digits.length / 2);
  const first = digits.slice(0, half);
  const second = digits.slice(half);
  const tvd =
    DIGITS.reduce((acc, d) => {
      const p = first.length ? first.filter((x) => x === d).length / first.length : 0.1;
      const q = second.length ? second.filter((x) => x === d).length / second.length : 0.1;
      return acc + Math.abs(p - q);
    }, 0) / 2;
  const frequencyStability = clamp(100 - tvd * 180);

  const dataSufficiency = clamp((digits.length / window) * 100);
  const signalStability = clamp(strategyAgreement * 100);

  const predictionReliability = clamp(
    distributionBalance * 0.2 +
      gapStability * 0.2 +
      frequencyStability * 0.2 +
      signalStability * 0.25 +
      dataSufficiency * 0.15 -
      live.noise * 0.08,
  );

  const overall = clamp(
    (distributionBalance + gapStability + frequencyStability + signalStability + dataSufficiency) / 5 -
      live.noise * 0.05,
  );

  return {
    distributionBalance,
    gapStability,
    frequencyStability,
    noise: live.noise,
    entropy: live.entropy,
    volatility: live.volatility,
    signalStability,
    dataSufficiency,
    predictionReliability,
    overall,
  };
}

export const statsUtils = { mean, stdev, clamp };

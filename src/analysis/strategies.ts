/**
 * Strategy engine — every analytical model produces a normalised score vector
 * across digits 0-9. No strategy is ever removed; weights are tuned by the
 * calibration engine at runtime.
 */
import { DIGITS } from "./statistics";
import type { DigitStat, StrategyResult } from "./types";

export type StrategyContext = {
  digits: number[];
  stats: DigitStat[];
  transition: number[][];
  noise: number;
  entropy: number;
  volatility: number;
};

type Model = {
  id: string;
  name: string;
  weight: number;
  run: (ctx: StrategyContext) => { scores: number[]; note: string };
};

const flat = () => DIGITS.map(() => 0.5);

function normalise(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || max - min < 1e-9) return flat();
  return values.map((v) => (v - min) / (max - min));
}

const invert = (values: number[]) => values.map((v) => -v);

function byDigit(stats: DigitStat[], pick: (s: DigitStat) => number) {
  return DIGITS.map((d) => pick(stats[d]!));
}

function windowCount(digits: number[], size: number, digit: number) {
  const slice = digits.slice(-size);
  return slice.length ? slice.filter((d) => d === digit).length / slice.length : 0.1;
}

export const STRATEGY_MODELS: Model[] = [
  {
    id: "lowest-frequency",
    name: "Lowest Frequency",
    weight: 1,
    run: (c) => ({
      scores: normalise(invert(byDigit(c.stats, (s) => s.percentage))),
      note: "Under-represented digits in the rolling window",
    }),
  },
  {
    id: "highest-frequency",
    name: "Highest Frequency",
    weight: 0.8,
    run: (c) => ({
      scores: normalise(byDigit(c.stats, (s) => s.percentage)),
      note: "Digits currently dominating the distribution",
    }),
  },
  {
    id: "weighted-frequency",
    name: "Weighted Frequency",
    weight: 1,
    run: (c) => ({
      scores: normalise(
        DIGITS.map(
          (d) =>
            windowCount(c.digits, 30, d) * 0.5 +
            windowCount(c.digits, 100, d) * 0.3 +
            windowCount(c.digits, c.digits.length, d) * 0.2,
        ),
      ),
      note: "Multi-horizon frequency blend (30/100/full)",
    }),
  },
  {
    id: "frequency-momentum",
    name: "Frequency Momentum",
    weight: 0.9,
    run: (c) => ({
      scores: normalise(byDigit(c.stats, (s) => s.recentPercentage - s.percentage)),
      note: "Digits accelerating versus their baseline rate",
    }),
  },
  {
    id: "frequency-recovery",
    name: "Frequency Recovery",
    weight: 1,
    run: (c) => ({
      scores: normalise(byDigit(c.stats, (s) => -s.deviation)),
      note: "Digits owed frequency to return to a 10% share",
    }),
  },
  {
    id: "gap-recovery",
    name: "Gap Recovery",
    weight: 1.15,
    run: (c) => ({
      scores: normalise(
        byDigit(c.stats, (s) => (s.averageGap ? s.currentGap / s.averageGap : 0)),
      ),
      note: "Current gap stretched beyond the digit's average gap",
    }),
  },
  {
    id: "gap-expansion",
    name: "Gap Expansion",
    weight: 0.85,
    run: (c) => ({
      scores: normalise(byDigit(c.stats, (s) => s.currentGap - s.largestGap * 0.5)),
      note: "Gaps expanding toward historical extremes",
    }),
  },
  {
    id: "gap-consistency",
    name: "Gap Consistency",
    weight: 0.8,
    run: (c) => ({
      scores: normalise(
        byDigit(c.stats, (s) => (s.largestGap ? 1 - Math.abs(s.currentGap - s.averageGap) / s.largestGap : 0)),
      ),
      note: "Digits arriving on a metronomic, predictable cadence",
    }),
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    weight: 1.05,
    run: (c) => ({
      scores: normalise(byDigit(c.stats, (s) => Math.max(0, -s.deviation) * 1.4)),
      note: "Statistical pull back toward the uniform mean",
    }),
  },
  {
    id: "repeat-probability",
    name: "Repeat Probability",
    weight: 0.7,
    run: (c) => {
      const last = c.digits[c.digits.length - 1] ?? 0;
      return {
        scores: DIGITS.map((d) => (d === last ? 1 : 0.35)),
        note: `Repeat pressure on the latest digit ${last}`,
      };
    },
  },
  {
    id: "bayesian",
    name: "Bayesian Model",
    weight: 1.2,
    run: (c) => {
      const n = c.digits.length || 1;
      const posterior = DIGITS.map((d) => {
        const count = c.stats[d]!.count;
        return (count + 1) / (n + 10);
      });
      return {
        scores: normalise(posterior.map((p, d) => p * (1 + c.stats[d]!.currentGap / (c.stats[d]!.averageGap || 1)) )),
        note: "Laplace-smoothed posterior blended with gap pressure",
      };
    },
  },
  {
    id: "transition-matrix",
    name: "Transition Matrix",
    weight: 1.25,
    run: (c) => {
      const last = c.digits[c.digits.length - 1] ?? 0;
      const row = c.transition[last] ?? flat();
      return {
        scores: normalise(row),
        note: `Markov transition probabilities from digit ${last}`,
      };
    },
  },
  {
    id: "distribution-balance",
    name: "Distribution Balance",
    weight: 0.95,
    run: (c) => ({
      scores: normalise(byDigit(c.stats, (s) => -Math.abs(s.percentage - 10) * Math.sign(s.deviation || 1))),
      note: "Rebalancing pressure across the full distribution",
    }),
  },
  {
    id: "digit-rotation",
    name: "Digit Rotation",
    weight: 0.75,
    run: (c) => {
      const recent = new Set(c.digits.slice(-6));
      return {
        scores: DIGITS.map((d) => (recent.has(d) ? 0.25 : 0.85)),
        note: "Rotation away from digits seen in the last 6 ticks",
      };
    },
  },
  {
    id: "dominance-continuation",
    name: "Dominance Continuation",
    weight: 0.7,
    run: (c) => ({
      scores: normalise(byDigit(c.stats, (s) => s.recentPercentage)),
      note: "Continuation of the currently dominant digit",
    }),
  },
  {
    id: "dominance-exhaustion",
    name: "Dominance Exhaustion",
    weight: 0.8,
    run: (c) => ({
      scores: normalise(invert(byDigit(c.stats, (s) => s.recentPercentage))),
      note: "Exhaustion of the recently over-played digits",
    }),
  },
  {
    id: "cluster-detection",
    name: "Cluster Detection",
    weight: 0.85,
    run: (c) => {
      const tail = c.digits.slice(-24);
      const clusters = DIGITS.map((d) => {
        let best = 0;
        let run = 0;
        for (const x of tail) {
          run = x === d ? run + 1 : 0;
          best = Math.max(best, run);
        }
        return best;
      });
      return { scores: normalise(clusters), note: "Recent clustering / streak behaviour" };
    },
  },
  {
    id: "entropy",
    name: "Entropy",
    weight: 0.9,
    run: (c) => {
      const bias = c.entropy < 92 ? 1 : -1;
      return {
        scores: normalise(byDigit(c.stats, (s) => bias * -s.deviation)),
        note:
          c.entropy < 92
            ? "Low entropy — distribution is skewed and correctable"
            : "High entropy — near-uniform randomness",
      };
    },
  },
  {
    id: "volatility-stability",
    name: "Volatility Stability",
    weight: 0.7,
    run: (c) => {
      const calm = c.volatility < 55;
      return {
        scores: calm
          ? normalise(byDigit(c.stats, (s) => s.currentGap))
          : normalise(byDigit(c.stats, (s) => s.recentPercentage)),
        note: calm ? "Calm regime favours gap recovery" : "Volatile regime favours momentum",
      };
    },
  },
  {
    id: "noise-filter",
    name: "Noise Filter",
    weight: 0.65,
    run: (c) => {
      const penalty = c.noise / 100;
      return {
        scores: byDigit(c.stats, (s) =>
          Math.max(0, (s.averageGap ? Math.min(1, s.currentGap / s.averageGap) : 0) * (1 - penalty * 0.5)),
        ),
        note: `Noise-adjusted signal (${c.noise.toFixed(0)}% noise)`,
      };
    },
  },
  {
    id: "market-regime",
    name: "Market Regime Detection",
    weight: 1,
    run: (c) => {
      const trending = c.stats.some((s) => Math.abs(s.deviation) > 3.5);
      return {
        scores: trending
          ? normalise(byDigit(c.stats, (s) => s.deviation))
          : normalise(byDigit(c.stats, (s) => s.currentGap)),
        note: trending ? "Biased regime detected" : "Balanced regime — gap driven",
      };
    },
  },
  {
    id: "signal-stability",
    name: "Signal Stability",
    weight: 0.9,
    run: (c) => ({
      scores: normalise(
        byDigit(c.stats, (s) => (s.trend === "up" ? 1 : s.trend === "flat" ? 0.55 : 0.2) + s.currentGap / 100),
      ),
      note: "Persistence of each digit's directional signal",
    }),
  },
];

export function runStrategies(ctx: StrategyContext): StrategyResult[] {
  return STRATEGY_MODELS.map((model) => {
    const { scores, note } = model.run(ctx);
    const safe = scores.map((s) => (Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 0.5));
    const max = Math.max(...safe);
    const sorted = [...safe].sort((a, b) => b - a);
    const best = safe.indexOf(max);
    return {
      id: model.id,
      name: model.name,
      scores: safe,
      best,
      confidence: Math.round(Math.max(0, (sorted[0]! - (sorted[1] ?? 0)) * 100)),
      note,
    };
  });
}

export const BASE_WEIGHTS: Record<string, number> = Object.fromEntries(
  STRATEGY_MODELS.map((m) => [m.id, m.weight]),
);

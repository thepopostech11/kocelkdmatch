/**
 * Model Calibration Engine — adaptive, session-scoped strategy weighting.
 * It observes how each model's picks behave against subsequent ticks and
 * gradually nudges weights. It never guarantees outcomes.
 */
import { BASE_WEIGHTS } from "./strategies";
import type { StrategyResult } from "./types";

type PendingSample = {
  picks: Record<string, number>;
  ticksRemaining: number;
  matched: Set<string>;
};

export type CalibrationSnapshot = {
  weights: Record<string, number>;
  hits: Record<string, number>;
  samples: Record<string, number>;
  sessionSamples: number;
  startedAt: number;
};

const LEARNING_RATE = 0.06;
const MIN_WEIGHT = 0.35;
const MAX_WEIGHT = 1.9;
const HORIZON = 5;

export class ModelCalibrationEngine {
  private weights: Record<string, number> = { ...BASE_WEIGHTS };
  private hits: Record<string, number> = {};
  private samples: Record<string, number> = {};
  private pending: PendingSample[] = [];
  private sessionSamples = 0;
  private startedAt = Date.now();
  private matchBuckets: Record<string, { samples: number; hits: number }> = {};
  private matchSamples = 0;
  private lastMatchMeta: Record<string, unknown> | null = null;

  /** Register the current tick's picks and evaluate outstanding samples. */
  observe(strategies: StrategyResult[], incomingDigit: number) {
    for (const sample of this.pending) {
      for (const [id, pick] of Object.entries(sample.picks)) {
        if (pick === incomingDigit) sample.matched.add(id);
      }
      sample.ticksRemaining -= 1;
    }

    const settled = this.pending.filter((s) => s.ticksRemaining <= 0);
    this.pending = this.pending.filter((s) => s.ticksRemaining > 0);

    for (const sample of settled) {
      this.sessionSamples += 1;
      for (const id of Object.keys(sample.picks)) {
        this.samples[id] = (this.samples[id] ?? 0) + 1;
        const hit = sample.matched.has(id);
        if (hit) this.hits[id] = (this.hits[id] ?? 0) + 1;
        const base = BASE_WEIGHTS[id] ?? 1;
        const delta = hit ? LEARNING_RATE : -LEARNING_RATE * 0.55;
        const next = (this.weights[id] ?? base) * (1 + delta);
        this.weights[id] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, next));
      }
    }

    if (strategies.length) {
      this.pending.push({
        picks: Object.fromEntries(strategies.map((s) => [s.id, s.best])),
        ticksRemaining: HORIZON,
        matched: new Set<string>(),
      });
      if (this.pending.length > 60) this.pending.shift();
    }
  }

  /* ---------------- MATCH signal calibration (confidence buckets) ---------- */

  /** Record a completed MATCH prediction outcome against its confidence. */
  recordMatchOutcome(confidence: number, won: boolean, meta?: Record<string, unknown>) {
    const bucket = this.bucketFor(confidence);
    const entry = this.matchBuckets[bucket] ?? { samples: 0, hits: 0 };
    entry.samples += 1;
    if (won) entry.hits += 1;
    this.matchBuckets[bucket] = entry;
    this.matchSamples += 1;
    if (meta) this.lastMatchMeta = meta;
  }

  /**
   * Blend the model's raw confidence with the observed hit rate for that
   * confidence bucket once enough samples exist. Never invents a number.
   */
  calibrateConfidence(confidence: number): number {
    const bucket = this.bucketFor(confidence);
    const entry = this.matchBuckets[bucket];
    if (!entry || entry.samples < 8) return confidence;
    const observed = (entry.hits / entry.samples) * 100;
    const trust = Math.min(0.6, entry.samples / 60);
    return confidence * (1 - trust) + observed * trust;
  }

  matchCalibration() {
    return { buckets: { ...this.matchBuckets }, samples: this.matchSamples, last: this.lastMatchMeta };
  }

  private bucketFor(confidence: number) {
    const floor = Math.max(0, Math.min(90, Math.floor(confidence / 10) * 10));
    return `${floor}-${floor + 9}`;
  }

  weightFor(id: string) {
    return this.weights[id] ?? BASE_WEIGHTS[id] ?? 1;
  }

  accuracyFor(id: string) {
    const s = this.samples[id] ?? 0;
    return s ? ((this.hits[id] ?? 0) / s) * 100 : 0;
  }

  snapshot(): CalibrationSnapshot {
    return {
      weights: { ...this.weights },
      hits: { ...this.hits },
      samples: { ...this.samples },
      sessionSamples: this.sessionSamples,
      startedAt: this.startedAt,
    };
  }

  reset() {
    this.weights = { ...BASE_WEIGHTS };
    this.hits = {};
    this.samples = {};
    this.pending = [];
    this.sessionSamples = 0;
    this.startedAt = Date.now();
    this.matchBuckets = {};
    this.matchSamples = 0;
    this.lastMatchMeta = null;
  }
}

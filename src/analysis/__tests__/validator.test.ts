import { describe, it, expect } from 'vitest';
import { validate7Layers } from '../validator';

// Minimal fake snapshot and prediction for unit testing
const fakeSnapshot: any = {
  stats: Array.from({ length: 10 }).map(() => ({ percentage: 15, count: 10, currentGap: 1, averageGap: 2 })),
  quality: { overall: 50, entropy: 60 },
};

const fakePrediction: any = {
  targetDigit: 3,
  confidence: 42,
  marketQuality: 50,
  strategyAgreement: 50,
  strategy: { components: { gapScore: 40, repeatScore: 25, momentumScore: 35, transitionScore: 30 } },
};

describe('validate7Layers', () => {
  it('returns a result with seven layers and passed true for the fake data', () => {
    const res = validate7Layers(fakeSnapshot, fakePrediction);
    expect(res).toHaveProperty('layers');
    expect(res.layers).toHaveLength(7);
    expect(res.passed).toBe(true);
  });
});

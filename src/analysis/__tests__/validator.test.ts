import { describe, it, expect } from 'vitest';
import { validate7Layers } from '../validator';

// Minimal fake snapshot and prediction for unit testing
const fakeSnapshot: any = {
  window: 100,
  digits: [3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  history: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  stats: Array.from({ length: 10 }, (_, index) => ({
    percentage: index === 3 ? 80 : 12,
    count: index === 3 ? 16 : 4,
    currentGap: 1,
    averageGap: 2,
  })),
  live: { currentDigit: 3, bufferSize: 20 },
  transition: Array.from({ length: 10 }, () => Array.from({ length: 10 }, (_, i) => (i === 3 ? 0.4 : 0.08))),
  quality: { overall: 75, entropy: 20, dataSufficiency: 80 },
};

const fakePrediction: any = {
  id: 'pred-1',
  createdAt: Date.now(),
  symbol: 'R_100',
  window: 100,
  targetDigit: 3,
  entryTrigger: 3,
  suggestedDuration: 12,
  observationWindow: 20,
  confidence: 78,
  entryOpportunity: 72,
  marketQuality: 75,
  predictionHealth: 80,
  winningStrategy: 'recurrence',
  supportingStrategies: ['momentum'],
  reasoning: ['stable'],
  lifetimeTicks: 20,
  strategyAgreement: 80,
  stability: 85,
  bufferSizeAtRun: 20,
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

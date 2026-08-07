/** Phase 2 — AI MATCHES analysis engine types. */

export type Tick = {
  epoch: number;
  quote: number;
  digit: number;
  pipSize: number;
  receivedAt: number;
};

export type DigitStat = {
  digit: number;
  count: number;
  percentage: number;
  deviation: number;
  currentGap: number;
  averageGap: number;
  largestGap: number;
  currentDrought: number;
  averageDrought: number;
  longestDrought: number;
  rank: number;
  trend: "up" | "down" | "flat";
  recentPercentage: number;
};

export type LiveStatistics = {
  currentTick: number;
  currentPrice: number;
  currentDigit: number;
  bufferSize: number;
  ticksProcessed: number;
  ticksPerSecond: number;
  repeatRate: number;
  digitLeader: number;
  digitLaggard: number;
  entropy: number;
  noise: number;
  volatility: number;
  averageGap: number;
  largestGap: number;
  averageDrought: number;
  longestDrought: number;
};

export type MarketQuality = {
  distributionBalance: number;
  gapStability: number;
  frequencyStability: number;
  noise: number;
  entropy: number;
  volatility: number;
  signalStability: number;
  dataSufficiency: number;
  predictionReliability: number;
  overall: number;
};

export type StrategyResult = {
  id: string;
  name: string;
  scores: number[];
  best: number;
  confidence: number;
  note: string;
};

export type AnalysisSnapshot = {
  symbol: string;
  window: number;
  digits: number[];
  stats: DigitStat[];
  live: LiveStatistics;
  quality: MarketQuality;
  strategies: StrategyResult[];
  transition: number[][];
  updatedAt: number;
};

export type Prediction = {
  id: string;
  createdAt: number;
  symbol: string;
  window: number;
  targetDigit: number;
  entryTrigger: number;
  suggestedDuration: number;
  observationWindow: number;
  confidence: number;
  entryOpportunity: number;
  marketQuality: number;
  predictionHealth: number;
  winningStrategy: string;
  supportingStrategies: string[];
  reasoning: string[];
  lifetimeTicks: number;
  strategyAgreement: number;
  stability: number;
  bufferSizeAtRun: number;
};

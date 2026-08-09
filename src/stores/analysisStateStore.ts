import { create } from "zustand";
import type { AnalysisSnapshot, Prediction } from "@/analysis/types";

export type AnalysisMarketState = {
  symbol: string;
  displayName: string;
  open: boolean;
  isLive: boolean;
  latestPrice: number;
  latestDigit: number;
  latestEpoch: number;
  tickHistory: number[];
  bufferSize: number;
  snapshot: AnalysisSnapshot;
  prediction: Prediction | null;
  confidence: number;
  strategyAgreement: number;
  opportunityScore: number;
  targetDigit: number | null;
  entryTrigger: number | null;
  recommendedDuration: number | null;
  marketQuality: number;
  volatility: number;
  noise: number;
  signalStability: number;
  predictionTimestamp: number | null;
  lastAnalysisUpdate: number;
  eligible: null;
  rejectionReasons: string[];
};

type AnalysisState = {
  markets: AnalysisMarketState[];
  marketCount: number;
  readyMarkets: number;
  qualifiedMarkets: number;
  analysisUpdateId: number;
  lastAnalysisUpdateAt: number;
  analysisStatus: "connected" | "disconnected";
  botLastUpdateId: number;
  botLastUpdateAt: number;
  botMarketCount: number;
  sharedStatus: "synced" | "sync error";
  setSharedState: (update: Partial<Omit<AnalysisState, "setSharedState" | "recordBotReceipt">>) => void;
  recordBotReceipt: (marketCount: number) => void;
};

export const useAnalysisStateStore = create<AnalysisState>((set) => ({
  markets: [],
  marketCount: 0,
  readyMarkets: 0,
  qualifiedMarkets: 0,
  analysisUpdateId: 0,
  lastAnalysisUpdateAt: 0,
  analysisStatus: "disconnected",
  botLastUpdateId: 0,
  botLastUpdateAt: 0,
  botMarketCount: 0,
  sharedStatus: "sync error",
  recordBotReceipt: (marketCount) =>
    set((state) => {
      const botLastUpdateId = state.botLastUpdateId + 1;
      const botLastUpdateAt = Date.now();
      const sharedStatus =
        state.marketCount > 0 && marketCount === state.marketCount ? "synced" : "sync error";
      return { ...state, botMarketCount: marketCount, botLastUpdateId, botLastUpdateAt, sharedStatus };
    }),
  setSharedState: (update) =>
    set((state) => {
      const next = { ...state, ...update } as Omit<AnalysisState, "setSharedState" | "recordBotReceipt">;
      const sharedStatus =
        next.marketCount > 0 && next.botMarketCount === next.marketCount ? "synced" : "sync error";
      return { ...next, sharedStatus, recordBotReceipt: state.recordBotReceipt, setSharedState: state.setSharedState };
    }),
}));

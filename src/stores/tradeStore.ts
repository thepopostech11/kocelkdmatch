import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OpenTrade } from "@/market/TradingEngine";

export type CompletedTrade = {
  contractId: string;
  symbol: string;
  targetDigit: number;
  stake: number;
  ticks: number;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  result: "won" | "lost";
  entryTime: number;
  closedAt: number;
  currency: string;
};

export type RiskSettings = {
  defaultStake: number;
  defaultTicks: number;
  confirmBeforeTrade: boolean;
  maxStakeWarning: number;
  dailyProfitLimit: number;
  dailyLossLimit: number;
  entrySoundEnabled: boolean;
  entryBannerSeconds: number;
};

type TradeStore = {
  history: CompletedTrade[];
  risk: RiskSettings;
  record: (trade: OpenTrade) => void;
  setRisk: <K extends keyof RiskSettings>(key: K, value: RiskSettings[K]) => void;
  clearHistory: () => void;
};

export const RISK_DEFAULTS: RiskSettings = {
  defaultStake: 1,
  defaultTicks: 1,
  confirmBeforeTrade: true,
  maxStakeWarning: 50,
  dailyProfitLimit: 100,
  dailyLossLimit: 50,
  entrySoundEnabled: true,
  entryBannerSeconds: 8,
};

export const useTradeStore = create<TradeStore>()(
  persist(
    (set) => ({
      history: [],
      risk: RISK_DEFAULTS,

      record: (trade) =>
        set((s) => {
          if (s.history.some((h) => h.contractId === trade.contractId)) return s;
          const entry: CompletedTrade = {
            contractId: trade.contractId,
            symbol: trade.symbol,
            targetDigit: trade.targetDigit,
            stake: trade.stake,
            ticks: trade.ticks,
            buyPrice: trade.buyPrice,
            sellPrice: trade.sellPrice ?? 0,
            profit: trade.profit,
            result: trade.profit > 0 ? "won" : "lost",
            entryTime: trade.entryTime,
            closedAt: trade.closedAt ?? Date.now(),
            currency: trade.currency,
          };
          return { history: [entry, ...s.history].slice(0, 200) };
        }),

      setRisk: (key, value) => set((s) => ({ risk: { ...s.risk, [key]: value } })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: "kocel-trades" },
  ),
);

/** Realised profit/loss for the current calendar day. */
export const selectTodayPnl = (s: TradeStore) => {
  const start = new Date().setHours(0, 0, 0, 0);
  return s.history
    .filter((h) => h.closedAt >= start)
    .reduce((acc, h) => acc + h.profit, 0);
};

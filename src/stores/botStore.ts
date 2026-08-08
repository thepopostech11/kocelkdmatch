import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BotSessionStats = {
  marketsScanned: number;
  opportunitiesFound: number;
  opportunitiesRejected: number;
  realTradesExecuted: number;
  wins: number;
  losses: number;
  totalPnl: number;
  confidenceTotal: number;
  agreementTotal: number;
  bestSymbol: string;
  bestStrategy: string;
};

export type BotActivity = { id: string; at: number; message: string };

const emptyStats: BotSessionStats = {
  marketsScanned: 0,
  opportunitiesFound: 0,
  opportunitiesRejected: 0,
  realTradesExecuted: 0,
  wins: 0,
  losses: 0,
  totalPnl: 0,
  confidenceTotal: 0,
  agreementTotal: 0,
  bestSymbol: "—",
  bestStrategy: "—",
};

type BotStore = {
  stake: number;
  minimumConfidence: number;
  stats: BotSessionStats;
  activity: BotActivity[];
  setStake: (stake: number) => void;
  setMinimumConfidence: (value: number) => void;
  setStats: (stats: BotSessionStats) => void;
  addActivity: (message: string) => void;
  resetSession: () => void;
};

export const useBotStore = create<BotStore>()(
  persist(
    (set) => ({
      stake: 1,
      minimumConfidence: 30,
      stats: emptyStats,
      activity: [],
      setStake: (stake) => set({ stake }),
      setMinimumConfidence: (minimumConfidence) => set({ minimumConfidence }),
      setStats: (stats) => set({ stats }),
      addActivity: (message) =>
        set((state) => ({
          activity: [{ id: `${Date.now()}-${state.activity.length}`, at: Date.now(), message }, ...state.activity].slice(0, 100),
        })),
      resetSession: () => set({ stats: { ...emptyStats }, activity: [] }),
    }),
    { name: "kocel-bot-session" },
  ),
);
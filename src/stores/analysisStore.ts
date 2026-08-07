import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Prediction } from "@/analysis/types";

export type HistoryEntry = Prediction & { expired: boolean; confirmedAt: number | null };

type AnalysisStore = {
  history: HistoryEntry[];
  record: (prediction: Prediction) => void;
  markResolved: (id: string, patch: Partial<HistoryEntry>) => void;
  clear: () => void;
};

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set) => ({
      history: [],
      record: (prediction) =>
        set((s) => ({
          history: [{ ...prediction, expired: false, confirmedAt: null }, ...s.history].slice(0, 20),
        })),
      markResolved: (id, patch) =>
        set((s) => ({
          history: s.history.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        })),
      clear: () => set({ history: [] }),
    }),
    { name: "kocel-analysis-history" },
  ),
);

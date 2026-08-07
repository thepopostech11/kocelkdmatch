import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConnectionState } from "@/types";

type ConnectionStore = {
  websocket: ConnectionState;
  oauth: ConnectionState;
  marketFeed: ConnectionState;
  latency: number;
  serverTime: number | null;
  symbol: string;
  tickWindow: number;
  lastTick: number | null;
  setWebsocket: (s: ConnectionState) => void;
  setOauth: (s: ConnectionState) => void;
  setMarketFeed: (s: ConnectionState) => void;
  setLatency: (ms: number) => void;
  setServerTime: (t: number) => void;
  setSymbol: (symbol: string) => void;
  setTickWindow: (n: number) => void;
  setLastTick: (quote: number) => void;
};

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set) => ({
      websocket: "idle",
      oauth: "idle",
      marketFeed: "idle",
      latency: 0,
      serverTime: null,
      symbol: "R_100",
      tickWindow: 100,
      lastTick: null,
      setWebsocket: (websocket) => set({ websocket }),
      setOauth: (oauth) => set({ oauth }),
      setMarketFeed: (marketFeed) => set({ marketFeed }),
      setLatency: (latency) => set({ latency }),
      setServerTime: (serverTime) => set({ serverTime }),
      setSymbol: (symbol) => set({ symbol }),
      setTickWindow: (tickWindow) => set({ tickWindow }),
      setLastTick: (lastTick) => set({ lastTick }),
    }),
    {
      name: "kocel-market",
      // Symbol + tick window persist across refreshes; live status does not.
      partialize: (s) => ({ symbol: s.symbol, tickWindow: s.tickWindow }),
    },
  ),
);

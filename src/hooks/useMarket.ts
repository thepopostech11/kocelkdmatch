/** React bindings for the single MarketEngine instance. */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { MarketEngine } from "@/market/MarketEngine";
import { useAuthStore } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";

function useEngineVersion() {
  return useSyncExternalStore(
    (cb) => MarketEngine.subscribe(cb),
    () => MarketEngine.version,
    () => 0,
  );
}

/** Boots the engine once for the authenticated session. */
export function useMarketSession() {
  const token = useAuthStore((s) => s.accessToken);
  const symbol = useConnectionStore((s) => s.symbol);
  const tickWindow = useConnectionStore((s) => s.tickWindow);
  const setWebsocket = useConnectionStore((s) => s.setWebsocket);
  const setMarketFeed = useConnectionStore((s) => s.setMarketFeed);
  const setLatency = useConnectionStore((s) => s.setLatency);
  const setLastTick = useConnectionStore((s) => s.setLastTick);
  const setServerTime = useConnectionStore((s) => s.setServerTime);

  useEffect(() => {
    void MarketEngine.start(token, symbol, tickWindow);
    // Symbol/window changes are handled by the effects below (no re-boot).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (MarketEngine.diagnostics.symbol !== symbol) MarketEngine.subscribeSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    MarketEngine.setWindow(tickWindow);
  }, [tickWindow]);

  const version = useEngineVersion();
  useEffect(() => {
    const d = MarketEngine.diagnostics;
    setWebsocket(d.socket === "connected" ? "connected" : d.socket === "error" ? "error" : "connecting");
    setMarketFeed(d.feed === "streaming" ? "connected" : d.feed === "error" ? "error" : "connecting");
    setLatency(d.latency);
    if (d.serverTime) setServerTime(d.serverTime);
    const last = MarketEngine.snapshot.live.currentPrice;
    if (last) setLastTick(last);
  }, [version, setWebsocket, setMarketFeed, setLatency, setServerTime, setLastTick]);
}

export function useAnalysisSnapshot() {
  useEngineVersion();
  return MarketEngine.snapshot;
}

export function useAccountInfo() {
  useEngineVersion();
  return MarketEngine.account;
}

export function useDiagnostics() {
  useEngineVersion();
  return MarketEngine.diagnostics;
}

export function usePredictionState() {
  useEngineVersion();
  const predict = useCallback(() => MarketEngine.predict(), []);
  return { prediction: MarketEngine.prediction, entry: MarketEngine.entry, predict };
}

export function useCalibration() {
  useEngineVersion();
  return MarketEngine.calibration;
}

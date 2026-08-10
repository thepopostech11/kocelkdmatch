/** React bindings for the single MarketEngine + TradingEngine instances. */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { MarketEngine } from "@/market/MarketEngine";
import { TradingEngine } from "@/market/TradingEngine";
import { selectActiveToken, useAuthStore } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";

function useEngineVersion() {
  return useSyncExternalStore(
    (cb) => MarketEngine.subscribe(cb),
    () => MarketEngine.version,
    () => 0,
  );
}

function useTradingVersion() {
  return useSyncExternalStore(
    (cb) => TradingEngine.subscribe(cb),
    () => TradingEngine.version,
    () => 0,
  );
}

/**
 * Boots the engine once for the authenticated session.
 * Safe to call from multiple pages — the engine itself is a singleton, so the
 * Analysis page and the Manual Trade page share one socket and one buffer.
 */
export function useMarketSession() {
  const token = useAuthStore(selectActiveToken);
  const activeLoginId = useAuthStore((s) => s.activeLoginId);
  const mergeAccounts = useAuthStore((s) => s.mergeAccounts);
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
  }, []);

  // Switching accounts re-authorizes on the SAME socket.
  useEffect(() => {
    MarketEngine.useToken(token);
  }, [token, activeLoginId]);

  useEffect(() => {
    if (MarketEngine.diagnostics.symbol !== symbol) MarketEngine.subscribeSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    MarketEngine.setWindow(tickWindow);
  }, [tickWindow]);

  const version = useEngineVersion();

  useEffect(() => {
    const d = MarketEngine.diagnostics;
    setWebsocket(
      d.socket === "connected" ? "connected" : d.socket === "error" ? "error" : "connecting",
    );
    setMarketFeed(
      d.feed === "streaming" ? "connected" : d.feed === "error" ? "error" : "connecting",
    );
    setLatency(d.latency);
    if (d.serverTime) setServerTime(d.serverTime);
    const last = MarketEngine.snapshot.live.currentPrice;
    if (last) setLastTick(last);
  }, [version, setWebsocket, setMarketFeed, setLatency, setServerTime, setLastTick]);

  // Keep the persisted account list in sync with `authorize`.account_list.
  useEffect(() => {
    if (MarketEngine.accounts.length) mergeAccounts(MarketEngine.accounts);
  }, [version, mergeAccounts]);
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

/** Continuous Indices resolved from the `active_symbols` handshake. */
export function useSymbolCatalogue() {
  useEngineVersion();
  return MarketEngine.symbols;
}

export function useAnalysisState() {
  useEngineVersion();
  return {
    symbols: MarketEngine.symbols,
    snapshot: MarketEngine.snapshot,
    prediction: MarketEngine.prediction,
    entry: MarketEngine.entry,
    diagnostics: MarketEngine.diagnostics,
  };
}

/** Last N digits for the live tape, newest last. */
export function useDigitTape(count = 100) {
  useEngineVersion();
  return MarketEngine.recentDigits(count);
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

export function useOpenTrades() {
  useTradingVersion();
  return TradingEngine.openTrades;
}

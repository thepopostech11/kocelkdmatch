import { useSyncExternalStore } from "react";
import { BotEngine } from "@/bot/BotEngine";
import { MarketEngine } from "@/market/MarketEngine";

export function useBotEngine() {
  useSyncExternalStore(
    (listener) => BotEngine.subscribe(listener),
    () => BotEngine.version,
    () => 0,
  );
  return BotEngine;
}

/**
 * Live view of the shared Analysis Engine state, filtered by the Bot's
 * confidence threshold. Subscribes to the engine directly so the scanner keeps
 * updating every tick — running or not.
 */
export function useScannerOpportunities() {
  useSyncExternalStore(
    (listener) => MarketEngine.subscribe(listener),
    () => MarketEngine.version,
    () => 0,
  );
  useSyncExternalStore(
    (listener) => BotEngine.scanner.subscribe(listener),
    () => BotEngine.scanner.version,
    () => 0,
  );
  return BotEngine.scanner.opportunities;
}

/** Same live data in stable display order — one entry per Continuous Index. */
export function useScannerMarkets() {
  useSyncExternalStore(
    (listener) => MarketEngine.subscribe(listener),
    () => MarketEngine.version,
    () => 0,
  );
  useSyncExternalStore(
    (listener) => BotEngine.scanner.subscribe(listener),
    () => BotEngine.scanner.version,
    () => 0,
  );
  return BotEngine.scanner.markets;
}

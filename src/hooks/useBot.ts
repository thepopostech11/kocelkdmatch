import { useSyncExternalStore } from "react";
import { BotEngine } from "@/bot/BotEngine";

export function useBotEngine() {
  useSyncExternalStore(
    (listener) => BotEngine.subscribe(listener),
    () => BotEngine.version,
    () => 0,
  );
  return BotEngine;
}

export function useScannerOpportunities() {
  useSyncExternalStore(
    (listener) => BotEngine.scanner.subscribe(listener),
    () => BotEngine.scanner.version,
    () => 0,
  );
  return BotEngine.scanner.opportunities;
}
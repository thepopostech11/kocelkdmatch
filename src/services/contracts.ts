/**
 * Service interfaces. Each engine communicates through these contracts only,
 * never by importing another engine directly.
 */
import type { DerivAccount } from "@/types";
import type { Tick } from "@/websocket/TickStreamManager";

export interface AuthenticationService {
  getAuthorizationUrl(mode?: "login" | "registration"): Promise<string>;
  handleCallback(code: string, state: string): Promise<void>;
  restoreSession(): boolean;
  logout(): void;
}

export interface AccountService {
  listAccounts(): Promise<DerivAccount[]>;
  switchAccount(loginid: string): void;
  getBalance(loginid: string): Promise<number>;
}

export interface MarketDataService {
  subscribeTicks(symbol: string, onTick: (tick: Tick) => void): () => void;
  getActiveSymbols(): Promise<{ symbol: string; display_name: string }[]>;
}

/** Phase 3 */
export interface TradingService {
  buy(params: Record<string, unknown>): Promise<unknown>;
  sell(contractId: string): Promise<unknown>;
}

/** Phase 4 */
export interface BotService {
  start(config: Record<string, unknown>): void;
  stop(): void;
  getState(): "idle" | "running" | "stopped";
}

/** Phase 2 */
export interface AnalysisService {
  analyse(ticks: Tick[]): Promise<Record<string, number>>;
}

export interface SettingsService {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}

export interface NotificationService {
  notify(kind: string, title: string, message?: string): void;
}

export const NOT_IMPLEMENTED = (phase: number) => {
  throw new Error(`This capability ships in Phase ${phase}.`);
};

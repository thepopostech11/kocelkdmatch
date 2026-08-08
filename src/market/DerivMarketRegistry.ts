/**
 * DerivMarketRegistry — the single source of truth for which Continuous
 * Indices are actually available right now.
 *
 *   Deriv WebSocket → active_symbols discovery → registry → scanner / bot
 *
 * The static SYMBOLS config is only used as a *filter* of what this tool
 * supports; availability always comes from Deriv.
 */
import { ConnectionManager } from "@/websocket/ConnectionManager";
import { SYMBOLS } from "@/config/app";
import type { SymbolMeta } from "@/market/MarketEngine";

export type RegistryStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "DISCOVERING"
  | "READY"
  | "ERROR";

type Listener = () => void;

const SUPPORTED = new Set<string>(SYMBOLS.map((s) => s.value));

class DerivMarketRegistryImpl {
  status: RegistryStatus = "DISCONNECTED";
  markets: SymbolMeta[] = [];
  error: string | null = null;
  lastDiscoveredAt: number | null = null;
  version = 0;

  private listeners = new Set<Listener>();
  private inflight: Promise<SymbolMeta[]> | null = null;

  /** Available (open) Continuous Indices supported by this tool. */
  get available(): SymbolMeta[] {
    return this.markets.filter((market) => market.open);
  }

  /** Discovers live markets, reusing an in-flight discovery when present. */
  async discover(force = false): Promise<SymbolMeta[]> {
    if (!force && this.status === "READY" && this.available.length > 0) return this.available;
    if (this.inflight) return this.inflight;

    this.inflight = this.run().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async run(): Promise<SymbolMeta[]> {
    this.error = null;
    this.setStatus("CONNECTING");
    try {
      const socket = await ConnectionManager.connectAuthenticated();
      this.setStatus("DISCOVERING");
      const res = await socket.request({ active_symbols: "brief", product_type: "basic" });
      const error = res["error"] as { message?: string } | undefined;
      if (error) throw new Error(error.message ?? "Deriv rejected the market discovery request.");

      const list = (res["active_symbols"] as Record<string, unknown>[] | undefined) ?? [];
      this.markets = list
        .map((item) => {
          const pip = Number(item["pip"] ?? 0.01);
          return {
            symbol: String(item["symbol"]),
            displayName: String(item["display_name"] ?? item["symbol"]),
            pip: pip > 0 ? Math.round(-Math.log10(pip)) : 2,
            open: Boolean(item["exchange_is_open"] ?? 1),
          } satisfies SymbolMeta;
        })
        .filter((market) => SUPPORTED.has(market.symbol) || /^(R_|1HZ)/.test(market.symbol));

      this.lastDiscoveredAt = Date.now();
      this.setStatus("READY");
      return this.available;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Market discovery failed.";
      this.setStatus("ERROR");
      throw err instanceof Error ? err : new Error(this.error);
    }
  }

  private setStatus(status: RegistryStatus) {
    this.status = status;
    this.emit();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }
}

export const DerivMarketRegistry = new DerivMarketRegistryImpl();

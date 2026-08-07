/**
 * TradingEngine — Phase 3 MATCHES order execution and contract tracking.
 *
 * It deliberately owns NO analysis of its own. It reuses the single socket
 * created by ConnectionManager (the same one MarketEngine streams on) and is
 * responsible only for: price proposals, order submission, and live contract
 * monitoring via `proposal_open_contract`.
 */
import { ConnectionManager } from "@/websocket/ConnectionManager";
import type { WebSocketManager } from "@/websocket/WebSocketManager";
import { selectActiveToken, useAuthStore } from "@/stores/authStore";

export type ProposalQuote = {
  payout: number;
  askPrice: number;
  spot: number;
  displayValue: string;
  id: string;
};

export type OpenTrade = {
  contractId: string;
  transactionId: string;
  symbol: string;
  targetDigit: number;
  stake: number;
  ticks: number;
  entryTime: number;
  entrySpot: number | null;
  buyPrice: number;
  payout: number;
  currentTick: number;
  remainingTicks: number;
  currentSpot: number | null;
  contractValue: number;
  profit: number;
  status: "open" | "won" | "lost";
  sellPrice: number | null;
  closedAt: number | null;
  currency: string;
};

export type TradeEvent =
  | { kind: "submitted"; trade: OpenTrade }
  | { kind: "update"; trade: OpenTrade }
  | { kind: "settled"; trade: OpenTrade };

type Listener = () => void;

class TradingEngineImpl {
  private unsubscribe: (() => void) | null = null;
  private attachedSocket: WebSocketManager | null = null;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<(e: TradeEvent) => void>();

  open = new Map<string, OpenTrade>();
  version = 0;
  lastError: string | null = null;

  private authorizedToken: string | null = null;

  private async socket(): Promise<WebSocketManager> {
    const existing = ConnectionManager.socket;
    const socket = existing?.isOpen ? existing : await ConnectionManager.connect();
    this.attach(socket);
    await this.ensureAuthorized(socket);
    return socket;
  }

  /**
   * Proposals and orders are only accepted on an authorized socket. The socket
   * is shared with the MarketEngine, but a page can reach the trade ticket
   * before that handshake lands (or after a reconnect), so we (re-)authorize
   * with the active account's WebSocket token before every order path.
   */
  private async ensureAuthorized(socket: WebSocketManager) {
    const token = selectActiveToken(useAuthStore.getState());
    if (!token) throw new Error("No authorised Deriv account. Sign in with Deriv again.");
    if (this.authorizedToken === token) return;
    const res = await socket.request({ authorize: token });
    const error = res["error"] as { message?: string } | undefined;
    if (error) {
      this.authorizedToken = null;
      throw new Error(error.message ?? "Deriv rejected this account token.");
    }
    this.authorizedToken = token;
  }

  private attach(socket: WebSocketManager) {
    if (this.attachedSocket === socket && this.unsubscribe) return;
    this.unsubscribe?.();
    // A new socket means the previous authorization no longer applies.
    if (this.attachedSocket !== socket) this.authorizedToken = null;
    this.attachedSocket = socket;
    this.unsubscribe = socket.subscribe((data) => this.handle(data));
  }

  /* ------------------------------------------------------------- proposals */

  /** Live price quote for a MATCHES contract. Used for the payout preview. */
  async quote(params: {
    symbol: string;
    digit: number;
    stake: number;
    ticks: number;
    currency: string;
  }): Promise<ProposalQuote> {
    const socket = await this.socket();
    const res = await socket.request({
      proposal: 1,
      amount: Number(params.stake.toFixed(2)),
      basis: "stake",
      contract_type: "DIGITMATCH",
      currency: params.currency,
      duration: params.ticks,
      duration_unit: "t",
      symbol: params.symbol,
      barrier: String(params.digit),
    });

    const p = res["proposal"] as Record<string, unknown> | undefined;
    if (!p) throw new Error("No proposal returned");
    return {
      payout: Number(p["payout"] ?? 0),
      askPrice: Number(p["ask_price"] ?? 0),
      spot: Number(p["spot"] ?? 0),
      displayValue: String(p["display_value"] ?? ""),
      id: String(p["id"] ?? ""),
    };
  }

  /* ----------------------------------------------------------------- buying */

  /**
   * Submits a real MATCHES order through the authenticated Deriv API and
   * immediately subscribes to live updates for the resulting contract.
   */
  async buy(params: {
    symbol: string;
    digit: number;
    stake: number;
    ticks: number;
    currency: string;
  }): Promise<OpenTrade> {
    const socket = await this.socket();
    this.lastError = null;

    const res = await socket.request({
      buy: 1,
      // Cap the price at the stake so we never pay more than the user approved.
      price: Number(params.stake.toFixed(2)),
      parameters: {
        amount: Number(params.stake.toFixed(2)),
        basis: "stake",
        contract_type: "DIGITMATCH",
        currency: params.currency,
        duration: params.ticks,
        duration_unit: "t",
        symbol: params.symbol,
        barrier: String(params.digit),
      },
    });

    const b = res["buy"] as Record<string, unknown> | undefined;
    if (!b) throw new Error("Order was not accepted by Deriv");

    const contractId = String(b["contract_id"] ?? "");
    const trade: OpenTrade = {
      contractId,
      transactionId: String(b["transaction_id"] ?? ""),
      symbol: params.symbol,
      targetDigit: params.digit,
      stake: params.stake,
      ticks: params.ticks,
      entryTime: Date.now(),
      entrySpot: null,
      buyPrice: Number(b["buy_price"] ?? params.stake),
      payout: Number(b["payout"] ?? 0),
      currentTick: 0,
      remainingTicks: params.ticks,
      currentSpot: null,
      contractValue: Number(b["buy_price"] ?? params.stake),
      profit: 0,
      status: "open",
      sellPrice: null,
      closedAt: null,
      currency: params.currency,
    };

    this.open.set(contractId, trade);
    this.emitEvent({ kind: "submitted", trade });
    this.emit();

    // Live contract monitoring.
    socket.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
    return trade;
  }

  /* ------------------------------------------------------- contract updates */

  private handle(data: Record<string, unknown>) {
    if (data["msg_type"] !== "proposal_open_contract") return;
    const c = data["proposal_open_contract"] as Record<string, unknown> | undefined;
    if (!c) return;

    const contractId = String(c["contract_id"] ?? "");
    const existing = this.open.get(contractId);
    if (!existing) return;

    const isSold = Boolean(c["is_sold"]);
    const profit = Number(c["profit"] ?? 0);
    const ticksPassed = Number(c["tick_count"] ?? existing.currentTick);

    const updated: OpenTrade = {
      ...existing,
      entrySpot: c["entry_spot"] != null ? Number(c["entry_spot"]) : existing.entrySpot,
      currentSpot: c["current_spot"] != null ? Number(c["current_spot"]) : existing.currentSpot,
      currentTick: ticksPassed,
      remainingTicks: Math.max(0, existing.ticks - ticksPassed),
      contractValue: Number(c["bid_price"] ?? existing.contractValue),
      payout: Number(c["payout"] ?? existing.payout),
      profit,
      status: isSold ? (profit > 0 ? "won" : "lost") : "open",
      sellPrice: isSold ? Number(c["sell_price"] ?? 0) : null,
      closedAt: isSold ? Date.now() : null,
    };

    if (isSold) {
      this.open.delete(contractId);
      this.emitEvent({ kind: "settled", trade: updated });
    } else {
      this.open.set(contractId, updated);
      this.emitEvent({ kind: "update", trade: updated });
    }
    this.emit();
  }

  get openTrades(): OpenTrade[] {
    return Array.from(this.open.values()).sort((a, b) => b.entryTime - a.entryTime);
  }

  /* ------------------------------------------------------------ subscription */

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onEvent(listener: (e: TradeEvent) => void) {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private emitEvent(event: TradeEvent) {
    this.eventListeners.forEach((l) => l(event));
  }

  private emit() {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }
}

export const TradingEngine = new TradingEngineImpl();

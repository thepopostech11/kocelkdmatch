import { MarketEngine } from "@/market/MarketEngine";
import { TradingEngine, type OpenTrade, type TradeEvent } from "@/market/TradingEngine";
import { useBotStore } from "@/stores/botStore";
import { useTradeStore } from "@/stores/tradeStore";
import { MultiSymbolScanner, type MarketOpportunity } from "./MultiSymbolScanner";

export type BotStatus =
  | "stopped"
  | "scanning"
  | "locked"
  | "waiting"
  | "submitting"
  | "trade-open"
  | "error";

type Listener = () => void;

class BotEngineImpl {
  readonly scanner = new MultiSymbolScanner();
  status: BotStatus = "stopped";
  locked: MarketOpportunity | null = null;
  lastTrade: OpenTrade | null = null;
  error: string | null = null;
  version = 0;

  private listeners = new Set<Listener>();
  private scannerUnsubscribe: (() => void) | null = null;
  private tradeUnsubscribe: (() => void) | null = null;
  private running = false;
  private submitting = false;
  private lastObservedEpoch = 0;

  constructor() {
    this.tradeUnsubscribe = TradingEngine.onEvent((event) => this.handleTradeEvent(event));
  }

  async start(stake: number, minimumConfidence: number) {
    if (this.running) return;
    if (!Number.isFinite(stake) || stake <= 0) throw new Error("Enter a valid stake amount.");
    if (!MarketEngine.account.authorised || !MarketEngine.diagnostics.tradingPermission) {
      throw new Error("This Deriv session is not authorised for trading.");
    }
    if (stake > MarketEngine.account.availableBalance) {
      throw new Error("The selected account does not have enough available balance.");
    }
    const symbols = MarketEngine.symbols.filter((symbol) => symbol.open);
    if (!symbols.length) throw new Error("Live Deriv markets are not available yet.");

    this.running = true;
    this.status = "scanning";
    this.error = null;
    this.locked = null;
    this.lastObservedEpoch = 0;
    useBotStore.getState().resetSession();
    useBotStore.getState().addActivity(`Scanning ${symbols.length} live markets`);
    this.scannerUnsubscribe?.();
    this.scannerUnsubscribe = this.scanner.subscribe(() => this.evaluate());
    await this.scanner.start(symbols, minimumConfidence);
    this.evaluate();
    this.emit();
  }

  stop() {
    this.running = false;
    this.submitting = false;
    this.locked = null;
    this.status = "stopped";
    this.scanner.select(null);
    this.scanner.stop();
    useBotStore.getState().addActivity("Bot stopped — no new trades will be opened");
    this.emit();
  }

  setMinimumConfidence(value: number) {
    this.scanner.setMinimumConfidence(value);
  }

  private evaluate() {
    if (!this.running || this.submitting || this.status === "trade-open") return;
    const opportunities = this.scanner.opportunities;
    this.updateScanStats(opportunities);

    if (this.locked) {
      const refreshed = opportunities.find((item) => item.symbol === this.locked?.symbol) ?? null;
      if (!refreshed?.eligibility?.eligible || !refreshed.prediction || !refreshed.live) {
        useBotStore.getState().addActivity("Signal invalidated — releasing market lock");
        this.locked = null;
        this.scanner.select(null);
        this.status = "scanning";
        this.emit();
        return;
      }
      this.locked = refreshed;
      const tick = refreshed.snapshot.live;
      const epoch = refreshed.snapshot.updatedAt;
      if (epoch === this.lastObservedEpoch) return;
      this.lastObservedEpoch = epoch;
      if (tick.currentDigit === refreshed.prediction.entryTrigger) void this.execute(refreshed);
      else this.status = "waiting";
      this.emit();
      return;
    }

    const strongest = opportunities.find((item) => item.eligibility?.eligible) ?? null;
    if (!strongest) {
      this.status = "scanning";
      this.emit();
      return;
    }

    this.locked = strongest;
    this.scanner.select(strongest.symbol);
    this.status = "locked";
    useBotStore
      .getState()
      .addActivity(`${strongest.displayName} selected at ${strongest.prediction?.confidence ?? 0}% confidence`);
    this.emit();
  }

  private async execute(opportunity: MarketOpportunity) {
    const prediction = opportunity.prediction;
    if (!prediction || !this.running || this.submitting) return;
    const { stake } = useBotStore.getState();
    const account = MarketEngine.account;
    if (!account.authorised || !MarketEngine.diagnostics.tradingPermission) {
      this.fail("Trading permission was lost. No order was submitted.");
      return;
    }
    if (stake > account.availableBalance) {
      this.fail("Insufficient balance. No order was submitted.");
      return;
    }

    this.submitting = true;
    this.status = "submitting";
    useBotStore.getState().addActivity(`Trigger ${prediction.entryTrigger} detected — validating live quote`);
    this.emit();
    try {
      const quote = await TradingEngine.quote({
        symbol: opportunity.symbol,
        digit: prediction.targetDigit,
        stake,
        ticks: prediction.suggestedDuration,
        currency: account.currency,
      });
      if (!quote.id || quote.askPrice <= 0 || quote.askPrice > stake) {
        throw new Error("Deriv did not return an acceptable live proposal.");
      }
      if (!this.running) return;
      const trade = await TradingEngine.buy({
        symbol: opportunity.symbol,
        digit: prediction.targetDigit,
        stake,
        ticks: prediction.suggestedDuration,
        currency: account.currency,
      });
      this.lastTrade = trade;
      this.status = "trade-open";
      useBotStore.getState().addActivity(`Real trade ${trade.contractId} opened`);
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Order submission failed";
      useBotStore.getState().addActivity(`Order rejected: ${this.error}`);
      this.locked = null;
      this.scanner.select(null);
      this.status = "scanning";
    } finally {
      this.submitting = false;
      this.emit();
    }
  }

  private handleTradeEvent(event: TradeEvent) {
    if (event.kind !== "settled") return;
    this.lastTrade = event.trade;
    useTradeStore.getState().record(event.trade);
    const store = useBotStore.getState();
    const stats = { ...store.stats };
    stats.realTradesExecuted += 1;
    stats.totalPnl += event.trade.profit;
    if (event.trade.profit > 0) stats.wins += 1;
    else stats.losses += 1;
    store.setStats(stats);
    store.addActivity(
      `Contract ${event.trade.contractId} finished — ${event.trade.status} ${event.trade.profit >= 0 ? "+" : ""}${event.trade.profit.toFixed(2)} ${event.trade.currency}`,
    );
    this.locked = null;
    this.scanner.select(null);
    this.status = this.running ? "scanning" : "stopped";
    this.emit();
  }

  private updateScanStats(opportunities: MarketOpportunity[]) {
    const store = useBotStore.getState();
    const qualified = opportunities.filter((item) => item.eligibility?.eligible);
    store.setStats({
      ...store.stats,
      marketsScanned: opportunities.length,
      opportunitiesFound: qualified.length,
      opportunitiesRejected: opportunities.filter((item) => item.prediction && !item.eligibility?.eligible).length,
      bestSymbol: opportunities[0]?.displayName ?? store.stats.bestSymbol,
      bestStrategy: opportunities[0]?.prediction?.winningStrategy ?? store.stats.bestStrategy,
    });
  }

  private fail(message: string) {
    this.error = message;
    this.status = "error";
    this.running = false;
    useBotStore.getState().addActivity(message);
    this.emit();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }
}

export const BotEngine = new BotEngineImpl();
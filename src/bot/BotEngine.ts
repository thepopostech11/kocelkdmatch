import { MarketEngine } from "@/market/MarketEngine";
import { TradingEngine, type OpenTrade, type TradeEvent } from "@/market/TradingEngine";
import { useBotStore } from "@/stores/botStore";
import { useTradeStore } from "@/stores/tradeStore";
import { MultiSymbolScanner, type MarketOpportunity } from "./MultiSymbolScanner";

export type BotStatus =
  | "stopped"
  | "scanning"
  | "warming"
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
  private lastKnownMarketCount = 0;

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
    this.assertRiskLimits(stake);
    const markets = MarketEngine.markets;

    this.running = true;
    this.status = "scanning";
    this.error = null;
    this.locked = null;
    this.lastObservedEpoch = 0;
    useBotStore.getState().resetSession();
    if (markets.length > 0) {
      useBotStore.getState().addActivity(`Scanning ${markets.length} shared analysis markets`);
    } else {
      useBotStore.getState().addActivity(
        "Connected to shared Analysis Engine — discovering available analysis markets...",
      );
    }
    this.scannerUnsubscribe?.();
    this.scannerUnsubscribe = this.scanner.subscribe(() => this.evaluate());
    await this.scanner.start(null, minimumConfidence);
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
    const marketCount = opportunities.length;
    const store = useBotStore.getState();
    if (marketCount !== this.lastKnownMarketCount) {
      this.lastKnownMarketCount = marketCount;
      if (marketCount > 0) {
        store.addActivity(`Analysis markets available: ${marketCount}`);
      } else {
        store.addActivity("Waiting for live analysis markets from the shared engine...");
      }
    }
    if (marketCount === 0 && MarketEngine.markets.length > 0) {
      console.error(
        "BOT INTEGRATION ERROR: Analysis Engine contains live markets, but Bot received zero markets.",
      );
    }
    this.updateScanStats(opportunities);

    if (this.locked) {
      const refreshed = opportunities.find((item) => item.symbol === this.locked?.symbol) ?? null;
      if (!refreshed?.qualified || !refreshed.prediction || !refreshed.live) {
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

    const strongest = this.scanner.strongest;
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

    // Final pre-trade check — re-read the live shared analysis snapshot.
    const fresh = this.scanner.opportunities.find((item) => item.symbol === opportunity.symbol);
    const freshPrediction = fresh?.prediction;
    const stale = !fresh?.qualified || !fresh.live || !freshPrediction
      || freshPrediction.targetDigit !== prediction.targetDigit
      || freshPrediction.entryTrigger !== prediction.entryTrigger
      || freshPrediction.suggestedDuration !== prediction.suggestedDuration
      || Date.now() - fresh.snapshot.updatedAt > 15_000;
    if (stale) {
      useBotStore.getState().addActivity("Signal invalidated at final check — returning to scanning");
      this.locked = null;
      this.scanner.select(null);
      this.status = "scanning";
      this.emit();
      return;
    }

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
    try {
      this.assertRiskLimits(stake);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : "A configured risk limit was reached.");
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
        availableSymbols: MarketEngine.symbols,
        balance: account.availableBalance,
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
    stats.confidenceTotal += this.locked?.prediction?.confidence ?? 0;
    stats.agreementTotal += this.locked?.prediction?.strategyAgreement ?? 0;
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
    // Re-scan ALL shared analysis markets immediately after every trade.
    if (this.running) this.evaluate();
  }

  /** Debug/telemetry — proves the Bot is consuming the shared analysis state. */
  get sync() {
    return {
      analysisMarkets: MarketEngine.markets.length,
      botMarkets: this.scanner.opportunities.length,
      subscribed: this.scanner.subscribed,
      lastAnalysisAt: MarketEngine.marketsUpdatedAt,
      lastTickAt: MarketEngine.diagnostics.lastTickAt,
      threshold: this.scanner.threshold,
      running: this.running,
    };
  }

  private updateScanStats(opportunities: MarketOpportunity[]) {
    const store = useBotStore.getState();
    const qualified = opportunities.filter((item) => item.qualified);
    store.setStats({
      ...store.stats,
      marketsScanned: opportunities.length,
      opportunitiesFound: qualified.length,
      opportunitiesRejected: opportunities.filter((item) => item.prediction && !item.qualified).length,
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

  private assertRiskLimits(stake: number) {
    const { history, risk } = useTradeStore.getState();
    const start = new Date().setHours(0, 0, 0, 0);
    const todayPnl = history
      .filter((trade) => trade.closedAt >= start)
      .reduce((total, trade) => total + trade.profit, 0);
    if (stake > risk.maxStakeWarning) throw new Error("Stake exceeds the configured bot safety limit.");
    if (todayPnl >= risk.dailyProfitLimit) throw new Error("Daily profit limit reached. The bot will not open a new trade.");
    if (todayPnl <= -risk.dailyLossLimit) throw new Error("Daily loss limit reached. The bot will not open a new trade.");
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
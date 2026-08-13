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
  | "requesting-proposal"
  | "buying"
  | "trade-open"
  | "result-processing"
  | "error";

type Listener = () => void;

class BotEngineImpl {
  readonly scanner = new MultiSymbolScanner();
  status: BotStatus = "stopped";
  locked: MarketOpportunity | null = null;
  opportunityId: string | null = null;
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
  private opportunitySequence = 0;
  private lockedTicksObserved = 0;
  private botContractIds = new Set<string>();
  /** Strategy attempt for the locked opportunity: 1 = first entry, 2 = recovery. */
  private attempt = 1;
  /** Recovery entry trigger override (second-highest digit) — target never changes. */
  private entryOverride: number | null = null;
  private recoveryPlan: { symbol: string; target: number; entry: number; duration: number } | null = null;

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
    this.opportunityId = null;
    this.lastObservedEpoch = 0;
    this.lockedTicksObserved = 0;
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
    this.opportunityId = null;
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
      const liveMarket = opportunities.find((item) => item.symbol === this.locked?.symbol) ?? null;
      if (!liveMarket?.qualified || !liveMarket.prediction || !liveMarket.live) {
        this.releaseOpportunity("Signal invalidated by the latest shared Analysis state");
        return;
      }
      const tick = liveMarket.snapshot.live;
      const epoch = liveMarket.snapshot.updatedAt;
      const lockedPrediction = this.locked.prediction;
      if (!lockedPrediction) {
        this.releaseOpportunity("Locked Analysis prediction is unavailable — returning to scanning");
        return;
      }
      // The target digit must never change while an opportunity is locked.
      if (liveMarket.prediction.targetDigit !== lockedPrediction.targetDigit) {
        this.releaseOpportunity("Target digit changed — signal cancelled");
        return;
      }
      const triggerDigit = this.entryOverride ?? lockedPrediction.entryTrigger;
      if (epoch === this.lastObservedEpoch) return;
      this.lastObservedEpoch = epoch;
      this.lockedTicksObserved += 1;
      if (tick.currentDigit === triggerDigit) {
        useBotStore.getState().addActivity(`Live digit ${tick.currentDigit} detected`);
        void this.execute(this.locked);
      } else if (this.lockedTicksObserved >= lockedPrediction.lifetimeTicks) {
        this.releaseOpportunity("SIGNAL EXPIRED — returning to fresh analysis");
        return;
      } else {
        this.status = "waiting";
      }
      this.emit();
      return;
    }

    // Recovery attempt — same market, same target, second-highest digit entry.
    if (this.recoveryPlan) {
      const plan = this.recoveryPlan;
      const market = opportunities.find((item) => item.symbol === plan.symbol);
      if (!market?.prediction || !market.live || market.prediction.targetDigit !== plan.target) {
        this.recoveryPlan = null;
        useBotStore.getState().addActivity("Recovery signal invalidated — returning to fresh analysis");
      } else {
        this.locked = market;
        this.attempt = 2;
        this.entryOverride = plan.entry;
        this.lockedTicksObserved = 0;
        this.lastObservedEpoch = market.snapshot.updatedAt;
        this.scanner.select(market.symbol);
        this.status = "locked";
        const activity = useBotStore.getState();
        activity.addActivity(
          `RECOVERY MODE · attempt 2 · MATCH ${plan.target} on trigger ${plan.entry} · ${plan.duration} ticks`,
        );
        this.recoveryPlan = null;
        this.emit();
        if (market.snapshot.live.currentDigit === plan.entry) void this.execute(market);
        return;
      }
    }

    const strongest = this.scanner.strongest;
    if (!strongest) {
      this.status = "scanning";
      this.emit();
      return;
    }

    this.locked = strongest;
    this.attempt = 1;
    this.entryOverride = null;
    this.opportunitySequence += 1;
    this.opportunityId = this.createOpportunityId(this.opportunitySequence);
    this.lockedTicksObserved = 0;
    this.lastObservedEpoch = strongest.snapshot.updatedAt;
    this.scanner.select(strongest.symbol);
    this.status = "locked";
    const prediction = strongest.prediction;
    const activity = useBotStore.getState();
    activity.addActivity(`${strongest.displayName} qualifies at ${prediction?.confidence ?? 0}% confidence`);
    activity.addActivity(`Opportunity ${this.opportunityId} locked`);
    if (prediction) {
      activity.addActivity(
        `Target ${prediction.targetDigit} · trigger ${prediction.entryTrigger} · duration ${prediction.suggestedDuration} ticks`,
      );
      activity.addActivity(`Waiting for real live trigger ${prediction.entryTrigger}`);
    }
    this.emit();
    if (prediction && strongest.snapshot.live.currentDigit === prediction.entryTrigger) {
      activity.addActivity(`Live digit ${prediction.entryTrigger} already matches the locked trigger`);
      void this.execute(strongest);
    }
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
      || fresh.snapshot.live.currentDigit !== prediction.entryTrigger
      || Date.now() - fresh.snapshot.updatedAt > 15_000;
    if (stale) {
      this.releaseOpportunity("Final shared Analysis validation failed — returning to scanning");
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
    this.status = "requesting-proposal";
    useBotStore.getState().addActivity("Final shared Analysis validation passed");
    useBotStore.getState().addActivity("Requesting real MATCH proposal");
    this.emit();
    try {
      const params = {
        symbol: opportunity.symbol,
        digit: prediction.targetDigit,
        stake,
        ticks: prediction.suggestedDuration,
        currency: account.currency,
        availableSymbols: MarketEngine.symbols,
        balance: account.availableBalance,
      };
      const quote = await this.withTimeout(
        TradingEngine.quote(params),
        15_000,
        "Deriv proposal request timed out. No Buy was submitted.",
      );
      if (!quote.id || quote.askPrice <= 0 || quote.askPrice > stake) {
        throw new Error("Deriv did not return an acceptable live proposal.");
      }
      if (!this.running) return;
      useBotStore.getState().addActivity(`Proposal ${quote.id} received at ${quote.askPrice.toFixed(2)} ${account.currency}`);
      this.status = "buying";
      useBotStore.getState().addActivity(`Buying DIGITMATCH ${prediction.targetDigit}`);
      this.emit();
      // Buy the exact proposal already validated above. Never request a second
      // proposal with potentially different pricing or parameters.
      const trade = await TradingEngine.buyFromProposal(params, quote);
      this.lastTrade = trade;
      this.botContractIds.add(trade.contractId);
      this.status = "trade-open";
      const store = useBotStore.getState();
      store.setStats({ ...store.stats, realTradesExecuted: store.stats.realTradesExecuted + 1 });
      store.addActivity(`Trade executed · contract ${trade.contractId} · transaction ${trade.transactionId}`);
      store.addActivity(`Contract active · buy ${trade.buyPrice.toFixed(2)} · payout ${trade.payout.toFixed(2)} ${trade.currency}`);
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Order submission failed";
      useBotStore.getState().addActivity(`Order rejected: ${this.error}`);
      this.releaseOpportunity("Execution lock released — refreshing shared Analysis");
    } finally {
      this.submitting = false;
      this.emit();
      if (this.running) this.evaluate();
    }
  }

  private handleTradeEvent(event: TradeEvent) {
    if (event.kind !== "settled" || !this.botContractIds.has(event.trade.contractId)) return;
    this.botContractIds.delete(event.trade.contractId);
    this.status = "result-processing";
    this.lastTrade = event.trade;
    useTradeStore.getState().record(event.trade);
    const store = useBotStore.getState();
    const stats = { ...store.stats };
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
    this.opportunityId = null;
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
      opportunityId: this.opportunityId,
      selectedSymbol: this.locked?.symbol ?? null,
      selectedConfidence: this.locked?.confidence ?? null,
      execution: this.status,
    };
  }

  private releaseOpportunity(reason: string) {
    useBotStore.getState().addActivity(reason);
    this.locked = null;
    this.opportunityId = null;
    this.lockedTicksObserved = 0;
    this.lastObservedEpoch = 0;
    this.scanner.select(null);
    this.status = this.running ? "scanning" : "stopped";
    this.emit();
  }

  private createOpportunityId(sequence: number) {
    const date = new Date();
    const day = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
    return `BOT-${day}-${String(sequence).padStart(4, "0")}`;
  }

  private async withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), milliseconds);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
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
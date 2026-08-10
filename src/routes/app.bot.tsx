import { createFileRoute } from "@tanstack/react-router";
import { Activity, Bot, CircleStop, Play, Radar, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useBotEngine, useScannerMarkets } from "@/hooks/useBot";
import { useBotStore } from "@/stores/botStore";
import { useAccountInfo, useAnalysisState, useDiagnostics } from "@/hooks/useMarket";
import type { MarketOpportunity } from "@/bot/MultiSymbolScanner";


export const Route = createFileRoute("/app/bot")({
  head: () => ({
    meta: [
      { title: "Bot — KOCEL DMATCH TOOL" },
      { name: "description", content: "Autonomous AI MATCHES bot for Deriv trading." },
      { property: "og:title", content: "Bot — KOCEL DMATCH TOOL" },
      { property: "og:description", content: "Autonomous AI MATCHES bot for Deriv trading." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BotPage,
});

function BotPage() {
  const engine = useBotEngine();
  const markets = useScannerMarkets();
  const account = useAccountInfo();
  const diagnostics = useDiagnostics();
  const analysisState = useAnalysisState();
  const stake = useBotStore((state) => state.stake);
  const minimumConfidence = useBotStore((state) => state.minimumConfidence);
  const stats = useBotStore((state) => state.stats);
  const activity = useBotStore((state) => state.activity);
  const setStake = useBotStore((state) => state.setStake);
  const setMinimumConfidence = useBotStore((state) => state.setMinimumConfidence);
  const [actionError, setActionError] = useState<string | null>(null);

  // The scanner filter always mirrors the slider, even before the bot starts.
  useEffect(() => {
    engine.setMinimumConfidence(minimumConfidence);
  }, [engine, minimumConfidence]);

  const sync = engine.sync;
  const totalMarkets = markets.length;
  const liveMarkets = markets.filter((item) => item.live).length;
  const readyMarkets = markets.filter((item) => item.ready).length;
  const qualifiedMarkets = markets.filter((item) => item.qualified).length;
  const marketCount = analysisState.symbols.length || totalMarkets;
  const best = markets.find((item) => item.status === "best" || item.status === "selected") ?? null;
  const running = engine.status !== "stopped" && engine.status !== "error";
  const selected = engine.locked;
  const prediction = selected?.prediction;


  const start = async () => {
    setActionError(null);
    try {
      await engine.start(stake, minimumConfidence);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The bot could not start.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-3 sm:p-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-bold sm:text-xl"><Bot className="size-5 text-primary" />Intelligent Multi-Symbol MATCHES Bot</h1>
          <p className="text-xs text-muted-foreground">Real-money automated trading · official live Deriv feed</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase">
          <span className={`size-2 rounded-full ${running ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
          {engine.status.replace("-", " ")}
        </div>
      </header>

      <section className="panel grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Radar className="size-4 text-accent" />AUTO MARKET SCANNER</div>
          <p className="mt-1 text-xs text-muted-foreground">The bot selects markets, target digits, triggers, and duration only after every critical gate passes.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>Feed: <strong className="text-foreground">{diagnostics.feed}</strong></span>
            <span>Authorization: <strong className="text-foreground">{account.authorised ? "verified" : "unavailable"}</strong></span>
            <span>Trading permission: <strong className="text-foreground">{diagnostics.tradingPermission ? "enabled" : "not granted"}</strong></span>
            <span>Analysis markets: <strong className="text-foreground">{marketCount} symbol{marketCount === 1 ? "" : "s"}</strong></span>
          </div>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-64">
          <label className="text-xs text-muted-foreground">Stake amount
            <Input className="mt-1" type="number" min="0.35" step="0.01" value={stake} disabled={running} onChange={(event) => setStake(Number(event.target.value))} />
          </label>
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Min confidence</span>
              <strong className="text-foreground">{minimumConfidence}%</strong>
            </div>
            <Slider
              className="mt-2"
              value={[minimumConfidence]}
              min={1}
              max={98}
              step={1}
              disabled={running}
              onValueChange={(value) => {
                const next = value[0] ?? 1;
                setMinimumConfidence(next);
                engine.setMinimumConfidence(next);
              }}
            />
          </div>
          {running ? (
            <Button className="sm:col-span-2" variant="destructive" onClick={() => engine.stop()}><CircleStop />Stop bot</Button>
          ) : (
            <Button className="sm:col-span-2" onClick={() => void start()}><Play />Start bot</Button>
          )}
        </div>
        {(actionError || engine.error) && <p className="text-sm text-destructive lg:col-span-2">{actionError ?? engine.error}</p>}
      </section>

      <section className="panel p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold">Live Analysis Scanner</h2>
          <p className="text-[11px] text-muted-foreground">
            Last analysis update:{" "}
            <strong className="font-mono text-foreground">
              {sync.lastAnalysisAt ? new Date(sync.lastAnalysisAt).toLocaleTimeString([], { hour12: false }) : "—"}
            </strong>
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Counter label="Markets" value={`${totalMarkets} / ${marketCount || totalMarkets}`} />
          <Counter label="Live" value={`${liveMarkets} / ${totalMarkets}`} />
          <Counter label="Ready" value={`${readyMarkets} / ${totalMarkets}`} />
          <Counter label="Qualified" value={`${qualifiedMarkets} / ${totalMarkets}`} />
          <Counter label="Min confidence" value={`${minimumConfidence}%`} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {markets.length ? (
            markets.map((item, index) => <ScannerCard key={item.symbol} index={index + 1} item={item} />)
          ) : (
            <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
              Waiting for the shared Analysis Engine to publish live markets…
            </p>
          )}
        </div>

        {best && best.prediction && (
          <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-3 text-xs">
            <p className="font-bold">Best current opportunity · {best.displayName}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Metric label="Confidence" value={`${best.prediction.confidence}%`} />
              <Metric label="Opportunity" value={String(best.opportunityScore)} />
              <Metric label="Target" value={String(best.prediction.targetDigit)} />
              <Metric label="Trigger" value={String(best.prediction.entryTrigger)} />
              <Metric label="Duration" value={`${best.prediction.suggestedDuration} ticks`} />
            </div>
          </div>
        )}
        {!qualifiedMarkets && totalMarkets > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Status: waiting for a qualified opportunity at {minimumConfidence}% minimum confidence.
          </p>
        )}
      </section>

      <section className="panel p-3 sm:p-4">
        <h2 className="text-sm font-bold">Shared Analysis Connection</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <Metric label="Analysis engine" value={diagnostics.feed === "streaming" ? "RUNNING" : diagnostics.feed.toUpperCase()} />
          <Metric label="Analysis markets" value={String(sync.analysisMarkets)} />
          <Metric label="Bot received" value={String(sync.botMarkets)} />
          <Metric label="Bot subscription" value={sync.subscribed ? "CONNECTED" : "IDLE"} />
          <Metric label="Latest tick" value={sync.lastTickAt ? new Date(sync.lastTickAt).toLocaleTimeString([], { hour12: false }) : "—"} />
          <Metric label="Latest analysis" value={sync.lastAnalysisAt ? new Date(sync.lastAnalysisAt).toLocaleTimeString([], { hour12: false }) : "—"} />
          <Metric label="Confidence source" value="Analysis Engine" />
          <Metric label="Active threshold" value={`${sync.threshold}%`} />
        </div>
        {sync.analysisMarkets > 0 && sync.botMarkets === 0 && (
          <p className="mt-3 text-xs text-destructive">
            CRITICAL INTERNAL SYNC ERROR — the Bot is not consuming the shared analysis state.
          </p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <h2 className="text-sm font-bold">Opportunity Ranking</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b text-muted-foreground"><tr>{["Symbol", "Confidence", "Opportunity", "Strategy", "Trigger", "Target", "Status"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr></thead>
              <tbody>{markets.length ? markets.map((item) => (
                <tr key={item.symbol} className="border-b border-border/60">
                  <td className="px-2 py-2.5 font-medium">{item.displayName}</td>
                  <td className="px-2 py-2.5">{item.confidence}%</td>
                  <td className="px-2 py-2.5">{item.opportunityScore}</td>
                  <td className="px-2 py-2.5">{item.prediction?.winningStrategy ?? "Warming up"}</td>
                  <td className="px-2 py-2.5 font-mono">{item.prediction?.entryTrigger ?? "—"}</td>
                  <td className="px-2 py-2.5 font-mono">{item.prediction?.targetDigit ?? "—"}</td>
                  <td className="px-2 py-2.5">{statusLabel(item.status)}</td>
                </tr>
              )) : <tr><td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">Waiting for live analysis markets…</td></tr>}</tbody>
            </table>
          </div>
        </div>


        <div className="panel p-4">
          <h2 className="text-sm font-bold">Market Lock</h2>
          {selected && prediction ? <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <Metric label="Symbol" value={selected.displayName} /><Metric label="Confidence" value={`${prediction.confidence}%`} />
            <Metric label="Target" value={String(prediction.targetDigit)} /><Metric label="Trigger" value={String(prediction.entryTrigger)} />
            <Metric label="Duration" value={`${prediction.suggestedDuration} ticks`} /><Metric label="Agreement" value={`${prediction.strategyAgreement}%`} />
            <div className="col-span-2"><Metric label="Strategy" value={prediction.winningStrategy} /></div>
          </dl> : <div className="mt-6 text-center text-xs text-muted-foreground"><ShieldCheck className="mx-auto mb-2 size-7" />No market locked. The bot will wait rather than force a trade.</div>}
        </div>
      </section>

      {selected?.eligibility && <section className="panel p-4"><h2 className="text-sm font-bold">Trade Eligibility</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{selected.eligibility.checks.map((check) => <div key={check.id} className="flex items-center justify-between border-b border-border/60 py-1 text-xs"><span>{check.label}</span><strong className={check.passed ? "text-success" : "text-destructive"}>{check.passed ? "PASS" : "FAIL"}</strong></div>)}</div></section>}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4"><h2 className="text-sm font-bold">Bot Session · Real-Money Statistics</h2><dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"><Metric label="Markets scanned" value={String(stats.marketsScanned)} /><Metric label="Opportunities" value={String(stats.opportunitiesFound)} /><Metric label="Rejected" value={String(stats.opportunitiesRejected)} /><Metric label="Real trades" value={String(stats.realTradesExecuted)} /><Metric label="Wins / Losses" value={`${stats.wins} / ${stats.losses}`} /><Metric label="Win rate" value={`${stats.realTradesExecuted ? ((stats.wins / stats.realTradesExecuted) * 100).toFixed(1) : "0.0"}%`} /><Metric label="Total P&L" value={`${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)} ${account.currency}`} /><Metric label="Avg confidence" value={`${stats.realTradesExecuted ? (stats.confidenceTotal / stats.realTradesExecuted).toFixed(1) : "0.0"}%`} /><Metric label="Avg agreement" value={`${stats.realTradesExecuted ? (stats.agreementTotal / stats.realTradesExecuted).toFixed(1) : "0.0"}%`} /><Metric label="Best symbol" value={stats.bestSymbol} /><Metric label="Best strategy" value={stats.bestStrategy} /></dl></div>
        <div className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-bold"><Activity className="size-4" />Bot Activity</h2><div className="mt-3 max-h-52 space-y-2 overflow-y-auto font-mono text-xs">{activity.length ? activity.map((item) => <div key={item.id} className="flex gap-3 border-b border-border/60 pb-2"><time className="text-muted-foreground">{new Date(item.at).toLocaleTimeString([], { hour12: false })}</time><span>{item.message}</span></div>) : <p className="text-muted-foreground">No activity this session.</p>}</div></div>
      </section>

      <p className="pb-3 text-xs text-muted-foreground">Confidence is a statistical score, not a guarantee. Real-money trading involves substantial risk of loss. Trades execute through the authorised Deriv account at the user’s own risk.</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 font-semibold">{value}</dd></div>;
}

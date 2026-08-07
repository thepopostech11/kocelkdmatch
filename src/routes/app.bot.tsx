import { createFileRoute } from "@tanstack/react-router";
import { Activity, Bot, CircleStop, Play, Radar, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBotEngine, useScannerOpportunities } from "@/hooks/useBot";
import { useBotStore } from "@/stores/botStore";
import { useAccountInfo, useDiagnostics } from "@/hooks/useMarket";

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
  const opportunities = useScannerOpportunities();
  const account = useAccountInfo();
  const diagnostics = useDiagnostics();
  const stake = useBotStore((state) => state.stake);
  const minimumConfidence = useBotStore((state) => state.minimumConfidence);
  const stats = useBotStore((state) => state.stats);
  const activity = useBotStore((state) => state.activity);
  const setStake = useBotStore((state) => state.setStake);
  const setMinimumConfidence = useBotStore((state) => state.setMinimumConfidence);
  const [actionError, setActionError] = useState<string | null>(null);
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl"><Bot className="size-5 text-primary" />Intelligent Multi-Symbol MATCHES Bot</h1>
          <p className="text-xs text-muted-foreground">Real-money automated trading · official live Deriv feed</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase">
          <span className={`size-2 rounded-full ${running ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
          {engine.status.replace("-", " ")}
        </div>
      </header>

      <section className="panel grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Radar className="size-4 text-accent" />AUTO MARKET SCANNER</div>
          <p className="mt-1 text-xs text-muted-foreground">The bot selects markets, target digits, triggers, and duration only after every critical gate passes.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>Feed: <strong className="text-foreground">{diagnostics.feed}</strong></span>
            <span>Authorization: <strong className="text-foreground">{account.authorised ? "verified" : "unavailable"}</strong></span>
            <span>Trading permission: <strong className="text-foreground">{diagnostics.tradingPermission ? "enabled" : "not granted"}</strong></span>
          </div>
        </div>
        <div className="grid min-w-64 grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Stake amount
            <Input className="mt-1" type="number" min="0.35" step="0.01" value={stake} disabled={running} onChange={(event) => setStake(Number(event.target.value))} />
          </label>
          <label className="text-xs text-muted-foreground">Min confidence
            <Select value={String(minimumConfidence)} disabled={running} onValueChange={(value) => {
              const next = Number(value) as 80 | 90 | 95 | 98;
              setMinimumConfidence(next);
              engine.setMinimumConfidence(next);
            }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{[80, 90, 95, 98].map((value) => <SelectItem key={value} value={String(value)}>{value}%</SelectItem>)}</SelectContent>
            </Select>
          </label>
          {running ? (
            <Button className="col-span-2" variant="destructive" onClick={() => engine.stop()}><CircleStop />Stop bot</Button>
          ) : (
            <Button className="col-span-2" onClick={() => void start()}><Play />Start bot</Button>
          )}
        </div>
        {(actionError || engine.error) && <p className="text-sm text-destructive lg:col-span-2">{actionError ?? engine.error}</p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <h2 className="text-sm font-bold">Live Opportunities</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b text-muted-foreground"><tr>{["Symbol", "Confidence", "Opportunity", "Strategy", "Trigger", "Target", "Status"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr></thead>
              <tbody>{opportunities.length ? opportunities.map((item) => (
                <tr key={item.symbol} className="border-b border-border/60">
                  <td className="px-2 py-2.5 font-medium">{item.displayName}</td>
                  <td className="px-2 py-2.5">{item.prediction?.confidence ?? 0}%</td>
                  <td className="px-2 py-2.5">{item.opportunityScore}</td>
                  <td className="px-2 py-2.5">{item.prediction?.winningStrategy ?? "Warming up"}</td>
                  <td className="px-2 py-2.5 font-mono">{item.prediction?.entryTrigger ?? "—"}</td>
                  <td className="px-2 py-2.5 font-mono">{item.prediction?.targetDigit ?? "—"}</td>
                  <td className="px-2 py-2.5 capitalize">{item.status}</td>
                </tr>
              )) : <tr><td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">{running ? "Connecting to live markets…" : "Start the bot to scan live markets"}</td></tr>}</tbody>
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
        <div className="panel p-4"><h2 className="text-sm font-bold">Bot Session · Real-Money Statistics</h2><dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"><Metric label="Markets scanned" value={String(stats.marketsScanned)} /><Metric label="Opportunities" value={String(stats.opportunitiesFound)} /><Metric label="Rejected" value={String(stats.opportunitiesRejected)} /><Metric label="Real trades" value={String(stats.realTradesExecuted)} /><Metric label="Wins / Losses" value={`${stats.wins} / ${stats.losses}`} /><Metric label="Total P&L" value={`${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)} ${account.currency}`} /><Metric label="Best symbol" value={stats.bestSymbol} /><Metric label="Best strategy" value={stats.bestStrategy} /></dl></div>
        <div className="panel p-4"><h2 className="flex items-center gap-2 text-sm font-bold"><Activity className="size-4" />Bot Activity</h2><div className="mt-3 max-h-52 space-y-2 overflow-y-auto font-mono text-xs">{activity.length ? activity.map((item) => <div key={item.id} className="flex gap-3 border-b border-border/60 pb-2"><time className="text-muted-foreground">{new Date(item.at).toLocaleTimeString([], { hour12: false })}</time><span>{item.message}</span></div>) : <p className="text-muted-foreground">No activity this session.</p>}</div></div>
      </section>

      <p className="pb-3 text-xs text-muted-foreground">Confidence is a statistical score, not a guarantee. Real-money trading involves substantial risk of loss. Trades execute through the authorised Deriv account at the user’s own risk.</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 font-semibold">{value}</dd></div>;
}

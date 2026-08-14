import { createFileRoute } from "@tanstack/react-router";
import { Activity, Bot, CircleStop, Play, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBotEngine, useScannerMarkets } from "@/hooks/useBot";
import { useBotStore } from "@/stores/botStore";
import { useAccountInfo, useAnalysisState, useDiagnostics } from "@/hooks/useMarket";
import type { MarketOpportunity } from "@/bot/MultiSymbolScanner";
import type { BotStatus } from "@/bot/BotEngine";


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
  const stats = useBotStore((state) => state.stats);
  const activity = useBotStore((state) => state.activity);
  const setStake = useBotStore((state) => state.setStake);
  const [actionError, setActionError] = useState<string | null>(null);

  const sync = engine.sync;
  const totalMarkets = markets.length;
  const liveMarkets = markets.filter((item) => item.live).length;
  const readyMarkets = markets.filter((item) => item.ready).length;
  const qualifiedMarkets = markets.filter((item) => item.qualified).length;
  const marketCount = analysisState.symbols.length || totalMarkets;
  const running = engine.status !== "stopped" && engine.status !== "error";
  const selected = engine.locked;
  const prediction = selected?.prediction;
  const currentState = botStateLabel(engine.status);


  const start = async () => {
    setActionError(null);
    try {
      await engine.start(stake);
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
          <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-primary" />CURRENT STATE</div>
          <p className="mt-2 text-xs text-muted-foreground">The bot always consumes the current shared MATCHES analysis snapshot from the single analysis engine.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>Feed: <strong className="text-foreground">{diagnostics.feed}</strong></span>
            <span>Authorization: <strong className="text-foreground">{account.authorised ? "verified" : "unavailable"}</strong></span>
            <span>Trading permission: <strong className="text-foreground">{diagnostics.tradingPermission ? "enabled" : "not granted"}</strong></span>
            <span>Analysis markets: <strong className="text-foreground">{marketCount} symbol{marketCount === 1 ? "" : "s"}</strong></span>
          </div>

          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{currentState}</p>
            <p className="mt-2 text-lg font-bold">{prediction ? `Candidate: ${selected?.displayName ?? "Volatility 75"}` : "Waiting for live analysis"}</p>
            {prediction && (
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <Metric label="Digit" value={String(prediction.targetDigit)} />
                <Metric label="Confidence" value={`${prediction.confidence}%`} />
                <Metric label="Duration" value={`${prediction.suggestedDuration} ticks`} />
                <Metric label="Trigger" value={String(prediction.entryTrigger)} />
              </div>
            )}
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-64">
          <label className="text-xs text-muted-foreground">Stake amount
            <Input className="mt-1" type="number" min="0.35" step="0.01" value={stake} disabled={running} onChange={(event) => setStake(Number(event.target.value))} />
          </label>

          {running ? (
            <Button className="sm:col-span-2" variant="destructive" onClick={() => engine.stop()}><CircleStop />Stop bot</Button>
          ) : (
            <Button className="sm:col-span-2" onClick={() => void start()}><Play />Start bot</Button>
          )}
        </div>
      </section>

      <section className="panel p-3 sm:p-4">
        <details open>
          <summary className="text-sm font-bold">SHARED ANALYSIS CONNECTION</summary>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Metric label="Analysis engine" value={diagnostics.feed === "streaming" ? "CONNECTED" : diagnostics.feed.toUpperCase()} />
            <Metric label="Live data" value={diagnostics.feed === "streaming" ? "STREAMING" : "IDLE"} />
            <Metric label="7-layer engine" value={"ACTIVE"} />
            <Metric label="Latest analysis" value={sync.lastAnalysisAt ? new Date(sync.lastAnalysisAt).toLocaleTimeString([], { hour12: false }) : "—"} />
            <Metric label="Selected symbol" value={sync.selectedSymbol ?? "—"} />
            <Metric label="Target" value={prediction ? String(prediction.targetDigit) : "—"} />
            <Metric label="Confidence" value={prediction ? `${prediction.confidence}%` : "—"} />
            <Metric label="Duration" value={prediction ? `${prediction.suggestedDuration} ticks` : "—"} />
          </div>
          {sync.analysisMarkets > 0 && sync.botMarkets === 0 && (
            <p className="mt-3 text-xs text-destructive">
              CRITICAL INTERNAL SYNC ERROR — the Bot is not consuming the shared analysis state.
            </p>
          )}
        </details>
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

function botStateLabel(status: BotStatus) {
  switch (status) {
    case "locked": return "SIGNAL READY";
    case "waiting": return "WAITING FOR ENTRY";
    case "requesting-proposal":
    case "buying": return "EXECUTING";
    case "trade-open": return "MONITORING";
    case "result-processing": return "COOLDOWN";
    case "scanning": return "ANALYZING";
    case "error": return "ERROR";
    default: return "WAITING";
  }
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

function statusLabel(status: MarketOpportunity["status"]) {
  switch (status) {
    case "best":
      return "BEST OPPORTUNITY";
    case "selected":
      return "SELECTED";
    case "qualified":
      return "QUALIFIED";
    case "below-threshold":
      return "BELOW THRESHOLD";
    case "unavailable":
      return "UNAVAILABLE";
    default:
      return "WARMING UP";
  }
}

function ScannerCard({
  index,
  item,
  botStatus,
  lockedSymbol,
}: {
  index: number;
  item: MarketOpportunity;
  botStatus: BotStatus;
  lockedSymbol: string | null;
}) {
  const tone =
    item.status === "best" || item.status === "selected"
      ? "border-primary/60 bg-primary/5"
      : item.status === "qualified"
        ? "border-success/50"
        : "border-border";
  const statusTone =
    item.status === "best" || item.status === "selected"
      ? "text-primary"
      : item.status === "qualified"
        ? "text-success"
        : "text-muted-foreground";
  return (
    <article className={`rounded-xl border ${tone} bg-card p-3`}>
      <header className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-bold">
          <span className="mr-1.5 font-mono text-muted-foreground">{String(index).padStart(2, "0")}</span>
          {item.displayName}
        </p>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
          <span className={`size-1.5 rounded-full ${item.live ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
          {item.live ? "Live" : "Idle"}
        </span>
      </header>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Row label="Digit" value={item.bufferSize ? String(item.snapshot.live.currentDigit) : "—"} />
        <Row label="Confidence" value={item.prediction ? `${item.confidence}%` : "—"} />
        <Row label="Opportunity" value={item.prediction ? `${item.opportunityScore}%` : "—"} />
        <Row label="Target" value={item.prediction ? String(item.prediction.targetDigit) : "—"} />
        <Row label="Trigger" value={item.prediction ? String(item.prediction.entryTrigger) : "—"} />
        <Row label="Duration" value={item.prediction ? `${item.prediction.suggestedDuration}t` : "—"} />
        <Row label="Buffer" value={`${item.bufferSize}`} />
        <Row label="Last tick" value={item.lastTickAt ? new Date(item.lastTickAt).toLocaleTimeString([], { hour12: false }) : "—"} />
      </div>
        <p className={`mt-2 text-[11px] font-bold uppercase ${statusTone}`}>
          {lockedSymbol === item.symbol ? lockedStatusLabel(botStatus, item) : statusLabel(item.status)}
        </p>
        {item.prediction && !item.qualified && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Reason: {item.eligibility?.checks.find((check) => check.critical && !check.passed)?.label ?? "Analysis signal invalid"}
          </p>
        )}
    </article>
  );
}

function lockedStatusLabel(
  status: BotStatus,
  item: MarketOpportunity,
) {
  switch (status) {
    case "locked":
      return "OPPORTUNITY LOCKED";
    case "waiting":
      return `WAITING FOR ${item.prediction?.entryTrigger ?? "TRIGGER"}`;
    case "requesting-proposal":
      return "REQUESTING PROPOSAL";
    case "buying":
      return "BUYING";
    case "trade-open":
      return "TRADE ACTIVE";
    case "result-processing":
      return "RESULT PROCESSING";
    default:
      return statusLabel(item.status);
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
}

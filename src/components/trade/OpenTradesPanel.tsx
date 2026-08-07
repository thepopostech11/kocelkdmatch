import { Activity } from "lucide-react";
import { useOpenTrades } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

const money = (v: number, c: string) =>
  `${c} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Live Trade Monitor + Open Trades. Every field is streamed from Deriv's
 * `proposal_open_contract` subscription.
 */
export function OpenTradesPanel() {
  const trades = useOpenTrades();

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Live Trade Monitor</h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {trades.length} open
        </span>
      </div>

      {trades.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
          <Activity className="size-4" />
          No active contracts. Place a MATCH trade to start monitoring.
        </p>
      ) : (
        <div className="space-y-3">
          {trades.map((t) => {
            const progress = t.ticks ? (t.currentTick / t.ticks) * 100 : 0;
            const up = t.profit >= 0;
            return (
              <article key={t.contractId} className="rounded-xl border border-border bg-surface-2/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      MATCHES {t.targetDigit} · {t.symbol}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      #{t.contractId} · {new Date(t.entryTime).toLocaleTimeString()}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "font-mono text-base font-bold tabular-nums",
                      up ? "text-success" : "text-destructive",
                    )}
                  >
                    {up ? "+" : ""}
                    {money(t.profit, t.currency)}
                  </p>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-gradient-brand transition-[width] duration-300"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] sm:grid-cols-6">
                  {[
                    ["Stake", money(t.stake, t.currency)],
                    ["Duration", `${t.ticks}t`],
                    ["Tick", `${t.currentTick}/${t.ticks}`],
                    ["Remaining", String(t.remainingTicks)],
                    ["Value", money(t.contractValue, t.currency)],
                    ["Status", t.status],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="font-mono font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>

                {(t.entrySpot != null || t.currentSpot != null) && (
                  <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
                    Entry spot {t.entrySpot ?? "—"} · Current spot {t.currentSpot ?? "—"}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

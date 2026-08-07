import { useAnalysisSnapshot } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

/** Live heat map — recoloured on every tick from the rolling buffer. */
export function HeatMap() {
  const snapshot = useAnalysisSnapshot();
  const max = Math.max(...snapshot.stats.map((s) => s.percentage), 1);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h2 className="mb-3 text-sm font-bold">Live Heat Map</h2>
      <div className="grid grid-cols-5 gap-1.5">
        {snapshot.stats.map((stat) => {
          const intensity = Math.min(1, stat.percentage / max);
          const hot = stat.deviation >= 0;
          return (
            <div
              key={stat.digit}
              className="rounded-lg p-2 text-center transition-colors duration-200"
              style={{
                backgroundColor: `color-mix(in oklab, var(--${hot ? "success" : "destructive"}) ${Math.round(
                  intensity * 70,
                )}%, var(--surface-2))`,
              }}
            >
              <p className="font-mono text-sm font-bold">{stat.digit}</p>
              <p className="text-[10px] tabular-nums opacity-80">{stat.percentage.toFixed(1)}%</p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Cold (below average)</span>
        <div className="mx-3 h-1.5 flex-1 rounded-full bg-[linear-gradient(90deg,var(--destructive),var(--surface-2),var(--success))]" />
        <span>Hot (above average)</span>
      </div>
      <p className={cn("mt-2 text-[10px] text-muted-foreground")}>
        Window {snapshot.window} ticks · buffer {snapshot.live.bufferSize}
      </p>
    </section>
  );
}

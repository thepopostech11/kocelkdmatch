import { useAnalysisSnapshot } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

/** Animated, resizable frequency histogram driven by the rolling buffer. */
export function FrequencyHistogram() {
  const snapshot = useAnalysisSnapshot();
  const max = Math.max(...snapshot.stats.map((s) => s.count), 1);
  const current = snapshot.live.currentDigit;

  return (
    <section className="flex min-h-64 resize-y flex-col overflow-auto rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h2 className="mb-3 shrink-0 text-sm font-bold">Frequency Histogram</h2>
      <div className="flex min-h-40 flex-1 items-end gap-2">
        {snapshot.stats.map((stat) => {
          const height = (stat.count / max) * 100;
          return (
            <div key={stat.digit} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
              <span className="text-center text-[10px] text-muted-foreground tabular-nums">
                {stat.count}
              </span>
              <div
                className={cn(
                  "rounded-t-md transition-[height] duration-200 ease-out",
                  stat.digit === current
                    ? "bg-gradient-brand"
                    : stat.deviation >= 0
                      ? "bg-success/70"
                      : "bg-destructive/60",
                )}
                style={{ height: `${Math.max(2, height)}%` }}
              />
              <span className="text-center font-mono text-[11px] font-bold">{stat.digit}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { useAnalysisSnapshot } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

function tone(percentage: number) {
  if (percentage > 11) return "success" as const;
  if (percentage < 9) return "destructive" as const;
  return "muted" as const;
}

export function DigitDashboard() {
  const snapshot = useAnalysisSnapshot();
  const current = snapshot.live.currentDigit;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h2 className="mb-3 text-sm font-bold">Live Digit Dashboard</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {snapshot.stats.map((stat) => {
          const t = tone(stat.percentage);
          const radius = 20;
          const circumference = 2 * Math.PI * radius;
          const pct = Math.min(100, (stat.percentage / 20) * 100);
          return (
            <div
              key={stat.digit}
              className={cn(
                "relative rounded-xl border p-2 transition-colors",
                stat.digit === current ? "border-primary bg-primary/10" : "border-border bg-surface-2/50",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="relative size-12 shrink-0">
                  <svg viewBox="0 0 48 48" className="size-full -rotate-90">
                    <circle cx="24" cy="24" r={radius} fill="none" strokeWidth="4" className="stroke-border" />
                    <circle
                      cx="24"
                      cy="24"
                      r={radius}
                      fill="none"
                      strokeWidth="4"
                      strokeLinecap="round"
                      className={cn(
                        "transition-[stroke-dashoffset] duration-200",
                        t === "success" && "stroke-success",
                        t === "destructive" && "stroke-destructive",
                        t === "muted" && "stroke-muted-foreground",
                      )}
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - pct / 100)}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-base font-bold">
                    {stat.digit}
                  </span>
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-mono text-sm font-bold tabular-nums",
                      t === "success" && "text-success",
                      t === "destructive" && "text-destructive",
                    )}
                  >
                    {stat.percentage.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{stat.count} hits</p>
                </div>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>Gap {stat.currentGap}</span>
                <span>Drought {stat.currentDrought}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

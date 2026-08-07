import { useAnalysisSnapshot } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

function Meter({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const score = invert ? 100 - value : value;
  const tone = score >= 70 ? "success" : score >= 45 ? "warning" : "destructive";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold tabular-nums">{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "destructive" && "bg-destructive",
          )}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function MarketQualityPanel() {
  const q = useAnalysisSnapshot().quality;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-bold">Market Quality</h2>
        <span className="font-mono text-xl font-bold text-gradient tabular-nums">
          {q.overall.toFixed(0)}%
        </span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Meter label="Distribution balance" value={q.distributionBalance} />
        <Meter label="Gap stability" value={q.gapStability} />
        <Meter label="Frequency stability" value={q.frequencyStability} />
        <Meter label="Signal stability" value={q.signalStability} />
        <Meter label="Data sufficiency" value={q.dataSufficiency} />
        <Meter label="Prediction reliability" value={q.predictionReliability} />
        <Meter label="Noise" value={q.noise} invert />
        <Meter label="Entropy" value={q.entropy} />
        <Meter label="Volatility" value={q.volatility} invert />
      </div>
    </section>
  );
}

import { useAnalysisSnapshot } from "@/hooks/useMarket";

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function LiveStatisticsPanel() {
  const s = useAnalysisSnapshot();
  const l = s.live;
  const leader = s.stats[l.digitLeader];
  const laggard = s.stats[l.digitLaggard];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h2 className="mb-3 text-sm font-bold">Live Statistics</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        <Cell label="Current tick" value={String(l.currentTick)} />
        <Cell label="Current price" value={l.currentPrice ? l.currentPrice.toFixed(4) : "—"} />
        <Cell label="Current digit" value={String(l.currentDigit)} />
        <Cell label="Rolling buffer" value={`${l.bufferSize} / ${s.window}`} />
        <Cell label="Ticks processed" value={String(l.ticksProcessed)} />
        <Cell label="Ticks per second" value={l.ticksPerSecond.toFixed(2)} />
        <Cell label="Current gap" value={String(leader?.currentGap ?? 0)} />
        <Cell label="Average gap" value={l.averageGap.toFixed(1)} />
        <Cell label="Largest gap" value={String(l.largestGap)} />
        <Cell label="Current drought" value={String(laggard?.currentDrought ?? 0)} />
        <Cell label="Average drought" value={l.averageDrought.toFixed(1)} />
        <Cell label="Longest drought" value={String(l.longestDrought)} />
        <Cell label="Repeat rate" value={`${l.repeatRate.toFixed(1)}%`} />
        <Cell label="Digit leader" value={String(l.digitLeader)} />
        <Cell label="Digit laggard" value={String(l.digitLaggard)} />
        <Cell label="Entropy" value={`${l.entropy.toFixed(1)}%`} />
        <Cell label="Noise" value={`${l.noise.toFixed(1)}%`} />
        <Cell label="Volatility" value={`${l.volatility.toFixed(1)}%`} />
      </div>
    </section>
  );
}

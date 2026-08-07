import { useAnalysisSnapshot, useCalibration } from "@/hooks/useMarket";
import { MarketEngine } from "@/market/MarketEngine";
import { cn } from "@/lib/utils";
import { Sliders, RotateCcw } from "lucide-react";

export function StrategyPanel() {
  const snapshot = useAnalysisSnapshot();
  const calibration = useCalibration();
  const session = calibration.snapshot();

  const rows = [...snapshot.strategies].sort(
    (a, b) => calibration.weightFor(b.id) - calibration.weightFor(a.id),
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Sliders className="size-4 text-primary" /> Strategy & Calibration Engine
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{session.sessionSamples} session samples</span>
          <button
            onClick={() => MarketEngine.resetCalibration()}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <RotateCcw className="size-3" /> Reset session
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-surface-2/60 px-3 py-6 text-center text-xs text-muted-foreground">
          Waiting for the rolling buffer to fill…
        </p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {rows.map((s) => {
            const weight = calibration.weightFor(s.id);
            const accuracy = calibration.accuracyFor(s.id);
            return (
              <div key={s.id} className="rounded-xl bg-surface-2/50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">{s.name}</span>
                  <span className="shrink-0 font-mono text-xs">
                    <span className="text-muted-foreground">pick</span>{" "}
                    <span className="font-bold text-gradient">{s.best}</span>
                  </span>
                </div>
                <p className="truncate text-[10px] text-muted-foreground">{s.note}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface">
                    <div
                      className={cn("h-full rounded-full bg-gradient-brand transition-[width]")}
                      style={{ width: `${Math.min(100, (weight / 1.9) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                    w {weight.toFixed(2)} · {accuracy.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

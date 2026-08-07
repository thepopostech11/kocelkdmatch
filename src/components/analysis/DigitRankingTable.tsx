import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useAnalysisSnapshot } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

export function DigitRankingTable() {
  const snapshot = useAnalysisSnapshot();
  const rows = [...snapshot.stats].sort((a, b) => a.rank - b.rank);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h2 className="mb-3 text-sm font-bold">Digit Ranking</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="py-1 pr-2">Rank</th>
              <th className="py-1 pr-2">Digit</th>
              <th className="py-1 pr-2 text-right">Freq</th>
              <th className="py-1 pr-2 text-right">%</th>
              <th className="py-1 pr-2 text-right">Gap</th>
              <th className="py-1 pr-2 text-right">Drought</th>
              <th className="py-1 text-right">Trend</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map((s) => (
              <tr key={s.digit} className="border-t border-border/60">
                <td className="py-1.5 pr-2 text-muted-foreground">#{s.rank}</td>
                <td className="py-1.5 pr-2 font-bold">{s.digit}</td>
                <td className="py-1.5 pr-2 text-right">{s.count}</td>
                <td
                  className={cn(
                    "py-1.5 pr-2 text-right",
                    s.deviation > 1 && "text-success",
                    s.deviation < -1 && "text-destructive",
                  )}
                >
                  {s.percentage.toFixed(1)}
                </td>
                <td className="py-1.5 pr-2 text-right">{s.currentGap}</td>
                <td className="py-1.5 pr-2 text-right">{s.currentDrought}</td>
                <td className="py-1.5 text-right">
                  <span className="inline-flex justify-end">
                    {s.trend === "up" ? (
                      <ArrowUp className="size-3.5 text-success" />
                    ) : s.trend === "down" ? (
                      <ArrowDown className="size-3.5 text-destructive" />
                    ) : (
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { History, Trash2 } from "lucide-react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { SYMBOLS } from "@/config/app";

export function PredictionHistory() {
  const history = useAnalysisStore((s) => s.history);
  const clear = useAnalysisStore((s) => s.clear);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <History className="size-4 text-primary" /> Prediction History
        </h2>
        {history.length > 0 && (
          <button
            onClick={clear}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" /> Clear
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="rounded-xl bg-surface-2/60 px-3 py-6 text-center text-xs text-muted-foreground">
          The last 20 analyses will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-2">Time</th>
                <th className="py-1 pr-2">Symbol</th>
                <th className="py-1 pr-2 text-right">Target</th>
                <th className="py-1 pr-2 text-right">Trigger</th>
                <th className="py-1 pr-2 text-right">Duration</th>
                <th className="py-1 pr-2 text-right">Conf.</th>
                <th className="py-1 pr-2">Strategy</th>
                <th className="py-1 pr-2 text-right">Obs.</th>
                <th className="py-1 pr-2 text-right">Window</th>
                <th className="py-1 text-right">State</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {history.map((h) => (
                <tr key={h.id} className="border-t border-border/60">
                  <td className="py-1.5 pr-2 font-mono text-muted-foreground">
                    {new Date(h.createdAt).toISOString().slice(11, 19)}
                  </td>
                  <td className="py-1.5 pr-2">
                    {SYMBOLS.find((s) => s.value === h.symbol)?.label ?? h.symbol}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono font-bold">{h.targetDigit}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{h.entryTrigger}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{h.suggestedDuration}t</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{h.confidence}%</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{h.winningStrategy}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{h.observationWindow}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{h.window}</td>
                  <td className="py-1.5 text-right">
                    {h.confirmedAt ? (
                      <span className="text-success">Triggered</span>
                    ) : h.expired ? (
                      <span className="text-muted-foreground">Expired</span>
                    ) : (
                      <span className="text-warning">Active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

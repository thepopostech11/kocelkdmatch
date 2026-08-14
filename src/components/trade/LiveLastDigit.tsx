import { useEffect, useState } from "react";
import { useAnalysisSnapshot } from "@/hooks/useMarket";

export function LiveLastDigit() {
  const snapshot = useAnalysisSnapshot();
  const [digit, setDigit] = useState<number | null>(null);
  const live = snapshot.live;

  useEffect(() => {
    setDigit(snapshot.live.currentDigit ?? null);
  }, [snapshot.updatedAt, snapshot.live.currentDigit]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
      <h2 className="text-sm font-bold">LIVE LAST DIGIT</h2>
      <div className="mt-4 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border bg-gradient-brand text-primary-foreground text-4xl font-bold">
            {digit ?? "—"}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${live.bufferSize > 0 ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
            <span>{live.bufferSize > 0 ? "LIVE" : "IDLE"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

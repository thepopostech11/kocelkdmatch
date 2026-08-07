import { useState } from "react";
import { ChevronDown, TerminalSquare } from "lucide-react";
import { useDiagnostics, useAnalysisSnapshot } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="break-all text-right font-mono text-[11px]">{value}</span>
    </div>
  );
}

export function DiagnosticsPanel() {
  const d = useDiagnostics();
  const snapshot = useAnalysisSnapshot();
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold"
        aria-expanded={open}
      >
        <TerminalSquare className="size-4 text-primary" />
        Connection Diagnostics
        <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <Row label="WebSocket status" value={d.socket} />
          <Row label="Authorised" value={d.authorised ? "yes" : "no"} />
          <Row label="Current subscription" value={`${d.symbol} · ${d.subscriptionId ?? "pending"}`} />
          <Row
            label="Last tick timestamp"
            value={d.lastTickAt ? new Date(d.lastTickAt).toISOString() : "—"}
          />
          <Row label="Tick rate" value={`${d.tickRate.toFixed(2)} ticks/s`} />
          <Row label="API latency" value={`${d.latency} ms`} />
          <Row label="Rolling buffer size" value={`${d.bufferSize} (window ${snapshot.window})`} />
          <Row label="Server time" value={d.serverTime ? new Date(d.serverTime).toISOString() : "—"} />
          <Row label="Last raw tick" value={d.lastRawTick || "—"} />
        </div>
      )}
    </section>
  );
}

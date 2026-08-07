import { useAccountInfo, useDiagnostics } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad" | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-xs font-semibold",
          tone === "ok" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function LiveAccountStatus() {
  const d = useDiagnostics();
  const account = useAccountInfo();

  const health =
    d.socket === "connected" && d.feed === "streaming" && d.latency < 400
      ? "Excellent"
      : d.socket === "connected"
        ? "Degraded"
        : "Offline";

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            d.feed === "streaming" ? "bg-success animate-pulse" : "bg-warning",
          )}
        />
        <h2 className="text-sm font-bold">Live Account Status</h2>
      </div>
      <Row
        label="Connected"
        value={d.socket === "connected" ? "Yes" : d.socket}
        tone={d.socket === "connected" ? "ok" : "bad"}
      />
      <Row label="Authorised" value={d.authorised ? "Yes" : "No"} tone={d.authorised ? "ok" : "warn"} />
      <Row
        label="Market feed"
        value={d.feed === "streaming" ? "Streaming" : d.feed}
        tone={d.feed === "streaming" ? "ok" : "warn"}
      />
      <Row
        label="Trading permission"
        value={d.tradingPermission ? "Granted" : "Read only"}
        tone={d.tradingPermission ? "ok" : "warn"}
      />
      <Row label="Account currency" value={account.currency} />
      <Row
        label="API latency"
        value={`${d.latency} ms`}
        tone={d.latency && d.latency < 250 ? "ok" : d.latency ? "warn" : undefined}
      />
      <Row
        label="Last server ping"
        value={d.lastPingAt ? new Date(d.lastPingAt).toISOString().slice(11, 19) : "—"}
      />
      <Row label="WebSocket health" value={health} tone={health === "Excellent" ? "ok" : "warn"} />
    </section>
  );
}

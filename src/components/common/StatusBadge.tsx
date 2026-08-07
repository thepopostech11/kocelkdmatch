import { cn } from "@/lib/utils";
import type { ConnectionState } from "@/types";

const TONE: Record<ConnectionState, string> = {
  idle: "bg-muted-foreground",
  connecting: "bg-warning",
  connected: "bg-success",
  reconnecting: "bg-warning",
  error: "bg-destructive",
};

export function StatusDot({ state, className }: { state: ConnectionState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        TONE[state],
        state === "connected" && "animate-pulse-ring",
        className,
      )}
    />
  );
}

export function StatusBadge({
  state,
  label,
}: {
  state: ConnectionState;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <StatusDot state={state} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

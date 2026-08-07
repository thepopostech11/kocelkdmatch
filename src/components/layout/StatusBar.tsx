import { useEffect, useState } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { APP_CONFIG } from "@/config/app";

export function StatusBar() {
  const { websocket, oauth, marketFeed, latency, symbol, serverTime } = useConnectionStore();
  const [clock, setClock] = useState<string>("--:--:--");

  useEffect(() => {
    const update = () =>
      setClock(new Date(serverTime ?? Date.now()).toISOString().slice(11, 19) + " UTC");
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [serverTime]);

  return (
    <footer className="flex h-9 shrink-0 items-center gap-x-4 gap-y-1 overflow-x-auto border-t border-border bg-surface/80 px-3 text-[11px] backdrop-blur-xl sm:px-4">
      <StatusBadge state={websocket} label="WebSocket" />
      <StatusBadge state={oauth} label="OAuth" />
      <StatusBadge state={marketFeed} label="Market feed" />
      <span className="whitespace-nowrap text-muted-foreground">
        Symbol <span className="font-mono text-foreground">{symbol}</span>
      </span>
      <span className="whitespace-nowrap text-muted-foreground">
        Latency <span className="text-foreground">{latency}ms</span>
      </span>
      <span className="ml-auto flex items-center gap-4 whitespace-nowrap text-muted-foreground">
        <span className="font-mono">{clock}</span>
        <span>v{APP_CONFIG.version}</span>
      </span>
    </footer>
  );
}

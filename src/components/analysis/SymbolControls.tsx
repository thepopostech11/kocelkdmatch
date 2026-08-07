import { useConnectionStore } from "@/stores/connectionStore";
import { SYMBOLS } from "@/config/app";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WINDOWS = [100, 200, 500, 700];

export function SymbolControls() {
  const symbol = useConnectionStore((s) => s.symbol);
  const setSymbol = useConnectionStore((s) => s.setSymbol);
  const tickWindow = useConnectionStore((s) => s.tickWindow);
  const setTickWindow = useConnectionStore((s) => s.setTickWindow);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div className="min-w-[220px] flex-1">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Continuous index
        </p>
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Live tick window
        </p>
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setTickWindow(w)}
              className={cn(
                "min-w-14 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                tickWindow === w
                  ? "bg-gradient-brand text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

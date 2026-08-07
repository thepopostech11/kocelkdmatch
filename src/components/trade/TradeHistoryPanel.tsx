import { useMemo, useState } from "react";
import { ArrowUpDown, History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTradeStore } from "@/stores/tradeStore";
import { cn } from "@/lib/utils";

type SortKey = "closedAt" | "profit" | "stake";

const money = (v: number, c: string) =>
  `${c} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function TradeHistoryPanel() {
  const history = useTradeStore((s) => s.history);
  const clearHistory = useTradeStore((s) => s.clearHistory);
  const [filter, setFilter] = useState<"all" | "won" | "lost">("all");
  const [sortKey, setSortKey] = useState<SortKey>("closedAt");
  const [desc, setDesc] = useState(true);

  const rows = useMemo(() => {
    const filtered = filter === "all" ? history : history.filter((h) => h.result === filter);
    return [...filtered].sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
  }, [history, filter, sortKey, desc]);

  const totals = useMemo(
    () => ({
      net: history.reduce((acc, h) => acc + h.profit, 0),
      won: history.filter((h) => h.result === "won").length,
      currency: history[0]?.currency ?? "USD",
    }),
    [history],
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Trade History</h2>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={clearHistory}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            ["Trades", String(history.length)],
            ["Won", `${totals.won}/${history.length}`],
            ["Net P/L", money(totals.net, totals.currency)],
          ].map(([label, value], i) => (
            <div key={label} className="rounded-xl bg-surface-2/60 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p
                className={cn(
                  "font-mono text-sm font-bold tabular-nums",
                  i === 2 && (totals.net >= 0 ? "text-success" : "text-destructive"),
                )}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
          <History className="size-4" />
          No completed trades yet.
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2">
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleSort("closedAt")}
                  >
                    Time <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-2">Symbol</th>
                <th className="py-2">Digit</th>
                <th className="py-2">
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleSort("stake")}
                  >
                    Stake <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-2">Ticks</th>
                <th className="py-2">Buy</th>
                <th className="py-2">Sell</th>
                <th className="py-2">
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleSort("profit")}
                  >
                    P/L <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-2">Result</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((h) => (
                <tr key={h.contractId} className="border-b border-border/60 last:border-b-0">
                  <td className="py-2">{new Date(h.closedAt).toLocaleTimeString()}</td>
                  <td className="py-2">{h.symbol}</td>
                  <td className="py-2 font-mono font-bold">{h.targetDigit}</td>
                  <td className="py-2">{h.stake.toFixed(2)}</td>
                  <td className="py-2">{h.ticks}</td>
                  <td className="py-2">{h.buyPrice.toFixed(2)}</td>
                  <td className="py-2">{h.sellPrice.toFixed(2)}</td>
                  <td
                    className={cn(
                      "py-2 font-mono font-bold",
                      h.profit >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {h.profit >= 0 ? "+" : ""}
                    {h.profit.toFixed(2)}
                  </td>
                  <td className="py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        h.result === "won"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {h.result === "won" ? "Won" : "Lost"}
                    </span>
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

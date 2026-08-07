import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccountInfo, useAnalysisSnapshot, usePredictionState } from "@/hooks/useMarket";
import { useConnectionStore } from "@/stores/connectionStore";
import { useTradeStore } from "@/stores/tradeStore";
import { TradingEngine } from "@/market/TradingEngine";
import { DURATION_RANGE } from "@/config/app";
import { cn } from "@/lib/utils";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Manual MATCHES order entry. The target digit is seeded from the shared AI
 * recommendation but stays fully under the user's control.
 */
export function TradeTicket() {
  const account = useAccountInfo();
  const snapshot = useAnalysisSnapshot();
  const { prediction } = usePredictionState();
  const symbol = useConnectionStore((s) => s.symbol);
  const risk = useTradeStore((s) => s.risk);

  const [stake, setStake] = useState(risk.defaultStake);
  const [ticks, setTicks] = useState(risk.defaultTicks);
  const [digit, setDigit] = useState<number>(prediction?.targetDigit ?? 0);
  const [touchedDigit, setTouchedDigit] = useState(false);
  const [payout, setPayout] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Seed from the AI recommendation until the user overrides it.
  useEffect(() => {
    if (!touchedDigit && prediction) setDigit(prediction.targetDigit);
  }, [prediction, touchedDigit]);

  const currency = account.currency || "USD";

  // Live payout preview from the Deriv proposal endpoint.
  useEffect(() => {
    let cancelled = false;
    if (!stake || stake <= 0 || !account.authorised) {
      setPayout(null);
      return;
    }
    setQuoting(true);
    const timer = setTimeout(() => {
      void TradingEngine.quote({ symbol, digit, stake, ticks, currency })
        .then((q) => {
          if (!cancelled) setPayout(q.payout);
        })
        .catch(() => {
          if (!cancelled) setPayout(null);
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [symbol, digit, stake, ticks, currency, account.authorised]);

  const profit = payout != null ? payout - stake : null;
  const returnPct = payout != null && stake > 0 ? ((payout - stake) / stake) * 100 : null;
  const overStake = stake > risk.maxStakeWarning;
  const insufficient = stake > account.balance;

  const stat = snapshot.stats[digit];

  const money = (v: number) =>
    `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const submit = async () => {
    setSubmitting(true);
    try {
      const trade = await TradingEngine.buy({ symbol, digit, stake, ticks, currency });
      toast.success("Trade submitted", {
        description: `MATCHES ${digit} · ${money(stake)} · ${ticks} tick${ticks > 1 ? "s" : ""}`,
      });
      setConfirmOpen(false);
      return trade;
    } catch (error) {
      toast.error("Trade rejected", {
        description: error instanceof Error ? error.message : "Deriv did not accept the order.",
      });
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const onMatch = () => {
    if (!account.authorised) {
      toast.error("Not authorised", { description: "Sign in with Deriv before trading." });
      return;
    }
    if (!account.scopes.includes("trade")) {
      toast.error("Trading permission missing", {
        description: "This Deriv token does not include the trade scope.",
      });
      return;
    }
    if (stake <= 0) {
      toast.error("Enter a stake greater than zero.");
      return;
    }
    if (insufficient) {
      toast.error("Insufficient balance", { description: `Available: ${money(account.balance)}` });
      return;
    }
    if (risk.confirmBeforeTrade) setConfirmOpen(true);
    else void submit();
  };

  const summaryRows = useMemo(
    () => [
      ["Target digit", String(digit)],
      ["Stake", money(stake)],
      ["Ticks", String(ticks)],
      ["Estimated payout", payout != null ? money(payout) : "—"],
      ["Estimated profit", profit != null ? money(profit) : "—"],
    ],
    [digit, stake, ticks, payout, profit, currency],
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Manual Trade Ticket</h2>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
          MATCHES
        </span>
      </div>

      {/* Target digit picker */}
      <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Target digit
      </p>
      <div className="mb-4 grid grid-cols-5 gap-1.5">
        {DIGITS.map((d) => {
          const s = snapshot.stats[d];
          const selected = d === digit;
          return (
            <button
              key={d}
              onClick={() => {
                setDigit(d);
                setTouchedDigit(true);
              }}
              className={cn(
                "rounded-xl border py-2 text-center transition-all",
                selected
                  ? "border-primary bg-gradient-brand text-primary-foreground shadow-elevated"
                  : "border-border bg-surface-2/60 hover:border-primary/50",
              )}
            >
              <span className="block font-mono text-base font-bold">{d}</span>
              <span
                className={cn(
                  "block text-[10px] tabular-nums",
                  selected ? "opacity-90" : "text-muted-foreground",
                )}
              >
                {s ? `${s.percentage.toFixed(1)}%` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {prediction && !touchedDigit && (
        <p className="mb-3 text-[11px] text-muted-foreground">
          Seeded from the AI recommendation (digit {prediction.targetDigit},{" "}
          {prediction.confidence}% confidence). Tap any digit to override.
        </p>
      )}

      {/* Stake + ticks */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Stake ({currency})
          </label>
          <Input
            type="number"
            min={0.35}
            step={0.5}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Number of ticks
          </label>
          <Input
            type="number"
            min={DURATION_RANGE.min}
            max={DURATION_RANGE.max}
            value={ticks}
            onChange={(e) =>
              setTicks(
                Math.max(
                  DURATION_RANGE.min,
                  Math.min(DURATION_RANGE.max, Number(e.target.value) || 1),
                ),
              )
            }
          />
        </div>
      </div>

      {/* Estimates */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Payout", payout != null ? money(payout) : "—"],
          ["Profit", profit != null ? money(profit) : "—"],
          ["Return", returnPct != null ? `${returnPct.toFixed(1)}%` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-2/60 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="font-mono text-sm font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {stat && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Digit {digit}: {stat.count} hits · gap {stat.currentGap} · avg gap{" "}
          {stat.averageGap.toFixed(1)}
        </p>
      )}

      {overStake && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-warning">
          <AlertTriangle className="size-3.5" />
          Stake exceeds your {money(risk.maxStakeWarning)} warning threshold.
        </p>
      )}
      {insufficient && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="size-3.5" />
          Stake exceeds the available balance of {money(account.balance)}.
        </p>
      )}

      <Button
        size="lg"
        onClick={onMatch}
        disabled={submitting || !account.authorised}
        className="mt-4 h-14 w-full bg-gradient-brand text-base font-bold"
      >
        {submitting ? (
          <Loader2 className="mr-2 size-5 animate-spin" />
        ) : (
          <TrendingUp className="mr-2 size-5" />
        )}
        <span className="flex flex-col items-start leading-tight">
          <span>MATCH · Digit {digit}</span>
          <span className="text-[11px] font-medium opacity-90">
            {quoting
              ? "Pricing…"
              : payout != null
                ? `Estimated payout ${money(payout)}`
                : "Payout unavailable"}
          </span>
        </span>
      </Button>

      {/* Confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm MATCHES trade</DialogTitle>
            <DialogDescription>
              This places a real contract on your {account.isVirtual ? "demo" : "real"} account{" "}
              {account.loginid}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {summaryRows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-border py-2 last:border-b-0"
              >
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="font-mono text-sm font-bold">{value}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={submitting}
              className="bg-gradient-brand"
            >
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirm & buy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

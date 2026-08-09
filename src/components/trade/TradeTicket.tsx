import { useEffect, useState } from "react";
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAccountInfo,
  useAnalysisSnapshot,
  usePredictionState,
  useSymbolCatalogue,
} from "@/hooks/useMarket";
import { useConnectionStore } from "@/stores/connectionStore";
import { useTradeStore } from "@/stores/tradeStore";
import { TradingEngine } from "@/market/TradingEngine";
import {
  TradeValidationError,
  buildMatchTradeRequest,
} from "@/market/MatchTradeParameterBuilder";
import { DURATION_RANGE } from "@/config/app";
import { cn } from "@/lib/utils";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type TradePhase = "idle" | "validating" | "pricing" | "buying" | "confirmed" | "rejected";
type ProposalDiagnostics = {
  stage: "idle" | "sending" | "valid" | "rejected";
  askPrice: number | null;
  payout: number | null;
  proposalId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorParameter: string | null;
};

/**
 * Manual MATCHES order entry. The target digit is seeded from the shared AI
 * recommendation but stays fully under the user's control.
 */
export function TradeTicket() {
  const account = useAccountInfo();
  const snapshot = useAnalysisSnapshot();
  const { prediction } = usePredictionState();
  const symbol = useConnectionStore((s) => s.symbol);
  const symbolCatalogue = useSymbolCatalogue();
  const risk = useTradeStore((s) => s.risk);

  const [stake, setStake] = useState(risk.defaultStake);
  const [ticks, setTicks] = useState(risk.defaultTicks);
  const [digit, setDigit] = useState<number>(prediction?.targetDigit ?? 0);
  const [touchedDigit, setTouchedDigit] = useState(false);
  const [payout, setPayout] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [phase, setPhase] = useState<TradePhase>("idle");
  const [proposalDiagnostics, setProposalDiagnostics] = useState<ProposalDiagnostics>({
    stage: "idle",
    askPrice: null,
    payout: null,
    proposalId: null,
    errorCode: null,
    errorMessage: null,
    errorParameter: null,
  });
  const [rejection, setRejection] = useState<{ parameter: string; value: string; reason: string } | null>(null);
  const [lastContract, setLastContract] = useState<string | null>(null);
  const submitting = phase === "validating" || phase === "pricing" || phase === "buying";

  // Seed from the AI recommendation until the user overrides it.
  useEffect(() => {
    if (!touchedDigit && prediction) setDigit(prediction.targetDigit);
  }, [prediction, touchedDigit]);

  const currency = account.currency || "USD";
  const symbolName =
    symbolCatalogue.find((item) => item.symbol === symbol)?.displayName ?? symbol;

  // Live payout preview from the Deriv proposal endpoint.
  useEffect(() => {
    let cancelled = false;
    if (!stake || stake <= 0 || !account.authorised) {
      setPayout(null);
      return;
    }
    setQuoting(true);
    setProposalDiagnostics({
      stage: "sending",
      askPrice: null,
      payout: null,
      proposalId: null,
      errorCode: null,
      errorMessage: null,
      errorParameter: null,
    });
    const timer = setTimeout(() => {
      void TradingEngine.quote({
        symbol,
        digit,
        stake,
        ticks,
        currency,
        availableSymbols: symbolCatalogue,
      })
        .then((q) => {
          if (!cancelled) {
            setPayout(q.payout);
            setProposalDiagnostics({
              stage: "valid",
              askPrice: q.askPrice,
              payout: q.payout,
              proposalId: q.id,
              errorCode: null,
              errorMessage: null,
              errorParameter: null,
            });
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setPayout(null);
            const detail = TradingEngine.lastErrorDetails;
            setProposalDiagnostics({
              stage: "rejected",
              askPrice: null,
              payout: null,
              proposalId: null,
              errorCode: detail?.code ?? null,
              errorMessage: detail?.message ?? (error instanceof Error ? error.message : "Deriv rejected the proposal."),
              errorParameter: detail?.parameter ?? null,
            });
          }
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [symbol, digit, stake, ticks, currency, account.authorised, symbolCatalogue]);

  const profit = payout != null ? payout - stake : null;
  const returnPct = payout != null && stake > 0 ? ((payout - stake) / stake) * 100 : null;
  const overStake = stake > risk.maxStakeWarning;
  const insufficient = stake > account.balance;

  const stat = snapshot.stats[digit];

  const money = (v: number) =>
    `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const onMatch = async () => {
    if (submitting) return;
    setRejection(null);
    setLastContract(null);

    if (!account.authorised) {
      setPhase("rejected");
      setRejection({ parameter: "session", value: "unauthorised", reason: "Sign in with Deriv before trading." });
      return;
    }
    if (!account.scopes.includes("trade")) {
      setPhase("rejected");
      setRejection({
        parameter: "permission",
        value: "read only",
        reason: "This Deriv session does not include the trade scope.",
      });
      return;
    }

    setPhase("validating");
    let request;
    try {
      request = buildMatchTradeRequest({
        symbol,
        digit,
        stake,
        ticks,
        currency,
        availableSymbols: symbolCatalogue,
        balance: account.availableBalance || account.balance,
      });
    } catch (error) {
      setPhase("rejected");
      if (error instanceof TradeValidationError) {
        setRejection({ parameter: error.parameter, value: String(error.value), reason: error.reason });
      } else {
        setRejection({
          parameter: "request",
          value: "—",
          reason: error instanceof Error ? error.message : "Trade could not be validated.",
        });
      }
      return;
    }

    setPhase("pricing");
    try {
      setProposalDiagnostics((prev) => ({ ...prev, stage: "sending" }));
      const proposal = await TradingEngine.quote({
        symbol,
        digit,
        stake,
        ticks,
        currency,
        availableSymbols: symbolCatalogue,
        balance: account.availableBalance || account.balance,
      });
      setPayout(proposal.payout);
      setProposalDiagnostics({
        stage: "valid",
        askPrice: proposal.askPrice,
        payout: proposal.payout,
        proposalId: proposal.id,
        errorCode: null,
        errorMessage: null,
        errorParameter: null,
      });
      setPhase("buying");
      const trade = await TradingEngine.buyFromProposal(
        {
          symbol,
          digit,
          stake,
          ticks,
          currency,
          availableSymbols: symbolCatalogue,
          balance: account.availableBalance || account.balance,
        },
        proposal,
      );
      setPayout(trade.payout);
      setProposalDiagnostics((prev) => ({
        ...prev,
        payout: trade.payout,
        proposalId: proposal.id,
      }));
      setLastContract(trade.contractId);
      setPhase("confirmed");
      toast.success("MATCH trade confirmed", {
        description: `${request.debug.displayName} · digit ${digit} · ${money(stake)} · ${ticks} tick${ticks > 1 ? "s" : ""} · #${trade.contractId}`,
      });
    } catch (error) {
      setPhase("rejected");
      const reason = error instanceof Error ? error.message : "Deriv did not accept the order.";
      const detail = TradingEngine.lastErrorDetails;
      setProposalDiagnostics({
        stage: "rejected",
        askPrice: null,
        payout: null,
        proposalId: null,
        errorCode: detail?.code ?? null,
        errorMessage: detail?.message ?? reason,
        errorParameter: detail?.parameter ?? null,
      });
      setRejection(
        error instanceof TradeValidationError
          ? { parameter: error.parameter, value: String(error.value), reason: error.reason }
          : { parameter: "deriv", value: "proposal/buy", reason },
      );
      toast.error("MATCH trade rejected", { description: reason });
    }
  };

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
        onClick={() => void onMatch()}
        disabled={submitting || !account.authorised}
        className="mt-4 h-14 w-full bg-gradient-brand text-base font-bold"
      >
        {submitting ? (
          <Loader2 className="mr-2 size-5 animate-spin" />
        ) : (
          <TrendingUp className="mr-2 size-5" />
        )}
        <span className="flex flex-col items-start leading-tight">
          <span>
            {phase === "validating"
              ? "VALIDATING…"
              : phase === "pricing"
                ? "GETTING PRICE…"
                : phase === "buying"
                  ? "BUYING MATCH…"
                  : `BUY MATCH · Digit ${digit}`}
          </span>
          <span className="text-[11px] font-medium opacity-90">
            {quoting
              ? "Pricing…"
              : payout != null
                ? `PAYOUT ${money(payout)}`
                : "Payout unavailable"}
          </span>
        </span>
      </Button>

      {phase === "confirmed" && lastContract && (
        <div className="mt-3 rounded-xl border border-success/40 bg-success/10 p-3 text-[11px]">
          <p className="text-xs font-bold text-success">MATCH TRADE CONFIRMED</p>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono tabular-nums">
            <span className="text-muted-foreground">Symbol</span>
            <span className="text-right">{symbolName}</span>
            <span className="text-muted-foreground">Digit</span>
            <span className="text-right">{digit}</span>
            <span className="text-muted-foreground">Duration</span>
            <span className="text-right">{ticks} ticks</span>
            <span className="text-muted-foreground">Stake</span>
            <span className="text-right">{money(stake)}</span>
            <span className="text-muted-foreground">Contract ID</span>
            <span className="text-right">{lastContract}</span>
          </div>
        </div>
      )}

      {phase === "rejected" && rejection && (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-[11px]">
          <p className="text-xs font-bold text-destructive">MATCH TRADE REJECTED</p>
          <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-muted-foreground">Parameter</span>
            <span className="font-mono">{rejection.parameter}</span>
            <span className="text-muted-foreground">Value</span>
            <span className="font-mono">{rejection.value}</span>
            <span className="text-muted-foreground">Reason</span>
            <span>{rejection.reason}</span>
          </div>
        </div>
      )}

      {import.meta.env.DEV && (
        <details className="mt-3 rounded-xl border border-border bg-surface-2/50 p-3 text-[11px]">
          <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Match request debug
          </summary>
          <div className="mt-2 space-y-2">
            <div className="rounded-lg border border-border/70 bg-background/50 p-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Match request
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono tabular-nums">
                <span className="text-muted-foreground">Contract type</span>
                <span className="text-right">DIGITMATCH</span>
                <span className="text-muted-foreground">Underlying symbol</span>
                <span className="text-right">{symbol}</span>
                <span className="text-muted-foreground">Barrier</span>
                <span className="text-right">{digit}</span>
                <span className="text-muted-foreground">Stake</span>
                <span className="text-right">{stake}</span>
                <span className="text-muted-foreground">Duration</span>
                <span className="text-right">{ticks}</span>
                <span className="text-muted-foreground">Duration unit</span>
                <span className="text-right">t</span>
                <span className="text-muted-foreground">Currency</span>
                <span className="text-right">{currency}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Proposal status
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono tabular-nums">
                <span className="text-muted-foreground">Status</span>
                <span className="text-right">
                  {proposalDiagnostics.stage === "sending"
                    ? "Request → Sending"
                    : proposalDiagnostics.stage === "valid"
                      ? "Proposal → Valid"
                      : proposalDiagnostics.stage === "rejected"
                        ? "Proposal → Rejected"
                        : "Idle"}
                </span>
                <span className="text-muted-foreground">Ask price</span>
                <span className="text-right">
                  {proposalDiagnostics.askPrice != null ? money(proposalDiagnostics.askPrice) : "—"}
                </span>
                <span className="text-muted-foreground">Payout</span>
                <span className="text-right">
                  {proposalDiagnostics.payout != null ? money(proposalDiagnostics.payout) : "—"}
                </span>
                <span className="text-muted-foreground">Proposal ID</span>
                <span className="text-right">{proposalDiagnostics.proposalId ?? "—"}</span>
                <span className="text-muted-foreground">Error</span>
                <span className="text-right">{proposalDiagnostics.errorCode ?? "—"}</span>
                <span className="text-muted-foreground">Message</span>
                <span className="text-right">{proposalDiagnostics.errorMessage ?? "—"}</span>
              </div>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}

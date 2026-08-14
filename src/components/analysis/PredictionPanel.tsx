import { useEffect, useState } from "react";
import { validate7Layers } from "@/analysis/validator";
import { Brain, Target, Timer, Zap, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePredictionState, useAnalysisSnapshot } from "@/hooks/useMarket";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { cn } from "@/lib/utils";

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-sm font-bold tabular-nums", accent && "text-gradient")}>
        {value}
      </p>
    </div>
  );
}

export function PredictionPanel() {
  const snapshot = useAnalysisSnapshot();
  const { prediction, entry, predict } = usePredictionState();
  const [validation, setValidation] = useState<{ name: string; status: "ANALYZING" | "PASSED" | "FAILED" }[] | null>(null);
  const record = useAnalysisStore((s) => s.record);
  const markResolved = useAnalysisStore((s) => s.markResolved);
  const notify = useNotificationStore((s) => s.push);

  const ready = snapshot.live.bufferSize >= 20;

  useEffect(() => {
    if (!prediction) return;
    if (entry.confirmed) {
      markResolved(prediction.id, { confirmedAt: entry.confirmedAt });
    } else if (entry.expired) {
      markResolved(prediction.id, { expired: true });
    }
  }, [prediction, entry.confirmed, entry.expired, entry.confirmedAt, markResolved]);

  const handlePredict = () => {
    const result = predict();
    if (!result) {
      notify("warning", "Not enough data", "Collecting ticks before running the models.");
      return;
    }
    record(result);
    notify(
      "info",
      `Target digit ${result.targetDigit}`,
      `Entry trigger ${result.entryTrigger} · ${result.confidence}% confidence`,
    );
    // Begin progressive validation using the prediction and snapshot data
    runValidation(result, snapshot).catch(() => {});
  };

  async function runValidation(prediction: NonNullable<typeof prediction>, snapshot: ReturnType<typeof useAnalysisSnapshot>) {
    const res = validate7Layers(snapshot, prediction as any);
    // animate progressive reveal
    setValidation(res.layers.map((l: any) => ({ name: l.name, status: "ANALYZING" as const })));
    for (let i = 0; i < res.layers.length; i++) {
      await new Promise((r) => setTimeout(r, 120));
      setValidation((prev) => {
        if (!prev) return null;
        const next = prev.slice();
        next[i] = { name: res.layers[i].name, status: res.layers[i].passed ? "PASSED" : "FAILED" };
        return next;
      });
    }
    // If all layers passed, re-run predict() to nudge the global prediction (causes TradeTicket seeding)
    if (res.passed) {
      try {
        predict();
      } catch {}
    }
  }

  function getMinFrequency() {
    // read from settings store default if available
    try {
      // dynamic import to avoid circular hooks in render path
      // fallback to 12
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useSettingsStore } = require("@/stores/settingsStore");
      return useSettingsStore.getState().strategyMinHighestFrequency ?? 12;
    } catch {
      return 12;
    }
  }

  const age = prediction ? entry.ticksObserved : 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <h2 className="text-sm font-bold">Unified AI Decision Engine</h2>
        </div>
        <button
          onClick={handlePredict}
          disabled={!ready}
          className="rounded-xl bg-gradient-brand px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-elevated transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
        >
          PREDICT
        </button>
      </div>

      {!prediction ? (
        <p className="rounded-xl bg-surface-2/60 px-3 py-6 text-center text-xs text-muted-foreground">
          {ready
            ? "Run the engine to generate a MATCHES recommendation package."
            : "Buffering live ticks from Deriv…"}
        </p>
      ) : (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-center">
              <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Target className="size-3" /> Target digit
              </p>
              <p className="font-mono text-4xl font-bold text-gradient">{prediction.targetDigit}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-2/60 p-3 text-center">
              <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Zap className="size-3" /> Entry trigger
              </p>
              <p className="font-mono text-4xl font-bold">{prediction.entryTrigger}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-2/60 p-3 text-center">
              <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Timer className="size-3" /> Duration
              </p>
              <p className="font-mono text-4xl font-bold">{prediction.suggestedDuration}</p>
              <p className="text-[10px] text-muted-foreground">ticks</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Confidence" value={`${prediction.confidence}%`} accent />
            <Metric label="Entry opportunity" value={`${prediction.entryOpportunity}%`} />
            <Metric label="Market quality" value={`${prediction.marketQuality}%`} />
            <Metric label="Prediction health" value={`${prediction.predictionHealth}%`} />
            <Metric label="Observation window" value={`${prediction.observationWindow} ticks`} />
            <Metric label="Prediction lifetime" value={`${prediction.lifetimeTicks} ticks`} />
            <Metric label="Prediction age" value={`${age} ticks`} />
            <Metric label="Strategy agreement" value={`${prediction.strategyAgreement}%`} />
          </div>

          <div className="mt-3 rounded-xl bg-surface-2/60 px-3 py-2 text-xs">
            <p className="text-muted-foreground">
              Winning strategy:{" "}
              <span className="font-semibold text-foreground">{prediction.winningStrategy}</span>
            </p>
            <p className="mt-1 text-muted-foreground">
              Supporting: {prediction.supportingStrategies.join(" · ")}
            </p>
            <p className="mt-1 text-muted-foreground">
              Prediction stability:{" "}
              <span className="font-mono text-foreground">{prediction.stability}%</span>
            </p>
          </div>

          {/* Live entry monitor */}
          <AnimatePresence mode="wait">
            {entry.confirmed ? (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 rounded-xl border border-success/50 bg-success/15 p-3"
              >
                <p className="flex items-center gap-2 text-sm font-bold text-success">
                  <CheckCircle2 className="size-4" /> ENTRY CONFIRMED
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Metric label="Trigger digit" value={String(prediction.entryTrigger)} />
                  <Metric label="Target digit" value={String(prediction.targetDigit)} />
                  <Metric label="Duration" value={`${prediction.suggestedDuration} ticks`} />
                  <Metric label="Confidence" value={`${prediction.confidence}%`} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Strategy: {prediction.winningStrategy} · No trade is placed — execution ships in Phase 3.
                </p>
              </motion.div>
            ) : entry.expired ? (
              <motion.div
                key="expired"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 p-3 text-xs text-muted-foreground"
              >
                <XCircle className="size-4" /> Prediction expired without the trigger digit appearing.
              </motion.div>
            ) : (
              <motion.div
                key="watching"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs"
              >
                <span className="size-2 animate-pulse rounded-full bg-primary" />
                Watching every tick for trigger digit{" "}
                <span className="font-mono font-bold">{prediction.entryTrigger}</span> · {age}/
                {prediction.lifetimeTicks} ticks observed
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3 rounded-xl border border-border bg-surface-2/40 p-3">
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              AI reasoning
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {prediction.reasoning.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Statistical guidance only — no outcome is guaranteed.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

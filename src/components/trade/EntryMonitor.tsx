import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap } from "lucide-react";
import { MarketEngine } from "@/market/MarketEngine";
import { usePredictionState } from "@/hooks/useMarket";
import { useTradeStore } from "@/stores/tradeStore";

/** Short confirmation chime. Uses WebAudio so no asset is required. */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* audio is best-effort only */
  }
}

/**
 * Watches the shared engine's entry state and raises a large animated banner
 * the moment the AI entry-trigger digit appears in the live stream.
 */
export function EntryMonitor() {
  const { prediction, entry } = usePredictionState();
  const risk = useTradeStore((s) => s.risk);
  const [visible, setVisible] = useState(false);
  const [shownFor, setShownFor] = useState<number | null>(null);
  const [hideOnNextTick, setHideOnNextTick] = useState(false);

  const confirmedAt = entry.confirmedAt;

  useEffect(() => {
    if (!entry.confirmed || !confirmedAt || confirmedAt === shownFor) return;
    setShownFor(confirmedAt);
    setVisible(true);
    setHideOnNextTick(true);
    if (risk.entrySoundEnabled) playChime();
  }, [entry.confirmed, confirmedAt, shownFor, risk.entrySoundEnabled]);

  useEffect(() => {
    if (!hideOnNextTick) return;
    const unsubscribe = MarketEngine.onTick(() => {
      setVisible(false);
      setHideOnNextTick(false);
    });
    return unsubscribe;
  }, [hideOnNextTick]);

  return (
    <AnimatePresence>
      {visible && prediction && (
        <motion.section
          initial={{ opacity: 0, scale: 0.94, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          className="relative overflow-hidden rounded-2xl border border-success bg-success/10 p-5 shadow-elevated"
        >
          <span className="pointer-events-none absolute inset-0 animate-pulse bg-success/10" />
          <div className="relative flex flex-wrap items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-success text-success-foreground">
              <Zap className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black tracking-tight text-success sm:text-2xl">
                ENTRY CONFIRMED
              </h2>
              <p className="text-xs text-muted-foreground">
                Trigger digit {prediction.entryTrigger} appeared in the live stream.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Trigger", String(prediction.entryTrigger)],
                ["Target", String(prediction.targetDigit)],
                ["Duration", `${prediction.suggestedDuration}t`],
                ["Confidence", `${prediction.confidence}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-surface-2/80 px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="font-mono text-base font-bold">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="relative mt-3 text-[11px] text-muted-foreground">
            Winning strategy: {prediction.winningStrategy}
          </p>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

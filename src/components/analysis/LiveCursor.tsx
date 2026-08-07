import { useEffect, useRef, useState } from "react";
import { useAnalysisSnapshot } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Live cursor — mirrors the Deriv DTrader digit strip. The animated marker is
 * driven by requestAnimationFrame so it never debounces or drops a tick.
 */
export function LiveCursor() {
  const snapshot = useAnalysisSnapshot();
  const current = snapshot.live.currentDigit;
  const trackRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const targetX = useRef(0);
  const currentX = useRef(0);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cell = track.querySelector<HTMLElement>(`[data-digit="${current}"]`);
    if (cell) targetX.current = cell.offsetLeft + cell.offsetWidth / 2;
    setFlash((f) => f + 1);
  }, [current, snapshot.updatedAt]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      currentX.current += (targetX.current - currentX.current) * 0.28;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translateX(${currentX.current}px) translateX(-50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const price = snapshot.live.currentPrice;
  const pip = snapshot.digits.length ? 0 : 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Live price</p>
          <p key={flash} className="font-mono text-2xl font-bold tabular-nums animate-in fade-in">
            {price ? price.toFixed(Math.max(2, pip || 2)) : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last digit</p>
          <p className="font-mono text-2xl font-bold text-gradient tabular-nums">{current}</p>
        </div>
      </div>

      <div ref={trackRef} className="relative flex gap-1">
        {DIGITS.map((d) => {
          const stat = snapshot.stats[d]!;
          return (
            <div
              key={d}
              data-digit={d}
              className={cn(
                "flex-1 rounded-xl border py-2 text-center transition-colors duration-150",
                d === current
                  ? "border-primary bg-primary/20"
                  : "border-border bg-surface-2/60",
              )}
            >
              <p className="font-mono text-sm font-bold">{d}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {stat.percentage.toFixed(1)}%
              </p>
            </div>
          );
        })}
        <div
          ref={cursorRef}
          className="pointer-events-none absolute -bottom-2 left-0 size-0 border-x-8 border-b-8 border-x-transparent border-b-primary"
          aria-hidden
        />
      </div>
    </section>
  );
}

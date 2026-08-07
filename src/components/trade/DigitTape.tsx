import { useEffect, useRef } from "react";
import { useDigitTape } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

/**
 * Premium scrolling last-digit tape. Renders the last 100 digits from the
 * shared rolling buffer and keeps the newest digit pinned into view.
 */
export function DigitTape({ count = 100 }: { count?: number }) {
  const digits = useDigitTape(count);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Always keep the newest digit visible without interrupting the animation.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [digits.length, digits[digits.length - 1]]);

  const newestIndex = digits.length - 1;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Live Last Digits</h2>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {digits.length} of {count}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {digits.length === 0 && (
          <p className="py-3 text-xs text-muted-foreground">Waiting for the live tick stream…</p>
        )}
        {digits.map((d, i) => {
          const isNewest = i === newestIndex;
          return (
            <span
              key={`${i}-${d}`}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border font-mono text-sm font-bold transition-all duration-200",
                isNewest
                  ? "scale-110 border-primary bg-gradient-brand text-primary-foreground shadow-elevated"
                  : "border-border bg-surface-2/60 text-muted-foreground",
              )}
            >
              {d}
            </span>
          );
        })}
      </div>
    </section>
  );
}

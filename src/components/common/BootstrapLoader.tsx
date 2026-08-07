import { motion } from "framer-motion";
import { APP_CONFIG } from "@/config/app";

export function BootstrapLoader({ progress, stage }: { progress: number; stage: string }) {
  const pct = Math.min(100, Math.round(progress));
  const circumference = 2 * Math.PI * 86;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-background px-6"
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-gradient-brand opacity-20 blur-[120px] animate-aurora" />

      <div className="relative flex size-56 items-center justify-center sm:size-64">
        <svg viewBox="0 0 200 200" className="size-full -rotate-90">
          <circle
            cx="100"
            cy="100"
            r="86"
            fill="none"
            strokeWidth="8"
            className="stroke-border"
            opacity="0.5"
          />
          <motion.circle
            cx="100"
            cy="100"
            r="86"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            stroke="url(#kocelGrad)"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="kocelGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--secondary)" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-6xl font-bold text-gradient opacity-70 tabular-nums sm:text-7xl">
            {pct}
            <span className="text-3xl">%</span>
          </span>
        </div>
      </div>

      <h2 className="mt-8 text-center text-xl font-bold tracking-tight sm:text-2xl">
        {APP_CONFIG.name}
      </h2>
      <motion.p
        key={stage}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 text-center text-sm text-muted-foreground"
      >
        {stage}
      </motion.p>

      <div className="mt-6 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-gradient-brand"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">v{APP_CONFIG.version}</p>
    </motion.div>
  );
}

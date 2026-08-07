import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

type Props = {
  phase: number;
  title: string;
  icon: LucideIcon;
  bullets: string[];
};

export function ComingSoon({ phase, title, icon: Icon, bullets }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center sm:py-20"
    >
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-3xl bg-gradient-brand opacity-30 blur-2xl" />
        <div className="panel relative flex size-20 items-center justify-center rounded-3xl">
          <Icon className="size-9 text-primary" />
        </div>
      </div>

      <span className="rounded-full border border-border bg-surface-2 px-4 py-1.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Coming in Phase {phase}
      </span>

      <h1 className="mt-5 text-3xl font-bold text-gradient sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
        The interface shell, state layer and streaming foundation are ready. This module activates in
        Phase {phase}.
      </p>

      <div className="mt-10 grid w-full gap-3 sm:grid-cols-3">
        {bullets.map((b) => (
          <div key={b} className="panel px-4 py-5 text-sm text-muted-foreground">
            {b}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

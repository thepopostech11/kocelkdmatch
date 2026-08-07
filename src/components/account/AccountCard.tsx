import { Wallet, ShieldCheck, Mail, IdCard, Coins, Activity, ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccountInfo, useDiagnostics } from "@/hooks/useMarket";
import { useConnectionStore } from "@/stores/connectionStore";
import { SYMBOLS } from "@/config/app";
import { cn } from "@/lib/utils";

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2/60 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="size-3" /> : null}
        {label}
      </p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

export function AccountCard() {
  const account = useAccountInfo();
  const diagnostics = useDiagnostics();
  const symbol = useConnectionStore((s) => s.symbol);
  const [open, setOpen] = useState(true);

  const symbolLabel = SYMBOLS.find((s) => s.value === symbol)?.label ?? symbol;
  const money = (v: number) =>
    `${account.currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground">
          <Wallet className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            {account.fullname || "Deriv Account"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {account.loginid || "—"} · {account.isVirtual ? "Demo" : "Real"}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-mono text-base font-bold text-gradient">
            {money(account.balance)}
          </span>
          <span className="text-[10px] text-muted-foreground">Balance</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3 xl:grid-cols-4">
              <Field label="Account holder" value={account.fullname || "—"} />
              <Field label="Login ID" value={account.loginid || "—"} icon={IdCard} />
              <Field label="Account type" value={account.isVirtual ? "Demo" : "Real"} />
              <Field label="Currency" value={account.currency} icon={Coins} />
              <Field label="Current balance" value={money(account.balance)} />
              <Field label="Available balance" value={money(account.availableBalance)} />
              <Field
                label="Account status"
                value={account.authorised ? "Authorised" : "Awaiting authorisation"}
                icon={ShieldCheck}
              />
              <Field label="Email" value={account.email || "Not provided"} icon={Mail} />
              <Field label="Current symbol" value={symbolLabel} icon={Activity} />
              <Field
                label="Connection"
                value={diagnostics.feed === "streaming" ? "Live" : diagnostics.socket}
              />
              <Field label="Landing company" value={account.landingCompany || "—"} />
              <Field label="Permissions" value={account.scopes.join(", ") || "—"} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

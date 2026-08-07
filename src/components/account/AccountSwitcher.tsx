import { Check, ChevronsUpDown, Wallet } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useAccountInfo } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const money = (v: number, currency: string) =>
  `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Lets the user switch between every Deriv account on their login
 * (demo and real). Switching re-authorizes on the existing socket.
 */
export function AccountSwitcher({ className }: { className?: string }) {
  const accounts = useAuthStore((s) => s.accounts);
  const activeLoginId = useAuthStore((s) => s.activeLoginId);
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount);
  const live = useAccountInfo();

  const active = accounts.find((a) => a.loginid === activeLoginId);
  const real = accounts.filter((a) => !a.isVirtual);
  const demo = accounts.filter((a) => a.isVirtual);

  if (!accounts.length) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
      >
        No linked accounts yet
      </div>
    );
  }

  const balanceFor = (loginid: string, fallback: number, currency: string) =>
    live.loginid === loginid ? money(live.balance, live.currency) : money(fallback, currency);

  const renderGroup = (label: string, list: typeof accounts) =>
    list.length ? (
      <>
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        {list.map((a) => (
          <DropdownMenuItem
            key={a.loginid}
            onSelect={() => setActiveAccount(a.loginid)}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                a.isVirtual ? "bg-warning" : "bg-success",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{a.loginid}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {balanceFor(a.loginid, a.balance, a.currency)}
              </span>
            </span>
            {a.loginid === activeLoginId && <Check className="size-4 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
      </>
    ) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-left transition-colors hover:bg-surface-2/70",
          className,
        )}
      >
        <Wallet className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold">
            {active?.loginid ?? "Select account"}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {active?.isVirtual ? "Demo" : "Real"} ·{" "}
            {active ? balanceFor(active.loginid, active.balance, active.currency) : "—"}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {renderGroup("Real accounts", real)}
        {real.length > 0 && demo.length > 0 && <DropdownMenuSeparator />}
        {renderGroup("Demo accounts", demo)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

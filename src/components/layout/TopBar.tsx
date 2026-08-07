import { useEffect, useState } from "react";
import { Bell, Check, ChevronDown, LogOut, Wallet } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuthStore, selectActiveAccount } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAccountInfo } from "@/hooks/useMarket";
import { NAV_ITEMS } from "@/components/layout/navItems";
import { APP_CONFIG, SYMBOLS } from "@/config/app";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  onLogout: () => void;
};

const money = (v: number, currency: string) =>
  `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export function TopBar({ onLogout }: Props) {
  const accounts = useAuthStore((s) => s.accounts);
  const stored = useAuthStore(selectActiveAccount);
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount);
  const live = useAccountInfo();
  const symbol = useConnectionStore((s) => s.symbol);
  const setSymbol = useConnectionStore((s) => s.setSymbol);
  const notifications = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const unread = notifications.filter((n) => !n.read).length;
  const loginId = live.loginid || stored?.loginid || "";
  const currency = live.currency || stored?.currency || "USD";
  const balance = live.loginid === loginId && live.authorised ? live.balance : (stored?.balance ?? 0);
  const isVirtual = live.loginid === loginId ? live.isVirtual : Boolean(stored?.isVirtual);

  const balanceFor = (id: string, fallback: number, cur: string) =>
    live.loginid === id && live.authorised ? money(live.balance, live.currency) : money(fallback, cur);

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-surface/85 backdrop-blur-xl">
      {/* Row 1 — identity, balance, actions */}
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        <Link to="/app/analysis" className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold tracking-tight">{APP_CONFIG.name}</span>
          <span className="hidden truncate text-[10px] text-muted-foreground sm:block">
            {APP_CONFIG.tagline}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Account + balance */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-2.5 py-1.5 text-left sm:px-3">
              <Wallet className="size-4 shrink-0 text-primary" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-mono text-xs font-bold">
                  {mounted ? loginId || "No account" : "—"}
                </span>
                <span
                  className={cn(
                    "truncate text-[10px] tabular-nums",
                    isVirtual ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {mounted ? `${isVirtual ? "DEMO" : "REAL"} · ${money(balance, currency)}` : "—"}
                </span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Switch account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accounts.length === 0 && (
                <DropdownMenuItem disabled>No accounts available</DropdownMenuItem>
              )}
              {accounts.map((a) => (
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
                    <span className="block truncate font-mono text-xs font-semibold">
                      {a.loginid}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {a.isVirtual ? "Demo" : "Real"} ·{" "}
                      {balanceFor(a.loginid, a.balance, a.currency)}
                    </span>
                  </span>
                  {a.loginid === loginId && <Check className="size-4 shrink-0 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <DropdownMenu onOpenChange={(o) => o && markAllRead()}>
            <DropdownMenuTrigger className="relative rounded-xl border border-border bg-surface-2 p-2">
              <Bell className="size-4" />
              {mounted && unread > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  You&apos;re all caught up
                </div>
              )}
              {notifications.slice(0, 8).map((n) => (
                <div key={n.id} className="px-3 py-2">
                  <p className="text-xs font-semibold">{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground">{n.message}</p>}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={onLogout}
            aria-label="Logout"
            className="rounded-xl border border-border bg-surface-2 p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      {/* Row 2 — primary navigation */}
      <div className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-2 py-1.5 sm:px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-gradient-brand text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="ml-auto shrink-0 pl-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-medium">
              <span className="hidden text-muted-foreground sm:inline">Symbol</span>
              <span className="font-mono font-semibold">{symbol}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
              <DropdownMenuLabel>Market symbol</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SYMBOLS.map((s) => (
                <DropdownMenuItem key={s.value} onSelect={() => setSymbol(s.value)}>
                  <span className="font-mono text-xs">{s.value}</span>
                  <span className="ml-2 text-muted-foreground">{s.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

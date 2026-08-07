import { useEffect, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, PanelLeft, Settings, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuthStore, selectActiveAccount } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { StatusBadge } from "@/components/common/StatusBadge";
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
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  onLogout: () => void;
};

export function TopBar({ onToggleSidebar, onOpenMobile, onLogout }: Props) {
  const accounts = useAuthStore((s) => s.accounts);
  const active = useAuthStore(selectActiveAccount);
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount);
  const websocket = useConnectionStore((s) => s.websocket);
  const symbol = useConnectionStore((s) => s.symbol);
  const setSymbol = useConnectionStore((s) => s.setSymbol);
  const notifications = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const unread = notifications.filter((n) => !n.read).length;
  const symbolLabel = SYMBOLS.find((s) => s.value === symbol)?.label ?? symbol;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/80 px-3 backdrop-blur-xl sm:px-4">
      <button
        onClick={onOpenMobile}
        aria-label="Open menu"
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      <button
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted lg:block"
      >
        <PanelLeft className="size-5" />
      </button>

      <Link to="/app/analysis" className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-sm font-bold text-primary-foreground">
          KD
        </span>
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-sm font-bold tracking-tight">{APP_CONFIG.name}</span>
          <span className="truncate text-[10px] text-muted-foreground">{APP_CONFIG.tagline}</span>
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Symbol selector */}
        <DropdownMenu>
          <DropdownMenuTrigger className="hidden items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-medium md:flex">
            <span className="text-muted-foreground">Symbol</span>
            <span className="font-semibold">{symbol}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
            <DropdownMenuLabel>Market symbol</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SYMBOLS.map((s) => (
              <DropdownMenuItem key={s.value} onClick={() => setSymbol(s.value)}>
                <span className="font-mono text-xs">{s.value}</span>
                <span className="ml-2 text-muted-foreground">{s.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Account selector */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-2.5 py-2 text-xs font-medium sm:px-3">
            <Wallet className="size-4 text-primary" />
            <span className="flex flex-col items-start leading-tight">
              <span className="font-semibold">
                {active
                  ? `${active.balance.toFixed(2)} ${active.currency}`
                  : mounted
                    ? "No account"
                    : "—"}
              </span>
              <span
                className={cn(
                  "text-[10px]",
                  active?.isVirtual ? "text-warning" : "text-muted-foreground",
                )}
              >
                {active ? (active.isVirtual ? "DEMO" : "REAL") : "—"}
              </span>
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Authorized accounts</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accounts.length === 0 && (
              <DropdownMenuItem disabled>No accounts available</DropdownMenuItem>
            )}
            {accounts.map((a) => (
              <DropdownMenuItem key={a.loginid} onClick={() => setActiveAccount(a.loginid)}>
                <span className="font-mono text-xs">{a.loginid}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {a.isVirtual ? "Demo" : "Real"} · {a.currency}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs lg:block">
          <StatusBadge state={websocket} label={symbolLabel} />
        </div>

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
                You're all caught up
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

        <Link
          to="/app/settings"
          className="hidden rounded-xl border border-border bg-surface-2 p-2 sm:block"
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="size-9 shrink-0 rounded-full bg-gradient-brand text-xs font-bold text-primary-foreground">
            {active?.loginid?.slice(0, 2).toUpperCase() ?? "KD"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{active?.loginid ?? "Deriv user"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="mr-2 size-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

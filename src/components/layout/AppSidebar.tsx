import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Bot, LineChart, LogOut, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const NAV_ITEMS = [
  { to: "/app/analysis", label: "Analysis", icon: LineChart },
  { to: "/app/manual-trade", label: "Manual Trade", icon: Activity },
  { to: "/app/bot", label: "Bot", icon: Bot },
  { to: "/app/settings", label: "Settings", icon: Settings },
] as const;

type Props = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
};

export function AppSidebar({ collapsed, mobileOpen, onCloseMobile, onLogout }: Props) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const nav = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-2 flex items-center justify-between lg:hidden">
        <span className="px-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Menu
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent"
        >
          <X className="size-4" />
        </Button>
      </div>

      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onCloseMobile}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            {active && (
              <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-brand" />
            )}
            <item.icon className={cn("size-4.5 shrink-0", active && "text-primary")} />
            <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
          </Link>
        );
      })}

      <div className="mt-auto">
        <Button
          variant="ghost"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4.5 shrink-0" />
          <span className={cn(collapsed && "lg:hidden")}>Logout</span>
        </Button>
      </div>
    </nav>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-300 lg:block",
          collapsed ? "w-[72px]" : "w-60",
        )}
      >
        {nav}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <Button
            variant="ghost"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar shadow-soft">
            {nav}
          </div>
        </div>
      )}
    </>
  );
}

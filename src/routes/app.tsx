import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { BootstrapLoader } from "@/components/common/BootstrapLoader";
import { useWorkspaceBootstrap } from "@/hooks/useWorkspaceBootstrap";
import { useThemeEffect } from "@/hooks/useThemeEffect";
import { selectIsAuthenticated, useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { ConnectionManager } from "@/websocket/ConnectionManager";
import { useMarketSession } from "@/hooks/useMarket";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();

  const authenticated = useAuthStore(selectIsAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const notify = useNotificationStore((s) => s.push);
  const { progress, stage, done } = useWorkspaceBootstrap();
  useMarketSession();

  useThemeEffect();

  useEffect(() => {
    if (!authenticated) void navigate({ to: "/", replace: true });
  }, [authenticated, navigate]);

  const handleLogout = () => {
    ConnectionManager.disconnect();
    logout();
    notify("connection", "Signed out", "Your Deriv session was cleared.");
    void navigate({ to: "/", replace: true });
  };

  if (!authenticated) return null;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <AnimatePresence>
        {!done && <BootstrapLoader progress={progress} stage={stage} />}
      </AnimatePresence>

      <TopBar onLogout={handleLogout} />

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <StatusBar />
    </div>
  );
}


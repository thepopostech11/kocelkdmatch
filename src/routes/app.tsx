import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
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
import { useContractModuleStore } from "@/stores/contractModuleStore";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const authenticated = useAuthStore(selectIsAuthenticated);
  const activeContractModule = useContractModuleStore((state) => state.activeContractModule);
  const logout = useAuthStore((s) => s.logout);
  const notify = useNotificationStore((s) => s.push);
  useThemeEffect();

  useEffect(() => {
    if (!authenticated) void navigate({ to: "/", replace: true });
  }, [authenticated, navigate]);

  const isMatchesWorkspace = [
    "/app/analysis",
    "/app/manual-trade",
    "/app/bot",
    "/app/settings",
  ].includes(pathname);

  useEffect(() => {
    if (activeContractModule !== "matches_differs" && isMatchesWorkspace) {
      void navigate({ to: "/app", replace: true });
    }
  }, [activeContractModule, isMatchesWorkspace, navigate]);

  const handleLogout = () => {
    ConnectionManager.disconnect();
    logout();
    notify("connection", "Signed out", "Your Deriv session was cleared.");
    void navigate({ to: "/", replace: true });
  };

  if (!authenticated || (activeContractModule !== "matches_differs" && isMatchesWorkspace)) return null;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      {isMatchesWorkspace && <MatchesWorkspaceChrome onLogout={handleLogout} />}

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {isMatchesWorkspace && <StatusBar />}
    </div>
  );
}

/** The existing Matches workspace keeps its original shared market session and chrome. */
function MatchesWorkspaceChrome({ onLogout }: { onLogout: () => void }) {
  useMarketSession();
  const { progress, stage, done } = useWorkspaceBootstrap();

  return (
    <>
      <AnimatePresence>
        {!done && <BootstrapLoader progress={progress} stage={stage} />}
      </AnimatePresence>
      <TopBar onLogout={onLogout} />
    </>
  );
}


import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnalysisPage } from "./app.analysis";
import { motion } from "framer-motion";
import { Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { APP_CONFIG } from "@/config/app";
import { buildAuthorizationUrl } from "@/lib/deriv/oauth";
import { selectIsAuthenticated, useAuthStore } from "@/stores/authStore";
import { useThemeEffect } from "@/hooks/useThemeEffect";
import { StatusDot } from "@/components/common/StatusBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KOCEL DMATCH TOOL — AI MATCHES Trading for Deriv" },
      {
        name: "description",
        content:
          "Sign in with Deriv to access KOCEL DMATCH TOOL, an AI powered MATCHES trading platform with live analysis, manual trading and bot automation.",
      },
      { property: "og:title", content: "KOCEL DMATCH TOOL — AI MATCHES Trading Platform" },
      {
        property: "og:description",
        content: "Secure Deriv OAuth login for AI powered MATCHES trading.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RootWrapper,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<"login" | "signup" | null>(null);
  const [remember, setRemember] = useState(true);
  const [online, setOnline] = useState(true);
  const authenticated = useAuthStore(selectIsAuthenticated);
  useThemeEffect();

  useEffect(() => {
    if (authenticated) return; // when authenticated, this route will render AnalysisPage below
  }, [authenticated]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        left: (i * 37) % 100,
        size: 2 + (i % 4),
        duration: 14 + (i % 9) * 2,
        delay: (i % 11) * 1.4,
      })),
    [],
  );

  const start = async (mode: "login" | "registration") => {
    setLoading(mode === "login" ? "login" : "signup");
    try {
      localStorage.setItem("kocel_remember_session", String(remember));
      window.location.href = await buildAuthorizationUrl(mode);
    } catch {
      setLoading(null);
      toast.error("Could not start the Deriv authorization flow.");
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Animated gradient aurora */}
      <div className="pointer-events-none absolute -top-1/3 left-1/2 size-[46rem] -translate-x-1/2 rounded-full bg-gradient-brand opacity-25 blur-[140px] animate-aurora" />
      <div className="pointer-events-none absolute -bottom-1/4 -left-24 size-[32rem] rounded-full bg-accent opacity-15 blur-[130px] animate-aurora" />

      {/* Floating trading particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute bottom-0 rounded-full bg-primary-glow opacity-40 animate-float-up"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass relative w-full max-w-md rounded-3xl p-7 shadow-elevated sm:p-9"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-brand text-xl font-bold text-primary-foreground shadow-elevated">
            KD
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="text-gradient">KOCEL DMATCH TOOL</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{APP_CONFIG.tagline}</p>
        </div>

        <div className="mt-8 space-y-3">
          <Button
            size="lg"
            className="h-12 w-full bg-gradient-brand text-base font-semibold"
            disabled={loading !== null}
            onClick={() => void start("login")}
          >
            {loading === "login" ? (
              <Loader2 className="mr-2 size-5 animate-spin" />
            ) : (
              <LogIn className="mr-2 size-5" />
            )}
            {loading === "login" ? "Redirecting to Deriv…" : "Login with Deriv"}
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-11 w-full"
            disabled={loading !== null}
            onClick={() => void start("registration")}
          >
            {loading === "signup" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 size-4" />
            )}
            Create a Deriv account
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
          <span className="text-sm text-muted-foreground">Remember session</span>
          <Switch checked={remember} onCheckedChange={setRemember} />
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-accent" />
          Secure Authentication · Powered by Deriv
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <StatusDot state={online ? "connected" : "error"} />
            {online ? "Connected" : "Offline"}
          </span>
          <span>made by Mr~Popo</span>
        </div>
      </motion.div>
    </div>
  );
}

/** Root route wrapper: render `AnalysisPage` when authenticated, otherwise show the login UI. */
export function RootWrapper() {
  const authenticated = useAuthStore(selectIsAuthenticated);
  useThemeEffect();
  return authenticated ? <AnalysisPage /> : <LoginPage />;
}

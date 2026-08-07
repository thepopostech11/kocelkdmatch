import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearStoredPkce, readStoredPkce } from "@/lib/deriv/oauth";
import { exchangeDerivCode, fetchDerivAccounts } from "@/lib/deriv/oauth.functions";
import { useAuthStore } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { APP_CONFIG } from "@/config/app";

export const Route = createFileRoute("/oauth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing in — KOCEL DMATCH TOOL" },
      { name: "description", content: "Completing your secure Deriv authentication." },
      { property: "og:title", content: "Signing in — KOCEL DMATCH TOOL" },
      { property: "og:description", content: "Completing your secure Deriv authentication." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OAuthCallback,
});

function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  const setSession = useAuthStore((s) => s.setSession);
  const setAccounts = useAuthStore((s) => s.setAccounts);
  const setOauth = useConnectionStore((s) => s.setOauth);
  const notify = useNotificationStore((s) => s.push);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const oauthError = params.get("error_description") ?? params.get("error");

      if (oauthError) {
        setOauth("error");
        setError(oauthError);
        return;
      }

      const stored = readStoredPkce();
      if (!code || !state || !stored.verifier) {
        setOauth("error");
        setError("Missing authorization code or PKCE verifier. Please sign in again.");
        return;
      }
      if (state !== stored.state) {
        setOauth("error");
        setError("State mismatch detected. The sign-in attempt was rejected for your safety.");
        return;
      }

      try {
        setOauth("connecting");
        const token = await exchangeDerivCode({
          data: { code, codeVerifier: stored.verifier },
        });
        clearStoredPkce();
        setSession(token.accessToken, token.tokenType, token.expiresIn);

        try {
          const accounts = await fetchDerivAccounts({
            data: { accessToken: token.accessToken },
          });
          setAccounts(accounts);
        } catch {
          notify("warning", "Accounts unavailable", "Signed in, but account list could not load.");
        }

        setOauth("connected");
        notify("success", "Signed in", "Deriv session established successfully.");
        void navigate({ to: "/app/analysis", replace: true });
      } catch (err) {
        setOauth("error");
        setError(err instanceof Error ? err.message : "Authentication failed.");
      }
    })();
  }, [navigate, notify, setAccounts, setOauth, setSession]);

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-gradient-brand opacity-20 blur-[130px] animate-aurora" />
      <div className="panel relative w-full max-w-md p-8 text-center">
        {error ? (
          <>
            <AlertTriangle className="mx-auto size-10 text-destructive" />
            <h1 className="mt-4 text-xl font-bold">Authentication failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => void navigate({ to: "/", replace: true })}>
              Back to login
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-10 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-bold">Validating your Deriv session</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Exchanging the authorization code securely on the server…
            </p>
            <p className="mt-6 text-xs text-muted-foreground">v{APP_CONFIG.version}</p>
          </>
        )}
      </div>
    </div>
  );
}

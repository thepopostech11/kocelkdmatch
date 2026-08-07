import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectionManager } from "@/websocket/ConnectionManager";
import { MarketEngine } from "@/market/MarketEngine";
import { useAuthStore } from "@/stores/authStore";
import type { DerivAccount } from "@/types";

/**
 * Manual fallback: paste a Deriv API token (app.deriv.com → Settings → API
 * token, with Read + Trade + Payments scopes). The token is validated against
 * the live WebSocket `authorize` call before it is stored, which guarantees the
 * workspace shows a real balance and can execute real contracts.
 */
export function TokenConnect() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const mergeAccounts = useAuthStore((s) => s.mergeAccounts);
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount);

  const connect = async () => {
    const value = token.trim();
    if (!value) return;
    setBusy(true);
    try {
      const socket = await ConnectionManager.connect();
      const res = await socket.request({ authorize: value });
      const error = res["error"] as { message?: string } | undefined;
      if (error) throw new Error(error.message ?? "Deriv rejected this token.");
      const auth = res["authorize"] as Record<string, unknown>;
      const list = (auth["account_list"] as Record<string, unknown>[] | undefined) ?? [];

      const accounts: DerivAccount[] = list.length
        ? list.map((a) => {
            const loginid = String(a["loginid"] ?? "");
            const isVirtual = Boolean(a["is_virtual"]) || /^VR/i.test(loginid);
            return {
              loginid,
              token: loginid === String(auth["loginid"] ?? "") ? value : undefined,
              currency: String(a["currency"] ?? auth["currency"] ?? "USD"),
              accountType: isVirtual ? "demo" : "real",
              isVirtual,
              balance: Number(auth["balance"] ?? 0),
            } as DerivAccount;
          })
        : [
            {
              loginid: String(auth["loginid"] ?? ""),
              token: value,
              currency: String(auth["currency"] ?? "USD"),
              accountType: auth["is_virtual"] ? "demo" : "real",
              isVirtual: Boolean(auth["is_virtual"]),
              balance: Number(auth["balance"] ?? 0),
            },
          ];

      mergeAccounts(accounts);
      setActiveAccount(String(auth["loginid"] ?? accounts[0]?.loginid ?? ""));
      MarketEngine.useToken(value);
      setToken("");
      toast.success(`Connected as ${String(auth["loginid"] ?? "")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not authorise this token.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-border py-3.5 last:border-b-0">
      <p className="text-sm font-medium">Connect with a Deriv API token</p>
      <p className="text-xs text-muted-foreground">
        Use this if authorisation fails after the Deriv login. Create a token at app.deriv.com →
        Settings → API token with Read, Trade and Payments scopes.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="a1-xxxxxxxxxxxxxxxxxxxxxxxxx"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
        />
        <Button onClick={() => void connect()} disabled={busy || !token.trim()} className="w-full sm:w-auto">
          {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Authorise
        </Button>
      </div>
    </div>
  );
}

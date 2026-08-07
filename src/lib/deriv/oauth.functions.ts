import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DERIV_CONFIG } from "@/config/app";

type DerivRawAccount = {
  loginid?: string;
  account_id?: string;
  currency?: string;
  account_type?: string;
  type?: string;
  is_virtual?: boolean;
  balance?: number | string;
};

type DerivAccountsResponse = {
  data?: DerivRawAccount[];
  accounts?: DerivRawAccount[];
};

export type DerivTokenResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
};

/** Server-side authorization-code -> access-token exchange (never done in the browser). */
export const exchangeDerivCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().min(1).max(4096),
        codeVerifier: z.string().min(43).max(128),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<DerivTokenResult> => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: DERIV_CONFIG.clientId,
      code: data.code,
      code_verifier: data.codeVerifier,
      redirect_uri: DERIV_CONFIG.redirectUri,
    });

    const res = await fetch(DERIV_CONFIG.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || typeof json["access_token"] !== "string") {
      const detail =
        (json["error_description"] as string) ?? (json["error"] as string) ?? `HTTP ${res.status}`;
      throw new Error(`Deriv token exchange failed: ${detail}`);
    }

    return {
      accessToken: json["access_token"] as string,
      tokenType: (json["token_type"] as string) ?? "Bearer",
      expiresIn: (json["expires_in"] as number) ?? 3600,
      ...(typeof json["refresh_token"] === "string"
        ? { refreshToken: json["refresh_token"] as string }
        : {}),
    };
  });

/** Fetches the authorized trading accounts for a session token. */
export const fetchDerivAccounts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ accessToken: z.string().min(10) }).parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(`${DERIV_CONFIG.apiBaseUrl}/trading/v1/options/accounts`, {
      headers: {
        Authorization: `Bearer ${data.accessToken}`,
        "Deriv-App-ID": DERIV_CONFIG.clientId,
      },
    });
    if (!res.ok) throw new Error(`Deriv accounts request failed (HTTP ${res.status})`);
    const json = (await res.json()) as DerivAccountsResponse | DerivRawAccount[];
    const list = Array.isArray(json) ? json : (json.data ?? json.accounts ?? []);
    return list.map((a) => ({
      loginid: String(a.loginid ?? a.account_id ?? ""),
      currency: String(a.currency ?? "USD"),
      accountType: String(a.account_type ?? a.type ?? "real"),
      isVirtual: Boolean(a.is_virtual ?? a.account_type === "demo"),
      balance: Number(a.balance ?? 0),
    }));
  });

/** Issues the selected Options account's short-lived authenticated WebSocket URL. */
export const issueDerivWebSocketUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        accountId: z.string().min(1).max(128),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const accountId = encodeURIComponent(data.accountId);
    const res = await fetch(
      `${DERIV_CONFIG.apiBaseUrl}/trading/v1/options/accounts/${accountId}/otp`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.accessToken}`,
          "Deriv-App-ID": DERIV_CONFIG.clientId,
        },
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      data?: { url?: string };
      error?: { message?: string } | string;
      message?: string;
    };
    const url = json.data?.url;
    if (!res.ok || !url) {
      const detail =
        typeof json.error === "string"
          ? json.error
          : (json.error?.message ?? json.message ?? `HTTP ${res.status}`);
      throw new Error(`Deriv WebSocket authorization failed: ${detail}`);
    }
    if (!url.startsWith("wss://")) throw new Error("Deriv returned an invalid WebSocket URL.");
    return { url };
  });

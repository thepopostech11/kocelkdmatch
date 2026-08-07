import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DERIV_CONFIG } from "@/config/app";

const exchangeSchema = z.object({
  code: z.string().min(1).max(4096),
  codeVerifier: z.string().min(20).max(256),
});

export type DerivTokenResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
};

/** Server-side authorization-code -> access-token exchange (never done in the browser). */
export const exchangeDerivCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => exchangeSchema.parse(data))
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
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    if (!res.ok) throw new Error(`Deriv accounts request failed (HTTP ${res.status})`);
    return (await res.json()) as Record<string, unknown>;
  });

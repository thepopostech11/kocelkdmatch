export const APP_CONFIG = {
  name: "KOCEL DMATCH TOOL",
  tagline: "AI Powered MATCHES Trading Platform",
  version: "1.2.0-phase3",
  apiVersion: "Deriv API v3",
  developer: "KOCEL Labs",
  license: "Proprietary",
} as const;

/**
 * Deriv application configuration.
 *
 * `appId` MUST be the numeric application ID registered at
 * https://api.deriv.com/dashboard for this app. The Deriv WebSocket API
 * (`authorize`, `buy`, `proposal`) rejects tokens that were not issued for the
 * same app_id, which is why the legacy OAuth flow below is keyed to it.
 */
export const DERIV_CONFIG = {
  // Application ID registered with Deriv for this app (used for both the
  // legacy WebSocket OAuth flow and the OAuth2 client_id).
  appId: "341wtpayB6TTevM7ac4LR",
  clientId: "341wtpayB6TTevM7ac4LR",
  redirectUri: "https://kocelkdmatch.lovable.app/oauth/callback",
  // Legacy OAuth endpoint: returns acct1/token1/cur1... query params containing
  // a ready-to-use WebSocket API token for EVERY account the user owns.
  legacyAuthorizeUrl: "https://oauth.deriv.com/oauth2/authorize",
  authorizeUrl: "https://auth.deriv.com/oauth2/auth",
  tokenUrl: "https://auth.deriv.com/oauth2/token",
  apiBaseUrl: "https://api.derivws.com",
  wsUrl: "wss://ws.derivws.com/websockets/v3",
  scopes: ["trade", "account_manage", "application_read", "payment"],
} as const;

/** Continuous Indices only — the sole market MATCHES contracts are offered on. */
export const SYMBOLS = [
  { value: "R_10", label: "Volatility 10 Index", pip: 3 },
  { value: "R_25", label: "Volatility 25 Index", pip: 3 },
  { value: "R_50", label: "Volatility 50 Index", pip: 4 },
  { value: "R_75", label: "Volatility 75 Index", pip: 4 },
  { value: "R_100", label: "Volatility 100 Index", pip: 2 },
  { value: "1HZ10V", label: "Volatility 10 (1s) Index", pip: 2 },
  { value: "1HZ25V", label: "Volatility 25 (1s) Index", pip: 2 },
  { value: "1HZ50V", label: "Volatility 50 (1s) Index", pip: 2 },
  { value: "1HZ75V", label: "Volatility 75 (1s) Index", pip: 2 },
  { value: "1HZ100V", label: "Volatility 100 (1s) Index", pip: 2 },
] as const;

export const SYMBOL_PIPS: Record<string, number> = Object.fromEntries(
  SYMBOLS.map((s) => [s.value, s.pip]),
);

export const TICK_WINDOWS = [25, 50, 100, 200, 500, 1000] as const;

/** MATCHES contracts accept 1-10 ticks. */
export const DURATION_RANGE = { min: 1, max: 10 } as const;

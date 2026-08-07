export const APP_CONFIG = {
  name: "KOCEL DMATCH TOOL",
  tagline: "AI Powered MATCHES Trading Platform",
  version: "1.0.0-phase1",
  apiVersion: "Deriv API v3",
  developer: "KOCEL Labs",
  license: "Proprietary",
} as const;

export const DERIV_CONFIG = {
  clientId: "341wtpayB6TTevM7ac4LR",
  redirectUri: "https://kocelkdmatch.lovable.app/oauth/callback",
  authorizeUrl: "https://auth.deriv.com/oauth2/auth",
  tokenUrl: "https://auth.deriv.com/oauth2/token",
  apiBaseUrl: "https://api.derivws.com",
  wsUrl: "wss://ws.derivws.com/websockets/v3",
  scopes: ["trade", "account_manage", "application_read"],
} as const;

export const SYMBOLS = [
  { value: "R_10", label: "Volatility 10 Index" },
  { value: "R_25", label: "Volatility 25 Index" },
  { value: "R_50", label: "Volatility 50 Index" },
  { value: "R_75", label: "Volatility 75 Index" },
  { value: "R_100", label: "Volatility 100 Index" },
  { value: "1HZ10V", label: "Volatility 10 (1s) Index" },
  { value: "1HZ25V", label: "Volatility 25 (1s) Index" },
  { value: "1HZ50V", label: "Volatility 50 (1s) Index" },
  { value: "1HZ75V", label: "Volatility 75 (1s) Index" },
  { value: "1HZ100V", label: "Volatility 100 (1s) Index" },
] as const;

export const TICK_WINDOWS = [25, 50, 100, 200, 500, 1000] as const;

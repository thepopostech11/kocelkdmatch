import { DERIV_CONFIG } from "@/config/app";
import type { DerivAccount } from "@/types";
import {
  OAUTH_STATE_KEY,
  PKCE_VERIFIER_KEY,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "./pkce";

type AuthMode = "login" | "registration";

/**
 * Builds the Deriv authorization URL.
 *
 * We use the legacy OAuth endpoint because it redirects back with a WebSocket
 * API token for EVERY account the user owns (acct1/token1/cur1, acct2/...).
 * Those tokens are what `authorize` on the v3 socket expects, and they are what
 * makes real/demo account switching possible without a second round-trip.
 */
export async function buildAuthorizationUrl(mode: AuthMode = "login"): Promise<string> {
  const params = new URLSearchParams({ app_id: String(DERIV_CONFIG.appId) });
  if (mode === "registration") params.set("route", "signup");
  return `${DERIV_CONFIG.legacyAuthorizeUrl}?${params.toString()}`;
}

/**
 * Builds an OAuth2 + PKCE authorization URL. Retained for deployments that are
 * registered against the newer auth.deriv.com endpoint.
 */
export async function buildPkceAuthorizationUrl(mode: AuthMode = "login"): Promise<string> {
  const verifier = generateCodeVerifier();
  const challenge = await deriveCodeChallenge(verifier);
  const state = generateState();

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  // Mirror into localStorage so the callback survives a brand-new tab.
  localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  localStorage.setItem(OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: DERIV_CONFIG.clientId,
    redirect_uri: DERIV_CONFIG.redirectUri,
    scope: DERIV_CONFIG.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (mode === "registration") params.set("prompt", "registration");

  return `${DERIV_CONFIG.authorizeUrl}?${params.toString()}`;
}

/**
 * Parses the legacy Deriv redirect: ?acct1=CR1&token1=a1-x&cur1=USD&acct2=...
 * Returns one DerivAccount per acctN triple, each carrying its own API token.
 */
export function parseLegacyAccounts(search: string): DerivAccount[] {
  const params = new URLSearchParams(search);
  const accounts: DerivAccount[] = [];

  for (let i = 1; i < 30; i += 1) {
    const loginid = params.get(`acct${i}`);
    const token = params.get(`token${i}`);
    if (!loginid || !token) continue;
    const currency = params.get(`cur${i}`) ?? "USD";
    // Demo accounts are prefixed VRTC / VRW on Deriv.
    const isVirtual = /^VR/i.test(loginid);
    accounts.push({
      loginid,
      token,
      currency: currency.toUpperCase(),
      accountType: isVirtual ? "demo" : "real",
      isVirtual,
      balance: 0,
    });
  }

  return accounts;
}

export function readStoredPkce() {
  const verifier =
    sessionStorage.getItem(PKCE_VERIFIER_KEY) ?? localStorage.getItem(PKCE_VERIFIER_KEY);
  const state = sessionStorage.getItem(OAUTH_STATE_KEY) ?? localStorage.getItem(OAUTH_STATE_KEY);
  return { verifier, state };
}

export function clearStoredPkce() {
  [sessionStorage, localStorage].forEach((store) => {
    store.removeItem(PKCE_VERIFIER_KEY);
    store.removeItem(OAUTH_STATE_KEY);
  });
}

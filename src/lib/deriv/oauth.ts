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
 * Builds the Deriv authorization URL using OAuth 2.0 Authorization Code + PKCE
 * (auth.deriv.com), exactly as documented by Deriv. `code_verifier` and
 * `state` are stored in sessionStorage before the redirect.
 */
export async function buildAuthorizationUrl(mode: AuthMode = "login"): Promise<string> {
  return buildPkceAuthorizationUrl(mode);
}

/** OAuth2 + PKCE authorization URL. */
export async function buildPkceAuthorizationUrl(mode: AuthMode = "login"): Promise<string> {
  const verifier = generateCodeVerifier();
  const challenge = await deriveCodeChallenge(verifier);
  const state = generateState();

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: DERIV_CONFIG.clientId,
    redirect_uri: DERIV_CONFIG.redirectUri,
    scope: DERIV_CONFIG.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // Legacy V1 app id, so Deriv can route users of the legacy platform.
    app_id: String(DERIV_CONFIG.appId),
  });
  if (mode === "registration") params.set("prompt", "registration");

  return `${DERIV_CONFIG.authorizeUrl}?${params.toString()}`;
}


/**
 * Parses the legacy Deriv redirect: ?acct1=CR1&token1=a1-x&cur1=USD&acct2=...
 * Returns one DerivAccount per acctN triple, each carrying its own API token.
 */
export function parseLegacyAccounts(search: string): DerivAccount[] {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
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

/** Legacy tokens can arrive on the query string or on the hash fragment. */
export function parseAccountsFromLocation(location: { search: string; hash: string }): DerivAccount[] {
  const fromSearch = parseLegacyAccounts(location.search);
  if (fromSearch.length) return fromSearch;
  return parseLegacyAccounts(location.hash.replace(/^#/, ""));
}

export function readStoredPkce() {
  // Deliberately tab-scoped: the verifier never persists beyond this OAuth tab.
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const state = sessionStorage.getItem(OAUTH_STATE_KEY);
  return { verifier, state };
}

export function clearStoredPkce() {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
}

import { DERIV_CONFIG } from "@/config/app";
import {
  OAUTH_STATE_KEY,
  PKCE_VERIFIER_KEY,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "./pkce";

type AuthMode = "login" | "registration";

/**
 * Builds the Deriv authorization URL and persists PKCE material for the callback.
 * When running on a host that is not the registered redirect origin, the flow
 * still uses the registered redirect_uri (Deriv requires an exact match).
 */
export async function buildAuthorizationUrl(mode: AuthMode = "login"): Promise<string> {
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

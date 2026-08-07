/** PKCE + state helpers for the Deriv OAuth 2.0 Authorization Code flow. */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export const PKCE_VERIFIER_KEY = "kocel_pkce_code_verifier";
export const OAUTH_STATE_KEY = "kocel_oauth_state";

export function generateCodeVerifier(): string {
  const array = crypto.getRandomValues(new Uint8Array(64));
  return Array.from(array)
    .map((v) => CHARS[v % CHARS.length])
    .join("");
}

export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DerivAccount } from "@/types";

type AuthState = {
  accessToken: string | null;
  tokenType: string;
  expiresAt: number | null;
  accounts: DerivAccount[];
  activeLoginId: string | null;
  bootstrapped: boolean;
  setSession: (token: string, tokenType: string, expiresIn: number) => void;
  setAccounts: (accounts: DerivAccount[]) => void;
  mergeAccounts: (accounts: DerivAccount[]) => void;
  updateBalance: (loginid: string, balance: number, currency?: string) => void;
  setActiveAccount: (loginid: string) => void;
  setBootstrapped: (v: boolean) => void;
  logout: () => void;
};

/** Prefer a real (non-virtual) account when nothing has been chosen yet. */
function defaultLoginId(accounts: DerivAccount[]) {
  return (accounts.find((a) => !a.isVirtual) ?? accounts[0])?.loginid ?? null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      tokenType: "Bearer",
      expiresAt: null,
      accounts: [],
      activeLoginId: null,
      bootstrapped: false,

      setSession: (accessToken, tokenType, expiresIn) =>
        set({ accessToken, tokenType, expiresAt: Date.now() + expiresIn * 1000 }),

      setAccounts: (accounts) =>
        set((s) => ({
          accounts,
          activeLoginId:
            s.activeLoginId && accounts.some((a) => a.loginid === s.activeLoginId)
              ? s.activeLoginId
              : defaultLoginId(accounts),
        })),

      /** Merge in richer data (e.g. account_list from `authorize`) without losing tokens. */
      mergeAccounts: (incoming) =>
        set((s) => {
          const byId = new Map(s.accounts.map((a) => [a.loginid, a]));
          for (const acc of incoming) {
            const existing = byId.get(acc.loginid);
            // Never let a token-less update erase a working token.
            const token = acc.token ?? existing?.token;
            byId.set(acc.loginid, {
              ...existing,
              ...acc,
              ...(token ? { token } : {}),
            });
          }
          const accounts = Array.from(byId.values());
          return {
            accounts,
            activeLoginId:
              s.activeLoginId && accounts.some((a) => a.loginid === s.activeLoginId)
                ? s.activeLoginId
                : defaultLoginId(accounts),
          };
        }),

      updateBalance: (loginid, balance, currency) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.loginid === loginid ? { ...a, balance, currency: currency ?? a.currency } : a,
          ),
        })),

      setActiveAccount: (activeLoginId) => set({ activeLoginId }),
      setBootstrapped: (bootstrapped) => set({ bootstrapped }),

      logout: () =>
        set({
          accessToken: null,
          expiresAt: null,
          accounts: [],
          activeLoginId: null,
          bootstrapped: false,
        }),
    }),
    { name: "kocel-auth" },
  ),
);

export const selectIsAuthenticated = (s: AuthState) =>
  Boolean(s.accessToken) && (!s.expiresAt || s.expiresAt > Date.now());

export const selectActiveAccount = (s: AuthState) =>
  s.accounts.find((a) => a.loginid === s.activeLoginId) ?? null;

/** The WebSocket API token for the currently selected account. */
export const selectActiveToken = (s: AuthState) =>
  s.accounts.find((a) => a.loginid === s.activeLoginId)?.token ?? s.accessToken;

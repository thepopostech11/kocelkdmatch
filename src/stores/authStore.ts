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
  setActiveAccount: (loginid: string) => void;
  setBootstrapped: (v: boolean) => void;
  logout: () => void;
};

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
              : (accounts[0]?.loginid ?? null),
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

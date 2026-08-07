import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeMode } from "@/types";

export type Settings = {
  // General
  theme: ThemeMode;
  language: string;
  defaultSymbol: string;
  defaultTickWindow: number;
  defaultStake: number;
  defaultDuration: number;
  rememberPreferences: boolean;
  autoConnect: boolean;
  // Appearance
  fontSize: number;
  animationSpeed: number;
  compactMode: boolean;
  // Notifications
  tradeNotifications: boolean;
  botNotifications: boolean;
  sound: boolean;
  entryAlerts: boolean;
  predictionAlerts: boolean;
  desktopNotifications: boolean;
  // Performance
  fpsCounter: boolean;
  memoryUsage: boolean;
  renderingMode: "auto" | "quality" | "performance";
  refreshInterval: number;
  developerMode: boolean;
  liveDiagnostics: boolean;
  // Security
  sessionTimeout: number;
  reconnectAutomatically: boolean;
};

const DEFAULTS: Settings = {
  theme: "dark",
  language: "en",
  defaultSymbol: "R_100",
  defaultTickWindow: 100,
  defaultStake: 1,
  defaultDuration: 1,
  rememberPreferences: true,
  autoConnect: true,
  fontSize: 16,
  animationSpeed: 1,
  compactMode: false,
  tradeNotifications: true,
  botNotifications: true,
  sound: true,
  entryAlerts: true,
  predictionAlerts: true,
  desktopNotifications: false,
  fpsCounter: false,
  memoryUsage: false,
  renderingMode: "auto",
  refreshInterval: 1000,
  developerMode: false,
  liveDiagnostics: false,
  sessionTimeout: 60,
  reconnectAutomatically: true,
};

type SettingsState = Settings & {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: "kocel-settings" },
  ),
);

export const SETTINGS_DEFAULTS = DEFAULTS;

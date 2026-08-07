import { Activity, Bot, LineChart, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { to: "/app/analysis", label: "Analysis", icon: LineChart },
  { to: "/app/manual-trade", label: "Manual Trade", icon: Activity },
  { to: "/app/bot", label: "Bot", icon: Bot },
  { to: "/app/settings", label: "Settings", icon: Settings },
] as const;

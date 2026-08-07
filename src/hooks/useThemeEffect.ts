import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/** Applies theme, font size and animation speed to the document root. */
export function useThemeEffect() {
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const animationSpeed = useSettingsStore((s) => s.animationSpeed);

  useEffect(() => {
    const root = document.documentElement;
    const prefersLight =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
    const resolved = theme === "system" ? (prefersLight ? "light" : "dark") : theme;
    root.classList.toggle("light", resolved === "light");
    root.classList.toggle("dark", resolved === "dark");
    root.style.setProperty("--app-font-size", `${fontSize}px`);
    root.style.setProperty("--app-animation-speed", String(animationSpeed));
  }, [theme, fontSize, animationSpeed]);
}

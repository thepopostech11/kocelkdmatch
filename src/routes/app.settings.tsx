import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAuthStore } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useBotStore } from "@/stores/botStore";
import { BotEngine } from "@/bot/BotEngine";
import { APP_CONFIG, SYMBOLS, TICK_WINDOWS } from "@/config/app";
import { MODULE_REGISTRY } from "@/services/moduleRegistry";
import { ConnectionManager } from "@/websocket/ConnectionManager";
import { TokenConnect } from "@/components/account/TokenConnect";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — KOCEL DMATCH TOOL" },
      { name: "description", content: "Configure theme, trading defaults, alerts and security." },
      { property: "og:title", content: "Settings — KOCEL DMATCH TOOL" },
      { property: "og:description", content: "Configure your KOCEL DMATCH trading workspace." },
    ],
  }),
  component: SettingsPage,
});

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel p-5">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

const TABS = [
  "General",
  "Trading",
  "Notifications",
  "Appearance",
  "Performance",
  "Security",
  "Privacy",
  "About",
];

function SettingsPage() {
  const s = useSettingsStore();
  const navigate = useNavigate();
  const logout = useAuthStore((st) => st.logout);
  const symbol = useConnectionStore((st) => st.symbol);
  const setSymbol = useConnectionStore((st) => st.setSymbol);
  const botMinimumConfidence = useBotStore((st) => st.minimumConfidence);
  const setBotMinimumConfidence = useBotStore((st) => st.setMinimumConfidence);

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-6">
      <h1 className="text-xl font-bold sm:text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Preferences are stored locally and restored on every session.
      </p>

      <Tabs defaultValue="General" className="mt-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-surface-2 p-1">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs sm:text-sm">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="General" className="mt-5 space-y-4">
          <Section title="General">
            <Row label="Theme" hint="Dark premium, light or follow system">
              <Select value={s.theme} onValueChange={(v) => s.set("theme", v as typeof s.theme)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Language">
              <Select value={s.language} onValueChange={(v) => s.set("language", v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="sw">Kiswahili</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Remember preferences">
              <Switch
                checked={s.rememberPreferences}
                onCheckedChange={(v) => s.set("rememberPreferences", v)}
              />
            </Row>
            <Row label="Auto connect" hint="Open the market feed right after login">
              <Switch checked={s.autoConnect} onCheckedChange={(v) => s.set("autoConnect", v)} />
            </Row>
          </Section>
        </TabsContent>

        <TabsContent value="Trading" className="mt-5 space-y-4">
          <Section title="Trading defaults">
            <Row label="Default symbol">
              <Select
                value={symbol}
                onValueChange={(v) => {
                  setSymbol(v);
                  s.set("defaultSymbol", v);
                }}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map((sym) => (
                    <SelectItem key={sym.value} value={sym.value}>
                      {sym.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Default tick window">
              <Select
                value={String(s.defaultTickWindow)}
                onValueChange={(v) => s.set("defaultTickWindow", Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICK_WINDOWS.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      {w} ticks
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Default stake">
              <Input
                type="number"
                min={0.35}
                step={0.5}
                value={s.defaultStake}
                onChange={(e) => s.set("defaultStake", Number(e.target.value))}
                className="w-28"
              />
            </Row>
            <Row label="Default contract duration" hint="In ticks">
              <Input
                type="number"
                min={1}
                max={10}
                value={s.defaultDuration}
                onChange={(e) => s.set("defaultDuration", Number(e.target.value))}
                className="w-28"
              />
            </Row>
          </Section>

          <Section title="Strategy settings">
            <Row
              label="Highest digit minimum frequency"
              hint={`${s.strategyMinHighestFrequency}% — the strategy only activates above this`}
            >
              <Slider
                className="w-44"
                min={10}
                max={20}
                step={0.5}
                value={[s.strategyMinHighestFrequency]}
                onValueChange={([v]) => s.set("strategyMinHighestFrequency", v ?? 12)}
              />
            </Row>
            <Row label="Strategy duration" hint="Contract duration in ticks (default 3)">
              <Input
                type="number"
                min={1}
                max={10}
                value={s.strategyDuration}
                onChange={(e) => s.set("strategyDuration", Number(e.target.value))}
                className="w-28"
              />
            </Row>
            <Row label="Maximum recovery attempts" hint="1 recovery = 2 total attempts per opportunity">
              <Input
                type="number"
                min={0}
                max={1}
                value={s.strategyMaxRecoveryAttempts}
                onChange={(e) => s.set("strategyMaxRecoveryAttempts", Math.min(1, Math.max(0, Number(e.target.value))))}
                className="w-28"
              />
            </Row>
            <Row label="Signal expiration" hint={`${s.strategySignalExpirationTicks} ticks before a signal expires`}>
              <Slider
                className="w-44"
                min={5}
                max={120}
                step={5}
                value={[s.strategySignalExpirationTicks]}
                onValueChange={([v]) => s.set("strategySignalExpirationTicks", v ?? 30)}
              />
            </Row>
            <Row label="Minimum signal stability" hint={`${s.strategyMinSignalStability}% required before trading`}>
              <Slider
                className="w-44"
                min={0}
                max={100}
                step={5}
                value={[s.strategyMinSignalStability]}
                onValueChange={([v]) => s.set("strategyMinSignalStability", v ?? 0)}
              />
            </Row>
          </Section>

          <Section title="Bot settings">
            <Row label="Maximum bot trades" hint="Bot stops opening new trades once reached">
              <Input
                type="number"
                min={1}
                value={s.maxBotTrades}
                onChange={(e) => s.set("maxBotTrades", Number(e.target.value))}
                className="w-28"
              />
            </Row>
            <Row label="Minimum bot loss" hint="Cumulative bot loss limit for the session">
              <Input
                type="number"
                min={0}
                step={1}
                value={s.botLossLimit}
                onChange={(e) => s.set("botLossLimit", Number(e.target.value))}
                className="w-28"
              />
            </Row>
            <Row label="Minimum bot confidence" hint={`${botMinimumConfidence}% — the Bot only trades at or above this`}>
              <Slider
                className="w-44"
                min={1}
                max={99}
                step={1}
                value={[botMinimumConfidence]}
                onValueChange={([v]) => {
                  setBotMinimumConfidence(v ?? 30);
                  BotEngine.setMinimumConfidence(v ?? 30);
                }}
              />
            </Row>
          </Section>

          <Section title="Manual trade settings">
            <Row label="Minimum loss" hint="Manual trading loss limit for the day">
              <Input
                type="number"
                min={0}
                step={1}
                value={s.manualLossLimit}
                onChange={(e) => s.set("manualLossLimit", Number(e.target.value))}
                className="w-28"
              />
            </Row>
            <Row label="Maximum daily trades" hint="Resets at the start of the next trading day">
              <Input
                type="number"
                min={1}
                value={s.maxDailyManualTrades}
                onChange={(e) => s.set("maxDailyManualTrades", Number(e.target.value))}
                className="w-28"
              />
            </Row>
          </Section>
        </TabsContent>


        <TabsContent value="Notifications" className="mt-5 space-y-4">
          <Section title="Notifications">
            <Row label="Trade notifications">
              <Switch
                checked={s.tradeNotifications}
                onCheckedChange={(v) => s.set("tradeNotifications", v)}
              />
            </Row>
            <Row label="Bot notifications">
              <Switch
                checked={s.botNotifications}
                onCheckedChange={(v) => s.set("botNotifications", v)}
              />
            </Row>
            <Row label="Sound">
              <Switch checked={s.sound} onCheckedChange={(v) => s.set("sound", v)} />
            </Row>
            <Row label="Entry alerts">
              <Switch checked={s.entryAlerts} onCheckedChange={(v) => s.set("entryAlerts", v)} />
            </Row>
            <Row label="Prediction alerts">
              <Switch
                checked={s.predictionAlerts}
                onCheckedChange={(v) => s.set("predictionAlerts", v)}
              />
            </Row>
            <Row label="Desktop notifications">
              <Switch
                checked={s.desktopNotifications}
                onCheckedChange={async (v) => {
                  if (v && typeof Notification !== "undefined") {
                    await Notification.requestPermission();
                  }
                  s.set("desktopNotifications", v);
                }}
              />
            </Row>
          </Section>
        </TabsContent>

        <TabsContent value="Appearance" className="mt-5 space-y-4">
          <Section title="Appearance">
            <Row label="Font size" hint={`${s.fontSize}px`}>
              <Slider
                className="w-44"
                min={13}
                max={20}
                step={1}
                value={[s.fontSize]}
                onValueChange={([v]) => s.set("fontSize", v ?? 16)}
              />
            </Row>
            <Row label="Animation speed" hint={`${s.animationSpeed.toFixed(1)}x`}>
              <Slider
                className="w-44"
                min={0}
                max={2}
                step={0.1}
                value={[s.animationSpeed]}
                onValueChange={([v]) => s.set("animationSpeed", v ?? 1)}
              />
            </Row>
            <Row label="Compact mode">
              <Switch checked={s.compactMode} onCheckedChange={(v) => s.set("compactMode", v)} />
            </Row>
          </Section>
        </TabsContent>

        <TabsContent value="Performance" className="mt-5 space-y-4">
          <Section title="Performance">
            <Row label="FPS counter">
              <Switch checked={s.fpsCounter} onCheckedChange={(v) => s.set("fpsCounter", v)} />
            </Row>
            <Row label="Memory usage">
              <Switch checked={s.memoryUsage} onCheckedChange={(v) => s.set("memoryUsage", v)} />
            </Row>
            <Row label="Rendering mode">
              <Select
                value={s.renderingMode}
                onValueChange={(v) => s.set("renderingMode", v as typeof s.renderingMode)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Refresh interval" hint={`${s.refreshInterval}ms`}>
              <Slider
                className="w-44"
                min={250}
                max={5000}
                step={250}
                value={[s.refreshInterval]}
                onValueChange={([v]) => s.set("refreshInterval", v ?? 1000)}
              />
            </Row>
            <Row label="Developer mode">
              <Switch
                checked={s.developerMode}
                onCheckedChange={(v) => s.set("developerMode", v)}
              />
            </Row>
            <Row label="Live diagnostics">
              <Switch
                checked={s.liveDiagnostics}
                onCheckedChange={(v) => s.set("liveDiagnostics", v)}
              />
            </Row>
          </Section>
        </TabsContent>

        <TabsContent value="Security" className="mt-5 space-y-4">
          <Section title="Deriv authorisation">
            <TokenConnect />
          </Section>
          <Section title="Security">
            <Row label="Session timeout" hint={`${s.sessionTimeout} minutes`}>
              <Slider
                className="w-44"
                min={15}
                max={240}
                step={15}
                value={[s.sessionTimeout]}
                onValueChange={([v]) => s.set("sessionTimeout", v ?? 60)}
              />
            </Row>
            <Row label="Reconnect automatically">
              <Switch
                checked={s.reconnectAutomatically}
                onCheckedChange={(v) => s.set("reconnectAutomatically", v)}
              />
            </Row>
            <Row label="Clear cache" hint="Drops cached market and UI state">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  sessionStorage.clear();
                  toast.success("Cache cleared");
                }}
              >
                Clear
              </Button>
            </Row>
            <Row label="Clear local storage" hint="Resets all saved preferences">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.clear();
                  s.reset();
                  toast.success("Local storage cleared");
                }}
              >
                Reset
              </Button>
            </Row>
            <Row label="Logout all sessions">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  ConnectionManager.disconnect();
                  logout();
                  void navigate({ to: "/", replace: true });
                }}
              >
                Logout everywhere
              </Button>
            </Row>
          </Section>
        </TabsContent>

        <TabsContent value="Privacy" className="mt-5 space-y-4">
          <Section title="Privacy">
            <p className="py-2 text-sm text-muted-foreground">
              KOCEL DMATCH TOOL stores your Deriv session and preferences on this device only. No
              trading data is shared with third parties. Authorization codes are exchanged
              server-side and never logged.
            </p>
          </Section>
        </TabsContent>

        <TabsContent value="About" className="mt-5 space-y-4">
          <Section title="About">
            <Row label="Application version">
              <span className="font-mono text-sm">{APP_CONFIG.version}</span>
            </Row>
            <Row label="API version">
              <span className="font-mono text-sm">{APP_CONFIG.apiVersion}</span>
            </Row>
            <Row label="Deriv status">
              <a
                className="text-sm text-primary underline-offset-4 hover:underline"
                href="https://deriv.statuspage.io"
                target="_blank"
                rel="noreferrer"
              >
                View status
              </a>
            </Row>
            <Row label="License">
              <span className="text-sm">{APP_CONFIG.license}</span>
            </Row>
            <Row label="Developer">
              <span className="text-sm">{APP_CONFIG.developer}</span>
            </Row>
          </Section>

          <Section title="Module registry">
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULE_REGISTRY.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{m.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{m.description}</p>
                  </div>
                  <span
                    className={
                      m.status === "ready"
                        ? "ml-2 shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success"
                        : "ml-2 shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning"
                    }
                  >
                    {m.status === "ready" ? "Ready" : `Phase ${m.phase}`}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

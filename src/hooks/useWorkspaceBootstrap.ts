import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionManager } from "@/websocket/ConnectionManager";
import { useConnectionStore } from "@/stores/connectionStore";
import { useAuthStore } from "@/stores/authStore";

const STAGES = [
  "Initializing modules",
  "Authenticating session",
  "Connecting to Deriv servers",
  "Opening live market feed",
  "Streaming ticks & statistics",
  "Preparing workspace",
];

/** Runs the post-login boot sequence and reports smooth progress. */
export function useWorkspaceBootstrap() {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(STAGES[0]!);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  const symbol = useConnectionStore((s) => s.symbol);
  const setWebsocket = useConnectionStore((s) => s.setWebsocket);
  const setMarketFeed = useConnectionStore((s) => s.setMarketFeed);
  const setOauth = useConnectionStore((s) => s.setOauth);
  const setLatency = useConnectionStore((s) => s.setLatency);
  const setLastTick = useConnectionStore((s) => s.setLastTick);
  const setServerTime = useConnectionStore((s) => s.setServerTime);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);

  const run = useCallback(async () => {
    const tick = (to: number, label: string) =>
      new Promise<void>((resolve) => {
        setStage(label);
        setProgress(to);
        setTimeout(resolve, 420);
      });

    await tick(12, STAGES[0]!);
    setOauth("connected");
    await tick(28, STAGES[1]!);

    setStage(STAGES[2]!);
    setWebsocket("connecting");
    const started = performance.now();
    try {
      const socket = await ConnectionManager.connect(1);
      setLatency(Math.round(performance.now() - started));
      setWebsocket("connected");
      setProgress(52);

      await tick(70, STAGES[3]!);
      setMarketFeed("connecting");
      socket.subscribe((data) => {
        const t = data["tick"] as { quote?: number; epoch?: number } | undefined;
        if (t?.quote) {
          setMarketFeed("connected");
          setLastTick(t.quote);
          if (t.epoch) setServerTime(t.epoch * 1000);
        }
      });
      socket.send({ ticks: symbol, subscribe: 1 });
      await tick(88, STAGES[4]!);
    } catch {
      setWebsocket("error");
      setMarketFeed("error");
      await tick(88, "Market feed unavailable — continuing offline");
    }

    await tick(100, STAGES[5]!);
    setBootstrapped(true);
    setTimeout(() => setDone(true), 350);
  }, [
    setOauth,
    setWebsocket,
    setMarketFeed,
    setLatency,
    setLastTick,
    setServerTime,
    setBootstrapped,
    symbol,
  ]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (bootstrapped) {
      setDone(true);
      return;
    }
    void run();
  }, [run, bootstrapped]);

  return { progress, stage, done };
}

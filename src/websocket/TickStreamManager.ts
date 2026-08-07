/**
 * TickStreamManager — Phase 1 foundation.
 * Holds the rolling tick buffer contract used by the Phase 2 analysis engine.
 */
import type { WebSocketManager } from "./WebSocketManager";

export type Tick = { epoch: number; quote: number };

export class TickStreamManager {
  private buffer: Tick[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    private socket: WebSocketManager,
    private windowSize = 1000,
  ) {}

  start(symbol: string, onTick?: (tick: Tick) => void) {
    this.stop();
    this.socket.send({ ticks: symbol, subscribe: 1 });
    this.unsubscribe = this.socket.subscribe((data) => {
      const tick = data["tick"] as { epoch?: number; quote?: number } | undefined;
      if (!tick?.quote) return;
      const next: Tick = { epoch: tick.epoch ?? Date.now() / 1000, quote: tick.quote };
      this.buffer = [...this.buffer, next].slice(-this.windowSize);
      onTick?.(next);
    });
  }

  get ticks() {
    return this.buffer;
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

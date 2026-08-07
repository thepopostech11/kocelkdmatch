/** HeartbeatManager — keeps the Deriv socket alive and measures latency (Phase 1 stub). */
import type { WebSocketManager } from "./WebSocketManager";

export class HeartbeatManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastPing = 0;

  constructor(
    private socket: WebSocketManager,
    private onLatency?: (ms: number) => void,
    private intervalMs = 20000,
  ) {}

  start() {
    this.stop();
    this.timer = setInterval(() => {
      this.lastPing = performance.now();
      this.socket.send({ ping: 1 });
    }, this.intervalMs);
    return this.socket.subscribe((data) => {
      if (data["ping"] || data["msg_type"] === "ping") {
        this.onLatency?.(Math.round(performance.now() - this.lastPing));
      }
    });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

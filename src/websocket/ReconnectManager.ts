/** ReconnectManager — exponential backoff reconnection policy (Phase 1 foundation). */
export class ReconnectManager {
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private reconnect: () => Promise<void>,
    private maxAttempts = 8,
  ) {}

  schedule() {
    if (this.attempts >= this.maxAttempts) return;
    const delay = Math.min(30000, 1000 * 2 ** this.attempts);
    this.attempts += 1;
    this.timer = setTimeout(() => {
      void this.reconnect();
    }, delay);
  }

  reset() {
    this.attempts = 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

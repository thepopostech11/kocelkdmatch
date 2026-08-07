/** SubscriptionManager — tracks active Deriv stream subscriptions (Phase 1 foundation). */
import type { WebSocketManager } from "./WebSocketManager";

export class SubscriptionManager {
  private active = new Map<string, string>();

  constructor(private socket: WebSocketManager) {}

  register(key: string, subscriptionId: string) {
    this.active.set(key, subscriptionId);
  }

  forget(key: string) {
    const id = this.active.get(key);
    if (!id) return;
    this.socket.send({ forget: id });
    this.active.delete(key);
  }

  forgetAll() {
    this.active.forEach((_, key) => this.forget(key));
  }

  list() {
    return Array.from(this.active.keys());
  }
}

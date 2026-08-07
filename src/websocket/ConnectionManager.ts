import { DERIV_CONFIG } from "@/config/app";
import { WebSocketManager } from "./WebSocketManager";

/**
 * ConnectionManager — the single entry point for the Deriv socket.
 * Guarantees exactly one live socket for the whole application and exposes a
 * drop hook so the MarketEngine can re-run its handshake after a reconnect.
 */
class ConnectionManagerImpl {
  private manager: WebSocketManager | null = null;
  private connecting: Promise<WebSocketManager> | null = null;

  /** Invoked whenever the socket drops unexpectedly. */
  onDrop: (() => void) | null = null;

  async connect(appId: string | number = DERIV_CONFIG.appId): Promise<WebSocketManager> {
    if (this.manager?.isOpen) return this.manager;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const manager = new WebSocketManager(`${DERIV_CONFIG.wsUrl}?app_id=${appId}`);
      manager.onClose = () => {
        this.manager = null;
        this.onDrop?.();
      };
      await manager.connect();
      this.manager = manager;
      return manager;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  get socket() {
    return this.manager;
  }

  disconnect() {
    this.manager?.close();
    this.manager = null;
  }
}

export const ConnectionManager = new ConnectionManagerImpl();

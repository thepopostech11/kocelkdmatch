import { DERIV_CONFIG } from "@/config/app";
import { WebSocketManager } from "./WebSocketManager";

/**
 * ConnectionManager — single entry point for the Deriv socket.
 * Phase 1: connect / disconnect / status only.
 */
class ConnectionManagerImpl {
  private manager: WebSocketManager | null = null;

  async connect(appId: string | number = 1): Promise<WebSocketManager> {
    if (this.manager?.isOpen) return this.manager;
    this.manager = new WebSocketManager(`${DERIV_CONFIG.wsUrl}?app_id=${appId}`);
    await this.manager.connect();
    return this.manager;
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

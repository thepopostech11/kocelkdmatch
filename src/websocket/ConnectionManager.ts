import { DERIV_CONFIG } from "@/config/app";
import { fetchDerivAccounts, issueDerivWebSocketUrl } from "@/lib/deriv/oauth.functions";
import { selectActiveAccount, useAuthStore } from "@/stores/authStore";
import { WebSocketManager } from "./WebSocketManager";

export type SocketSessionMode = "public" | "legacy-token" | "oauth2-otp";

/**
 * ConnectionManager — the single entry point for the Deriv socket.
 * Guarantees exactly one live socket for the whole application and exposes a
 * drop hook so the MarketEngine can re-run its handshake after a reconnect.
 */
class ConnectionManagerImpl {
  private manager: WebSocketManager | null = null;
  private connecting: Promise<WebSocketManager> | null = null;
  private sessionMode: SocketSessionMode = "public";
  private sessionAccountId: string | null = null;

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

  /**
   * Opens the correct authenticated socket for the active account. OAuth2
   * bearer tokens authenticate the REST request that issues a one-time WS URL;
   * legacy API tokens continue to use the normal `authorize` message.
   */
  async connectAuthenticated(): Promise<WebSocketManager> {
    let state = useAuthStore.getState();
    let account = selectActiveAccount(state);

    // Repair sessions created before the REST response's `data` envelope was
    // handled. The existing OAuth2 access token remains unchanged.
    if (state.accessToken && !account) {
      const accounts = await fetchDerivAccounts({ data: { accessToken: state.accessToken } });
      useAuthStore.getState().setAccounts(accounts);
      state = useAuthStore.getState();
      account = selectActiveAccount(state);
    }
    const accountToken = account?.token;

    if (account && accountToken) {
      if (this.manager?.isOpen && this.sessionMode === "legacy-token") return this.manager;
      this.disconnect();
      const socket = await this.connect();
      this.sessionMode = "legacy-token";
      this.sessionAccountId = account.loginid;
      return socket;
    }

    if (!state.accessToken || !account?.loginid) {
      this.sessionMode = "public";
      this.sessionAccountId = null;
      return this.connect();
    }

    if (
      this.manager?.isOpen &&
      this.sessionMode === "oauth2-otp" &&
      this.sessionAccountId === account.loginid
    ) {
      return this.manager;
    }

    this.disconnect();
    const { url } = await issueDerivWebSocketUrl({
      data: { accessToken: state.accessToken, accountId: account.loginid },
    });
    const manager = new WebSocketManager(url);
    manager.onClose = () => {
      this.manager = null;
      this.onDrop?.();
    };
    await manager.connect();
    this.manager = manager;
    this.sessionMode = "oauth2-otp";
    this.sessionAccountId = account.loginid;
    return manager;
  }

  get socket() {
    return this.manager;
  }

  get mode() {
    return this.sessionMode;
  }

  get accountId() {
    return this.sessionAccountId;
  }

  disconnect() {
    this.manager?.close();
    this.manager = null;
    this.sessionMode = "public";
    this.sessionAccountId = null;
  }
}

export const ConnectionManager = new ConnectionManagerImpl();

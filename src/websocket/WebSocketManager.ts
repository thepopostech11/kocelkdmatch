/**
 * WebSocketManager — Phase 1 foundation.
 * Owns the raw socket lifecycle only. Trading/subscription logic lands in later phases.
 */
export type SocketListener = (payload: Record<string, unknown>) => void;

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private listeners = new Set<SocketListener>();
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);
      } catch (error) {
        reject(error as Error);
        return;
      }
      this.socket.onopen = () => resolve();
      this.socket.onerror = () => reject(new Error("WebSocket connection failed"));
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          this.listeners.forEach((l) => l(data));
        } catch {
          /* ignore malformed frames */
        }
      };
    });
  }

  send(payload: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }

  subscribe(listener: SocketListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isOpen() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }
}

/**
 * WebSocketManager — owns the raw Deriv socket lifecycle.
 *
 * Adds over the Phase 1 foundation:
 *  - `onClose` / `onOpen` hooks so the ConnectionManager can reconnect.
 *  - `request()` — req_id correlated request/response for trading calls.
 *  - Outbound queueing so sends issued before OPEN are not silently dropped.
 */
export type SocketListener = (payload: Record<string, unknown>) => void;

export type DerivError = { code: string; message: string };

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private listeners = new Set<SocketListener>();
  private pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private queue: Record<string, unknown>[] = [];
  private reqId = 1;
  private url: string;
  private closedByUser = false;

  onClose: (() => void) | null = null;
  onOpen: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    this.closedByUser = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        this.socket = new WebSocket(this.url);
      } catch (error) {
        reject(error as Error);
        return;
      }

      this.socket.onopen = () => {
        settled = true;
        // Flush anything queued while the socket was still opening.
        const queued = this.queue;
        this.queue = [];
        queued.forEach((p) => this.send(p));
        this.onOpen?.();
        resolve();
      };

      this.socket.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error("WebSocket connection failed"));
        }
      };

      this.socket.onclose = () => {
        this.rejectAllPending(new Error("Socket closed"));
        if (!settled) {
          settled = true;
          reject(new Error("WebSocket closed before opening"));
        }
        if (!this.closedByUser) this.onClose?.();
      };

      this.socket.onmessage = (event) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(event.data as string) as Record<string, unknown>;
        } catch {
          return;
        }

        // Resolve a correlated request first, then fan out to stream listeners.
        const id = data["req_id"];
        if (typeof id === "number" && this.pending.has(id)) {
          const entry = this.pending.get(id)!;
          this.pending.delete(id);
          clearTimeout(entry.timer);
          const err = data["error"] as DerivError | undefined;
          if (err) entry.reject(new Error(err.message || err.code));
          else entry.resolve(data);
        }

        this.listeners.forEach((l) => l(data));
      };
    });
  }

  send(payload: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else if (this.socket?.readyState === WebSocket.CONNECTING) {
      this.queue.push(payload);
    }
  }

  /** Correlated request — resolves with the matching response frame. */
  request(payload: Record<string, unknown>, timeoutMs = 20000): Promise<Record<string, unknown>> {
    const req_id = this.reqId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(req_id);
        reject(new Error("Deriv request timed out"));
      }, timeoutMs);
      this.pending.set(req_id, { resolve, reject, timer });
      this.send({ ...payload, req_id });
    });
  }

  private rejectAllPending(error: Error) {
    this.pending.forEach((entry) => {
      clearTimeout(entry.timer);
      entry.reject(error);
    });
    this.pending.clear();
  }

  subscribe(listener: SocketListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get isOpen() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  close() {
    this.closedByUser = true;
    this.rejectAllPending(new Error("Socket closed"));
    this.socket?.close();
    this.socket = null;
  }
}

import { backendPort } from "./portUtils";

export type WebSocketMessage = {
  type: "notification" | "connected";
  payload?: unknown;
  userId?: string;
};

type MessageHandler = (message: WebSocketMessage) => void;

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const POLLING_INTERVAL = 30000;

export class NotificationWebSocket {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private onMessage: MessageHandler;
  private onFallbackPoll: () => void;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private _connected = false;

  constructor(onMessage: MessageHandler, onFallbackPoll: () => void) {
    this.onMessage = onMessage;
    this.onFallbackPoll = onFallbackPoll;
  }

  get connected(): boolean {
    return this._connected;
  }

  connect(token: string): void {
    this.token = token;
    this.closed = false;
    this.reconnectAttempt = 0;
    this.stopPolling();
    this.createConnection();
  }

  disconnect(): void {
    this.closed = true;
    this.stopPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this._connected = false;
  }

  private createConnection(): void {
    if (this.closed || !this.token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//localhost:${backendPort}/ws?token=${this.token}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.handleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectAttempt = 0;
      this.stopPolling();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        this.onMessage(data);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this._connected = false;
      if (event.code === 4001 || event.code === 4003) {
        this.startPolling();
        return;
      }
      if (!this.closed) {
        this.handleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private handleReconnect(): void {
    if (this.closed) return;

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt++;

    this.startPolling();

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      this.onFallbackPoll();
    }, POLLING_INTERVAL);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

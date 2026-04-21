import { useEffect, useRef } from "react";
import { backendPort } from "../utils/portUtils";

const NOTIFICATIONS_WS_PATH = "/ws/notifications";
const POLL_INTERVAL_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

type ServerMessage =
  | { type: "connected" }
  | { type: "notification"; notification: unknown }
  | { type: "pong" };

const buildWebSocketUrl = (): string | null => {
  if (typeof window === "undefined" || !backendPort) return null;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:${backendPort}${NOTIFICATIONS_WS_PATH}`;
};

/**
 * Subscribes to real-time notification events via WebSocket. When the socket
 * is open, `onUpdate` is called for every broadcast. When the socket is
 * unavailable (or disconnected), the hook falls back to calling `onUpdate`
 * on a polling interval so notifications still refresh.
 */
export const useNotificationsSubscription = (onUpdate: () => void): void => {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    let cancelled = false;
    let reconnectAttempt = 0;
    let socket: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = setInterval(() => {
        onUpdateRef.current();
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempt,
        MAX_RECONNECT_DELAY_MS
      );
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (cancelled) return;
      const url = buildWebSocketUrl();
      if (!url || typeof WebSocket === "undefined") {
        startPolling();
        return;
      }

      let nextSocket: WebSocket;
      try {
        nextSocket = new WebSocket(url);
      } catch {
        startPolling();
        scheduleReconnect();
        return;
      }

      socket = nextSocket;

      nextSocket.onopen = () => {
        if (cancelled) {
          nextSocket.close();
          return;
        }
        reconnectAttempt = 0;
        stopPolling();
        // Refresh once on connect so the client is in sync with anything
        // missed while disconnected.
        onUpdateRef.current();
      };

      nextSocket.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== "string") return;
        let parsed: ServerMessage;
        try {
          parsed = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }
        if (parsed.type === "notification") {
          onUpdateRef.current();
        }
      };

      const handleDisconnect = () => {
        if (socket === nextSocket) {
          socket = null;
        }
        if (cancelled) return;
        startPolling();
        scheduleReconnect();
      };

      nextSocket.onerror = handleDisconnect;
      nextSocket.onclose = handleDisconnect;
    };

    connect();

    return () => {
      cancelled = true;
      stopPolling();
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
        socket = null;
      }
    };
  }, []);
};

import { useEffect, useRef, useState } from "react";
import { backendPort } from "./portUtils";

const WS_PATH = "/ws/notifications";
const RECONNECT_INITIAL_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

export type NotificationSocketStatus = "connecting" | "open" | "closed";

export interface NotificationSocketMessage {
  type: "connected" | "notification.created" | "notification.updated";
  userId?: string;
  notification?: unknown;
}

export const buildNotificationSocketUrl = (): string => {
  if (typeof window === "undefined") {
    return `ws://localhost:${backendPort}${WS_PATH}`;
  }
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host =
    /* istanbul ignore next */
    backendPort ? `localhost:${backendPort}` : window.location.host;
  return `${scheme}//${host}${WS_PATH}`;
};

export interface UseNotificationSocketOptions {
  enabled: boolean;
  onMessage: (msg: NotificationSocketMessage) => void;
}

export const useNotificationSocket = ({
  enabled,
  onMessage,
}: UseNotificationSocketOptions): NotificationSocketStatus => {
  const [status, setStatus] = useState<NotificationSocketStatus>("closed");
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      return;
    }
    /* istanbul ignore if */
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      setStatus("closed");
      return;
    }

    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = RECONNECT_INITIAL_DELAY_MS;

    const scheduleReconnect = () => {
      if (disposed) return;
      if (reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RECONNECT_MAX_DELAY_MS);
    };

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      try {
        socket = new WebSocket(buildNotificationSocketUrl());
      } catch (err) {
        /* istanbul ignore next */
        console.warn("[notification-ws] failed to construct socket", err);
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        retryDelay = RECONNECT_INITIAL_DELAY_MS;
        setStatus("open");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as NotificationSocketMessage;
          onMessageRef.current(data);
        } catch {
          /* ignore malformed messages */
        }
      };

      socket.onerror = () => {
        /* istanbul ignore next */
        setStatus("closed");
      };

      socket.onclose = () => {
        setStatus("closed");
        if (!disposed) scheduleReconnect();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [enabled]);

  return status;
};

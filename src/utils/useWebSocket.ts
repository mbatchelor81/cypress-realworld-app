import { useEffect, useRef, useCallback, useState } from "react";
import { backendPort } from "./portUtils";
import { NotificationResponseItem } from "../models";

export interface WebSocketNotificationMessage {
  type: "NOTIFICATIONS";
  userId: string;
  notifications: NotificationResponseItem[];
}

interface UseWebSocketOptions {
  currentUserId: string | undefined;
  onNotification: (notifications: NotificationResponseItem[]) => void;
}

export const useNotificationWebSocket = ({
  currentUserId,
  onNotification,
}: UseWebSocketOptions) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  const clearNewNotifications = useCallback(() => {
    setHasNewNotifications(false);
  }, []);

  const connect = useCallback(() => {
    if (!currentUserId) return;

    const wsUrl = `ws://localhost:${backendPort}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketNotificationMessage = JSON.parse(event.data);
        if (data.type === "NOTIFICATIONS" && data.userId === currentUserId) {
          setHasNewNotifications(true);
          onNotification(data.notifications);
        }
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected, reconnecting in 3s...");
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      ws.close();
    };

    wsRef.current = ws;
  }, [currentUserId, onNotification]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { hasNewNotifications, clearNewNotifications };
};

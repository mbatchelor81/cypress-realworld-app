import { useEffect } from "react";
import {
  subscribe,
  WebSocketEventType,
  WebSocketServerMessage,
} from "../services/websocketClient";

type EventHandler = (message: WebSocketServerMessage) => void;

export const useWebSocket = (topic: string, handler: EventHandler): void => {
  useEffect(() => {
    const unsubscribe = subscribe(topic, handler);
    return unsubscribe;
  }, [topic, handler]);
};

export const useTransactionWebSocket = (
  userId: string | undefined,
  onEvent: EventHandler
): void => {
  useEffect(() => {
    if (!userId) return;

    const unsubPersonal = subscribe(`transactions:${userId}`, onEvent);
    const unsubPublic = subscribe("transactions", onEvent);

    return () => {
      unsubPersonal();
      unsubPublic();
    };
  }, [userId, onEvent]);
};

export const useNotificationWebSocket = (
  userId: string | undefined,
  onEvent: EventHandler
): void => {
  useEffect(() => {
    if (!userId) return;

    const unsub = subscribe(`notifications:${userId}`, onEvent);
    return unsub;
  }, [userId, onEvent]);
};

export { WebSocketEventType };
export type { WebSocketServerMessage };

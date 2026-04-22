import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import {
  WebSocketEventType,
  WebSocketClientAction,
  WebSocketServerMessage,
  WebSocketClientMessage,
} from "./websocket-types";

interface AuthenticatedWebSocket extends WebSocket {
  isAlive: boolean;
  userId: string | undefined;
  subscribedTopics: Set<string>;
}

const HEARTBEAT_INTERVAL_MS = 30000;

let wss: WebSocketServer | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

const parseClientMessage = (data: string): WebSocketClientMessage | null => {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;

    if (
      typeof parsed.action !== "string" ||
      typeof parsed.topic !== "string" ||
      !Object.values(WebSocketClientAction).includes(parsed.action as WebSocketClientAction)
    ) {
      return null;
    }

    return {
      action: parsed.action as WebSocketClientAction,
      topic: parsed.topic as string,
    };
  } catch {
    return null;
  }
};

export const initWebSocketServer = (server: HttpServer): WebSocketServer => {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    const client = ws as AuthenticatedWebSocket;
    client.isAlive = true;
    client.userId = undefined;
    client.subscribedTopics = new Set();

    client.on("pong", () => {
      client.isAlive = true;
    });

    client.on("message", (rawData: WebSocket.RawData) => {
      const message = parseClientMessage(rawData.toString());
      if (!message) {
        return;
      }

      if (message.action === WebSocketClientAction.SUBSCRIBE) {
        client.subscribedTopics.add(message.topic);
      } else if (message.action === WebSocketClientAction.UNSUBSCRIBE) {
        client.subscribedTopics.delete(message.topic);
      }
    });

    client.on("close", () => {
      client.subscribedTopics.clear();
    });
  });

  heartbeatInterval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      const client = ws as AuthenticatedWebSocket;
      if (!client.isAlive) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  return wss;
};

export const broadcastToTopic = (topic: string, message: WebSocketServerMessage): void => {
  if (!wss) return;

  const serialized = JSON.stringify(message);
  wss.clients.forEach((ws) => {
    const client = ws as AuthenticatedWebSocket;
    if (client.readyState === WebSocket.OPEN && client.subscribedTopics.has(topic)) {
      client.send(serialized);
    }
  });
};

export const broadcastToAll = (message: WebSocketServerMessage): void => {
  if (!wss) return;

  const serialized = JSON.stringify(message);
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  });
};

export const emitTransactionCreated = (
  transactionId: string,
  senderId: string,
  receiverId: string
): void => {
  const message: WebSocketServerMessage = {
    type: WebSocketEventType.TRANSACTION_CREATED,
    payload: { transactionId, senderId, receiverId },
    timestamp: new Date().toISOString(),
  };

  broadcastToTopic("transactions", message);
  broadcastToTopic(`transactions:${senderId}`, message);
  broadcastToTopic(`transactions:${receiverId}`, message);
};

export const emitTransactionUpdated = (
  transactionId: string,
  status: string,
  requestStatus?: string
): void => {
  const message: WebSocketServerMessage = {
    type: WebSocketEventType.TRANSACTION_UPDATED,
    payload: { transactionId, status, requestStatus },
    timestamp: new Date().toISOString(),
  };

  broadcastToTopic("transactions", message);
};

export const emitNotificationReceived = (notificationId: string, userId: string): void => {
  const message: WebSocketServerMessage = {
    type: WebSocketEventType.NOTIFICATION_RECEIVED,
    payload: { notificationId, userId },
    timestamp: new Date().toISOString(),
  };

  broadcastToTopic(`notifications:${userId}`, message);
};

export const emitLikeCreated = (
  likeId: string,
  transactionId: string,
  userId: string
): void => {
  const message: WebSocketServerMessage = {
    type: WebSocketEventType.LIKE_CREATED,
    payload: { likeId, transactionId, userId },
    timestamp: new Date().toISOString(),
  };

  broadcastToTopic(`transaction:${transactionId}`, message);
};

export const emitCommentCreated = (
  commentId: string,
  transactionId: string,
  userId: string
): void => {
  const message: WebSocketServerMessage = {
    type: WebSocketEventType.COMMENT_CREATED,
    payload: { commentId, transactionId, userId },
    timestamp: new Date().toISOString(),
  };

  broadcastToTopic(`transaction:${transactionId}`, message);
};

export const getWebSocketServer = (): WebSocketServer | null => wss;

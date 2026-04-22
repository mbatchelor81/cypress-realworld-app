import { Server as HttpServer, IncomingMessage } from "http";
import WebSocket, { WebSocketServer } from "ws";
import cookie from "cookie";
import signature from "cookie-signature";
import {
  WebSocketEventType,
  WebSocketClientAction,
  WebSocketServerMessage,
  WebSocketClientMessage,
} from "./websocket-types";

interface AuthenticatedWebSocket extends WebSocket {
  isAlive: boolean;
  userId: string;
  subscribedTopics: Set<string>;
}

const HEARTBEAT_INTERVAL_MS = 30000;

let wss: WebSocketServer | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let configuredSecret = "";

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

const extractSessionId = (req: IncomingMessage): string | null => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookie.parse(cookieHeader);
  const signedCookie = cookies["connect.sid"];
  if (!signedCookie) return null;

  const rawValue = signedCookie.startsWith("s:")
    ? signedCookie.slice(2)
    : signedCookie;

  const result = signature.unsign(rawValue, configuredSecret);
  if (result === false) return null;

  return result;
};

export const initWebSocketServer = (server: HttpServer, secret: string): WebSocketServer => {
  configuredSecret = secret;
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url || "/", `http://${req.headers.host}`);
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const sid = extractSessionId(req);
    if (!sid) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss!.handleUpgrade(req, socket, head, (ws) => {
      wss!.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const client = ws as AuthenticatedWebSocket;
    client.isAlive = true;
    client.subscribedTopics = new Set();

    const cookies = cookie.parse(req.headers.cookie || "");
    const signedCookie = cookies["connect.sid"] || "";
    const rawValue = signedCookie.startsWith("s:") ? signedCookie.slice(2) : signedCookie;
    const sid = signature.unsign(rawValue, configuredSecret);
    client.userId = typeof sid === "string" ? sid : "";

    client.on("pong", () => {
      client.isAlive = true;
    });

    client.on("message", (rawData: WebSocket.RawData) => {
      const message = parseClientMessage(rawData.toString());
      if (!message) {
        return;
      }

      if (message.action === WebSocketClientAction.SUBSCRIBE) {
        const isPrivateTopic = message.topic.includes(":");
        if (isPrivateTopic) {
          const topicUserId = message.topic.split(":")[1];
          if (topicUserId && topicUserId !== client.userId) {
            return;
          }
        }
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

  const envelope = { ...message, topic };
  const serialized = JSON.stringify(envelope);
  wss.clients.forEach((ws) => {
    const client = ws as AuthenticatedWebSocket;
    if (client.readyState === WebSocket.OPEN && client.subscribedTopics.has(topic)) {
      client.send(serialized);
    }
  });
};

export const broadcastToAll = (message: WebSocketServerMessage): void => {
  if (!wss) return;

  const envelope = { ...message, topic: "*" };
  const serialized = JSON.stringify(envelope);
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

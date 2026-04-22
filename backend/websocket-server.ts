import { Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { RequestHandler } from "express";
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

interface SessionRequest extends IncomingMessage {
  session?: { passport?: { user?: string } };
  _resolvedUserId?: string;
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

const resolveUserId = (
  sessionMiddleware: RequestHandler,
  req: IncomingMessage
): Promise<string | null> => {
  return new Promise((resolve) => {
    const res = new ServerResponse(req);
    sessionMiddleware(req as Parameters<RequestHandler>[0], res as Parameters<RequestHandler>[1], () => {
      const sessionReq = req as SessionRequest;
      const userId = sessionReq.session?.passport?.user ?? null;
      resolve(userId);
    });
  });
};

export const initWebSocketServer = (
  server: HttpServer,
  sessionMiddleware: RequestHandler
): WebSocketServer => {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url || "/", `http://${req.headers.host}`);
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    resolveUserId(sessionMiddleware, req)
      .then((userId) => {
        if (!userId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        const sessionReq = req as SessionRequest;
        sessionReq._resolvedUserId = userId;
        wss!.handleUpgrade(req, socket, head, (ws) => {
          wss!.emit("connection", ws, req);
        });
      })
      .catch(() => {
        socket.destroy();
      });
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const client = ws as AuthenticatedWebSocket;
    client.isAlive = true;
    client.subscribedTopics = new Set();
    client.userId = (req as SessionRequest & { _resolvedUserId?: string })._resolvedUserId || "";

    client.on("pong", () => {
      client.isAlive = true;
    });

    client.on("message", (rawData: WebSocket.RawData) => {
      const message = parseClientMessage(rawData.toString());
      if (!message) {
        return;
      }

      if (message.action === WebSocketClientAction.SUBSCRIBE) {
        if (message.topic.includes(":")) {
          const [prefix, suffix] = message.topic.split(":");
          const userScopedPrefixes = ["transactions", "notifications"];
          if (userScopedPrefixes.includes(prefix) && suffix !== client.userId) {
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
  receiverId: string,
  privacyLevel: string
): void => {
  const message: WebSocketServerMessage = {
    type: WebSocketEventType.TRANSACTION_CREATED,
    payload: { transactionId, senderId, receiverId },
    timestamp: new Date().toISOString(),
  };

  if (privacyLevel === "public") {
    broadcastToTopic("transactions", message);
  }
  broadcastToTopic(`transactions:${senderId}`, message);
  broadcastToTopic(`transactions:${receiverId}`, message);
};

export const emitTransactionUpdated = (
  transactionId: string,
  senderId: string,
  receiverId: string,
  status: string,
  requestStatus?: string
): void => {
  const message: WebSocketServerMessage = {
    type: WebSocketEventType.TRANSACTION_UPDATED,
    payload: { transactionId, status, requestStatus },
    timestamp: new Date().toISOString(),
  };

  broadcastToTopic(`transactions:${senderId}`, message);
  broadcastToTopic(`transactions:${receiverId}`, message);
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

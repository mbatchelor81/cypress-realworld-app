import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { NotificationType, NotificationResponseItem } from "../src/models";

export const JWT_SECRET = process.env.JWT_SECRET || "rwa-websocket-secret";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Map<string, Set<AuthenticatedWebSocket>>();

let wss: WebSocketServer | null = null;

export const initWebSocketServer = (server: HttpServer): WebSocketServer => {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Authentication required");
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      ws.userId = decoded.userId;
      ws.isAlive = true;

      if (!clients.has(decoded.userId)) {
        clients.set(decoded.userId, new Set());
      }
      clients.get(decoded.userId)!.add(ws);

      ws.send(JSON.stringify({ type: "connected", userId: decoded.userId }));
    } catch {
      ws.close(4003, "Invalid token");
      return;
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("close", () => {
      if (ws.userId) {
        const userClients = clients.get(ws.userId);
        if (userClients) {
          userClients.delete(ws);
          if (userClients.size === 0) {
            clients.delete(ws.userId);
          }
        }
      }
    });
  });

  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.isAlive === false) {
        authWs.terminate();
        return;
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  return wss;
};

export const broadcastNotification = (
  userId: string,
  notification: NotificationType | NotificationResponseItem
) => {
  const userClients = clients.get(userId);
  if (!userClients) return;

  const message = JSON.stringify({
    type: "notification",
    payload: notification,
  });

  userClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
};

export const getConnectedClientCount = (): number => {
  let count = 0;
  clients.forEach((set) => {
    count += set.size;
  });
  return count;
};

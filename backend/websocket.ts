import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { RequestHandler } from "express";
import passport from "passport";
import { NotificationResponseItem } from "../src/models";

let wss: WebSocketServer | undefined;

// Map of userId -> Set of WebSocket connections for that user
const userConnections = new Map<string, Set<WebSocket>>();

export const setupWebSocket = (
  server: HttpServer,
  sessionMiddleware: RequestHandler
): WebSocketServer => {
  wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, userId: string) => {
    // Track this connection for the authenticated user
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(ws);

    ws.on("error", (err) => {
      console.error("WebSocket client error:", err);
    });

    ws.on("close", () => {
      const connections = userConnections.get(userId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          userConnections.delete(userId);
        }
      }
    });
  });

  // Authenticate WebSocket upgrade requests using the session
  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    // Run session middleware to parse the session cookie
    const res = Object.create(require("http").ServerResponse.prototype);
    sessionMiddleware(req as any, res, () => {
      passport.initialize()(req as any, res, () => {
        passport.session()(req as any, res, () => {
          const user = (req as any).user;
          if (!user || !user.id) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }

          wss!.handleUpgrade(req, socket, head, (ws) => {
            wss!.emit("connection", ws, user.id);
          });
        });
      });
    });
  });

  return wss;
};

export const broadcastNotifications = (
  userId: string,
  notifications: NotificationResponseItem[]
) => {
  if (!wss) return;

  const connections = userConnections.get(userId);
  if (!connections) return;

  const message = JSON.stringify({
    type: "NOTIFICATIONS",
    userId,
    notifications,
  });

  connections.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

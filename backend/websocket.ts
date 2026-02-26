import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { NotificationResponseItem } from "../src/models";

let wss: WebSocketServer | undefined;

export const setupWebSocket = (server: HttpServer): WebSocketServer => {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("error", (err) => {
      console.error("WebSocket client error:", err);
    });
  });

  return wss;
};

export const broadcastNotifications = (
  userId: string,
  notifications: NotificationResponseItem[]
) => {
  if (!wss) return;

  const message = JSON.stringify({
    type: "NOTIFICATIONS",
    userId,
    notifications,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

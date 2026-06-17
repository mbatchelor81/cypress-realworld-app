import type { IncomingMessage, Server as HttpServer } from "http";
import type { RequestHandler } from "express";
import type { Duplex } from "stream";
import { WebSocket, WebSocketServer } from "ws";
import type passport from "passport";
import type { NotificationResponseItem } from "../src/models";

export const NOTIFICATIONS_WS_PATH = "/ws/notifications";

const HEARTBEAT_INTERVAL_MS = 30_000;

interface AuthedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

type NotificationMessage =
  | { type: "connected" }
  | { type: "notification"; notification: NotificationResponseItem }
  | { type: "pong" };

const userConnections = new Map<string, Set<AuthedWebSocket>>();

let wsServer: WebSocketServer | null = null;

const runMiddleware = (
  req: IncomingMessage,
  res: Record<string, unknown>,
  middleware: RequestHandler
): Promise<void> =>
  new Promise((resolve, reject) => {
    // @ts-expect-error — Express middleware accepts Node's IncomingMessage + a minimal response shim.
    middleware(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
  });

const buildUpgradeResponseShim = () => ({
  getHeader: () => undefined,
  setHeader: () => undefined,
  writeHead: () => undefined,
  end: () => undefined,
  on: () => undefined,
  once: () => undefined,
  emit: () => undefined,
  removeListener: () => undefined,
});

const rejectUpgrade = (socket: Duplex, statusLine: string): void => {
  try {
    socket.write(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\n\r\n`);
  } catch {
    // best-effort — the socket may already be closed
  }
  socket.destroy();
};

const addConnection = (userId: string, ws: AuthedWebSocket): void => {
  let connections = userConnections.get(userId);
  if (!connections) {
    connections = new Set();
    userConnections.set(userId, connections);
  }
  connections.add(ws);
};

const removeConnection = (userId: string, ws: AuthedWebSocket): void => {
  const connections = userConnections.get(userId);
  if (!connections) return;
  connections.delete(ws);
  if (connections.size === 0) {
    userConnections.delete(userId);
  }
};

export const initNotificationWebSocketServer = (
  server: HttpServer,
  sessionMiddleware: RequestHandler,
  passportInstance: typeof passport
): WebSocketServer => {
  const wss = new WebSocketServer({ noServer: true });
  wsServer = wss;

  const authenticateUpgrade = async (req: IncomingMessage): Promise<string | null> => {
    const res = buildUpgradeResponseShim();
    try {
      await runMiddleware(req, res, sessionMiddleware);
      await runMiddleware(req, res, passportInstance.initialize());
      await runMiddleware(req, res, passportInstance.session());
    } catch {
      return null;
    }
    // @ts-expect-error — passport.session() populates `user` on the request.
    const user: { id?: string; sub?: string } | undefined = req.user;
    const userId = user?.id ?? user?.sub;
    return userId ?? null;
  };

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = req.url ?? "";
    if (!url.startsWith(NOTIFICATIONS_WS_PATH)) {
      return;
    }

    authenticateUpgrade(req)
      .then((userId) => {
        if (!userId) {
          rejectUpgrade(socket, "401 Unauthorized");
          return;
        }
        wss.handleUpgrade(req, socket, head, (client) => {
          const ws = client as AuthedWebSocket;
          ws.userId = userId;
          wss.emit("connection", ws, req);
        });
      })
      .catch(() => {
        rejectUpgrade(socket, "500 Internal Server Error");
      });
  });

  wss.on("connection", (client: WebSocket) => {
    const ws = client as AuthedWebSocket;
    if (!ws.userId) {
      ws.close(1008, "Unauthorized");
      return;
    }

    ws.isAlive = true;
    addConnection(ws.userId, ws);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed && parsed.type === "ping") {
          sendMessage(ws, { type: "pong" });
        }
      } catch {
        // ignore malformed client messages
      }
    });

    ws.on("close", () => {
      if (ws.userId) removeConnection(ws.userId, ws);
    });

    ws.on("error", () => {
      if (ws.userId) removeConnection(ws.userId, ws);
    });

    sendMessage(ws, { type: "connected" });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as AuthedWebSocket;
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(heartbeat);
    wsServer = null;
  });

  return wss;
};

const sendMessage = (ws: AuthedWebSocket, message: NotificationMessage): void => {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // client may have disconnected between readyState check and send
  }
};

export const broadcastNotificationToUser = (
  userId: string,
  notification: NotificationResponseItem
): void => {
  if (!wsServer) return;
  const connections = userConnections.get(userId);
  if (!connections || connections.size === 0) return;
  connections.forEach((ws) => sendMessage(ws, { type: "notification", notification }));
};

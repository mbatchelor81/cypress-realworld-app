import type { Server as HttpServer, IncomingMessage } from "http";
import type { RequestHandler } from "express";
import { WebSocketServer, WebSocket } from "ws";
import type { NotificationResponseItem } from "../src/models";

const WS_PATH = "/ws/notifications";
const HEARTBEAT_INTERVAL_MS = 30_000;

type AuthedRequest = IncomingMessage & {
  user?: { id?: string };
  session?: unknown;
};

type AuthedSocket = WebSocket & {
  userId: string;
  isAlive: boolean;
};

type ServerEvent =
  | { type: "connected"; userId: string }
  | { type: "notification.created"; notification: NotificationResponseItem }
  | { type: "notification.updated"; notification: NotificationResponseItem };

const sockets = new Set<AuthedSocket>();
let wss: WebSocketServer | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

const safeSend = (socket: AuthedSocket, event: ServerEvent) => {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(event));
  } catch (err) {
    /* istanbul ignore next */
    console.error("[notification-ws] failed to send event", err);
  }
};

const runMiddleware = (middleware: RequestHandler, req: AuthedRequest): Promise<void> =>
  new Promise((resolve, reject) => {
    const res = {
      end: () => {},
      setHeader: () => {},
      getHeader: () => undefined,
    } as unknown as Parameters<RequestHandler>[1];
    middleware(req as Parameters<RequestHandler>[0], res, (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });

const authenticateUpgrade = async (
  req: AuthedRequest,
  middlewares: RequestHandler[]
): Promise<string | null> => {
  for (const mw of middlewares) {
    await runMiddleware(mw, req);
  }
  return req.user?.id ?? null;
};

export const setupNotificationWsServer = (
  server: HttpServer,
  middlewares: RequestHandler[]
): void => {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const url = req.url ?? "";
    if (!url.startsWith(WS_PATH)) return;

    try {
      const userId = await authenticateUpgrade(req as AuthedRequest, middlewares);
      /* istanbul ignore if */
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss!.handleUpgrade(req, socket, head, (ws) => {
        const authed = ws as AuthedSocket;
        authed.userId = userId;
        authed.isAlive = true;
        sockets.add(authed);

        authed.on("pong", () => {
          authed.isAlive = true;
        });

        authed.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg?.type === "ping") {
              safeSend(authed, { type: "connected", userId });
            }
          } catch {
            /* ignore malformed client messages */
          }
        });

        authed.on("close", () => {
          sockets.delete(authed);
        });

        safeSend(authed, { type: "connected", userId });
      });
    } catch (err) {
      /* istanbul ignore next */
      console.error("[notification-ws] upgrade failed", err);
      socket.destroy();
    }
  });

  heartbeatTimer = setInterval(() => {
    for (const socket of sockets) {
      if (!socket.isAlive) {
        socket.terminate();
        sockets.delete(socket);
        continue;
      }
      socket.isAlive = false;
      try {
        socket.ping();
      } catch {
        /* ignore */
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();
};

export const broadcastNotificationCreated = (notification: NotificationResponseItem): void => {
  for (const socket of sockets) {
    if (socket.userId === notification.userId) {
      safeSend(socket, { type: "notification.created", notification });
    }
  }
};

export const broadcastNotificationUpdated = (notification: NotificationResponseItem): void => {
  for (const socket of sockets) {
    if (socket.userId === notification.userId) {
      safeSend(socket, { type: "notification.updated", notification });
    }
  }
};

/* istanbul ignore next */
export const closeNotificationWsServer = (): void => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  for (const socket of sockets) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  }
  sockets.clear();
  wss?.close();
  wss = null;
};

export const NOTIFICATION_WS_PATH = WS_PATH;

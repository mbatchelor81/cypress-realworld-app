import type { IncomingMessage, Server as HTTPServer } from "http";
import type { Duplex } from "stream";
import type { RequestHandler, Response } from "express";
import { WebSocket, WebSocketServer } from "ws";

interface SessionRequest extends IncomingMessage {
  session?: {
    passport?: { user?: string };
    [key: string]: unknown;
  };
}

const userConnections: Map<string, Set<WebSocket>> = new Map();

function getUserIdFromSession(req: SessionRequest): string | undefined {
  return req.session?.passport?.user;
}

export function setupWebSocketServer(server: HTTPServer, sessionMiddleware: RequestHandler): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const sessionRequest = request as SessionRequest;
    const fakeResponse = {} as Response;

    sessionMiddleware(sessionRequest as unknown as Parameters<RequestHandler>[0], fakeResponse, (err?: unknown) => {
      if (err) {
        socket.destroy();
        return;
      }

      const userId = getUserIdFromSession(sessionRequest);
      if (!userId) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(sessionRequest, socket, head, (ws) => {
        wss.emit("connection", ws, sessionRequest);
      });
    });
  });

  wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
    const sessionRequest = request as SessionRequest;
    const userId = getUserIdFromSession(sessionRequest);
    if (!userId) {
      ws.close();
      return;
    }

    let sockets = userConnections.get(userId);
    if (!sockets) {
      sockets = new Set<WebSocket>();
      userConnections.set(userId, sockets);
    }
    sockets.add(ws);

    ws.on("error", () => {
      // Prevent unhandled 'error' events from crashing the process
    });

    ws.on("close", () => {
      const current = userConnections.get(userId);
      if (!current) {
        return;
      }
      current.delete(ws);
      if (current.size === 0) {
        userConnections.delete(userId);
      }
    });
  });
}

export function broadcastToUser(userId: string, payload: object): void {
  const sockets = userConnections.get(userId);
  if (!sockets || sockets.size === 0) {
    return;
  }

  const message = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

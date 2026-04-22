import { Machine, assign, Sender } from "xstate";

export interface WebSocketSchema {
  states: {
    idle: {};
    active: {
      states: {
        connecting: {};
        connected: {};
      };
    };
    disconnected: {};
  };
}

export type WebSocketEvents =
  | { type: "CONNECT"; url: string }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "WS_MESSAGE"; data: unknown }
  | { type: "DISCONNECT" }
  | { type: "CLEAR_NEW_NOTIFICATIONS" };

export interface WebSocketContext {
  url: string;
  notificationVersion: number;
}

const isNotificationCreated = (data: unknown): boolean => {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "NOTIFICATION_CREATED"
  );
};

export const webSocketMachine = Machine<WebSocketContext, WebSocketSchema, WebSocketEvents>(
  {
    id: "webSocket",
    initial: "idle",
    context: {
      url: "",
      notificationVersion: 0,
    },
    on: {
      CLEAR_NEW_NOTIFICATIONS: {
        actions: assign<WebSocketContext, WebSocketEvents>({
          notificationVersion: () => 0,
        }),
      },
    },
    states: {
      idle: {
        on: {
          CONNECT: {
            target: "active",
            actions: assign<WebSocketContext, WebSocketEvents>({
              url: (_ctx, event) => (event.type === "CONNECT" ? event.url : ""),
            }),
          },
        },
      },
      active: {
        initial: "connecting",
        invoke: {
          id: "webSocketService",
          src: (context: WebSocketContext) => (send: Sender<WebSocketEvents>) => {
            const socket = new WebSocket(context.url);

            socket.onopen = () => {
              send({ type: "CONNECTED" });
            };

            socket.onmessage = (event: MessageEvent) => {
              let parsed: unknown;
              try {
                parsed = JSON.parse(event.data as string);
              } catch {
                parsed = event.data;
              }
              send({ type: "WS_MESSAGE", data: parsed });
            };

            socket.onclose = () => {
              send({ type: "DISCONNECTED" });
            };

            socket.onerror = () => {
              send({ type: "DISCONNECTED" });
            };

            return () => {
              if (
                socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING
              ) {
                socket.close();
              }
            };
          },
        },
        on: {
          DISCONNECT: "idle",
          DISCONNECTED: "disconnected",
        },
        states: {
          connecting: {
            on: {
              CONNECTED: "connected",
            },
          },
          connected: {
            on: {
              WS_MESSAGE: {
                actions: assign<WebSocketContext, WebSocketEvents>({
                  notificationVersion: (ctx, event) =>
                    event.type === "WS_MESSAGE" && isNotificationCreated(event.data)
                      ? ctx.notificationVersion + 1
                      : ctx.notificationVersion,
                }),
              },
            },
          },
        },
      },
      disconnected: {
        after: {
          3000: "active",
        },
        on: {
          DISCONNECT: "idle",
        },
      },
    },
  }
);

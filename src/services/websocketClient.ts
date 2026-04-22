import { backendPort } from "../utils/portUtils";

export enum WebSocketEventType {
  TRANSACTION_CREATED = "TRANSACTION_CREATED",
  TRANSACTION_UPDATED = "TRANSACTION_UPDATED",
  NOTIFICATION_RECEIVED = "NOTIFICATION_RECEIVED",
  LIKE_CREATED = "LIKE_CREATED",
  COMMENT_CREATED = "COMMENT_CREATED",
}

export interface WebSocketServerMessage {
  type: WebSocketEventType;
  payload: Record<string, string | undefined>;
  timestamp: string;
}

type MessageHandler = (message: WebSocketServerMessage) => void;

interface SubscriptionEntry {
  topic: string;
  handler: MessageHandler;
}

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_BACKOFF_MULTIPLIER = 2;

let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
let isIntentionallyClosed = false;
const subscriptions: SubscriptionEntry[] = [];

const getWebSocketUrl = (): string => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//localhost:${backendPort}/ws`;
};

const resubscribeAll = (): void => {
  const topics = new Set(subscriptions.map((s) => s.topic));
  topics.forEach((topic) => {
    sendToSocket({ action: "SUBSCRIBE", topic });
  });
};

const sendToSocket = (data: { action: string; topic: string }): void => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
};

const handleMessage = (event: MessageEvent): void => {
  let message: WebSocketServerMessage;
  try {
    message = JSON.parse(event.data as string) as WebSocketServerMessage;
  } catch {
    return;
  }

  subscriptions.forEach((sub) => {
    sub.handler(message);
  });
};

const scheduleReconnect = (): void => {
  if (isIntentionallyClosed) return;

  reconnectTimeout = setTimeout(() => {
    reconnectDelay = Math.min(
      reconnectDelay * RECONNECT_BACKOFF_MULTIPLIER,
      MAX_RECONNECT_DELAY_MS
    );
    connect();
  }, reconnectDelay);
};

export const connect = (): void => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  isIntentionallyClosed = false;
  const url = getWebSocketUrl();

  try {
    socket = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    resubscribeAll();
  };

  socket.onmessage = handleMessage;

  socket.onclose = () => {
    socket = null;
    scheduleReconnect();
  };

  socket.onerror = () => {
    if (socket) {
      socket.close();
    }
  };
};

export const disconnect = (): void => {
  isIntentionallyClosed = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (socket) {
    socket.close();
    socket = null;
  }

  reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
};

export const subscribe = (topic: string, handler: MessageHandler): (() => void) => {
  const entry: SubscriptionEntry = { topic, handler };
  subscriptions.push(entry);

  sendToSocket({ action: "SUBSCRIBE", topic });

  return () => {
    const index = subscriptions.indexOf(entry);
    if (index !== -1) {
      subscriptions.splice(index, 1);
    }

    const stillSubscribed = subscriptions.some((s) => s.topic === topic);
    if (!stillSubscribed) {
      sendToSocket({ action: "UNSUBSCRIBE", topic });
    }
  };
};

export const isConnected = (): boolean => {
  return socket !== null && socket.readyState === WebSocket.OPEN;
};

export enum WebSocketEventType {
  TRANSACTION_CREATED = "TRANSACTION_CREATED",
  TRANSACTION_UPDATED = "TRANSACTION_UPDATED",
  NOTIFICATION_RECEIVED = "NOTIFICATION_RECEIVED",
  LIKE_CREATED = "LIKE_CREATED",
  COMMENT_CREATED = "COMMENT_CREATED",
}

export enum WebSocketClientAction {
  SUBSCRIBE = "SUBSCRIBE",
  UNSUBSCRIBE = "UNSUBSCRIBE",
}

export interface WebSocketServerMessage {
  type: WebSocketEventType;
  payload: TransactionCreatedPayload
    | TransactionUpdatedPayload
    | NotificationReceivedPayload
    | LikeCreatedPayload
    | CommentCreatedPayload;
  timestamp: string;
}

export interface WebSocketClientMessage {
  action: WebSocketClientAction;
  topic: string;
}

export interface TransactionCreatedPayload {
  transactionId: string;
  senderId: string;
  receiverId: string;
}

export interface TransactionUpdatedPayload {
  transactionId: string;
  status: string;
  requestStatus?: string;
}

export interface NotificationReceivedPayload {
  notificationId: string;
  userId: string;
}

export interface LikeCreatedPayload {
  likeId: string;
  transactionId: string;
  userId: string;
}

export interface CommentCreatedPayload {
  commentId: string;
  transactionId: string;
  userId: string;
}

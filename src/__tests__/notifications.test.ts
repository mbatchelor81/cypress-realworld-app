import { describe, expect, it, beforeEach } from "vitest";
import {
  seedDatabase,
  getTransactionsForUserContacts,
  getAllUsers,
  createPaymentNotification,
  createLikeNotification,
  createLike,
  createComment,
  createCommentNotification,
  getTransactionsByUserId,
  getNotificationsByUserId,
  createNotifications,
  updateNotificationById,
  getNotificationById,
  formatNotificationForApiResponse,
} from "../../backend/database";

import { PaymentNotificationStatus, NotificationsType } from "../../src/models";
import type {
  User,
  Transaction,
  PaymentNotification,
  Like,
  Comment,
  LikeNotification,
  CommentNotification,
  NotificationType,
} from "../../src/models";

describe("Notifications", () => {
  let user: User;
  beforeEach(async () => {
    await seedDatabase();
    user = (await getAllUsers())[0];
  });

  describe("create notifications", () => {
    let transactions: Transaction[];
    let transaction: Transaction;
    let paymentNotification: PaymentNotification;
    let like: Like;
    let likeNotification: LikeNotification;
    let comment: Comment;
    let commentNotification: CommentNotification;
    beforeEach(async () => {
      user = (await getAllUsers())[0];
      transactions = await getTransactionsForUserContacts(user.id);
      transaction = transactions[0];
      paymentNotification = await createPaymentNotification(
        user.id,
        transaction.id,
        PaymentNotificationStatus.received
      );
      like = await createLike(user.id, transaction.id);
      likeNotification = await createLikeNotification(user.id, transaction.id, like.id);
      comment = await createComment(user.id, transaction.id, "This is my comment");

      commentNotification = await createCommentNotification(user.id, transaction.id, comment.id);
    });

    it("should create a payment notification for a transaction", () => {
      expect(paymentNotification.transactionId).toBe(transaction.id);
      expect(paymentNotification.status).toBe(PaymentNotificationStatus.received);
    });

    it("should create a like notification for a transaction", () => {
      expect(likeNotification.transactionId).toBe(transaction.id);
      expect(likeNotification.likeId).toBe(like.id);
    });

    it("should create a comment notification for a transaction", () => {
      expect(commentNotification.transactionId).toBe(transaction.id);
      expect(commentNotification.commentId).toBe(comment.id);
    });

    it("should format comment notification for api", async () => {
      const apiNotification = await formatNotificationForApiResponse(commentNotification);
      expect(apiNotification.userFullName).toBeDefined();
    });

    it("should create notifications for a transaction", async () => {
      const notificationsPayload = [
        {
          type: NotificationsType.payment,
          transactionId: transaction.id,
          status: PaymentNotificationStatus.received,
        },
        {
          type: NotificationsType.like,
          transactionId: transaction.id,
          likeId: like.id,
        },
        {
          type: NotificationsType.comment,
          transactionId: transaction.id,
          commentId: comment.id,
        },
      ];

      const notifications = await createNotifications(user.id, notificationsPayload);

      expect(notifications[0]!.transactionId).toBe(transaction.id);
      // @ts-ignore
      expect(notifications[1]!.likeId).toBe(like.id);
      // @ts-ignore
      expect(notifications[2]!.commentId).toBe(comment.id);
    });
  });

  it("should get a list of notifications for a user", async () => {
    const transactions: Transaction[] = await getTransactionsByUserId(user.id);
    const transaction = transactions[0];

    // create comment and like and notifications for transaction
    const comment = await createComment(user.id, transaction.id, "This is my notification content");
    await createCommentNotification(user.id, transaction.id, comment.id);
    const like = await createLike(user.id, transaction.id);
    await createLikeNotification(user.id, transaction.id, like.id);

    const notifications = await getNotificationsByUserId(user.id);

    expect(notifications.length).toBeGreaterThan(1);
    expect(notifications[notifications.length - 1]).toMatchObject({
      transactionId: transaction.id,
    });
  });

  it("should update a notification", async () => {
    const notifications = await getNotificationsByUserId(user.id);
    const edits: Partial<NotificationType> = {
      isRead: true,
    };
    // @ts-ignore
    await updateNotificationById(user.id, notifications[0].id, edits);

    // @ts-ignore
    const updatedNotification = await getNotificationById(notifications[0].id);
    expect(updatedNotification.isRead).toBe(true);
  });
});

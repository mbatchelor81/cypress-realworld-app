///<reference path="types.ts" />

import express from "express";
import {
  getCommentsByTransactionId,
  createComments,
  getTransactionById,
  getUnreadNotificationsByUserId,
} from "./database";
import { broadcastNotifications } from "./websocket";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { shortIdValidation, isCommentValidator } from "./validators";
const router = express.Router();

// Routes

//GET /comments/:transactionId
router.get(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId")]),
  async (req, res) => {
    const { transactionId } = req.params;
    const comments = await getCommentsByTransactionId(transactionId);

    res.status(200);
    res.json({ comments });
  }
);

//POST /comments/:transactionId
router.post(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId"), isCommentValidator]),
  async (req, res) => {
    const { transactionId } = req.params;
    const { content } = req.body;

    /* istanbul ignore next */
    const transaction = await getTransactionById(transactionId);
    await createComments(req.user?.id!, transactionId, content);

    // Broadcast updated notifications to both sender and receiver
    const { senderId, receiverId } = transaction;
    const senderNotifications = await getUnreadNotificationsByUserId(senderId);
    broadcastNotifications(senderId, senderNotifications);
    if (receiverId !== senderId) {
      const receiverNotifications = await getUnreadNotificationsByUserId(receiverId);
      broadcastNotifications(receiverId, receiverNotifications);
    }

    res.sendStatus(200);
  }
);

export default router;

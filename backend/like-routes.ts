///<reference path="types.ts" />

import express from "express";
import {
  getLikesByTransactionId,
  createLikes,
  getTransactionById,
  getUnreadNotificationsByUserId,
} from "./database";
import { broadcastNotifications } from "./websocket";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { shortIdValidation } from "./validators";
const router = express.Router();

// Routes

//GET /likes/:transactionId
router.get(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId")]),
  async (req, res) => {
    const { transactionId } = req.params;
    const likes = await getLikesByTransactionId(transactionId);

    res.status(200);
    res.json({ likes });
  }
);

//POST /likes/:transactionId
router.post(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId")]),
  async (req, res) => {
    const { transactionId } = req.params;
    /* istanbul ignore next */
    const transaction = await getTransactionById(transactionId);
    await createLikes(req.user?.id!, transactionId);

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

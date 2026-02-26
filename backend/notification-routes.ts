///<reference path="types.ts" />

import express from "express";
import {
  createNotifications,
  updateNotificationById,
  getUnreadNotificationsByUserId,
  formatNotificationsForApiResponse,
} from "./database";
import { broadcastNotifications } from "./websocket";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import {
  isNotificationsBodyValidator,
  shortIdValidation,
  isNotificationPatchValidator,
} from "./validators";
const router = express.Router();

// Routes

//GET /notifications/
router.get("/", ensureAuthenticated, async (req, res) => {
  /* istanbul ignore next */
  const notifications = await getUnreadNotificationsByUserId(req.user?.id!);

  res.status(200);
  res.json({ results: notifications });
});

//POST /notifications/bulk
router.post(
  "/bulk",
  ensureAuthenticated,
  validateMiddleware([...isNotificationsBodyValidator]),
  async (req, res) => {
    const { items } = req.body;
    /* istanbul ignore next */
    const notifications = await createNotifications(req.user?.id!, items);

    // Broadcast formatted notifications over WebSocket
    const formatted = await formatNotificationsForApiResponse(notifications);
    broadcastNotifications(req.user?.id!, formatted);

    res.status(200);
    // @ts-ignore
    res.json({ results: notifications });
  }
);

//PATCH /notifications/:notificationId - scoped-user
router.patch(
  "/:notificationId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("notificationId"), ...isNotificationPatchValidator]),
  async (req, res) => {
    const { notificationId } = req.params;
    /* istanbul ignore next */
    await updateNotificationById(req.user?.id!, notificationId, req.body);

    res.sendStatus(204);
  }
);

export default router;

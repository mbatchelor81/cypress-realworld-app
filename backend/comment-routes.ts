///<reference path="types.ts" />

import express from "express";
import { getCommentsByTransactionId, createComments } from "./database";
import { ensureAuthenticated, getAuthenticatedUserId, validateMiddleware } from "./helpers";
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
    await createComments(getAuthenticatedUserId(req), transactionId, content);

    res.sendStatus(200);
  }
);

export default router;

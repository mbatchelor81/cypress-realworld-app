///<reference path="types.ts" />

import express from "express";
import { getLikesByTransactionId, createLikes } from "./database";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { shortIdValidation } from "./validators";
import { emitLikeCreated } from "./websocket-server";
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
    const like = await createLikes(req.user?.id!, transactionId);

    emitLikeCreated(like.id, transactionId, req.user?.id!);

    res.sendStatus(200);
  }
);

export default router;

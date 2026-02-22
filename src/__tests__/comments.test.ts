import { describe, expect, it, beforeEach } from "vitest";
import {
  seedDatabase,
  getTransactionsForUserContacts,
  getAllUsers,
  getTransactionsByUserId,
  createComment,
  getCommentsByTransactionId,
} from "../../backend/database";

import { User, Transaction } from "../../src/models";

describe("Comments", () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it("should comment a transaction for a contact", async () => {
    const user: User = (await getAllUsers())[0];
    const transactions: Transaction[] = await getTransactionsForUserContacts(user.id);

    const content = "This is my comment content";
    const comment = await createComment(user.id, transactions[0].id, content);

    expect(comment.transactionId).toBe(transactions[0].id);
    expect(comment.content).toBe(content);
  });

  it("should get a list of comments for a transaction", async () => {
    const user: User = (await getAllUsers())[0];
    const transactions: Transaction[] = await getTransactionsByUserId(user.id);
    const transaction = transactions[0];

    await createComment(user.id, transaction.id, "This is my comment");

    const comments = await getCommentsByTransactionId(transaction.id);

    expect(comments[0].transactionId).toBe(transaction.id);
  });
});

import { describe, expect, it, beforeEach } from "vitest";
import {
  seedDatabase,
  getTransactionsForUserContacts,
  getAllUsers,
  getTransactionsByUserId,
  createLike,
  getLikesByTransactionId,
} from "../../backend/database";

import { User, Transaction } from "../../src/models";

describe("Transactions", () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it("should like a transaction for a contact", async () => {
    const user: User = (await getAllUsers())[0];
    const transactions: Transaction[] = await getTransactionsForUserContacts(user.id);

    const like = await createLike(user.id, transactions[0].id);

    expect(like.transactionId).toBe(transactions[0].id);
  });

  it("should get a list of likes for a transaction", async () => {
    const user: User = (await getAllUsers())[0];
    const transactions: Transaction[] = await getTransactionsByUserId(user.id);
    const transaction = transactions[0];

    await createLike(user.id, transaction.id);

    const likes = await getLikesByTransactionId(transaction.id);

    expect(likes[0].transactionId).toBe(transaction.id);
  });
});

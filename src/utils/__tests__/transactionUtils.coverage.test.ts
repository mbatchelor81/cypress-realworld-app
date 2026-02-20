import { describe, expect, test } from "vitest";
import {
  formatTransactionTitle,
  formatFullName,
  isPayment,
  isRequestTransaction,
  payAppDifference,
  payAppAddition,
  getChargeAmount,
  getTransferAmount,
  getPayAppCreditedAmount,
  hasSufficientFunds,
  isCommentNotification,
  isLikeNotification,
  isPaymentNotification,
  hasDateQueryFields,
  getDateQueryFields,
  omitDateQueryFields,
  hasAmountQueryFields,
  getAmountQueryFields,
  omitAmountQueryFields,
  omitPaginationQueryFields,
  getPaginatedItems,
  endOfDayUTC,
  isoStringToLocalMidnightStart,
  isoStringToLocalMidnightEnd,
  isoStringToLocalDateFull,
  localDateToIsoString,
  localDateToUTCISOString,
} from "../transactionUtils";
import {
  User,
  DefaultPrivacyLevel,
  Transaction,
  TransactionRequestStatus,
  TransactionStatus,
  PaymentNotificationStatus,
} from "../../models";

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "user1",
  uuid: "uuid-1",
  firstName: "John",
  lastName: "Doe",
  username: "johndoe",
  password: "pass",
  email: "john@example.com",
  phoneNumber: "555-1234",
  balance: 10000,
  avatar: "/avatar.png",
  defaultPrivacyLevel: DefaultPrivacyLevel.public,
  createdAt: new Date(),
  modifiedAt: new Date(),
  ...overrides,
});

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "tx1",
  uuid: "tx-uuid-1",
  source: "src1",
  amount: 5000,
  description: "test",
  privacyLevel: DefaultPrivacyLevel.public,
  receiverId: "user2",
  senderId: "user1",
  balanceAtCompletion: 5000,
  status: TransactionStatus.complete,
  requestStatus: undefined,
  createdAt: new Date(),
  modifiedAt: new Date(),
  ...overrides,
});

describe("formatTransactionTitle", () => {
  test("returns formatted title with sender and receiver names", () => {
    const sender = makeUser({ firstName: "Alice", lastName: "Smith" });
    const receiver = makeUser({ firstName: "Bob", lastName: "Jones" });
    expect(formatTransactionTitle(sender, receiver)).toBe("Alice Smith paid Bob Jones");
  });

  test("handles single-word names", () => {
    const sender = makeUser({ firstName: "Madonna", lastName: "" });
    const receiver = makeUser({ firstName: "Cher", lastName: "" });
    expect(formatTransactionTitle(sender, receiver)).toBe("Madonna  paid Cher ");
  });
});

describe("formatFullName", () => {
  test("joins first and last name", () => {
    const user = makeUser({ firstName: "Jane", lastName: "Austen" });
    expect(formatFullName(user)).toBe("Jane Austen");
  });
});

describe("isPayment", () => {
  test("returns true for a payment (no requestStatus)", () => {
    const tx = makeTransaction();
    expect(isPayment(tx)).toBe(true);
  });

  test("returns false for a request transaction", () => {
    const tx = makeTransaction({ requestStatus: TransactionRequestStatus.pending });
    expect(isPayment(tx)).toBe(false);
  });
});

describe("payAppDifference / payAppAddition", () => {
  test("payAppDifference computes sender balance minus transaction amount", () => {
    const sender = makeUser({ balance: 10000 });
    const tx = makeTransaction({ amount: 3000 });
    expect(payAppDifference(sender, tx).getAmount()).toBe(7000);
  });

  test("payAppAddition computes receiver balance plus transaction amount", () => {
    const receiver = makeUser({ balance: 10000 });
    const tx = makeTransaction({ amount: 3000 });
    expect(payAppAddition(receiver, tx).getAmount()).toBe(13000);
  });
});

describe("getChargeAmount", () => {
  test("returns absolute difference", () => {
    const sender = makeUser({ balance: 10000 });
    const tx = makeTransaction({ amount: 3000 });
    expect(getChargeAmount(sender, tx)).toBe(7000);
  });
});

describe("getTransferAmount", () => {
  test("returns absolute difference", () => {
    const sender = makeUser({ balance: 10000 });
    const tx = makeTransaction({ amount: 3000 });
    expect(getTransferAmount(sender, tx)).toBe(7000);
  });
});

describe("getPayAppCreditedAmount", () => {
  test("returns credited amount", () => {
    const receiver = makeUser({ balance: 10000 });
    const tx = makeTransaction({ amount: 3000 });
    expect(getPayAppCreditedAmount(receiver, tx)).toBe(13000);
  });
});

describe("hasSufficientFunds", () => {
  test("returns true when balance exceeds amount", () => {
    const sender = makeUser({ balance: 10000 });
    const tx = makeTransaction({ amount: 3000 });
    expect(hasSufficientFunds(sender, tx)).toBe(true);
  });

  test("returns false when balance is less than amount", () => {
    const sender = makeUser({ balance: 1000 });
    const tx = makeTransaction({ amount: 5000 });
    expect(hasSufficientFunds(sender, tx)).toBe(false);
  });
});

describe("notification type guards", () => {
  const baseNotification = {
    id: "n1",
    uuid: "n-uuid",
    userId: "u1",
    transactionId: "tx1",
    isRead: false,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  test("isCommentNotification", () => {
    expect(isCommentNotification({ ...baseNotification, commentId: "c1" })).toBe(true);
    expect(isCommentNotification({ ...baseNotification, likeId: "l1" })).toBe(false);
  });

  test("isLikeNotification", () => {
    expect(isLikeNotification({ ...baseNotification, likeId: "l1" })).toBe(true);
    expect(isLikeNotification({ ...baseNotification, commentId: "c1" })).toBe(false);
  });

  test("isPaymentNotification", () => {
    expect(
      isPaymentNotification({
        ...baseNotification,
        status: PaymentNotificationStatus.received,
      })
    ).toBe(true);
    expect(isPaymentNotification({ ...baseNotification, likeId: "l1" })).toBe(false);
  });
});

describe("query field helpers", () => {
  test("hasDateQueryFields", () => {
    expect(hasDateQueryFields({ dateRangeStart: "a", dateRangeEnd: "b" })).toBe(true);
    expect(hasDateQueryFields({ dateRangeStart: "a" })).toBe(false);
    expect(hasDateQueryFields({})).toBe(false);
  });

  test("getDateQueryFields", () => {
    expect(getDateQueryFields({ dateRangeStart: "a", dateRangeEnd: "b" })).toEqual({
      dateRangeStart: "a",
      dateRangeEnd: "b",
    });
  });

  test("omitDateQueryFields", () => {
    expect(
      omitDateQueryFields({ dateRangeStart: "a", dateRangeEnd: "b", status: TransactionStatus.complete })
    ).toEqual({ status: "complete" });
  });

  test("hasAmountQueryFields", () => {
    expect(hasAmountQueryFields({ amountMin: 1, amountMax: 10 })).toBe(true);
    expect(hasAmountQueryFields({ amountMin: 1 })).toBe(false);
    expect(hasAmountQueryFields({})).toBe(false);
  });

  test("getAmountQueryFields", () => {
    expect(getAmountQueryFields({ amountMin: 1, amountMax: 10 })).toEqual({
      amountMin: 1,
      amountMax: 10,
    });
  });

  test("omitAmountQueryFields", () => {
    expect(omitAmountQueryFields({ amountMin: 1, amountMax: 10, status: TransactionStatus.complete })).toEqual({
      status: "complete",
    });
  });

  test("omitPaginationQueryFields", () => {
    expect(omitPaginationQueryFields({ page: 1, limit: 10, status: TransactionStatus.complete })).toEqual({
      status: "complete",
    });
  });
});

describe("getPaginatedItems", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  test("returns first page", () => {
    const result = getPaginatedItems(1, 10, items);
    expect(result.data).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.totalPages).toBe(3);
  });

  test("returns second page", () => {
    const result = getPaginatedItems(2, 10, items);
    expect(result.data).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  test("returns last partial page", () => {
    const result = getPaginatedItems(3, 10, items);
    expect(result.data).toEqual([20, 21, 22, 23, 24]);
  });
});

describe("endOfDayUTC", () => {
  test("returns end of day in UTC", () => {
    const date = new Date(2023, 5, 15, 10, 30, 0);
    const result = endOfDayUTC(date);
    expect(result.getUTCHours()).toBe(23);
    expect(result.getUTCMinutes()).toBe(59);
    expect(result.getUTCSeconds()).toBe(59);
    expect(result.getUTCMilliseconds()).toBe(999);
  });

  test("handles non-Date input by using current date", () => {
    const result = endOfDayUTC(null as unknown as Date);
    expect(result).toBeInstanceOf(Date);
    expect(result.getUTCHours()).toBe(23);
  });
});

describe("ISO string date utilities", () => {
  test("isoStringToLocalMidnightStart", () => {
    const result = isoStringToLocalMidnightStart("2023-06-15T14:30:00.000Z");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  test("isoStringToLocalMidnightEnd", () => {
    const result = isoStringToLocalMidnightEnd("2023-06-15T14:30:00.000Z");
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
  });

  test("isoStringToLocalDateFull preserves time components", () => {
    const result = isoStringToLocalDateFull("2023-06-15T14:30:45.123Z");
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(45);
  });

  test("localDateToIsoString returns ISO string", () => {
    const date = new Date(2023, 5, 15, 0, 0, 0, 0);
    const result = localDateToIsoString(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("localDateToUTCISOString with Date", () => {
    const date = new Date(2023, 5, 15, 10, 30, 0, 0);
    const result = localDateToUTCISOString(date);
    expect(result).toContain("2023-06-15");
    expect(result).toContain("T10:30:00");
  });

  test("localDateToUTCISOString with null returns current ISO string", () => {
    const result = localDateToUTCISOString(null);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

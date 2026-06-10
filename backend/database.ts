import bcrypt from "bcryptjs";
import { v4 } from "uuid";
import {
  uniqBy,
  map,
  sample,
  orderBy,
  flatMap,
  get,
  remove,
} from "lodash/fp";
import { isWithinInterval } from "date-fns";
import shortid from "shortid";
import {
  BankAccount,
  Transaction,
  User,
  Contact,
  TransactionStatus,
  TransactionRequestStatus,
  Like,
  Comment,
  PaymentNotification,
  PaymentNotificationStatus,
  LikeNotification,
  CommentNotification,
  NotificationType,
  NotificationPayloadType,
  NotificationsType,
  TransactionResponseItem,
  TransactionPayload,
  BankTransfer,
  BankTransferPayload,
  BankTransferType,
  NotificationResponseItem,
  TransactionQueryPayload,
  DefaultPrivacyLevel,
} from "../src/models";
import {
  isPayment,
  getTransferAmount,
  hasSufficientFunds,
  getChargeAmount,
  hasDateQueryFields,
  getDateQueryFields,
  hasAmountQueryFields,
  getAmountQueryFields,
  getQueryWithoutFilterFields,
  getPayAppCreditedAmount,
  isRequestTransaction,
  formatFullName,
  isLikeNotification,
  isCommentNotification,
} from "../src/utils/transactionUtils";
import { DbSchema } from "../src/models/db-schema";
import { supabase } from "./supabase-client";
import { buildDatabase } from "../scripts/seedDataUtils";

export type TDatabase = {
  users: User[];
  contacts: Contact[];
  bankaccounts: BankAccount[];
  transactions: Transaction[];
  likes: Like[];
  comments: Comment[];
  notifications: NotificationType[];
  banktransfers: BankTransfer[];
};

const USER_TABLE = "users";
const CONTACT_TABLE = "contacts";
const BANK_ACCOUNT_TABLE = "bankaccounts";
const TRANSACTION_TABLE = "transactions";
const LIKE_TABLE = "likes";
const COMMENT_TABLE = "comments";
const NOTIFICATION_TABLE = "notifications";
const BANK_TRANSFER_TABLE = "banktransfers";

// Helper to throw on Supabase errors
const throwIfError = <T>(result: { data: T | null; error: any }): T => {
  if (result.error) throw result.error;
  return result.data as T;
};

export const seedDatabase = async () => {
  const testSeed: TDatabase = buildDatabase();

  // Truncate tables in reverse FK order
  const tables = [
    BANK_TRANSFER_TABLE,
    NOTIFICATION_TABLE,
    COMMENT_TABLE,
    LIKE_TABLE,
    TRANSACTION_TABLE,
    BANK_ACCOUNT_TABLE,
    CONTACT_TABLE,
    USER_TABLE,
  ];

  for (const table of tables) {
    // Delete all rows — neq id '' matches everything since all ids are non-empty
    await supabase.from(table).delete().neq("id", "");
  }

  // Insert in FK order
  // Batch inserts in chunks of 500 to avoid payload limits
  const chunkInsert = async (table: string, rows: any[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      throwIfError(await supabase.from(table).insert(chunk));
    }
  };

  await chunkInsert(USER_TABLE, testSeed.users);
  await chunkInsert(CONTACT_TABLE, testSeed.contacts);
  await chunkInsert(BANK_ACCOUNT_TABLE, testSeed.bankaccounts);
  await chunkInsert(TRANSACTION_TABLE, testSeed.transactions);
  await chunkInsert(LIKE_TABLE, testSeed.likes);
  await chunkInsert(COMMENT_TABLE, testSeed.comments);
  await chunkInsert(NOTIFICATION_TABLE, testSeed.notifications);
  await chunkInsert(BANK_TRANSFER_TABLE, testSeed.banktransfers);
};

export const getAllUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from(USER_TABLE).select("*");
  if (error) throw error;
  return data as User[];
};

export const getAllPublicTransactions = async (): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from(TRANSACTION_TABLE)
    .select("*")
    .eq("privacyLevel", DefaultPrivacyLevel.public);
  if (error) throw error;
  return data as Transaction[];
};

export const getAllForEntity = async (entity: keyof DbSchema) => {
  const { data, error } = await supabase.from(entity).select("*");
  if (error) throw error;
  return data;
};

export const getAllBy = async (entity: keyof DbSchema, key: string, value: any) => {
  const { data, error } = await supabase.from(entity).select("*").eq(key, value);
  if (error) throw error;
  return data;
};

export const getBy = async (entity: keyof DbSchema, key: string, value: any) => {
  const { data, error } = await supabase.from(entity).select("*").eq(key, value).limit(1).single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
};

export const getAllByObj = async (entity: keyof DbSchema, query: Record<string, any>) => {
  let q = supabase.from(entity).select("*");
  for (const [key, value] of Object.entries(query)) {
    q = q.eq(key, value);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

// Search
export const cleanSearchQuery = (query: string) => query.replace(/[^a-zA-Z0-9]/g, "");

export const searchUsers = async (query: string): Promise<User[]> => {
  const cleaned = cleanSearchQuery(query);
  if (!cleaned) return [];

  const pattern = `%${cleaned}%`;
  const { data, error } = await supabase
    .from(USER_TABLE)
    .select("*")
    .or(
      `firstName.ilike.${pattern},lastName.ilike.${pattern},username.ilike.${pattern},email.ilike.${pattern},phoneNumber.ilike.${pattern}`
    );
  if (error) throw error;
  return data as User[];
};

export const removeUserFromResults = (userId: User["id"], results: User[]) =>
  remove({ id: userId }, results);

// convenience methods

// User
export const getUserBy = async (key: string, value: any) => getBy(USER_TABLE, key, value);
export const getUserId = (user: User): string => user.id;
export const getUserById = async (id: string) => getUserBy("id", id);
export const getUserByUsername = async (username: string) => getUserBy("username", username);

export const createUser = async (userDetails: Partial<User>): Promise<User> => {
  const password = bcrypt.hashSync(userDetails.password!, 10);
  const user: User = {
    id: shortid(),
    uuid: v4(),
    firstName: userDetails.firstName!,
    lastName: userDetails.lastName!,
    username: userDetails.username!,
    password,
    email: userDetails.email!,
    phoneNumber: userDetails.phoneNumber!,
    balance: Number(userDetails.balance!) || 0,
    avatar: userDetails.avatar!,
    defaultPrivacyLevel: userDetails.defaultPrivacyLevel!,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  throwIfError(await supabase.from(USER_TABLE).insert(user));
  return user;
};

export const updateUserById = async (userId: string, edits: Partial<User>) => {
  throwIfError(
    await supabase
      .from(USER_TABLE)
      .update({ ...edits, modifiedAt: new Date() })
      .eq("id", userId)
  );
};

// Contact
export const getContactBy = async (key: string, value: any) => getBy(CONTACT_TABLE, key, value);

export const getContactsBy = async (key: string, value: any) => getAllBy(CONTACT_TABLE, key, value);

export const getContactsByUsername = async (username: string) => {
  const user = await getUserByUsername(username);
  if (!user) return [];
  return getContactsByUserId(user.id);
};

export const getContactsByUserId = async (userId: string): Promise<Contact[]> =>
  (await getContactsBy("userId", userId)) as Contact[];

export const createContact = async (contact: Contact) => {
  throwIfError(await supabase.from(CONTACT_TABLE).insert(contact));
  return getContactBy("id", contact.id);
};

export const removeContactById = async (contactId: string) => {
  throwIfError(await supabase.from(CONTACT_TABLE).delete().eq("id", contactId));
};

export const createContactForUser = async (userId: string, contactUserId: string) => {
  const contactId = shortid();
  const contact: Contact = {
    id: contactId,
    uuid: v4(),
    userId,
    contactUserId,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  const result = await createContact(contact);
  return result;
};

// Bank Account
export const getBankAccountBy = async (key: string, value: any) =>
  getBy(BANK_ACCOUNT_TABLE, key, value);

export const getBankAccountById = async (id: string) => getBankAccountBy("id", id);

export const getBankAccountsBy = async (key: string, value: any) =>
  getAllBy(BANK_ACCOUNT_TABLE, key, value);

export const createBankAccount = async (bankaccount: BankAccount) => {
  throwIfError(await supabase.from(BANK_ACCOUNT_TABLE).insert(bankaccount));
  return getBankAccountBy("id", bankaccount.id);
};

export const createBankAccountForUser = async (
  userId: string,
  accountDetails: Partial<BankAccount>
) => {
  const accountId = shortid();
  const bankaccount: BankAccount = {
    id: accountId,
    uuid: v4(),
    userId,
    bankName: accountDetails.bankName!,
    accountNumber: accountDetails.accountNumber!,
    routingNumber: accountDetails.routingNumber!,
    isDeleted: false,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  const result = await createBankAccount(bankaccount);
  return result;
};

export const removeBankAccountById = async (bankAccountId: string) => {
  throwIfError(
    await supabase
      .from(BANK_ACCOUNT_TABLE)
      .update({ isDeleted: true, modifiedAt: new Date() })
      .eq("id", bankAccountId)
  );
};

// Bank Transfer
// Note: Balance transfers from/to bank accounts is a future feature,
// but some of the backend database functionality is already implemented here.

/* istanbul ignore next */
export const getBankTransferBy = async (key: string, value: any) =>
  getBy(BANK_TRANSFER_TABLE, key, value);

export const getBankTransfersBy = async (key: string, value: any) =>
  getAllBy(BANK_TRANSFER_TABLE, key, value);

export const getBankTransfersByUserId = async (userId: string) =>
  getBankTransfersBy("userId", userId);

/* istanbul ignore next */
export const createBankTransfer = async (bankTransferDetails: BankTransferPayload) => {
  const bankTransfer: BankTransfer = {
    id: shortid(),
    uuid: v4(),
    ...bankTransferDetails,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  throwIfError(await supabase.from(BANK_TRANSFER_TABLE).insert(bankTransfer));
  return (await getBankTransferBy("id", bankTransfer.id)) as BankTransfer;
};

// Transaction

export const getTransactionBy = async (key: string, value: any) =>
  getBy(TRANSACTION_TABLE, key, value);

export const getTransactionById = async (id: string) =>
  (await getTransactionBy("id", id)) as Transaction;

export const getTransactionsByObj = async (query: Record<string, any>) =>
  (await getAllByObj(TRANSACTION_TABLE, query)) as Transaction[];

export const getTransactionByIdForApi = async (id: string) => {
  const transaction = await getTransactionBy("id", id);
  return formatTransactionForApiResponse(transaction);
};

export const getTransactionsForUserForApi = async (userId: string, query?: object) => {
  const transactions = await getTransactionsForUserByObj(userId, query || {});
  return await formatTransactionsForApiResponse(transactions);
};

export const getFullNameForUser = async (userId: User["id"]) => {
  const user = await getUserById(userId);
  return formatFullName(user);
};

export const formatTransactionForApiResponse = async (
  transaction: Transaction
): Promise<TransactionResponseItem> => {
  const receiver = await getUserById(transaction.receiverId);
  const sender = await getUserById(transaction.senderId);

  const receiverName = await getFullNameForUser(transaction.receiverId);
  const senderName = await getFullNameForUser(transaction.senderId);
  const likes = await getLikesByTransactionId(transaction.id);
  const comments = await getCommentsByTransactionId(transaction.id);

  return {
    receiverName,
    senderName,
    receiverAvatar: receiver.avatar,
    senderAvatar: sender.avatar,
    likes,
    comments,
    ...transaction,
  };
};

export const formatTransactionsForApiResponse = async (
  transactions: Transaction[]
): Promise<TransactionResponseItem[]> => {
  const formatted = await Promise.all(
    transactions.map((transaction) => formatTransactionForApiResponse(transaction))
  );
  return orderBy(
    [(transaction: TransactionResponseItem) => new Date(transaction.modifiedAt)],
    ["desc"],
    formatted
  );
};

export const getAllTransactionsForUserByObj = async (
  userId: string,
  query?: object
): Promise<Transaction[]> => {
  const queryWithoutFilterFields =
    query && Object.keys(query).length > 0 ? getQueryWithoutFilterFields(query) : undefined;

  const queryFields = queryWithoutFilterFields || query;

  const receiverQuery = { receiverId: userId, ...(queryFields || {}) };
  const senderQuery = { senderId: userId, ...(queryFields || {}) };

  const [receiverTxns, senderTxns] = await Promise.all([
    getTransactionsByObj(receiverQuery),
    getTransactionsByObj(senderQuery),
  ]);

  let userTransactions = [...receiverTxns, ...senderTxns];

  if (query && (hasDateQueryFields(query) || hasAmountQueryFields(query))) {
    const { dateRangeStart, dateRangeEnd } = getDateQueryFields(query);
    const { amountMin, amountMax } = getAmountQueryFields(query);

    if (dateRangeStart && dateRangeEnd) {
      userTransactions = userTransactions.filter((transaction) =>
        isWithinInterval(new Date(transaction.createdAt), {
          start: new Date(dateRangeStart),
          end: new Date(dateRangeEnd),
        })
      );
    }

    if (amountMin && amountMax) {
      userTransactions = userTransactions.filter(
        (transaction) => transaction.amount >= amountMin && transaction.amount <= amountMax
      );
    }
  }

  return userTransactions;
};

export const getTransactionsForUserByObj = async (
  userId: string,
  query: object
): Promise<Transaction[]> => {
  const all = await getAllTransactionsForUserByObj(userId, query);
  return uniqBy("id", all);
};

export const getContactIdsForUser = async (userId: string): Promise<string[]> => {
  const contacts = await getContactsByUserId(userId);
  return map("contactUserId", contacts);
};

export const getTransactionsForUserContacts = async (
  userId: string,
  query?: object
): Promise<TransactionResponseItem[]> => {
  const contactIds = await getContactIdsForUser(userId);
  const results = await Promise.all(
    contactIds.map((contactId) => getTransactionsForUserForApi(contactId, query))
  );
  return uniqBy("id", flatMap((x: TransactionResponseItem[]) => x, results));
};

export const getTransactionIds = (transactions: Transaction[]) => map("id", transactions);

export const getContactsTransactionIds = async (userId: string): Promise<string[]> => {
  const txns = await getTransactionsForUserContacts(userId);
  return getTransactionIds(txns);
};

export const nonContactPublicTransactions = async (userId: string): Promise<Transaction[]> => {
  const contactsTransactionIds = await getContactsTransactionIds(userId);
  const publicTxns = await getAllPublicTransactions();
  return publicTxns.filter((transaction) => !contactsTransactionIds.includes(transaction.id));
};

export const getNonContactPublicTransactionsForApi = async (
  userId: string
): Promise<TransactionResponseItem[]> => {
  const txns = await nonContactPublicTransactions(userId);
  return formatTransactionsForApiResponse(txns);
};

export const getPublicTransactionsDefaultSort = async (userId: string) => ({
  contactsTransactions: await getTransactionsForUserContacts(userId),
  publicTransactions: await getNonContactPublicTransactionsForApi(userId),
});

export const getPublicTransactionsByQuery = async (
  userId: string,
  query: TransactionQueryPayload
) => {
  if (query && (hasDateQueryFields(query) || hasAmountQueryFields(query))) {
    const { dateRangeStart, dateRangeEnd } = getDateQueryFields(query);
    const { amountMin, amountMax } = getAmountQueryFields(query);

    const [contactsTransactions, nonContactPublic] = await Promise.all([
      getTransactionsForUserContacts(userId, query),
      getNonContactPublicTransactionsForApi(userId),
    ]);

    let filteredPublic = nonContactPublic as TransactionResponseItem[];

    if (dateRangeStart && dateRangeEnd) {
      filteredPublic = filteredPublic.filter((t) =>
        isWithinInterval(new Date(t.createdAt), {
          start: new Date(dateRangeStart),
          end: new Date(dateRangeEnd),
        })
      );
    }

    if (amountMin && amountMax) {
      filteredPublic = filteredPublic.filter(
        (t) => t.amount >= amountMin && t.amount <= amountMax
      );
    }

    return { contactsTransactions, publicTransactions: filteredPublic };
  } else {
    return {
      contactsTransactions: await getTransactionsForUserContacts(userId),
      publicTransactions: await getNonContactPublicTransactionsForApi(userId),
    };
  }
};

export const debitPayAppBalance = async (user: User, transaction: Transaction) => {
  if (hasSufficientFunds(user, transaction)) {
    const newBalance = getChargeAmount(user, transaction);
    await updateUserById(get("id", user), { balance: newBalance });
  } else {
    /* istanbul ignore next */
    const transferAmount = getTransferAmount(user)(transaction);
    await createBankTransfer({
      userId: user.id,
      source: transaction.source,
      amount: transferAmount,
      transactionId: transaction.id,
      type: BankTransferType.withdrawal,
    });
    await updateUserById(get("id", user), { balance: 0 });
  }
};

export const creditPayAppBalance = async (user: User, transaction: Transaction) => {
  const newBalance = getPayAppCreditedAmount(user, transaction);
  await updateUserById(get("id", user), { balance: newBalance });
};

export const createTransaction = async (
  userId: User["id"],
  transactionType: "payment" | "request",
  transactionDetails: TransactionPayload
): Promise<Transaction> => {
  const sender = await getUserById(userId);
  const receiver = await getUserById(transactionDetails.receiverId);
  const transaction: Transaction = {
    id: shortid(),
    uuid: v4(),
    source: transactionDetails.source,
    amount: transactionDetails.amount * 100,
    description: transactionDetails.description,
    receiverId: transactionDetails.receiverId,
    senderId: userId,
    privacyLevel: transactionDetails.privacyLevel || sender.defaultPrivacyLevel,
    status: TransactionStatus.pending,
    requestStatus: transactionType === "request" ? TransactionRequestStatus.pending : undefined,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  throwIfError(await supabase.from(TRANSACTION_TABLE).insert(transaction));
  const savedTransaction = (await getTransactionBy("id", transaction.id)) as Transaction;

  // if payment, debit sender's balance for payment amount
  if (isPayment(transaction)) {
    await debitPayAppBalance(sender, transaction);
    await creditPayAppBalance(receiver, transaction);
    await updateTransactionById(transaction.id, {
      status: TransactionStatus.complete,
    });
    await createPaymentNotification(
      transaction.receiverId,
      transaction.id,
      PaymentNotificationStatus.received
    );
  } else {
    await createPaymentNotification(
      transaction.receiverId,
      transaction.id,
      PaymentNotificationStatus.requested
    );
  }

  return savedTransaction;
};

export const updateTransactionById = async (
  transactionId: string,
  edits: Partial<Transaction>
) => {
  const transaction = (await getTransactionBy("id", transactionId)) as Transaction;
  const { senderId, receiverId } = transaction;
  const sender = await getUserById(senderId);
  const receiver = await getUserById(receiverId);

  // if payment, debit sender's balance for payment amount
  if (isRequestTransaction(transaction)) {
    await debitPayAppBalance(receiver, transaction);
    await creditPayAppBalance(sender, transaction);
    edits.status = TransactionStatus.complete;

    await createPaymentNotification(
      transaction.senderId,
      transaction.id,
      PaymentNotificationStatus.received
    );
  }

  throwIfError(
    await supabase
      .from(TRANSACTION_TABLE)
      .update({ ...edits, modifiedAt: new Date() })
      .eq("id", transactionId)
  );
};

// Likes

export const getLikeBy = async (key: string, value: any): Promise<Like> =>
  (await getBy(LIKE_TABLE, key, value)) as Like;
export const getLikesByObj = async (query: Record<string, any>) =>
  (await getAllByObj(LIKE_TABLE, query)) as Like[];

export const getLikeById = async (id: string): Promise<Like> => getLikeBy("id", id);
export const getLikesByTransactionId = async (transactionId: string) =>
  getLikesByObj({ transactionId });

export const createLike = async (userId: string, transactionId: string): Promise<Like> => {
  const like: Like = {
    id: shortid(),
    uuid: v4(),
    userId,
    transactionId,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  throwIfError(await supabase.from(LIKE_TABLE).insert(like));
  return (await getLikeById(like.id)) as Like;
};

export const createLikes = async (userId: string, transactionId: string) => {
  const transaction = await getTransactionById(transactionId);
  const { senderId, receiverId } = transaction;

  const like = await createLike(userId, transactionId);

  /* istanbul ignore next */
  if (userId !== senderId || userId !== receiverId) {
    await createLikeNotification(senderId, transactionId, like.id);
    await createLikeNotification(receiverId, transactionId, like.id);
  } else if (userId === senderId) {
    await createLikeNotification(senderId, transactionId, like.id);
  } else {
    await createLikeNotification(receiverId, transactionId, like.id);
  }
};

// Comments

export const getCommentBy = async (key: string, value: any): Promise<Comment> =>
  (await getBy(COMMENT_TABLE, key, value)) as Comment;
export const getCommentsByObj = async (query: Record<string, any>) =>
  (await getAllByObj(COMMENT_TABLE, query)) as Comment[];

export const getCommentById = async (id: string): Promise<Comment> => getCommentBy("id", id);
export const getCommentsByTransactionId = async (transactionId: string) =>
  getCommentsByObj({ transactionId });

export const createComment = async (
  userId: string,
  transactionId: string,
  content: string
): Promise<Comment> => {
  const comment: Comment = {
    id: shortid(),
    uuid: v4(),
    content,
    userId,
    transactionId,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  throwIfError(await supabase.from(COMMENT_TABLE).insert(comment));
  return (await getCommentById(comment.id)) as Comment;
};

export const createComments = async (userId: string, transactionId: string, content: string) => {
  const transaction = await getTransactionById(transactionId);
  const { senderId, receiverId } = transaction;

  const comment = await createComment(userId, transactionId, content);

  /* istanbul ignore next */
  if (userId !== senderId || userId !== receiverId) {
    await createCommentNotification(senderId, transactionId, comment.id);
    await createCommentNotification(receiverId, transactionId, comment.id);
  } else if (userId === senderId) {
    await createCommentNotification(senderId, transactionId, comment.id);
  } else {
    await createCommentNotification(receiverId, transactionId, comment.id);
  }
};

// Notifications

export const getNotificationBy = async (key: string, value: any): Promise<NotificationType> =>
  (await getBy(NOTIFICATION_TABLE, key, value)) as NotificationType;

export const getNotificationsByObj = async (query: Record<string, any>) =>
  (await getAllByObj(NOTIFICATION_TABLE, query)) as NotificationType[];

export const getUnreadNotificationsByUserId = async (userId: string) => {
  const notifications = await getNotificationsByObj({ userId, isRead: false });
  return formatNotificationsForApiResponse(notifications);
};

export const createPaymentNotification = async (
  userId: string,
  transactionId: string,
  status: PaymentNotificationStatus
): Promise<PaymentNotification> => {
  const notification: PaymentNotification = {
    id: shortid(),
    uuid: v4(),
    userId: userId,
    transactionId: transactionId,
    status,
    isRead: false,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  throwIfError(await supabase.from(NOTIFICATION_TABLE).insert(notification));
  return notification;
};

export const createLikeNotification = async (
  userId: string,
  transactionId: string,
  likeId: string
): Promise<LikeNotification> => {
  const notification: LikeNotification = {
    id: shortid(),
    uuid: v4(),
    userId: userId,
    transactionId: transactionId,
    likeId: likeId,
    isRead: false,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  throwIfError(await supabase.from(NOTIFICATION_TABLE).insert(notification));
  return notification;
};

export const createCommentNotification = async (
  userId: string,
  transactionId: string,
  commentId: string
): Promise<CommentNotification> => {
  const notification: CommentNotification = {
    id: shortid(),
    uuid: v4(),
    userId: userId,
    transactionId: transactionId,
    commentId: commentId,
    isRead: false,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  throwIfError(await supabase.from(NOTIFICATION_TABLE).insert(notification));
  return notification;
};

export const createNotifications = async (
  userId: string,
  notifications: NotificationPayloadType[]
) => {
  const results = [];
  for (const item of notifications) {
    if ("status" in item && item.type === NotificationsType.payment) {
      results.push(await createPaymentNotification(userId, item.transactionId, item.status));
    } else if ("likeId" in item && item.type === NotificationsType.like) {
      results.push(await createLikeNotification(userId, item.transactionId, item.likeId));
    } /* istanbul ignore next */ else if ("commentId" in item) {
      results.push(await createCommentNotification(userId, item.transactionId, item.commentId));
    }
  }
  return results;
};

export const updateNotificationById = async (
  userId: string,
  notificationId: string,
  edits: Partial<NotificationType>
) => {
  throwIfError(
    await supabase
      .from(NOTIFICATION_TABLE)
      .update({ ...edits, modifiedAt: new Date() })
      .eq("id", notificationId)
  );
};

export const formatNotificationForApiResponse = async (
  notification: NotificationType
): Promise<NotificationResponseItem> => {
  let userFullName = await getFullNameForUser(notification.userId);
  const transaction = await getTransactionById(notification.transactionId);

  if (isRequestTransaction(transaction)) {
    userFullName = await getFullNameForUser(transaction.senderId);
  }

  if (isLikeNotification(notification)) {
    const like = await getLikeById(notification.likeId);
    userFullName = await getFullNameForUser(like.userId);
  }

  if (isCommentNotification(notification)) {
    const comment = await getCommentById(notification.commentId);
    userFullName = await getFullNameForUser(comment.userId);
  }

  return {
    userFullName,
    ...notification,
  };
};

export const formatNotificationsForApiResponse = async (
  notifications: NotificationType[]
): Promise<NotificationResponseItem[]> => {
  const formatted = await Promise.all(
    notifications.map((notification) => formatNotificationForApiResponse(notification))
  );
  return orderBy(
    [(notification: NotificationResponseItem) => new Date(notification.modifiedAt)],
    ["desc"],
    formatted
  );
};

// dev/test private methods
/* istanbul ignore next */
export const getRandomUser = async () => {
  const users = await getAllUsers();
  return sample(users)!;
};

/* istanbul ignore next */
export const getAllContacts = async () => {
  const { data, error } = await supabase.from(CONTACT_TABLE).select("*");
  if (error) throw error;
  return data as Contact[];
};

/* istanbul ignore next */
export const getAllTransactions = async () => {
  const { data, error } = await supabase.from(TRANSACTION_TABLE).select("*");
  if (error) throw error;
  return data as Transaction[];
};

/* istanbul ignore */
export const getBankAccountsByUserId = async (userId: string) =>
  getBankAccountsBy("userId", userId);

/* istanbul ignore next */
export const getNotificationById = async (id: string): Promise<NotificationType> =>
  getNotificationBy("id", id);

/* istanbul ignore next */
export const getNotificationsByUserId = async (userId: string) =>
  getNotificationsByObj({ userId });

/* istanbul ignore next */
export const getBankTransferByTransactionId = async (transactionId: string) =>
  getBankTransferBy("transactionId", transactionId);

/* istanbul ignore next */
export const getTransactionsBy = async (key: string, value: string) =>
  getAllBy(TRANSACTION_TABLE, key, value);

/* istanbul ignore next */
export const getTransactionsByUserId = async (userId: string) =>
  getTransactionsBy("receiverId", userId);

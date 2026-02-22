-- Enums
CREATE TYPE default_privacy_level AS ENUM ('public', 'private', 'contacts');
CREATE TYPE transaction_status AS ENUM ('pending', 'incomplete', 'complete');
CREATE TYPE transaction_request_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE payment_notification_status AS ENUM ('requested', 'received', 'incomplete');
CREATE TYPE bank_transfer_type AS ENUM ('withdrawal', 'deposit');

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  avatar TEXT NOT NULL,
  "defaultPrivacyLevel" default_privacy_level NOT NULL DEFAULT 'public',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "modifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "contactUserId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "modifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank Accounts
CREATE TABLE bankaccounts (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "bankName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "routingNumber" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "modifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT '',
  amount BIGINT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  "privacyLevel" default_privacy_level NOT NULL DEFAULT 'public',
  "receiverId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "senderId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "balanceAtCompletion" BIGINT,
  status transaction_status NOT NULL DEFAULT 'pending',
  "requestStatus" TEXT DEFAULT '',
  "requestResolvedAt" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "modifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Likes
CREATE TABLE likes (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "transactionId" TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "modifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "transactionId" TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "modifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications (single-table polymorphism for Payment/Like/Comment notifications)
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "transactionId" TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  status payment_notification_status,
  "likeId" TEXT REFERENCES likes(id) ON DELETE SET NULL,
  "commentId" TEXT REFERENCES comments(id) ON DELETE SET NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "modifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank Transfers
CREATE TABLE banktransfers (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT '',
  amount BIGINT NOT NULL,
  type bank_transfer_type NOT NULL,
  "transactionId" TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "modifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_contacts_userId ON contacts("userId");
CREATE INDEX idx_contacts_contactUserId ON contacts("contactUserId");
CREATE INDEX idx_bankaccounts_userId ON bankaccounts("userId");
CREATE INDEX idx_transactions_senderId ON transactions("senderId");
CREATE INDEX idx_transactions_receiverId ON transactions("receiverId");
CREATE INDEX idx_transactions_privacyLevel ON transactions("privacyLevel");
CREATE INDEX idx_likes_transactionId ON likes("transactionId");
CREATE INDEX idx_likes_userId ON likes("userId");
CREATE INDEX idx_comments_transactionId ON comments("transactionId");
CREATE INDEX idx_comments_userId ON comments("userId");
CREATE INDEX idx_notifications_userId ON notifications("userId");
CREATE INDEX idx_notifications_isRead ON notifications("isRead");
CREATE INDEX idx_banktransfers_userId ON banktransfers("userId");
CREATE INDEX idx_banktransfers_transactionId ON banktransfers("transactionId");

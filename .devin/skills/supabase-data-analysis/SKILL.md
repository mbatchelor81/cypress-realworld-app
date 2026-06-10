---
name: supabase-data-analysis
description: Query and analyze the RWA Supabase PostgreSQL database — table schemas, key analytical queries, and reporting patterns. Use when asked to investigate user behavior, transaction patterns, data quality, or produce business metrics.
---

# Supabase Data Analysis

This skill guides analyzing the Real World App's Supabase PostgreSQL database via the Supabase MCP (`execute_sql` tool).

## Database Schema

| Table | Rows | Primary Key | Description |
|-------|------|-------------|-------------|
| `users` | ~5 | `id` (text) | User accounts with balance, privacy settings |
| `transactions` | ~600 | `id` (text) | Payments and requests between users |
| `bankaccounts` | ~5 | `id` (text) | Linked bank accounts per user |
| `contacts` | ~14 | `id` (text) | User-to-user contact relationships |
| `banktransfers` | ~25 | `id` (text) | Deposits/withdrawals between bank and app |
| `notifications` | ~25 | `id` (text) | Payment, like, and comment notifications |
| `likes` | ~10 | `id` (text) | Transaction likes |
| `comments` | ~10 | `id` (text) | Transaction comments |

## Key Relationships

```
users.id ──< transactions.senderId
users.id ──< transactions.receiverId
users.id ──< bankaccounts.userId
users.id ──< contacts.userId / contacts.contactUserId
users.id ──< banktransfers.userId
transactions.id ──< likes.transactionId
transactions.id ──< comments.transactionId
transactions.id ──< notifications.transactionId
```

## Common Analytical Queries

### User Activity Summary
```sql
SELECT u.username, u."firstName", u."lastName", u.balance,
  COUNT(DISTINCT t.id) as transaction_count,
  COUNT(DISTINCT ba.id) as bank_account_count,
  COUNT(DISTINCT c.id) as contact_count
FROM users u
LEFT JOIN transactions t ON u.id = t."senderId" OR u.id = t."receiverId"
LEFT JOIN bankaccounts ba ON u.id = ba."userId"
LEFT JOIN contacts c ON u.id = c."userId"
GROUP BY u.id, u.username, u."firstName", u."lastName", u.balance
ORDER BY transaction_count DESC
```

### Transaction Volume by Status
```sql
SELECT status, "requestStatus", COUNT(*) as count,
  SUM(amount)/100.0 as total_amount_dollars, AVG(amount)/100.0 as avg_amount_dollars
FROM transactions
GROUP BY status, "requestStatus"
```

### Payment vs Request Breakdown
```sql
SELECT
  CASE WHEN "requestStatus" IS NULL OR "requestStatus" = '' THEN 'payment'
       ELSE 'request' END as type,
  COUNT(*) as count,
  SUM(amount)/100.0 as total_volume_dollars
FROM transactions
GROUP BY type
```

### Balance Reconciliation Check
```sql
SELECT u.username, u.balance/100.0 as balance_dollars,
  COALESCE(sent.total, 0)/100.0 as total_sent,
  COALESCE(received.total, 0)/100.0 as total_received,
  COALESCE(deposits.total, 0)/100.0 as total_deposits,
  (u.balance - (COALESCE(received.total, 0) - COALESCE(sent.total, 0) + COALESCE(deposits.total, 0)))/100.0 as discrepancy
FROM users u
LEFT JOIN (SELECT "senderId", SUM(amount) as total FROM transactions WHERE status = 'complete' GROUP BY "senderId") sent ON u.id = sent."senderId"
LEFT JOIN (SELECT "receiverId", SUM(amount) as total FROM transactions WHERE status = 'complete' GROUP BY "receiverId") received ON u.id = received."receiverId"
LEFT JOIN (SELECT "userId", SUM(amount) as total FROM banktransfers GROUP BY "userId") deposits ON u.id = deposits."userId"
```

## Steps for Any Data Analysis Task

1. **Identify the question** — What metric or insight is needed?
2. **Query the schema** — Use `list_tables` with `verbose: true` if you need column details
3. **Write and execute SQL** — Use `execute_sql` via the Supabase MCP
4. **Analyze results** — Look for patterns, outliers, and trends
5. **Visualize if helpful** — Use Python matplotlib/plotly to create charts
6. **Report findings** — Produce a markdown summary with data tables and recommendations

## Important Notes

- All column names with camelCase must be quoted: `"firstName"`, `"senderId"`, `"requestStatus"`
- The `amount` field is stored as `bigint` (cents, not dollars) — divide by 100 for display
- `defaultPrivacyLevel` is an enum: `public`, `private`, `contacts`
- `banktransfers.type` indicates deposit vs withdrawal
- Use `execute_sql` for reads; use `apply_migration` only for DDL changes

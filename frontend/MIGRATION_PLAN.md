# Migration Plan: Firestore → Go + PostgreSQL

## Overview

This document outlines the plan to migrate TineX from Firebase/Firestore to a self-hosted Go REST API backed by PostgreSQL. The frontend (Next.js) remains unchanged except for swapping Firebase SDK calls for HTTP API calls.

**Goals:**
- Replace all Firestore reads/writes with REST API calls to a Go backend
- Keep Firebase Auth for authentication (simpler, no user migration needed)
- Replace all `core/repositories/` with API client functions
- Full data parity — no features dropped

---

## Phase 0: Preparation

- [ ] Spin up PostgreSQL instance (local dev: Docker; prod: Supabase, Railway, Neon, or self-hosted)
- [ ] Create Go project (`tinex-api`) with module `github.com/yourname/tinex-api`
- [ ] Choose Go HTTP framework: `chi` or `gin` (chi recommended — lightweight, stdlib-compatible)
- [ ] Set up database migrations tool: `golang-migrate` or `goose`
- [ ] Set up Firebase Admin SDK in Go for JWT verification
- [ ] Configure CI to run Go tests and migrations

---

## Phase 1: PostgreSQL Schema

Run migrations in this order to respect foreign keys.

### 1.1 Users

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,        -- Firebase Auth UID
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  photo_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.2 User Settings

```sql
CREATE TABLE user_settings (
  user_id                    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  base_currency              TEXT NOT NULL DEFAULT 'USD',
  active_analytics_preset_id TEXT,
  seen_version               TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.3 Accounts

```sql
CREATE TABLE accounts (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('cash','bank_account','credit_card','investment','savings','other')),
  currency    TEXT NOT NULL,
  balance     NUMERIC(20,8) NOT NULL DEFAULT 0,
  color       TEXT,
  icon        TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  is_saving   BOOLEAN NOT NULL DEFAULT FALSE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
```

### 1.4 Categories

```sql
CREATE TABLE categories (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  icon        TEXT NOT NULL,
  color       TEXT NOT NULL,
  parent_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,  -- protects Transfer In/Out
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
```

### 1.5 Tags

```sql
CREATE TABLE tags (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_tags_user_id ON tags(user_id);
```

### 1.6 Transactions

```sql
CREATE TABLE transactions (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id               TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type                     TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount                   NUMERIC(20,8) NOT NULL,
  currency                 TEXT NOT NULL,
  description              TEXT NOT NULL DEFAULT '',
  date                     TIMESTAMPTZ NOT NULL,
  category_id              TEXT REFERENCES categories(id) ON DELETE SET NULL,
  merchant_name            TEXT,
  notes                    TEXT,
  exclude_from_analytics   BOOLEAN NOT NULL DEFAULT FALSE,
  exchange_rate            NUMERIC(20,8),
  fee                      NUMERIC(20,8),
  pair_id                  TEXT,               -- links Transfer Out ↔ Transfer In
  source_id                TEXT,
  source_name              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_id       ON transactions(user_id);
CREATE INDEX idx_transactions_account_id    ON transactions(account_id);
CREATE INDEX idx_transactions_category_id   ON transactions(category_id);
CREATE INDEX idx_transactions_date          ON transactions(date);
CREATE INDEX idx_transactions_user_date     ON transactions(user_id, date);
```

### 1.7 Transaction Tags (many-to-many)

```sql
CREATE TABLE transaction_tags (
  transaction_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id          TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);
```

### 1.8 Budgets

```sql
CREATE TABLE budgets (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id      TEXT REFERENCES categories(id) ON DELETE CASCADE,
  amount           NUMERIC(20,8) NOT NULL,
  currency         TEXT NOT NULL,
  period           TEXT NOT NULL CHECK (period IN ('day','week','month','year')),
  start_date       TIMESTAMPTZ NOT NULL,
  end_date         TIMESTAMPTZ,
  alert_threshold  NUMERIC(5,2) NOT NULL DEFAULT 80,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budgets_user_id     ON budgets(user_id);
CREATE INDEX idx_budgets_category_id ON budgets(category_id);
```

### 1.9 Scheduled Transactions

```sql
CREATE TABLE scheduled_transactions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id       TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount           NUMERIC(20,8) NOT NULL,
  currency         TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  category_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  fee              NUMERIC(20,8),
  next_date        TIMESTAMPTZ NOT NULL,
  recurrence       TEXT NOT NULL CHECK (recurrence IN ('once','daily','weekly','monthly','yearly')),
  end_date         TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_executed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_user_id ON scheduled_transactions(user_id);
```

### 1.10 Scheduled Transaction Tags

```sql
CREATE TABLE scheduled_transaction_tags (
  scheduled_transaction_id  TEXT NOT NULL REFERENCES scheduled_transactions(id) ON DELETE CASCADE,
  tag_id                    TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (scheduled_transaction_id, tag_id)
);
```

### 1.11 Wishlists

```sql
CREATE TABLE wishlists (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.12 Wishlist Items

```sql
CREATE TABLE wishlist_items (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id  TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(20,8) NOT NULL,
  currency     TEXT NOT NULL,
  category_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.13 Analytics Presets

```sql
CREATE TABLE analytics_presets (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics_preset_categories (
  preset_id    TEXT NOT NULL REFERENCES analytics_presets(id) ON DELETE CASCADE,
  category_id  TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (preset_id, category_id)
);
```

### 1.14 Chat Messages

```sql
CREATE TABLE chat_messages (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id, created_at);
```

### 1.15 Imported Transactions

```sql
CREATE TABLE imported_transactions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  hash           TEXT NOT NULL,
  source         TEXT NOT NULL,
  import_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, hash, source)
);

CREATE INDEX idx_imported_user_source ON imported_transactions(user_id, source);
```

---

## Phase 2: Go Project Structure

```
tinex-api/
├── cmd/
│   └── server/
│       └── main.go              # Entry point
├── internal/
│   ├── auth/
│   │   └── middleware.go        # Firebase JWT verification
│   ├── db/
│   │   └── db.go                # PostgreSQL connection pool (pgx)
│   ├── handler/
│   │   ├── accounts.go
│   │   ├── transactions.go
│   │   ├── categories.go
│   │   ├── budgets.go
│   │   ├── tags.go
│   │   ├── wishlists.go
│   │   ├── scheduled.go
│   │   ├── analytics_presets.go
│   │   ├── chat_messages.go
│   │   ├── user_settings.go
│   │   ├── import.go
│   │   └── currency.go
│   ├── model/                   # Go structs matching DB schema
│   │   └── *.go
│   ├── repo/                    # SQL queries (sqlc-generated or hand-written)
│   │   └── *.go
│   └── service/                 # Business logic (balance updates, etc.)
│       ├── transaction.go
│       └── category.go
├── migrations/                  # SQL migration files
│   ├── 001_init.up.sql
│   └── 001_init.down.sql
├── go.mod
└── go.sum
```

**Recommended libraries:**
- `github.com/go-chi/chi/v5` — HTTP router
- `github.com/jackc/pgx/v5` — PostgreSQL driver
- `firebase.google.com/go/v4` — Firebase Admin SDK (JWT verify)
- `github.com/golang-migrate/migrate/v4` — DB migrations
- `github.com/sqlc-dev/sqlc` — Generate type-safe DB code (optional but recommended)

---

## Phase 3: REST API Endpoints

All endpoints are prefixed `/api/v1` and require `Authorization: Bearer <firebase-id-token>` header. The middleware extracts `user_id` from the verified token.

### Accounts
```
GET    /api/v1/accounts              → getByUserId
POST   /api/v1/accounts              → create
GET    /api/v1/accounts/:id          → getById
PUT    /api/v1/accounts/:id          → update
DELETE /api/v1/accounts/:id          → delete
GET    /api/v1/accounts/default      → getDefaultAccount
PUT    /api/v1/accounts/:id/default  → setDefault
GET    /api/v1/accounts/balance      → getTotalBalance
```

### Transactions
```
GET    /api/v1/transactions              → getByUserId (query: limit, order, orderDir)
POST   /api/v1/transactions              → create
GET    /api/v1/transactions/:id          → getById
PUT    /api/v1/transactions/:id          → update
DELETE /api/v1/transactions/:id          → delete
GET    /api/v1/transactions/by-account/:accountId
GET    /api/v1/transactions/by-category/:categoryId
GET    /api/v1/transactions/range        → getByDateRange (query: start, end)
GET    /api/v1/transactions/stats        → getStats (query: start, end)
```

### Categories
```
GET    /api/v1/categories              → getByUserId
POST   /api/v1/categories              → create
GET    /api/v1/categories/:id          → getById
PUT    /api/v1/categories/:id          → update
DELETE /api/v1/categories/:id          → delete
GET    /api/v1/categories/type/:type   → getByType (income|expense)
POST   /api/v1/categories/defaults     → createDefaultCategories
```

### Budgets
```
GET    /api/v1/budgets              → getByUserId
POST   /api/v1/budgets              → create
GET    /api/v1/budgets/:id          → getById
PUT    /api/v1/budgets/:id          → update
DELETE /api/v1/budgets/:id          → soft delete (is_active = false)
DELETE /api/v1/budgets/:id/hard     → hard delete
GET    /api/v1/budgets/by-category/:categoryId
```

### Tags
```
GET    /api/v1/tags        → getByUserId
POST   /api/v1/tags        → create
GET    /api/v1/tags/:id    → getById
PUT    /api/v1/tags/:id    → update
DELETE /api/v1/tags/:id    → delete
```

### Wishlists
```
GET    /api/v1/wishlists              → getAll
POST   /api/v1/wishlists              → create
GET    /api/v1/wishlists/:id          → getById
PUT    /api/v1/wishlists/:id          → update
DELETE /api/v1/wishlists/:id          → delete
GET    /api/v1/wishlists/:id/items    → getByWishlistId
POST   /api/v1/wishlists/:id/items    → createItem
PUT    /api/v1/wishlists/:id/items/:itemId          → updateItem
DELETE /api/v1/wishlists/:id/items/:itemId          → deleteItem
PUT    /api/v1/wishlists/:id/items/:itemId/toggle   → toggleConfirmed
```

### Scheduled Transactions
```
GET    /api/v1/scheduled              → getByUserId
POST   /api/v1/scheduled              → create
PUT    /api/v1/scheduled/:id          → update
DELETE /api/v1/scheduled/:id          → delete
GET    /api/v1/scheduled/upcoming     → getUpcoming (query: days)
```

### Analytics Presets
```
GET    /api/v1/analytics-presets        → getByUserId
POST   /api/v1/analytics-presets        → create
GET    /api/v1/analytics-presets/:id    → getById
PUT    /api/v1/analytics-presets/:id    → update
DELETE /api/v1/analytics-presets/:id    → delete
```

### Chat Messages
```
GET    /api/v1/chat-messages           → getRecentByUserId (query: limit)
POST   /api/v1/chat-messages           → create
DELETE /api/v1/chat-messages/:id       → delete
DELETE /api/v1/chat-messages           → deleteAllForUser
```

### User Settings
```
GET    /api/v1/settings    → getOrCreate
PUT    /api/v1/settings    → update
DELETE /api/v1/settings    → delete
```

### Imported Transactions
```
POST   /api/v1/imported-transactions/batch  → createBatch
GET    /api/v1/imported-transactions/hashes → getImportedHashes (query: source)
DELETE /api/v1/imported-transactions/by-transaction/:transactionId
```

### User Management
```
POST   /api/v1/users                → create/upsert user on first login
DELETE /api/v1/users/data           → deleteAllForUser (all collections)
```

### Proxy endpoints (keep in Next.js)
```
/api/chat         → stays in Next.js (calls Gemini, uses financial context)
/api/currency     → stays in Next.js (calls exchange rate API)
/api/parse-pdf    → stays in Next.js (uses pdf-parse CommonJS module)
/api/detect-bank  → stays in Next.js
```

---

## Phase 4: Business Logic in Go

### 4.1 Account Balance Updates (in `service/transaction.go`)

When a transaction is **created**:
- `expense`: `balance -= amount`
- `income`: `balance += amount`
- `transfer`: debit source account, credit destination account (linked by `pair_id`)

When a transaction is **deleted**:
- Reverse the balance change above
- If the transaction has a `pair_id`, also delete the paired transaction and reverse its balance

When a transaction is **updated**:
- Revert old balance effect, apply new balance effect

All balance updates must run in a **PostgreSQL transaction** (`BEGIN/COMMIT`).

### 4.2 Default Category Seeding

On `POST /api/v1/users`, insert all default categories for the new user.  
System categories (`is_system = TRUE`): "Transfer Out", "Transfer In" — never deletable.

### 4.3 Budget Soft Delete

`DELETE /api/v1/budgets/:id` sets `is_active = FALSE`. A separate hard-delete endpoint permanently removes the row.

### 4.4 Duplicate Import Detection

`getImportedHashes` returns all hashes for `(user_id, source)`. The frontend checks before calling the import endpoint.

### 4.5 Scheduled Transaction Execution

When a scheduled transaction is executed:
1. Create a normal transaction via the transactions service
2. Advance `next_date` based on `recurrence`
3. If `next_date > end_date` (or recurrence is `once`), set `is_active = FALSE`

---

## Phase 5: Authentication

Keep **Firebase Auth** — do not migrate users. The Go backend verifies Firebase ID tokens:

```go
// internal/auth/middleware.go
app, _ := firebase.NewApp(ctx, nil) // uses GOOGLE_APPLICATION_CREDENTIALS
authClient, _ := app.Auth(ctx)

func Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
        decoded, err := authClient.VerifyIDToken(ctx, token)
        if err != nil {
            http.Error(w, "Unauthorized", 401)
            return
        }
        ctx := context.WithValue(r.Context(), userIDKey, decoded.UID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

The Next.js frontend already has `getIdToken()` from Firebase Auth — pass it as the Bearer token to all Go API calls.

---

## Phase 6: Frontend Migration

Replace `core/repositories/` with an API client layer. The rest of the app stays the same.

### 6.1 Create API Client

```typescript
// core/api/client.ts
import { auth } from '@/lib/firebase';

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### 6.2 Replace Repository Classes

For each repository class, create a corresponding API module:

```typescript
// core/api/accounts.ts  (replaces core/repositories/AccountRepository.ts)
export const accountApi = {
  getAll: () => apiFetch('/api/v1/accounts'),
  getById: (id: string) => apiFetch(`/api/v1/accounts/${id}`),
  create: (input: CreateAccountInput) => apiFetch('/api/v1/accounts', { method: 'POST', body: JSON.stringify(input) }),
  update: (input: UpdateAccountInput) => apiFetch(`/api/v1/accounts/${input.id}`, { method: 'PUT', body: JSON.stringify(input) }),
  delete: (id: string) => apiFetch(`/api/v1/accounts/${id}`, { method: 'DELETE' }),
  // ...
};
```

Repeat for all repositories. The call sites in components only change the import path and method names where needed.

### 6.3 Remove Firebase SDK (optional, last step)

Once all Firestore calls are removed, you can drop `firebase/firestore` from the client bundle. Keep `firebase/auth` for login/logout.

---

## Phase 7: Data Migration

Migrate existing Firestore data to PostgreSQL once.

### 7.1 Migration Script (Node.js or Go)

```
1. Export all Firestore collections to JSON using firebase-admin
2. Insert in dependency order:
   users → user_settings
          → accounts
          → categories
          → tags
          → transactions → transaction_tags
          → budgets
          → scheduled_transactions
          → wishlists → wishlist_items
          → analytics_presets → analytics_preset_categories
          → chat_messages
          → imported_transactions
3. Verify row counts match document counts
4. Verify account balances sum correctly
```

Key transforms:
- Firestore `Timestamp` → PostgreSQL `TIMESTAMPTZ` (ISO string)
- Firestore `string[]` tags field → rows in `transaction_tags`
- Firestore document ID → PostgreSQL `id` column

---

## Phase 8: Rollout Strategy

1. **Run both systems in parallel** — Go API deployed, but frontend still uses Firestore
2. **Migrate one resource at a time** (start with read-only: categories, tags)
3. **Feature-flag each resource**: env var `NEXT_PUBLIC_USE_API=accounts,categories`
4. **Full cutover** — all resources use Go API; stop writing to Firestore
5. **Decommission Firestore** — remove firebase/firestore from frontend bundle

---

## Phase 9: Checklist Before Cutover

- [ ] All 14 repositories have equivalent API endpoints
- [ ] Account balance updates are transactional in PostgreSQL
- [ ] Transfer pair creation/deletion is atomic
- [ ] Default categories seeded for new users
- [ ] System categories cannot be deleted (backend enforces)
- [ ] Budget soft-delete works
- [ ] Duplicate import detection via hashes works
- [ ] All existing Firestore data migrated and verified
- [ ] `npm run build` passes with new API client code
- [ ] Go API deployed with TLS and proper CORS (`localhost:3000` + prod domain)
- [ ] `NEXT_PUBLIC_API_URL` set in all environments

---

## Deferred / Out of Scope

- Replacing Firebase Auth (significant complexity, low value)
- Migrating `/api/chat` to Go (Gemini SDK for Go is fine but not urgent)
- Migrating `/api/parse-pdf` to Go (requires PDF parsing library; defer)
- Real-time updates (Firestore listeners) — polling or SSE can be added later if needed

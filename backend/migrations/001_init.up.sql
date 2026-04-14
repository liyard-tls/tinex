-- Users (Firebase Auth UID as PK)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  photo_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id                    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  base_currency              TEXT NOT NULL DEFAULT 'USD',
  active_analytics_preset_id TEXT,
  seen_version               TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
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
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  icon        TEXT NOT NULL,
  color       TEXT NOT NULL,
  parent_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
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
  pair_id                  TEXT,
  source_id                TEXT,
  source_name              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date  ON transactions(user_id, date DESC);

-- Transaction Tags (many-to-many)
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id          TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
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
CREATE INDEX IF NOT EXISTS idx_budgets_user_id     ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);

-- Scheduled Transactions
CREATE TABLE IF NOT EXISTS scheduled_transactions (
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
CREATE INDEX IF NOT EXISTS idx_scheduled_user_id ON scheduled_transactions(user_id);

-- Scheduled Transaction Tags
CREATE TABLE IF NOT EXISTS scheduled_transaction_tags (
  scheduled_transaction_id  TEXT NOT NULL REFERENCES scheduled_transactions(id) ON DELETE CASCADE,
  tag_id                    TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (scheduled_transaction_id, tag_id)
);

-- Wishlists
CREATE TABLE IF NOT EXISTS wishlists (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);

-- Wishlist Items
CREATE TABLE IF NOT EXISTS wishlist_items (
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
CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist_id ON wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id     ON wishlist_items(user_id);

-- Analytics Presets
CREATE TABLE IF NOT EXISTS analytics_presets (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_presets_user_id ON analytics_presets(user_id);

-- Analytics Preset Categories
CREATE TABLE IF NOT EXISTS analytics_preset_categories (
  preset_id    TEXT NOT NULL REFERENCES analytics_presets(id) ON DELETE CASCADE,
  category_id  TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (preset_id, category_id)
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id, created_at DESC);

-- Imported Transactions (duplicate detection)
CREATE TABLE IF NOT EXISTS imported_transactions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  hash           TEXT NOT NULL,
  source         TEXT NOT NULL,
  import_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, hash, source)
);
CREATE INDEX IF NOT EXISTS idx_imported_user_source ON imported_transactions(user_id, source);

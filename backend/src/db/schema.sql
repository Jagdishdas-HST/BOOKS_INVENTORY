
-- Idempotent DDL — every statement uses IF NOT EXISTS so this is safe to
-- run on every pod boot (the supervisor runs this BEFORE index.ts starts).

CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id                serial PRIMARY KEY,
  sku               text NOT NULL UNIQUE,
  title             text NOT NULL,
  category          text NOT NULL,
  language          text NOT NULL DEFAULT 'English',
  cost_price        numeric(12,2) NOT NULL,
  retail_price      numeric(12,2) NOT NULL,
  warehouse_stock   integer NOT NULL DEFAULT 0,
  write_off_stock   integer NOT NULL DEFAULT 0,
  reorder_threshold integer NOT NULL DEFAULT 20,
  isbn              text,
  cover_url         text,
  cover_key         text,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS distributor_stock (
  id             serial PRIMARY KEY,
  distributor_id integer NOT NULL REFERENCES users(id),
  book_id        integer NOT NULL REFERENCES books(id),
  quantity       integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id                 serial PRIMARY KEY,
  book_id            integer NOT NULL REFERENCES books(id),
  distributor_id     integer REFERENCES users(id),
  to_distributor_id  integer REFERENCES users(id),
  quantity           integer NOT NULL,
  type               text NOT NULL DEFAULT 'assign',
  reason             text,
  moved_by_id        integer NOT NULL REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_history (
  id             serial PRIMARY KEY,
  book_id        integer NOT NULL REFERENCES books(id),
  field          text NOT NULL,
  old_value      numeric(12,2) NOT NULL,
  new_value      numeric(12,2) NOT NULL,
  changed_by_id  integer NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id               serial PRIMARY KEY,
  distributor_id   integer NOT NULL REFERENCES users(id),
  book_id          integer NOT NULL REFERENCES books(id),
  quantity         integer NOT NULL,
  unit_price       numeric(12,2) NOT NULL,
  total_value      numeric(12,2) NOT NULL,
  payment_type     text NOT NULL,
  is_discounted    boolean NOT NULL DEFAULT false,
  client_logged_at timestamptz,
  client_id        text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS remittances (
  id             serial PRIMARY KEY,
  distributor_id integer NOT NULL REFERENCES users(id),
  amount         numeric(12,2) NOT NULL,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id              serial PRIMARY KEY,
  remittance_id   integer NOT NULL REFERENCES remittances(id),
  sale_id         integer NOT NULL REFERENCES sales(id),
  amount          numeric(12,2) NOT NULL,
  allocated_by_id integer NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_conflicts (
  id               serial PRIMARY KEY,
  distributor_id   integer NOT NULL REFERENCES users(id),
  book_id          integer NOT NULL REFERENCES books(id),
  quantity         integer NOT NULL,
  unit_price       numeric(12,2) NOT NULL,
  total_value      numeric(12,2) NOT NULL,
  payment_type     text NOT NULL,
  is_discounted    boolean NOT NULL DEFAULT false,
  held_at_sync     integer NOT NULL,
  client_logged_at timestamptz,
  client_id        text UNIQUE,
  status           text NOT NULL DEFAULT 'pending',
  resolved_by_id   integer REFERENCES users(id),
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         serial PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users(id),
  action     text NOT NULL,
  entity     text NOT NULL,
  details    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes (all IF NOT EXISTS — idempotent)
CREATE INDEX IF NOT EXISTS idx_sales_distributor_id    ON sales(distributor_id);
CREATE INDEX IF NOT EXISTS idx_sales_book_id           ON sales(book_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at        ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_payment_type      ON sales(payment_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_book    ON stock_movements(book_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_dist    ON stock_movements(distributor_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id       ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at    ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action        ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity        ON audit_log(entity);
CREATE INDEX IF NOT EXISTS idx_remittances_dist        ON remittances(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_stock_dist  ON distributor_stock(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_stock_book  ON distributor_stock(book_id);
CREATE INDEX IF NOT EXISTS idx_price_history_book      ON price_history(book_id);

-- Allow audit_log.created_at to be set explicitly (for seeding historical data)
ALTER TABLE audit_log ALTER COLUMN created_at SET DEFAULT now();

-- Allow sales.created_at to be set explicitly (for seeding historical data)
ALTER TABLE sales ALTER COLUMN created_at SET DEFAULT now();

-- Allow stock_movements.created_at to be set explicitly (for seeding historical data)
ALTER TABLE stock_movements ALTER COLUMN created_at SET DEFAULT now();

-- Allow price_history.created_at to be set explicitly (for seeding historical data)
ALTER TABLE price_history ALTER COLUMN created_at SET DEFAULT now();

-- Allow remittances.created_at to be set explicitly (for seeding historical data)
ALTER TABLE remittances ALTER COLUMN created_at SET DEFAULT now();

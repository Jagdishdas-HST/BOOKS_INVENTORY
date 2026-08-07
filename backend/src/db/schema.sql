
-- Idempotent schema. Runs top-to-bottom on every backend boot.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'English',
  cost_price NUMERIC(12,2) NOT NULL,
  retail_price NUMERIC(12,2) NOT NULL,
  warehouse_stock INTEGER NOT NULL DEFAULT 0,
  write_off_stock INTEGER NOT NULL DEFAULT 0,
  reorder_threshold INTEGER NOT NULL DEFAULT 20,
  isbn TEXT,
  cover_url TEXT,
  cover_key TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS distributor_stock (
  id SERIAL PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES users(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  quantity INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  distributor_id INTEGER REFERENCES users(id),
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'assign',
  reason TEXT,
  moved_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS to_distributor_id INTEGER REFERENCES users(id);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  field TEXT NOT NULL,
  old_value NUMERIC(12,2) NOT NULL,
  new_value NUMERIC(12,2) NOT NULL,
  changed_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES users(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_value NUMERIC(12,2) NOT NULL,
  payment_type TEXT NOT NULL,
  is_discounted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Offline sale support (added this turn):
ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_logged_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS sales_client_id_key ON sales (client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS remittances (
  id SERIAL PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id SERIAL PRIMARY KEY,
  remittance_id INTEGER NOT NULL REFERENCES remittances(id),
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  amount NUMERIC(12,2) NOT NULL,
  allocated_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Flagged offline sales that failed stock re-validation at sync (added this turn).
CREATE TABLE IF NOT EXISTS sale_conflicts (
  id SERIAL PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES users(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_value NUMERIC(12,2) NOT NULL,
  payment_type TEXT NOT NULL,
  is_discounted BOOLEAN NOT NULL DEFAULT false,
  held_at_sync INTEGER NOT NULL,
  client_logged_at TIMESTAMPTZ,
  client_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by_id INTEGER REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sale_conflicts_client_id_key ON sale_conflicts (client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

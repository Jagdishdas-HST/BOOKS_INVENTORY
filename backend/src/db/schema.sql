
-- Idempotent — every CREATE uses IF NOT EXISTS, and later-turn columns use
-- ALTER TABLE ADD COLUMN IF NOT EXISTS. Safe to run on every pod boot.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
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
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE books ADD COLUMN IF NOT EXISTS isbn TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_key TEXT;

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
  moved_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'assign';
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  field TEXT NOT NULL,
  old_value NUMERIC(12,2) NOT NULL,
  new_value NUMERIC(12,2) NOT NULL,
  changed_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES users(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_value NUMERIC(12,2) NOT NULL,
  payment_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- New this turn: distinguish discounted paid sales from full-price ones.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_discounted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS remittances (
  id SERIAL PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- New this turn: optional remittance-to-debt-sale allocations.
CREATE TABLE IF NOT EXISTS payment_allocations (
  id SERIAL PRIMARY KEY,
  remittance_id INTEGER NOT NULL REFERENCES remittances(id),
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  amount NUMERIC(12,2) NOT NULL,
  allocated_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_remittance ON payment_allocations(remittance_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_sale ON payment_allocations(sale_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE homes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT ck_homes_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE members (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  CONSTRAINT uq_members_id UNIQUE (id),
  CONSTRAINT ck_members_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT fk_members_home FOREIGN KEY (home_id) REFERENCES homes (id)
);

CREATE INDEX idx_members_home ON members (home_id, seq);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT fk_bills_home FOREIGN KEY (home_id) REFERENCES homes (id),
  CONSTRAINT ck_bills_total_positive CHECK (total_cents > 0)
);

CREATE INDEX idx_bills_home ON bills (home_id, created_at);

CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  idempotency_key TEXT,
  CONSTRAINT fk_shares_bill FOREIGN KEY (bill_id) REFERENCES bills (id),
  CONSTRAINT fk_shares_member FOREIGN KEY (member_id) REFERENCES members (id),
  CONSTRAINT uq_shares_bill_member UNIQUE (bill_id, member_id),
  CONSTRAINT ck_shares_amount_nonneg CHECK (amount_cents >= 0),
  CONSTRAINT ck_shares_paid_consistent CHECK ((paid_at IS NULL) = (idempotency_key IS NULL))
);

CREATE INDEX idx_shares_bill ON shares (bill_id);
CREATE INDEX idx_shares_member ON shares (member_id);
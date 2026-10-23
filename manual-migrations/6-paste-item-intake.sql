ALTER TABLE items ADD COLUMN intake_status TEXT NOT NULL DEFAULT 'received' CHECK (intake_status IN ('reported', 'received'));
ALTER TABLE items ADD COLUMN received_by TEXT REFERENCES users(id);
ALTER TABLE items ADD COLUMN received_at TEXT;
CREATE INDEX idx_items_intake ON items(intake_status, collection);

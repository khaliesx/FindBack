-- Reserve approved items and keep the operator's review decision.
ALTER TABLE items ADD COLUMN reserved_claim_id TEXT REFERENCES claims(id);
ALTER TABLE items ADD COLUMN reserved_at TEXT;
ALTER TABLE claims ADD COLUMN decision_reason TEXT;
ALTER TABLE claims ADD COLUMN handover_verified INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_items_reserved ON items(reserved_claim_id);
-- Step 7 retires old demo accounts. An approved claim owned by one of them
-- cannot be collected, so void its pickup code before reserving anything.
UPDATE claims SET status = 'rejected', pickup_code = NULL,
  decision_reason = 'Claimant demo account retired during migration', reviewed_at = datetime('now')
WHERE status = 'approved' AND user_id IN ('U-DEMO-RES','U-DEMO-SEC','U-DEMO-STP','U-DEMO-STC');
-- Preserve approvals for accounts that remain active.
UPDATE items SET reserved_claim_id = (
  SELECT c.id FROM claims c WHERE c.item_id = items.id AND c.status = 'approved'
  ORDER BY c.reviewed_at DESC, c.created_at DESC LIMIT 1
), reserved_at = datetime('now')
WHERE status = 'available' AND EXISTS (
  SELECT 1 FROM claims c WHERE c.item_id = items.id AND c.status = 'approved'
);
-- An older database may have more than one approved claim for an item.
-- Keep one reservation and void the other pickup codes.
UPDATE claims SET status = 'rejected', pickup_code = NULL,
  decision_reason = 'Superseded by the active reservation during migration', reviewed_at = datetime('now')
WHERE status = 'approved' AND EXISTS (
  SELECT 1 FROM items i WHERE i.id = claims.item_id
    AND i.reserved_claim_id IS NOT NULL AND i.reserved_claim_id != claims.id
);

-- Keep historical demo users for claim references, but allow only the agreed operator.
ALTER TABLE users ADD COLUMN username TEXT;
CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
UPDATE users SET username = 'findback_admni', email = 'findback_admni@findback.demo',
  name = 'FindBack Demo Operator', password_hash = 'pbkdf2_sha256$100000$w5aSRwDuPhTiOlsaBztG5A==$wgwNbFfo6SutYDEc9zckrdS23AS8nfvf4uObvETiS2s=', role = 'admin',
  collection_point = NULL, active = 1 WHERE id = 'U-DEMO-ADM';
UPDATE users SET active = 0 WHERE id IN ('U-DEMO-RES','U-DEMO-SEC','U-DEMO-STP','U-DEMO-STC');
DELETE FROM sessions WHERE user_id IN ('U-DEMO-RES','U-DEMO-SEC','U-DEMO-STP','U-DEMO-STC','U-DEMO-ADM');

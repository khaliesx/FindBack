// Rebuilds the single demo-operator migration before it has been deployed.
// Usage: node scripts/build-seed.mjs "<operator password>"
import { writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: node scripts/build-seed.mjs "<operator password, 8+ chars>"');
  process.exit(1);
}
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
const hash = `pbkdf2_sha256$100000$${Buffer.from(salt).toString('base64')}$${Buffer.from(bits).toString('base64')}`;
const sql = `-- Keep historical demo users for claim references, but allow only the agreed operator.
ALTER TABLE users ADD COLUMN username TEXT;
CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
UPDATE users SET username = 'findback_admni', email = 'findback_admni@findback.demo',
  name = 'FindBack Demo Operator', password_hash = '${hash}', role = 'admin',
  collection_point = NULL, active = 1 WHERE id = 'U-DEMO-ADM';
UPDATE users SET active = 0 WHERE id IN ('U-DEMO-RES','U-DEMO-SEC','U-DEMO-STP','U-DEMO-STC');
DELETE FROM sessions WHERE user_id IN ('U-DEMO-RES','U-DEMO-SEC','U-DEMO-STP','U-DEMO-STC','U-DEMO-ADM');
`;
for (const file of ['../migrations/0007_single_demo_operator.sql', '../manual-migrations/7-paste-single-demo-operator.sql'])
  writeFileSync(new URL(file, import.meta.url), sql);
console.log('Updated both single-operator migration files.');

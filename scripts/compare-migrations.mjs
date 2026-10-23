// Verify that the console-paste path produces the same database as Wrangler migrations.
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const migrationDir = join(root, 'migrations');
const manualDir = join(root, 'manual-migrations');
const migration = step => join(migrationDir, readdirSync(migrationDir).find(name => name.startsWith(String(step).padStart(4, '0') + '_')));
const manual = step => join(manualDir, readdirSync(manualDir).find(name => name.startsWith(step + '-paste-')));

function snapshot(pathForStep) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (let step = 1; step <= 8; step++) {
    db.exec(readFileSync(pathForStep(step), 'utf8'));
    if (step === 2) db.exec(`
      INSERT INTO users (id,email,name,password_hash,role) VALUES ('U-KEEP-RES','keep@example.test','Active resident','test','resident');
      INSERT INTO items (id,name,category,color,location,date,description,private_note,collection,sample)
        VALUES ('FB-OLD-STAFF','Legacy staff claim','Other','Black','Retail Square','2026-10-18','Test item','Test detail','Township management office',0),
               ('FB-KEEP-RES','Active resident claim','Other','Black','Retail Square','2026-10-18','Test item','Test detail','Township management office',0);
      INSERT INTO claims (id,item_id,user_id,claimant_name,proof,last_seen,status,pickup_code)
        VALUES ('CL-OLD-STAFF','FB-OLD-STAFF','U-DEMO-STP','Old staff','Private detail','Retail Square','approved','123456'),
               ('CL-KEEP-RES','FB-KEEP-RES','U-KEEP-RES','Active resident','Private detail','Retail Square','approved','654321');
    `);
  }
  const oldClaim = db.prepare("SELECT status, pickup_code FROM claims WHERE id='CL-OLD-STAFF'").get();
  const oldItem = db.prepare("SELECT status, reserved_claim_id FROM items WHERE id='FB-OLD-STAFF'").get();
  const keptClaim = db.prepare("SELECT status, pickup_code FROM claims WHERE id='CL-KEEP-RES'").get();
  const keptItem = db.prepare("SELECT reserved_claim_id FROM items WHERE id='FB-KEEP-RES'").get();
  if (oldClaim.status !== 'rejected' || oldClaim.pickup_code !== null || oldItem.status !== 'available' || oldItem.reserved_claim_id !== null)
    throw Error('Retired demo claimant still holds a pickup code or reservation.');
  if (keptClaim.status !== 'approved' || keptClaim.pickup_code !== '654321' || keptItem.reserved_claim_id !== 'CL-KEEP-RES')
    throw Error('Active resident approval was not preserved and reserved.');
  const entries = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
  const tables = entries.filter(entry => entry.type === 'table');
  const schema = tables.map(entry => ({
    name: entry.name,
    columns: db.prepare(`PRAGMA table_info("${entry.name}")`).all(),
    foreignKeys: db.prepare(`PRAGMA foreign_key_list("${entry.name}")`).all(),
    indexes: db.prepare(`PRAGMA index_list("${entry.name}")`).all().map(index => ({
      name: index.name, unique: index.unique, partial: index.partial,
      columns: db.prepare(`PRAGMA index_xinfo("${index.name}")`).all(),
    })),
  }));
  const rows = Object.fromEntries(tables.map(entry => {
    const columns = db.prepare(`PRAGMA table_info("${entry.name}")`).all().map(column => column.name);
    const values = db.prepare(`SELECT * FROM "${entry.name}"`).all().map(row => Object.fromEntries(columns.map(column => [
      column, ['at', 'created_at', 'reviewed_at', 'reserved_at', 'received_at'].includes(column) && row[column] ? '<timestamp>' : row[column],
    ])));
    values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return [entry.name, values];
  }));
  db.close();
  return JSON.stringify({ schema, rows });
}

const versioned = snapshot(migration);
const consolePaste = snapshot(manual);
if (versioned !== consolePaste) {
  const at = [...versioned].findIndex((char, index) => char !== consolePaste[index]);
  throw Error(`Console-paste and Wrangler migration paths differ near: ${versioned.slice(at, at + 180)} / ${consolePaste.slice(at, at + 180)}`);
}
console.log('PASS: Console-paste and Wrangler paths match on columns, foreign keys, indexes, and seeded rows.');

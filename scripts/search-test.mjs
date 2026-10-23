// Tests /api/search logic with the real Worker code, a real SQLite database and a fake Workers AI.
// Run: node scripts/search-test.mjs      (needs Node 22+, uses node:sqlite)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';
const operatorPassword = process.env.FINDBACK_OPERATOR_PASSWORD;
if (!operatorPassword) throw Error('Set FINDBACK_OPERATOR_PASSWORD to the agreed demo password before running this test.');

let pass = 0, failN = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : failN++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); };

// --- Minimal D1 adapter over node:sqlite
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0002_seed.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0003_elmina_collection_points.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0004_photo_scenarios.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0005_elmina_found_locations.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0006_item_intake.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0007_single_demo_operator.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0008_claim_reservations.sql', import.meta.url), 'utf8'));
check('only the agreed demo operator stays active', db.prepare("SELECT COUNT(*) AS n FROM users WHERE active = 1").get().n === 1 && db.prepare("SELECT username FROM users WHERE active = 1").get().username === 'findback_admni');
// Activate two legacy desk fixtures only in this disposable test database so
// role and collection-point access can be exercised without changing the demo.
db.exec("UPDATE users SET active = 1 WHERE id IN ('U-DEMO-SEC','U-DEMO-STC')");
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const DB = { prepare: sql => stmt(sql), batch: async list => { for (const s of list) await s.run(); return []; } };
const { locationCatalog, collectionCatalog } = await import('../public/data.js');
const photoRows = db.prepare("SELECT id, location, collection FROM items WHERE id LIKE 'FB-ELM-%'").all();
check('all seven photos use catalogued Elmina areas', photoRows.length === 7 && photoRows.every(r => locationCatalog.some(p => p.name === r.location)));
check('collection desks are separate proposed destinations', photoRows.every(r => collectionCatalog.some(p => p.name === r.collection)) && photoRows.some(r => r.location !== r.collection));
check('legacy generic locations migrated', db.prepare("SELECT COUNT(*) AS n FROM items WHERE location IN ('Central Park', 'Clubhouse', 'Retail Square', 'Community Garden')").get().n === 0);
check('map points stay within the Elmina demo area', [...locationCatalog,...collectionCatalog].every(p => p.lat > 3.16 && p.lat < 3.22 && p.lng > 101.49 && p.lng < 101.53));

// --- Fake Workers AI: hashed bag-of-words vectors, and a vision model that needs the licence first
const calls = { agree: 0, vision: 0, embed: 0 };
const vec = t => { const v = new Array(64).fill(0); for (const w of t.toLowerCase().match(/[a-z]+/g) || []) { let h = 0; for (const c of w) h = (h * 31 + c.charCodeAt(0)) % 64; v[h] += 1; } return v; };
const fakeAI = (caption, { breakEmbed = false } = {}) => {
  let agreed = false;
  return { async run(model, input) {
    if (model.includes('vision')) {
      if (input.prompt === 'agree') { calls.agree++; agreed = true; return { response: 'Thank you' }; }
      if (!agreed) throw new Error('5016: Prior to using this model, you must submit the prompt "agree"');
      calls.vision++;
      if (!/^data:image\/jpeg;base64,/.test(input.image) || !input.messages?.length) throw new Error('bad vision input');
      return { response: caption };
    }
    if (model.includes('bge')) { calls.embed++; if (breakEmbed) throw new Error('down'); return { shape: [input.text.length, 64], data: input.text.map(vec) }; }
    throw new Error('unknown model ' + model);
  } };
};

const BASE = 'https://findback.test';
let env = { DB, AI: fakeAI('A black insulated bottle with a silver base and carrying handle.'), DEMO_MODE: 'true', ASSETS: { fetch: () => new Response('asset') } };
const call = async (method, path, body, cookie) => {
  const r = await worker.fetch(new Request(BASE + path, { method, headers: { 'Content-Type': 'application/json', Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('Set-Cookie') || '').split(';')[0] };
};
const JPEG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');

check('search needs sign-in', (await call('POST', '/api/search', { query: 'bottle' })).status === 401);
const { cookie } = await call('POST', '/api/auth/register', { name: 'Test Resident', email: 'resident-test@findback.demo', password: 'testing-pass-123' });
check('resident signs in', !!cookie);

const photo = await call('POST', '/api/search', { image: JPEG }, cookie);
check('photo search returns the AI description', photo.status === 200 && /black insulated bottle/.test(photo.data.caption), JSON.stringify(photo.data));
check('licence accepted once, automatically', calls.agree === 1 && calls.vision === 1);
const topPhoto = [...photo.data.scores].sort((a, b) => b.score - a.score)[0];
check('AI ranks the black bottle highest', topPhoto?.id === 'FB-ELM-001', JSON.stringify(topPhoto));
// The app's final ranking adds word matching on the AI's description (same function the app uses).
const { rankText, seedItems } = await import('../public/data.js');
const ranked = rankText(seedItems, photo.data.caption, photo.data.scores);
check('app ranks FB-ELM-001 first', ranked[0]?.id === 'FB-ELM-001', JSON.stringify(ranked.slice(0, 3)));
check('scores cover all 7 available items', photo.data.scores.length === 7);

await call('POST', '/api/search', { image: JPEG }, cookie);
check('licence not re-sent on later searches', calls.agree === 1 && calls.vision === 2);

const words = await call('POST', '/api/search', { query: 'green keys' }, cookie);
const topWords = [...words.data.scores].sort((a, b) => b.score - a.score)[0];
check('text-only search skips the vision model', words.status === 200 && words.data.caption === null && calls.vision === 2);
check('"green keys" ranks FB-ELM-002 first', topWords?.id === 'FB-ELM-002', JSON.stringify(topWords));

check('empty search rejected', (await call('POST', '/api/search', {}, cookie)).status === 400);
check('non-JPEG photo rejected', (await call('POST', '/api/search', { image: 'data:text/html;base64,PHA+' }, cookie)).status === 400);

const before = calls.vision;
for (let i = 0; i < 30; i++) await call('POST', '/api/search', { image: JPEG }, cookie);
const limited = await call('POST', '/api/search', { image: JPEG }, cookie);
check('photo searches limited to 30 per hour per user', limited.status === 429 && calls.vision - before === 28, `${limited.status} ${calls.vision - before}`);

env = { ...env, AI: fakeAI('x', { breakEmbed: true }) };
const { cookie: c2 } = await call('POST', '/api/auth/login', { username: 'findback_admni', password: operatorPassword });
check('agreed staff username signs in', !!c2);
check('public config does not reveal staff password', !JSON.stringify((await call('GET', '/api/config')).data).includes(operatorPassword));
check('operator cannot use resident search', (await call('POST', '/api/search', { query: 'umbrella' }, c2)).status === 403);
check('AI outage returns a clear 502, not a crash', (await call('POST', '/api/search', { query: 'umbrella' }, cookie)).status === 502);
env = { ...env, AI: undefined };
check('missing AI binding returns 503', (await call('POST', '/api/search', { query: 'umbrella' }, cookie)).status === 503);

const report = await call('POST', '/api/items', { image: JPEG, name: 'Test red cap', category: 'Other', color: 'Red', location: 'Elmina Central Park', date: '2026-10-20', description: 'Red cap left by the path', privateNote: 'Stitched initials underneath', collection: 'Elmina Rainforest Knowledge Centre (ERKC)' }, cookie);
const reportId = report.data?.item?.id;
check('new report starts awaiting physical intake', report.status === 201 && report.data.item.status === 'reported');
check('reporter sees pending status', (await call('GET', '/api/items', null, cookie)).data.items.some(i => i.id === reportId && i.status === 'reported'));
check('new report is absent from AI search inventory', !db.prepare("SELECT id FROM items WHERE status = 'available' AND intake_status = 'received'").all().some(i => i.id === reportId));
const { cookie: otherResident } = await call('POST', '/api/auth/register', { name: 'Second Resident', email: 'second-test@findback.demo', password: 'testing-pass-456' });
check('unreceived item cannot be claimed', (await call('POST', '/api/claims', { itemId: reportId, proof: 'Stitched initials underneath', lastSeen: 'Elmina Central Park' }, otherResident)).status === 409);
const { cookie: wrongDesk } = await call('POST', '/api/auth/login', { email: 'staff.clubhouse@findback.demo', password: 'FindBack-Demo-2026' });
check('other desk cannot receive item', (await call('POST', `/api/items/${reportId}/intake`, null, wrongDesk)).status === 403);
const { cookie: rightDesk } = await call('POST', '/api/auth/login', { email: 'security@findback.demo', password: 'FindBack-Demo-2026' });
check('assigned desk sees pending report', (await call('GET', '/api/items', null, rightDesk)).data.items.some(i => i.id === reportId && i.status === 'reported'));
check('assigned desk confirms receipt', (await call('POST', `/api/items/${reportId}/intake`, null, rightDesk)).status === 200);
check('duplicate receipt is blocked', (await call('POST', `/api/items/${reportId}/intake`, null, rightDesk)).status === 409);
check('received item becomes available', (await call('GET', '/api/items', null, cookie)).data.items.some(i => i.id === reportId && i.status === 'available'));
check('receipt writes an audit event', db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'item.receive' AND target = ?").get(reportId).n === 1);

const first = await call('POST', '/api/claims', { itemId: 'FB-ELM-002', proof: 'Silver key ring with a small red scratch', lastSeen: 'Elmina Green 7 yesterday' }, cookie);
const claimId = first.data?.claim?.id;
const second = await call('POST', '/api/claims', { itemId: 'FB-ELM-002', proof: 'A bent blue key attached to the ring', lastSeen: 'Elmina Central Park yesterday' }, otherResident);
check('two residents can submit competing claims before review', first.status === 201 && second.status === 201);
check('approval needs a recorded reason', (await call('POST', `/api/claims/${claimId}/decision`, { decision: 'approved', verified: true }, c2)).status === 400);
check('approval needs evidence confirmation', (await call('POST', `/api/claims/${claimId}/decision`, { decision: 'approved', reason: 'Secret detail matches the physical keys' }, c2)).status === 400);
check('operator approves and reserves', (await call('POST', `/api/claims/${claimId}/decision`, { decision: 'approved', reason: 'Secret detail matches the physical keys', verified: true }, c2)).status === 200);
check('reservation points to approved claim', db.prepare('SELECT reserved_claim_id FROM items WHERE id = ?').get('FB-ELM-002').reserved_claim_id === claimId);
check('reserved item is hidden from resident inventory', !(await call('GET', '/api/items', null, otherResident)).data.items.some(i => i.id === 'FB-ELM-002'));
env = { ...env, AI: fakeAI('green keys') };
check('reserved item is absent from smart search', !(await call('POST', '/api/search', { query: 'green keys' }, otherResident)).data.scores.some(i => i.id === 'FB-ELM-002'));
check('second pending claim cannot reserve the same item', (await call('POST', `/api/claims/${second.data.claim.id}/decision`, { decision: 'approved', reason: 'Claimant gave another plausible detail', verified: true }, c2)).status === 409);
check('new claims blocked while reserved', (await call('POST', '/api/claims', { itemId: 'FB-ELM-002', proof: 'Other distinctive mark', lastSeen: 'Elmina Green 7' }, otherResident)).status === 409);
const approvedMine = (await call('GET', '/api/claims?scope=mine', null, cookie)).data.claims.find(c => c.id === claimId);
check('handover requires second ownership check', (await call('POST', `/api/claims/${claimId}/handover`, { code: approvedMine.pickupCode }, c2)).status === 400);
check('release needs reason', (await call('POST', `/api/claims/${claimId}/release`, {}, c2)).status === 400);
check('operator can release mistaken reservation', (await call('POST', `/api/claims/${claimId}/release`, { reason: 'Claimant retracted their ownership evidence' }, c2)).status === 200);
check('release clears reservation and voids pickup code', db.prepare('SELECT reserved_claim_id FROM items WHERE id = ?').get('FB-ELM-002').reserved_claim_id === null && db.prepare('SELECT pickup_code FROM claims WHERE id = ?').get(claimId).pickup_code === null);
check('release restores resident visibility', (await call('GET', '/api/items', null, otherResident)).data.items.some(i => i.id === 'FB-ELM-002'));
check('second pending claimant can be approved after release', (await call('POST', `/api/claims/${second.data.claim.id}/decision`, { decision: 'approved', reason: 'Bent key matches the physical item', verified: true }, c2)).status === 200);
const secondCode = (await call('GET', '/api/claims?scope=mine', null, otherResident)).data.claims.find(c => c.id === second.data.claim.id).pickupCode;
check('confirmed handover succeeds', (await call('POST', `/api/claims/${second.data.claim.id}/handover`, { code: secondCode, confirmedOwnerDetail: true }, c2)).status === 200);
check('handover verification is recorded', db.prepare('SELECT handover_verified FROM claims WHERE id = ?').get(second.data.claim.id).handover_verified === 1);

console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);

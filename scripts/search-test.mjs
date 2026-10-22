// Tests /api/search logic with the real Worker code, a real SQLite database and a fake Workers AI.
// Run: node scripts/search-test.mjs      (needs Node 22+, uses node:sqlite)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';

let pass = 0, failN = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : failN++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); };

// --- Minimal D1 adapter over node:sqlite
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0002_seed.sql', import.meta.url), 'utf8'));
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const DB = { prepare: sql => stmt(sql), batch: async list => { for (const s of list) await s.run(); return []; } };

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
let env = { DB, AI: fakeAI('A black water bottle with a red sticker and a carry loop.'), DEMO_MODE: 'true', ASSETS: { fetch: () => new Response('asset') } };
const call = async (method, path, body, cookie) => {
  const r = await worker.fetch(new Request(BASE + path, { method, headers: { 'Content-Type': 'application/json', Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('Set-Cookie') || '').split(';')[0] };
};
const JPEG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');

check('search needs sign-in', (await call('POST', '/api/search', { query: 'bottle' })).status === 401);
const { cookie } = await call('POST', '/api/auth/login', { email: 'resident@findback.demo', password: 'FindBack-Demo-2026' });
check('resident signs in', !!cookie);

const photo = await call('POST', '/api/search', { image: JPEG }, cookie);
check('photo search returns the AI description', photo.status === 200 && /black water bottle/.test(photo.data.caption), JSON.stringify(photo.data));
check('licence accepted once, automatically', calls.agree === 1 && calls.vision === 1);
const top2 = [...photo.data.scores].sort((a, b) => b.score - a.score).slice(0, 2).map(s => s.id);
check('AI ranks the two black bottles highest', top2.includes('FB-001') && top2.includes('FB-007'), JSON.stringify(top2));
// The app's final ranking adds word matching on the AI's description (same function the app uses).
const { rankText, seedItems } = await import('../public/data.js');
const ranked = rankText(seedItems, photo.data.caption, photo.data.scores);
check('app ranks FB-001 (red sticker) first', ranked[0]?.id === 'FB-001', JSON.stringify(ranked.slice(0, 3)));
check('scores cover all 12 available items', photo.data.scores.length === 12);

await call('POST', '/api/search', { image: JPEG }, cookie);
check('licence not re-sent on later searches', calls.agree === 1 && calls.vision === 2);

const words = await call('POST', '/api/search', { query: 'green keys' }, cookie);
const topWords = [...words.data.scores].sort((a, b) => b.score - a.score)[0];
check('text-only search skips the vision model', words.status === 200 && words.data.caption === null && calls.vision === 2);
check('"green keys" ranks FB-002 first', topWords?.id === 'FB-002', JSON.stringify(topWords));

check('empty search rejected', (await call('POST', '/api/search', {}, cookie)).status === 400);
check('non-JPEG photo rejected', (await call('POST', '/api/search', { image: 'data:text/html;base64,PHA+' }, cookie)).status === 400);

const before = calls.vision;
for (let i = 0; i < 30; i++) await call('POST', '/api/search', { image: JPEG }, cookie);
const limited = await call('POST', '/api/search', { image: JPEG }, cookie);
check('photo searches limited to 30 per hour per user', limited.status === 429 && calls.vision - before === 28, `${limited.status} ${calls.vision - before}`);

env = { ...env, AI: fakeAI('x', { breakEmbed: true }) };
const { cookie: c2 } = await call('POST', '/api/auth/login', { email: 'admin@findback.demo', password: 'FindBack-Demo-2026' });
check('AI outage returns a clear 502, not a crash', (await call('POST', '/api/search', { query: 'umbrella' }, c2)).status === 502);
env = { ...env, AI: undefined };
check('missing AI binding returns 503', (await call('POST', '/api/search', { query: 'umbrella' }, c2)).status === 503);

console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);

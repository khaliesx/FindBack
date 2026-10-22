// FindBack API — Cloudflare Worker + D1
// Static files in /public are served by Workers Assets; every /api/* request reaches this code.

const COLLECTION_POINTS = ['Township management office', 'Central Park security desk', 'Clubhouse reception'];
const LOCATIONS = ['Central Park', 'Clubhouse', 'Retail Square', 'Community Garden'];
const CATEGORIES = ['Bottles', 'Keys', 'Bags & wallets', 'Electronics', 'Other'];
const COLORS = ['Black', 'White', 'Blue', 'Green', 'Red', 'Brown', 'Cream', 'Other'];
const ROLES = ['resident', 'security', 'staff', 'admin'];

// ---------- Access-control rules (single source of truth) ----------
// Each role gets a fixed permission set. Scoped permissions ("desk", "review",
// "handover") additionally require the item's collection point to match the
// user's assigned collection point, except for admins.
const PERMISSIONS = {
  resident: ['items:read', 'items:report', 'claims:create', 'claims:own'],
  security: ['items:read', 'items:report', 'claims:create', 'claims:own', 'claims:desk', 'claims:handover'],
  staff:    ['items:read', 'items:report', 'claims:create', 'claims:own', 'claims:desk', 'claims:review', 'claims:handover', 'items:private'],
  admin:    ['*'],
};
const can = (user, perm) => {
  const p = PERMISSIONS[user?.role] || [];
  return p.includes('*') || p.includes(perm);
};
const inScope = (user, collection) => user.role === 'admin' || (!!user.collection_point && user.collection_point === collection);

// ---------- Settings ----------
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 100000;      // Cloudflare Workers caps PBKDF2 at 100,000
const MAX_BODY = 2_000_000;
const MAX_IMAGE = 1_400_000;           // characters of data URL (~1 MB JPEG)
const LOGIN_WINDOW_MIN = 15, LOGIN_MAX_FAILS = 5;

// ---------- Small helpers ----------
const enc = new TextEncoder();
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const now = () => Date.now();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const randomId = (prefix, bytes = 4) => prefix + [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
const pickupCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
const str = (v, min, max, label) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min || s.length > max) fail(400, `${label} must be ${min}–${max} characters.`);
  return s;
};
const oneOf = (v, list, label) => { if (!list.includes(v)) fail(400, `Please choose a valid ${label}.`); return v; };

async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Password hashes: "pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>"
export async function hashPassword(password, iterations = PBKDF2_ITERATIONS, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2_sha256$${iterations}$${b64(salt)}$${b64(bits)}`;
}
async function verifyPassword(password, stored) {
  const [alg, it, salt, hash] = String(stored).split('$');
  if (alg !== 'pbkdf2_sha256' || !it || !salt || !hash) return false;
  const again = await hashPassword(password, Number(it), unb64(salt));
  return safeEqual(again.split('$')[3], hash);
}
// Used when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = 'pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

async function readBody(req) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) fail(413, 'That upload is too large.');
  const text = await req.text();
  if (text.length > MAX_BODY) fail(413, 'That upload is too large.');
  try { return text ? JSON.parse(text) : {}; } catch { fail(400, 'Invalid request.'); }
}
const audit = (env, userId, action, target = null, detail = null) =>
  env.DB.prepare('INSERT INTO audit_log (user_id, action, target, detail) VALUES (?, ?, ?, ?)')
    .bind(userId, action, target, detail == null ? null : String(detail).slice(0, 300)).run();

// ---------- Sessions ----------
function cookieToken(req) {
  const m = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)fb_session=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
const sessionCookie = (token, maxAge) =>
  `fb_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

async function createSession(env, userId) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = b64(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await sha256Hex(token), userId, now() + SESSION_DAYS * 864e5),
  ]);
  return sessionCookie(token, SESSION_DAYS * 86400);
}
async function currentUser(req, env) {
  const token = cookieToken(req);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.collection_point FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`
  ).bind(await sha256Hex(token), now()).first();
}
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role, collectionPoint: u.collection_point || null, permissions: PERMISSIONS[u.role] });

// ---------- Row mappers ----------
const itemOut = (r, withPrivate = false) => ({
  id: r.id, name: r.name, category: r.category, color: r.color, location: r.location, date: r.date,
  description: r.description, collection: r.collection, image: r.image || null,
  type: r.illus_type || null, paint: r.paint || null, accent: r.accent || null,
  status: r.status, sample: !!r.sample, reportedByMe: false,
  ...(withPrivate ? { privateNote: r.private_note } : {}),
});

// ---------- Route handlers ----------
const routes = [];
const route = (method, pattern, handler, { auth = true } = {}) =>
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, auth });

route('GET', '/api/config', async ({ env }) => {
  const demo = env.DEMO_MODE === 'true';
  return json({
    demoMode: demo,
    allowRegistration: env.ALLOW_REGISTRATION !== 'false',
    collectionPoints: COLLECTION_POINTS,
    demoAccounts: demo ? [
      { email: 'resident@findback.demo', label: 'Resident' },
      { email: 'security@findback.demo', label: 'Security · Central Park' },
      { email: 'staff.centralpark@findback.demo', label: 'Staff · Central Park' },
      { email: 'staff.clubhouse@findback.demo', label: 'Staff · Clubhouse' },
      { email: 'admin@findback.demo', label: 'Township admin' },
    ] : [],
    demoPassword: demo ? (env.DEMO_PASSWORD || null) : null,
  });
}, { auth: false });

route('POST', '/api/auth/register', async ({ req, env }) => {
  if (env.ALLOW_REGISTRATION === 'false') fail(403, 'Self-registration is closed. Please contact the township office.');
  const b = await readBody(req);
  const name = str(b.name, 2, 80, 'Name');
  const email = str(b.email, 5, 120, 'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Please enter a valid email.');
  const password = typeof b.password === 'string' ? b.password : '';
  if (password.length < 10 || password.length > 128) fail(400, 'Password must be at least 10 characters.');
  if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first())
    fail(409, 'An account with this email already exists. Please sign in.');
  const id = randomId('U-', 6);
  await env.DB.prepare('INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email, name, await hashPassword(password), 'resident').run();
  await audit(env, id, 'user.register', id);
  const user = await env.DB.prepare('SELECT id, email, name, role, collection_point FROM users WHERE id = ?').bind(id).first();
  return json({ user: publicUser(user) }, 201, { 'Set-Cookie': await createSession(env, id) });
}, { auth: false });

route('POST', '/api/auth/login', async ({ req, env }) => {
  const b = await readBody(req);
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 120) : '';
  const password = typeof b.password === 'string' ? b.password.slice(0, 128) : '';
  if (!email || !password) fail(400, 'Please enter your email and password.');
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth.login_failed' AND target = ? AND at > datetime('now', ?)`
  ).bind(email, `-${LOGIN_WINDOW_MIN} minutes`).first();
  if (recent.n >= LOGIN_MAX_FAILS) fail(429, `Too many attempts. Try again in ${LOGIN_WINDOW_MIN} minutes.`);
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok || !user.active) {
    await audit(env, user?.id || null, 'auth.login_failed', email);
    fail(401, user && ok && !user.active ? 'This account has been deactivated.' : 'Email or password is incorrect.');
  }
  await audit(env, user.id, 'auth.login', user.id);
  return json({ user: publicUser(user) }, 200, { 'Set-Cookie': await createSession(env, user.id) });
}, { auth: false });

route('POST', '/api/auth/logout', async ({ req, env }) => {
  const token = cookieToken(req);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}, { auth: false });

route('GET', '/api/auth/me', async ({ user }) => json({ user: publicUser(user) }));

// Items -------------------------------------------------------------
route('GET', '/api/items', async ({ env, user }) => {
  const { results } = await env.DB.prepare(
    `SELECT * FROM items WHERE status = 'available' ORDER BY date DESC, created_at DESC`
  ).all();
  return json({
    items: results.map(r => ({
      ...itemOut(r, can(user, 'items:private') && inScope(user, r.collection)),
      reportedByMe: r.reported_by === user.id,
    })),
  });
});

route('POST', '/api/items', async ({ req, env, user }) => {
  if (!can(user, 'items:report')) fail(403, 'Your role cannot report items.');
  const b = await readBody(req);
  const image = typeof b.image === 'string' ? b.image : '';
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_IMAGE)
    fail(400, 'Please attach a photo under 1 MB.');
  // Desk roles always log into their own collection point.
  const collection = ['security', 'staff'].includes(user.role) ? user.collection_point : oneOf(b.collection, COLLECTION_POINTS, 'collection point');
  if (!collection) fail(403, 'Your account has no collection point assigned.');
  const date = str(b.date, 10, 10, 'Date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date(now() + 864e5).toISOString().slice(0, 10)) fail(400, 'Please enter a valid date.');
  const item = {
    id: randomId('FB-', 3),
    name: str(b.name, 2, 80, 'Name'),
    category: oneOf(b.category, CATEGORIES, 'category'),
    color: oneOf(b.color, COLORS, 'colour'),
    location: oneOf(b.location, LOCATIONS, 'location'),
    description: str(b.description, 5, 500, 'Description'),
    privateNote: str(b.privateNote, 3, 500, 'Staff-only detail'),
  };
  await env.DB.prepare(
    `INSERT INTO items (id, name, category, color, location, date, description, private_note, collection, image, reported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(item.id, item.name, item.category, item.color, item.location, date, item.description, item.privateNote, collection, image, user.id).run();
  await audit(env, user.id, 'item.report', item.id, collection);
  return json({ item: { id: item.id, collection } }, 201);
});

// Claims ------------------------------------------------------------
const CLAIM_SELECT = `SELECT c.*, i.name AS item_name, i.collection, i.image, i.illus_type, i.paint, i.accent,
  i.private_note, i.status AS item_status FROM claims c JOIN items i ON i.id = c.item_id`;

function claimOut(r, user, view) {
  const base = {
    id: r.id, itemId: r.item_id, status: r.status, createdAt: r.created_at,
    item: { name: r.item_name, collection: r.collection, image: r.image || null, type: r.illus_type, paint: r.paint, accent: r.accent },
  };
  if (view === 'mine') return { ...base, pickupCode: r.status === 'approved' ? r.pickup_code : null };
  // Desk view: everyone with desk access sees who claimed it;
  // only reviewers in scope see the evidence and the staff-only record.
  const reviewer = can(user, 'claims:review') && inScope(user, r.collection);
  return {
    ...base, claimantName: r.claimant_name, isMine: r.user_id === user.id,
    ...(reviewer ? { proof: r.proof, lastSeen: r.last_seen, privateNote: r.private_note } : {}),
  };
}

route('GET', '/api/claims', async ({ env, user, url }) => {
  const scope = url.searchParams.get('scope') || 'mine';
  if (scope === 'mine') {
    const { results } = await env.DB.prepare(CLAIM_SELECT + ' WHERE c.user_id = ? ORDER BY c.created_at DESC').bind(user.id).all();
    return json({ claims: results.map(r => claimOut(r, user, 'mine')) });
  }
  if (scope === 'desk') {
    if (!can(user, 'claims:desk')) fail(403, 'Your role has no collection desk.');
    const stmt = user.role === 'admin'
      ? env.DB.prepare(CLAIM_SELECT + ' ORDER BY c.created_at DESC LIMIT 200')
      : env.DB.prepare(CLAIM_SELECT + ' WHERE i.collection = ? ORDER BY c.created_at DESC LIMIT 200').bind(user.collection_point);
    const { results } = await stmt.all();
    return json({ claims: results.map(r => claimOut(r, user, 'desk')) });
  }
  fail(400, 'Unknown scope.');
});

route('POST', '/api/claims', async ({ req, env, user }) => {
  if (!can(user, 'claims:create')) fail(403, 'Your role cannot submit claims.');
  const b = await readBody(req);
  const itemId = str(b.itemId, 3, 20, 'Item');
  const proof = str(b.proof, 8, 600, 'Identifying detail');
  const lastSeen = str(b.lastSeen, 3, 200, 'Last seen');
  const item = await env.DB.prepare('SELECT id, status, reported_by FROM items WHERE id = ?').bind(itemId).first();
  if (!item || item.status !== 'available') fail(409, 'This item is no longer available.');
  if (item.reported_by === user.id) fail(409, 'You reported this item, so you cannot claim it.');
  const dup = await env.DB.prepare(`SELECT 1 FROM claims WHERE item_id = ? AND user_id = ? AND status != 'rejected'`).bind(itemId, user.id).first();
  if (dup) fail(409, 'You already have a claim for this item. Check My claims.');
  const id = randomId('CL-', 3);
  await env.DB.prepare('INSERT INTO claims (id, item_id, user_id, claimant_name, proof, last_seen) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, itemId, user.id, user.name, proof, lastSeen).run();
  await audit(env, user.id, 'claim.create', id, itemId);
  return json({ claim: { id } }, 201);
});

async function loadClaimForDesk(env, id) {
  const c = await env.DB.prepare(CLAIM_SELECT + ' WHERE c.id = ?').bind(id).first();
  if (!c) fail(404, 'Claim not found.');
  return c;
}

route('POST', '/api/claims/:id/decision', async ({ req, env, user, params }) => {
  if (!can(user, 'claims:review')) fail(403, 'Your role cannot approve or reject claims.');
  const c = await loadClaimForDesk(env, params.id);
  if (!inScope(user, c.collection)) fail(403, 'This claim belongs to another collection point.');
  if (c.user_id === user.id) fail(403, 'You cannot review your own claim.');
  if (c.status !== 'pending') fail(409, 'This claim has already been reviewed.');
  const { decision } = await readBody(req);
  oneOf(decision, ['approved', 'rejected'], 'decision');
  if (decision === 'approved') {
    const other = await env.DB.prepare(`SELECT 1 FROM claims WHERE item_id = ? AND id != ? AND status IN ('approved','collected')`).bind(c.item_id, c.id).first();
    if (other) fail(409, 'This item already has an approved claim.');
  }
  const code = decision === 'approved' ? pickupCode() : null;
  const res = await env.DB.prepare(
    `UPDATE claims SET status = ?, pickup_code = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'pending'`
  ).bind(decision, code, user.id, c.id).run();
  if (!res.meta.changes) fail(409, 'This claim has already been reviewed.');
  await audit(env, user.id, 'claim.' + (decision === 'approved' ? 'approve' : 'reject'), c.id, c.item_id);
  return json({ ok: true });
});

route('POST', '/api/claims/:id/handover', async ({ req, env, user, params }) => {
  if (!can(user, 'claims:handover')) fail(403, 'Your role cannot hand over items.');
  const c = await loadClaimForDesk(env, params.id);
  if (!inScope(user, c.collection)) fail(403, 'This item is held at another collection point.');
  if (c.status !== 'approved') fail(409, 'Only approved claims can be handed over.');
  if (c.user_id === user.id) fail(403, 'Another team member must hand over your own claim.');
  const { code } = await readBody(req);
  if (typeof code !== 'string' || !safeEqual(code.trim(), c.pickup_code || '')) {
    await audit(env, user.id, 'claim.handover_failed', c.id, 'wrong pickup code');
    fail(400, 'Pickup code does not match. Ask the owner to check My claims.');
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE claims SET status = 'collected', handed_by = ?, handed_at = datetime('now') WHERE id = ?`).bind(user.id, c.id),
    env.DB.prepare(`UPDATE items SET status = 'collected' WHERE id = ?`).bind(c.item_id),
    env.DB.prepare(`UPDATE claims SET status = 'rejected', reviewed_at = datetime('now') WHERE item_id = ? AND id != ? AND status IN ('pending','approved')`).bind(c.item_id, c.id),
  ]);
  await audit(env, user.id, 'claim.handover', c.id, c.item_id);
  return json({ ok: true, claimantName: c.claimant_name, itemName: c.item_name });
});

// Smart search (Cloudflare Workers AI) -------------------------------
// Photo → a vision model describes the item → an embedding model compares that
// description (plus any typed words) with every available item's text.
const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const EMBED_MODEL = '@cf/baai/bge-m3';
const PHOTO_SEARCHES_PER_HOUR = 30;

async function describePhoto(env, image) {
  const input = {
    messages: [
      { role: 'system', content: 'You describe photos of lost items for a lost-and-found search. Reply with one short sentence only.' },
      { role: 'user', content: 'Describe the main object: what it is, its main colour, and any distinctive marks, stickers or text. No preamble.' },
    ],
    image,
    max_tokens: 60,
  };
  try {
    return await env.AI.run(VISION_MODEL, input);
  } catch (e) {
    // Meta's licence must be accepted once per Cloudflare account before first use.
    if (!/agree|licen[cs]e/i.test(String(e?.message || e))) throw e;
    await env.AI.run(VISION_MODEL, { prompt: 'agree' });
    return env.AI.run(VISION_MODEL, input);
  }
}
async function embed(env, texts) {
  const out = await env.AI.run(EMBED_MODEL, { text: texts });
  const vectors = out?.data || out?.response;
  if (!Array.isArray(vectors) || vectors.length !== texts.length) throw new Error('Unexpected embedding output');
  return vectors;
}
function cosine(a, b) {
  let n = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { n += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return n / (Math.sqrt(aa * bb) || 1);
}

route('POST', '/api/search', async ({ req, env, user }) => {
  if (!env.AI) fail(503, 'Smart search is not set up on this server.');
  const b = await readBody(req);
  const query = typeof b.query === 'string' ? b.query.trim().slice(0, 300) : '';
  const image = typeof b.image === 'string' && b.image ? b.image : null;
  if (image && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_IMAGE)) fail(400, 'Please use a photo under 1 MB.');
  if (!query && !image) fail(400, 'Describe the item or add a photo.');

  let caption = null;
  if (image) {
    const used = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'search.photo' AND user_id = ? AND at > datetime('now', '-1 hour')`
    ).bind(user.id).first();
    if (used.n >= PHOTO_SEARCHES_PER_HOUR) fail(429, 'Photo search limit reached for this hour. Describe the item in words instead.');
    await audit(env, user.id, 'search.photo');
    try {
      const r = await describePhoto(env, image);
      caption = String(r?.response || r?.description || '').replace(/\s+/g, ' ').trim().slice(0, 300) || null;
    } catch (e) {
      console.error('vision failed', e);
      fail(502, 'The AI could not read this photo right now.');
    }
  }

  const { results: items } = await env.DB.prepare(
    `SELECT id, name, category, color, description FROM items WHERE status = 'available'`
  ).all();
  const text = [query, caption].filter(Boolean).join('. ');
  if (!items.length || !text) return json({ caption, scores: [] });
  let vectors;
  try {
    vectors = await embed(env, [text, ...items.map(i => `${i.name}. ${i.category}. ${i.color}. ${i.description}`)]);
  } catch (e) {
    console.error('embedding failed', e);
    fail(502, 'Smart matching is unavailable right now.');
  }
  return json({ caption, scores: items.map((i, k) => ({ id: i.id, score: cosine(vectors[0], vectors[k + 1]) })) });
});

// Administration -----------------------------------------------------
const requireAdmin = user => { if (user.role !== 'admin') fail(403, 'Township admins only.'); };

route('GET', '/api/admin/users', async ({ env, user }) => {
  requireAdmin(user);
  const { results } = await env.DB.prepare(
    'SELECT id, email, name, role, collection_point, active, created_at FROM users ORDER BY role, name'
  ).all();
  return json({ users: results.map(u => ({ ...publicUser(u), active: !!u.active, createdAt: u.created_at })) });
});

route('PATCH', '/api/admin/users/:id', async ({ req, env, user, params }) => {
  requireAdmin(user);
  const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first();
  if (!target) fail(404, 'User not found.');
  const b = await readBody(req);
  const role = oneOf(b.role, ROLES, 'role');
  const active = b.active !== false;
  let point = b.collectionPoint || null;
  if (['security', 'staff'].includes(role)) oneOf(point, COLLECTION_POINTS, 'collection point');
  else point = null;
  if (target.id === user.id && (role !== 'admin' || !active)) fail(400, 'You cannot remove your own admin access.');
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET role = ?, collection_point = ?, active = ? WHERE id = ?').bind(role, point, active ? 1 : 0, target.id),
    // Sign the user out everywhere so the new permissions apply immediately.
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id),
  ]);
  await audit(env, user.id, 'user.update', target.id, `${target.role}→${role}${point ? ' @ ' + point : ''}${active ? '' : ' (deactivated)'}`);
  return json({ ok: true });
});

route('GET', '/api/admin/audit', async ({ env, user }) => {
  requireAdmin(user);
  const { results } = await env.DB.prepare(
    `SELECT a.at, a.action, a.target, a.detail, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 100`
  ).all();
  return json({ entries: results });
});

// ---------- Entry point ----------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      // CSRF defence: state-changing requests must come from this site.
      if (!['GET', 'HEAD'].includes(req.method)) {
        const origin = req.headers.get('Origin');
        if (origin && origin !== url.origin) fail(403, 'Cross-site request blocked.');
        if (!(req.headers.get('Content-Type') || '').includes('application/json') && req.method !== 'POST')
          fail(415, 'Expected JSON.');
      }
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.re);
        if (!m) continue;
        const user = await currentUser(req, env);
        if (r.auth && !user) fail(401, 'Please sign in.');
        return await r.handler({ req, env, url, user, params: m.groups || {} });
      }
      fail(404, 'Not found.');
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Server error. Please try again.' }, 500);
    }
  },
};

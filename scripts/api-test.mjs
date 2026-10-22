// End-to-end API test against a running `wrangler dev`.  node scripts/api-test.mjs [baseUrl] [demoPassword]
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = process.argv[3] || 'FindBack-Demo-2026';
let pass = 0, failN = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : failN++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); };

function client() {
  let cookie = '';
  return async (method, path, body, headers = {}) => {
    const r = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), Origin: BASE, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    let data = null; try { data = await r.json(); } catch {}
    return { status: r.status, data, setCookie: sc };
  };
}
const login = async email => { const c = client(); const r = await c('POST', '/api/auth/login', { email, password: PW }); return [c, r]; };
const JPEG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes-for-test').toString('base64');

// --- anonymous
const anon = client();
check('anonymous cannot list items', (await anon('GET', '/api/items')).status === 401);
const cfg = await anon('GET', '/api/config');
check('config is public and lists demo accounts', cfg.status === 200 && cfg.data.demoAccounts.length === 5);
check('static index still served', (await fetch(BASE + '/')).status === 200);

// --- login
const bad = await client()('POST', '/api/auth/login', { email: 'resident@findback.demo', password: 'wrong-password' });
check('wrong password rejected', bad.status === 401);
const [res, r1] = await login('resident@findback.demo');
check('resident login', r1.status === 200 && r1.data.user.role === 'resident', JSON.stringify(r1.data));
check('session cookie is HttpOnly + Secure + SameSite', /HttpOnly/.test(r1.setCookie) && /Secure/.test(r1.setCookie) && /SameSite=Lax/.test(r1.setCookie));

// --- items + privacy
const items = await res('GET', '/api/items');
check('resident sees 12 items', items.data.items.length === 12, items.data?.items?.length);
check('resident never receives private notes', items.data.items.every(i => !('privateNote' in i)));
const [stp] = await login('staff.centralpark@findback.demo');
const sItems = (await stp('GET', '/api/items')).data.items;
check('staff sees private notes only for own collection point',
  sItems.filter(i => i.privateNote).every(i => i.collection === 'Central Park security desk') && sItems.some(i => i.privateNote));

// --- CSRF
const csrf = await res('POST', '/api/claims', { itemId: 'FB-001', proof: 'Initials AK underneath', lastSeen: 'Central Park' }, { Origin: 'https://evil.example' });
check('cross-site POST blocked', csrf.status === 403);

// --- claim flow
const cl = await res('POST', '/api/claims', { itemId: 'FB-001', proof: 'Initials AK underneath and a dent', lastSeen: 'Central Park, Sunday' });
check('resident creates claim', cl.status === 201, JSON.stringify(cl.data));
const claimId = cl.data?.claim?.id;
check('duplicate claim blocked', (await res('POST', '/api/claims', { itemId: 'FB-001', proof: 'again again again', lastSeen: 'x x x' })).status === 409);
check('resident has no desk access', (await res('GET', '/api/claims?scope=desk')).status === 403);
check('resident cannot approve', (await res('POST', `/api/claims/${claimId}/decision`, { decision: 'approved' })).status === 403);

const [sec] = await login('security@findback.demo');
const secDesk = await sec('GET', '/api/claims?scope=desk');
const secView = secDesk.data.claims.find(c => c.id === claimId);
check('security sees claim at own desk', !!secView);
check('security does NOT see proof or private note', secView && !('proof' in secView) && !('privateNote' in secView));
check('security cannot approve', (await sec('POST', `/api/claims/${claimId}/decision`, { decision: 'approved' })).status === 403);

const [stc] = await login('staff.clubhouse@findback.demo');
check('clubhouse staff cannot see Central Park claim', !(await stc('GET', '/api/claims?scope=desk')).data.claims.some(c => c.id === claimId));
check('clubhouse staff cannot approve out-of-scope claim', (await stc('POST', `/api/claims/${claimId}/decision`, { decision: 'approved' })).status === 403);

const stView = (await stp('GET', '/api/claims?scope=desk')).data.claims.find(c => c.id === claimId);
check('in-scope staff sees proof + private note', stView && stView.proof && stView.privateNote);
check('staff never sees pickup code', stView && !('pickupCode' in stView));
const appr = await stp('POST', `/api/claims/${claimId}/decision`, { decision: 'approved' });
check('in-scope staff approves', appr.status === 200, JSON.stringify(appr.data));
check('cannot review twice', (await stp('POST', `/api/claims/${claimId}/decision`, { decision: 'rejected' })).status === 409);

const mine = (await res('GET', '/api/claims?scope=mine')).data.claims.find(c => c.id === claimId);
check('claimant gets 6-digit pickup code', /^\d{6}$/.test(mine?.pickupCode || ''), JSON.stringify(mine));
check('claimant view hides proof & private note', mine && !('privateNote' in mine));

check('handover with wrong code rejected', (await sec('POST', `/api/claims/${claimId}/handover`, { code: '000000' === mine.pickupCode ? '111111' : '000000' })).status === 400);
check('clubhouse staff cannot hand over Central Park item', (await stc('POST', `/api/claims/${claimId}/handover`, { code: mine.pickupCode })).status === 403);
const ho = await sec('POST', `/api/claims/${claimId}/handover`, { code: mine.pickupCode });
check('security hands over with correct code', ho.status === 200, JSON.stringify(ho.data));
check('collected item leaves public list', !(await res('GET', '/api/items')).data.items.some(i => i.id === 'FB-001'));

// --- reporting
const rep = await res('POST', '/api/items', { image: JPEG, name: 'Red cap', category: 'Other', color: 'Red', location: 'Clubhouse', date: '2026-10-20', description: 'Red baseball cap by the pool', privateNote: 'Name tag inside', collection: 'Clubhouse reception' });
check('resident reports item', rep.status === 201, JSON.stringify(rep.data));
check('reporter cannot claim own report', (await res('POST', '/api/claims', { itemId: rep.data.item.id, proof: 'Name tag inside it', lastSeen: 'pool area' })).status === 409);
const secRep = await sec('POST', '/api/items', { image: JPEG, name: 'Blue scarf', category: 'Other', color: 'Blue', location: 'Central Park', date: '2026-10-20', description: 'Blue scarf near the lake', privateNote: 'Burn mark on edge', collection: 'Clubhouse reception' });
check('security report is forced to own desk', secRep.data?.item?.collection === 'Central Park security desk', JSON.stringify(secRep.data));
check('non-JPEG image rejected', (await res('POST', '/api/items', { image: 'data:text/html;base64,PHNjcmlwdD4=', name: 'x x', category: 'Other', color: 'Red', location: 'Clubhouse', date: '2026-10-20', description: 'xxxxxx', privateNote: 'xxx', collection: 'Clubhouse reception' })).status === 400);

// --- admin
check('non-admin blocked from user list', (await stp('GET', '/api/admin/users')).status === 403);
const [adm] = await login('admin@findback.demo');
const users = await adm('GET', '/api/admin/users');
check('admin lists users without password hashes', users.status === 200 && !JSON.stringify(users.data).includes('pbkdf2'));
const resId = users.data.users.find(u => u.email === 'resident@findback.demo').id;
check('staff role requires collection point', (await adm('PATCH', `/api/admin/users/${resId}`, { role: 'staff', active: true })).status === 400);
check('admin promotes resident to clubhouse staff', (await adm('PATCH', `/api/admin/users/${resId}`, { role: 'staff', collectionPoint: 'Clubhouse reception', active: true })).status === 200);
check('role change signs the user out', (await res('GET', '/api/auth/me')).status === 401);
const adminId = users.data.users.find(u => u.email === 'admin@findback.demo').id;
check('admin cannot demote self', (await adm('PATCH', `/api/admin/users/${adminId}`, { role: 'resident', active: true })).status === 400);
await adm('PATCH', `/api/admin/users/${resId}`, { role: 'resident', active: true });
const audit = await adm('GET', '/api/admin/audit');
check('audit log records handover + role change', ['claim.handover', 'user.update', 'claim.approve'].every(a => audit.data.entries.some(e => e.action === a)));

// --- registration + logout + rate limit
const nu = client();
const email = `tester${Date.now()}@example.com`;
const reg = await nu('POST', '/api/auth/register', { name: 'New Resident', email, password: 'a-long-password' });
check('self-registration creates resident', reg.status === 201 && reg.data.user.role === 'resident');
check('short password rejected', (await client()('POST', '/api/auth/register', { name: 'X Y', email: 'b' + email, password: 'short' })).status === 400);
check('duplicate email rejected', (await client()('POST', '/api/auth/register', { name: 'X Y', email, password: 'a-long-password' })).status === 409);
await nu('POST', '/api/auth/logout');
check('logout ends session', (await nu('GET', '/api/auth/me')).status === 401);
let last;
for (let i = 0; i < 6; i++) last = await client()('POST', '/api/auth/login', { email, password: 'nope-nope-nope' });
check('login rate-limited after 5 failures', last.status === 429, last.status);

console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);

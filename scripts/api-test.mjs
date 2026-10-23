// End-to-end API test against a running `wrangler dev`.  node scripts/api-test.mjs [baseUrl] [demoPassword]
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = process.argv[3] || 'FindBack-Demo-2026';
const OPERATOR_PW = process.env.FINDBACK_OPERATOR_PASSWORD;
if (!OPERATOR_PW) throw Error('Set FINDBACK_OPERATOR_PASSWORD to the agreed demo password before running this test.');
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
const login = async (identifier, password = PW) => { const c = client(); const field = identifier.includes('@') ? 'email' : 'username'; const r = await c('POST', '/api/auth/login', { [field]: identifier, password }); return [c, r]; };
const suffix = Date.now();
const JPEG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes-for-test').toString('base64');

// --- anonymous
const anon = client();
check('anonymous cannot list items', (await anon('GET', '/api/items')).status === 401);
const cfg = await anon('GET', '/api/config');
check('config is public without staff password', cfg.status === 200 && !JSON.stringify(cfg.data).includes(OPERATOR_PW));
check('static index still served', (await fetch(BASE + '/')).status === 200);

// --- login
const bad = await client()('POST', '/api/auth/login', { username: 'findback_admni', password: 'wrong-password' });
check('wrong password rejected', bad.status === 401);
check('old demo resident is deactivated', (await login('resident@findback.demo'))[1].status === 401);
const [adm, adminLogin] = await login('findback_admni', OPERATOR_PW);
check('single operator signs in by username', adminLogin.status === 200 && adminLogin.data.user.role === 'admin');
check('operator has no resident claim history', (await adm('GET', '/api/claims?scope=mine')).status === 403);
const residentEmail = `resident-${suffix}@example.com`;
const res = client();
const r1 = await res('POST', '/api/auth/register', { name: 'Test Resident', email: residentEmail, password: PW });
check('resident registration signs them in', r1.status === 201 && r1.data.user.role === 'resident', JSON.stringify(r1.data));
check('session cookie is HttpOnly + Secure + SameSite', /HttpOnly/.test(r1.setCookie) && /Secure/.test(r1.setCookie) && /SameSite=Lax/.test(r1.setCookie));
async function roleClient(role, point, name) {
  const email = `${role}-${name}-${suffix}@example.com`;
  const signup = await client()('POST', '/api/auth/register', { name, email, password: PW });
  if (signup.status !== 201) throw Error(`Could not create ${role} test fixture: ${signup.status}`);
  const change = await adm('PATCH', `/api/admin/users/${signup.data.user.id}`, { role, collectionPoint: point, active: true });
  if (change.status !== 200) throw Error(`Could not assign ${role} test fixture: ${change.status}`);
  return (await login(email))[0];
}

// --- items + privacy
const items = await res('GET', '/api/items');
check('resident sees 7 photo scenarios', items.data.items.length === 7, items.data?.items?.length);
check('resident never receives private notes', items.data.items.every(i => !('privateNote' in i)));
const stp = await roleClient('staff', 'Elmina Rainforest Knowledge Centre (ERKC)', 'Reviewer');
const sItems = (await stp('GET', '/api/items')).data.items;
check('staff sees private notes only for own collection point',
  sItems.filter(i => i.privateNote).every(i => i.collection === 'Elmina Rainforest Knowledge Centre (ERKC)') && sItems.some(i => i.privateNote));

// --- CSRF
const csrf = await res('POST', '/api/claims', { itemId: 'FB-ELM-001', proof: 'A small scrape under the base', lastSeen: 'Elmina Central Park' }, { Origin: 'https://evil.example' });
check('cross-site POST blocked', csrf.status === 403);

// --- claim flow
const cl = await res('POST', '/api/claims', { itemId: 'FB-ELM-001', proof: 'A small scrape underneath the base', lastSeen: 'Elmina Central Park, Sunday' });
check('resident creates claim', cl.status === 201, JSON.stringify(cl.data));
const claimId = cl.data?.claim?.id;
check('duplicate claim blocked', (await res('POST', '/api/claims', { itemId: 'FB-ELM-001', proof: 'again again again', lastSeen: 'x x x' })).status === 409);
check('resident has no desk access', (await res('GET', '/api/claims?scope=desk')).status === 403);
check('resident cannot approve', (await res('POST', `/api/claims/${claimId}/decision`, { decision: 'approved' })).status === 403);

const sec = await roleClient('security', 'Elmina Rainforest Knowledge Centre (ERKC)', 'Receiver');
const secDesk = await sec('GET', '/api/claims?scope=desk');
const secView = secDesk.data.claims.find(c => c.id === claimId);
check('security sees claim at own desk', !!secView);
check('security does NOT see proof or private note', secView && !('proof' in secView) && !('privateNote' in secView));
check('security cannot approve', (await sec('POST', `/api/claims/${claimId}/decision`, { decision: 'approved' })).status === 403);
check('security cannot submit a resident claim', (await sec('POST', '/api/claims', { itemId: 'FB-ELM-002', proof: 'Distinct private mark', lastSeen: 'Elmina Green Seven' })).status === 403);

const stc = await roleClient('staff', 'Elmina Green 7 Management Office', 'OtherReviewer');
check('Elmina Green 7 staff cannot see Elmina Central Park claim', !(await stc('GET', '/api/claims?scope=desk')).data.claims.some(c => c.id === claimId));
check('Elmina Green 7 staff cannot approve out-of-scope claim', (await stc('POST', `/api/claims/${claimId}/decision`, { decision: 'approved' })).status === 403);

const stView = (await stp('GET', '/api/claims?scope=desk')).data.claims.find(c => c.id === claimId);
check('in-scope staff sees proof + private note', stView && stView.proof && stView.privateNote);
check('staff never sees pickup code', stView && !('pickupCode' in stView));
const appr = await stp('POST', `/api/claims/${claimId}/decision`, { decision: 'approved', reason: 'Private detail matches the physical item', verified: true });
check('in-scope staff approves', appr.status === 200, JSON.stringify(appr.data));
check('cannot review twice', (await stp('POST', `/api/claims/${claimId}/decision`, { decision: 'rejected' })).status === 409);

const mine = (await res('GET', '/api/claims?scope=mine')).data.claims.find(c => c.id === claimId);
check('claimant gets 6-digit pickup code', /^\d{6}$/.test(mine?.pickupCode || ''), JSON.stringify(mine));
check('claimant view hides proof & private note', mine && !('privateNote' in mine));

check('security cannot hand over an item', (await sec('POST', `/api/claims/${claimId}/handover`, { code: mine.pickupCode, confirmedOwnerDetail: true })).status === 403);
check('handover with wrong code rejected', (await stp('POST', `/api/claims/${claimId}/handover`, { code: '000000' === mine.pickupCode ? '111111' : '000000', confirmedOwnerDetail: true })).status === 400);
check('Elmina Green 7 staff cannot hand over Elmina Central Park item', (await stc('POST', `/api/claims/${claimId}/handover`, { code: mine.pickupCode })).status === 403);
const ho = await stp('POST', `/api/claims/${claimId}/handover`, { code: mine.pickupCode, confirmedOwnerDetail: true });
check('collection-point staff hands over with correct code', ho.status === 200, JSON.stringify(ho.data));
check('collected item leaves public list', !(await res('GET', '/api/items')).data.items.some(i => i.id === 'FB-ELM-001'));

// --- reporting
const rep = await res('POST', '/api/items', { image: JPEG, name: 'Red cap', category: 'Other', color: 'Red', location: 'Elmina Green Seven', date: '2026-10-20', description: 'Red baseball cap by the pool', privateNote: 'Name tag inside', collection: 'Elmina Green 7 Management Office' });
check('resident reports item', rep.status === 201, JSON.stringify(rep.data));
check('operator cannot submit resident found-item reports', (await adm('POST', '/api/items', { image: JPEG })).status === 403);
check('new report awaits physical receipt', rep.data?.item?.status === 'reported');
check('reporter can track pending report', (await res('GET', '/api/items')).data.items.some(i => i.id === rep.data.item.id && i.status === 'reported'));
check('reporter cannot claim own report', (await res('POST', '/api/claims', { itemId: rep.data.item.id, proof: 'Name tag inside it', lastSeen: 'pool area' })).status === 409);
check('other desk cannot confirm receipt', (await stp('POST', `/api/items/${rep.data.item.id}/intake`)).status === 403);
check('assigned desk confirms physical receipt', (await stc('POST', `/api/items/${rep.data.item.id}/intake`)).status === 200);
check('received report is now available', (await res('GET', '/api/items')).data.items.some(i => i.id === rep.data.item.id && i.status === 'available'));
// Continue this exact newly reported item through claim, review and handover.
const secondOwner = client();
const secondSignup = await secondOwner('POST', '/api/auth/register', { name: 'Item Owner', email: `owner-${suffix}@example.com`, password: PW });
check('another resident registers to claim the received report', secondSignup.status === 201);
const reportClaim = await secondOwner('POST', '/api/claims', { itemId: rep.data.item.id, proof: 'A handwritten name tag stitched inside the cap', lastSeen: 'Elmina Green Seven pool, yesterday' });
check('received report can be claimed', reportClaim.status === 201, JSON.stringify(reportClaim.data));
const reportClaimId = reportClaim.data?.claim?.id;
check('operator records ownership review and reserves reported item', (await adm('POST', `/api/claims/${reportClaimId}/decision`, { decision: 'approved', reason: 'Name tag matches the physical cap', verified: true })).status === 200);
check('reserved report disappears from resident item list', !(await secondOwner('GET', '/api/items')).data.items.some(i => i.id === rep.data.item.id));
const reportCode = (await secondOwner('GET', '/api/claims?scope=mine')).data.claims.find(c => c.id === reportClaimId)?.pickupCode;
check('owner receives pickup code for the reported item', /^\d{6}$/.test(reportCode || ''));
check('operator hands reported item over after second check', (await adm('POST', `/api/claims/${reportClaimId}/handover`, { code: reportCode, confirmedOwnerDetail: true })).status === 200);
check('owner sees reported item as collected', (await secondOwner('GET', '/api/claims?scope=mine')).data.claims.find(c => c.id === reportClaimId)?.status === 'collected');
const secRep = await sec('POST', '/api/items', { image: JPEG, name: 'Blue scarf', category: 'Other', color: 'Blue', location: 'Elmina Central Park', date: '2026-10-20', description: 'Blue scarf near the lake', privateNote: 'Burn mark on edge', collection: 'Elmina Green 7 Management Office' });
check('security report is forced to own desk', secRep.data?.item?.collection === 'Elmina Rainforest Knowledge Centre (ERKC)', JSON.stringify(secRep.data));
check('non-JPEG image rejected', (await res('POST', '/api/items', { image: 'data:text/html;base64,PHNjcmlwdD4=', name: 'x x', category: 'Other', color: 'Red', location: 'Elmina Green Seven', date: '2026-10-20', description: 'xxxxxx', privateNote: 'xxx', collection: 'Elmina Green 7 Management Office' })).status === 400);

// --- admin
check('non-admin blocked from user list', (await stp('GET', '/api/admin/users')).status === 403);
const users = await adm('GET', '/api/admin/users');
check('admin lists users without password hashes', users.status === 200 && !JSON.stringify(users.data).includes('pbkdf2'));
const resId = users.data.users.find(u => u.email === residentEmail).id;
check('staff role requires collection point', (await adm('PATCH', `/api/admin/users/${resId}`, { role: 'staff', active: true })).status === 400);
check('admin promotes resident to Elmina Green 7 staff', (await adm('PATCH', `/api/admin/users/${resId}`, { role: 'staff', collectionPoint: 'Elmina Green 7 Management Office', active: true })).status === 200);
check('role change signs the user out', (await res('GET', '/api/auth/me')).status === 401);
const adminId = users.data.users.find(u => u.email === 'findback_admni@findback.demo').id;
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

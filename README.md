# FindBack — accounts, role-based access and database

FindBack now runs as one Cloudflare Worker:

- **`public/`** — the phone app (same design as before) served as static files.
- **`src/worker.js`** — the `/api` backend: sign-in, sessions, access rules, items, claims, admin.
- **`migrations/`** — the Cloudflare **D1** (SQLite) database schema and sample data.

## Roles and what they can do

| Permission | Resident | Security desk | Collection-point staff | Township admin |
|---|:-:|:-:|:-:|:-:|
| Browse and search found items | ✓ | ✓ | ✓ | ✓ |
| Report a found item | ✓ (chooses point) | ✓ (own desk only) | ✓ (own point only) | ✓ |
| Claim an item and track own claims | ✓ | ✓ | ✓ | ✓ |
| See claims at a collection desk | — | own desk | own point | all |
| Read ownership evidence and staff-only notes | — | — | own point | all |
| Approve / reject claims | — | — | own point | all |
| Hand over an item (needs owner's pickup code) | — | own desk | own point | all |
| Manage users, roles and collection points | — | — | — | ✓ |
| View the audit log | — | — | — | ✓ |

Extra rules the server enforces:

- Nobody can review or hand over **their own** claim.
- You can't claim an item **you reported**.
- An approved claim gets a **pickup QR code and 6-digit code** that only the claimant sees (My claims, plus a "ready to collect" banner on Home). The desk taps **Scan pickup QR**, checks the person, and confirms. Typing the 6-digit code works if the camera is unavailable. The QR holds `FINDBACK:<claim id>:<code>`, and the server re-checks the code, the role and the collection point before releasing anything. A used QR is refused.
- Changing someone's role signs them out everywhere, so the new permissions apply immediately. An admin can't remove their own admin access.

The rules are defined once in `PERMISSIONS` at the top of `src/worker.js`. The app hides buttons that a role can't use, but **the server is what enforces the rules**.

## Security measures

- Passwords hashed with PBKDF2-SHA256 (100,000 iterations, random salt).
- Session token in an `HttpOnly; Secure; SameSite=Lax` cookie. Only its SHA-256 hash is stored, and it expires after 7 days.
- Cross-site POST requests are rejected (Origin check).
- After 5 failed logins, an email is locked out for 15 minutes.
- Residents never receive staff-only notes. Security never receives claim evidence. Nobody but the claimant receives the pickup code.
- Every sign-in, report, claim, decision, handover and role change is written to the audit log.

## Demo accounts

All five use the password **`FindBack-Demo-2026`**, and the sign-in screen has a button for each.

| Email | Role |
|---|---|
| resident@findback.demo | Resident |
| security@findback.demo | Security desk · Central Park security desk |
| staff.centralpark@findback.demo | Staff · Central Park security desk |
| staff.clubhouse@findback.demo | Staff · Clubhouse reception |
| admin@findback.demo | Township admin |

**Demo story (about 2 minutes):**
1. **Resident:** search "black bottle, red sticker", then claim FB-001.
2. **Staff · Central Park:** approve the claim.
3. **Resident:** Home now says the item is ready; tap it to show the pickup QR.
4. **Security · Central Park:** tap **Scan pickup QR** and scan the resident's screen (or type the code), then confirm.
5. **Admin:** show the audit log.

---

## Smart search (Cloudflare Workers AI)

Search no longer downloads AI models into the phone. `POST /api/search` runs on Cloudflare:

- **Photo:** `@cf/meta/llama-3.2-11b-vision-instruct` describes the item in one sentence (the app shows "AI sees: …"). Meta's licence is accepted automatically on first use.
- **Meaning:** `@cf/baai/bge-m3` compares the typed words and/or that description with every available item.
- The app combines this with word matching. If the AI is unavailable, word matching still works and the screen says so.
- Limit: 30 photo searches per user per hour. Workers AI free tier: 10,000 neurons per day.
- Needs the `[ai] binding = "AI"` block in `wrangler.toml`.
- Test without Cloudflare: `node scripts/search-test.mjs` (fake AI + real SQLite, Node 22+).

## Deploy (Wrangler, about 10 minutes)

You need Node.js 18+ and access to **the Cloudflare account that owns `findback.khaliesahkhafizalfahmi.workers.dev`**. Run these in this folder:

```bash
npm install
npx wrangler login                          # opens a browser: sign in to that Cloudflare account
npx wrangler d1 create findback-db          # prints a database_id
```

1. Paste the `database_id` into `wrangler.toml`, replacing `REPLACE_WITH_DATABASE_ID`.
2. Copy your existing **`icons/`** folder into `public/icons/`. If you downloaded the MiniLM model files, copy `models/` into `public/models/` too.
3. Create the tables and sample data, then deploy:

```bash
npx wrangler d1 migrations apply findback-db --remote
npx wrangler deploy
```

The Worker is named `findback`, so it replaces the current site at the same URL.

**Check it worked:** open the site, tap **Start**, tap **Resident** and sign in. On phones that already have the old version installed, reopen the app twice; the service worker cache was bumped to `v5`.

### Before sharing the link widely

- In `wrangler.toml`, set `DEMO_MODE = "false"`. This hides the demo buttons and password, which give anyone **admin access** to the public URL. Then run `npx wrangler deploy` again.
- To use a different demo password, run `node scripts/build-seed.mjs "your-new-password"` **before** the first `migrations apply`.

### If sign-in shows "Error 1102" (CPU limit)

The Workers **Free** plan allows about 10 ms of CPU per request. A 100,000-iteration password hash can take longer than that. If it happens:

1. In `src/worker.js`, lower `PBKDF2_ITERATIONS` (for example to 20,000).
2. Regenerate the seed with `node scripts/build-seed.mjs "<password>"`, after changing the `100000` default in that script to match.
3. Delete and recreate the database, re-apply the migrations, and redeploy.

This is a weaker setting; state it as a known limitation in your report.

## Run locally

```bash
npx wrangler d1 migrations apply findback-db --local
npx wrangler dev                       # http://localhost:8787
node scripts/api-test.mjs              # 45 automated access-control checks (run against a fresh local DB)
```

## Known limitations (state these honestly)

- **QR scanning needs camera permission and HTTPS** (workers.dev is HTTPS). It was tested in Chrome with a simulated camera, not yet on a real iPhone. Rehearse once on the actual demo phone, and remember typing the code always works as a backup.
- **No push notifications.** The owner finds out their item is approved when they next open the app (Home banner).

- **Self-registration** has no email verification or proof of residency. A real township would verify residents against unit records, or set `ALLOW_REGISTRATION = "false"` and have the office create accounts.
- **No password reset or MFA.** For real staff accounts, single sign-on through the company identity provider would be the expected approach.
- **Photos are stored in the database** as compressed JPEG text. That's fine for a demo, but production would use object storage such as Cloudflare R2.
- **Login rate limiting is per email**, not per device or IP.
- Personal data (names, emails, claim evidence) is stored. A real deployment must follow Malaysia's Personal Data Protection Act; the specific obligations need verification with the organisation's data-protection officer.

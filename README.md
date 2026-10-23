hallo everybody
# FindBack — accounts, role-based access and database

FindBack now runs as one Cloudflare Worker:

- **`public/`** — the phone app (same design as before) served as static files.
- **`src/worker.js`** — the `/api` backend: sign-in, sessions, access rules, items, claims, admin.
- **`migrations/`** — versioned Cloudflare **D1** (SQLite) migrations. **`manual-migrations/`** holds console-paste copies for the already initialized live database; Wrangler must not scan these as new migrations.

The three collection desks in this prototype are proposals: Elmina Lakeside Mall Centre Management Office, Elmina Rainforest Knowledge Centre (ERKC), and Elmina Green 7 Management Office. Their use as lost-and-found counters has not been confirmed with the operators.

The seven photo-based Elmina item records use prototype scenarios and images in `public/images/items/`. The old illustrated records are retired if they have no pending or approved claim. Their reported locations now use named Elmina areas; these are approximate area labels, not exact spots where an item was found. The three collection desks are separate proposed handover destinations. `locationCatalog` and `collectionCatalog` in `public/data.js` record map search terms and source links. Exact counter locations remain to be verified; directions open the named facility only.

The resident home and collection desk (including the admin's desk view) show an interactive OpenStreetMap view. Green circles mark available items by reported area; dark pins mark proposed collection facilities. The item list remains available if map tiles cannot load. Approved claim cards link to facility directions. Coordinates represent broad public areas and facility vicinity, not the actual find spot or a confirmed collection counter. The Elmina Green Seven marker uses a broader Elmina Green area coordinate and needs an on-site check before operational use. Leaflet 1.9.4 loads from unpkg; map tiles load only while the map is viewed, with OpenStreetMap attribution.

New reports are stored with `intake_status = 'reported'`. Only the reporter and the assigned desk (or admin) can see them. A desk account confirms physical receipt, recording the staff user and time; then the item becomes visible in resident search and eligible for claims. Existing demo items default to `received` so the pitch story remains usable. This is a receipt confirmation, not yet a transfer chain between desks.

## Roles and what they can do

| Permission | Resident | Security desk | Collection-point staff | Township admin |
|---|:-:|:-:|:-:|:-:|
| Resident catalog and smart search | ✓ | — | — | — |
| Report a found item | ✓ (chooses point) | ✓ (own desk only) | ✓ (own point only) | — |
| Confirm physical receipt | — | own desk | own desk | all desks |
| Claim an item and track own claims | ✓ | — | — | — |
| See claims at a collection desk | — | own desk | own point | all |
| Read ownership evidence and staff-only notes | — | — | own point | all |
| Approve / reject claims | — | — | own point | all |
| Hand over an item (needs owner's pickup code) | — | — | own point | all |
| Manage users, roles and collection points | — | — | — | ✓ |
| View the audit log | — | — | — | ✓ |

Extra rules the server enforces:

- Nobody can review or hand over **their own** claim.
- You can't claim an item **you reported**.
- A reviewer records why they approved or rejected a claim. Approval requires checking the claimant's private evidence against the physical item, and reserves the item immediately. Other residents cannot see or claim it while reserved, and a competing pending claim cannot be approved. Staff can release a mistaken reservation with a recorded reason, which voids its pickup code.
- At handover, staff must check the claimant's identity and a private ownership detail again, then confirm that check along with the pickup code. The database records this second verification.
- An approved claim gets a **6-digit pickup code** in the database. The resident's My claims page renders a QR from the claim ID and code; the QR itself is not stored as an image. Only the claimant sees it. Collection-point staff or the admin scan it at the desk, check the person and private ownership detail, then confirm. Typing the code works if the camera is unavailable. The QR holds `FINDBACK:<claim id>:<code>`, and the server re-checks the code, the role and the collection point before releasing anything. A used QR is refused.
- Security desk staff receive found objects and can see claim status at their assigned desk. They cannot read ownership evidence, approve claims, or hand items over. Collection-point staff can review evidence and complete a verified handover at their assigned point. The township admin can do that across all three points and manage accounts.
- Changing someone's role signs them out everywhere, so the new permissions apply immediately. An admin can't remove their own admin access.

The rules are defined once in `PERMISSIONS` at the top of `src/worker.js`. The app hides buttons that a role can't use, but **the server is what enforces the rules**.

## Security measures

- Passwords hashed with PBKDF2-SHA256 (100,000 iterations, random salt).
- Session token in an `HttpOnly; Secure; SameSite=Lax` cookie. Only its SHA-256 hash is stored, and it expires after 7 days.
- Cross-site POST requests are rejected (Origin check).
- After 5 failed logins, an email is locked out for 15 minutes.
- Residents never receive staff-only notes. Security never receives claim evidence. Nobody but the claimant receives the pickup code.
- Every sign-in, report, physical receipt, claim, decision, handover and role change is written to the audit log.

## Prototype sign-in

Residents create their own prototype account with a name, email, and password. There is no email verification in this pitch version. Staff use the separate **Staff sign in** screen. The sole demo operator username is **`findback_admni`** with the agreed prototype password. That account has admin scope across all three proposed desks. The four old seeded role accounts remain in D1 for historical claim references but are deactivated, and their existing sessions are removed by migration `0007`.

**Demo story (about 2 minutes):**
1. **Resident:** create an account, search "black insulated bottle", then claim FB-ELM-001.
2. **FindBack operator:** sign in through Staff sign in and approve the claim.
3. **Resident:** Home now says the item is ready; tap it to show the pickup QR.
4. **FindBack operator:** tap **Scan pickup QR** and scan the resident's screen (or type the code), then confirm.
5. **FindBack operator:** show the audit log.

---

## Smart search (Cloudflare Workers AI)

Search no longer downloads AI models into the phone. `POST /api/search` runs on Cloudflare:

- **Photo:** `@cf/meta/llama-3.2-11b-vision-instruct` describes the item in one sentence (the app shows "AI sees: …"). Meta's licence is accepted automatically on first use.
- **Meaning:** `@cf/baai/bge-m3` compares the typed words and/or that description with every available item.
- The app combines this with word matching. If the AI is unavailable, word matching still works and the screen says so.
- Limit: 30 photo searches per user per hour. Workers AI free tier: 10,000 neurons per day.
- Needs the `[ai] binding = "AI"` block in `wrangler.toml`.
- Test without Cloudflare: set `FINDBACK_OPERATOR_PASSWORD` to the agreed demo password, then run `node scripts/search-test.mjs` (fake AI + real SQLite, Node 22+). The password is not returned by `/api/config`.

## Deploy with Wrangler

Read [DEPLOYMENT-READINESS.md](DEPLOYMENT-READINESS.md) first. The live database has been backed up and migrations 3–8 have been applied and verified. Run `node scripts/compare-migrations.mjs` to verify that the versioned and console-paste migration paths still produce the same result before deployment.

### Existing live database

The current live D1 database was initially set up by pasting SQL in the Cloudflare console, so it does not have Wrangler's migration history. A full backup was verified, and `manual-migrations/3-paste-elmina-collection-points.sql` through `manual-migrations/8-paste-claim-reservations.sql` were applied in numerical order on 2026-10-23. Do not replay them on this database. Migration 7 deactivated old demo accounts and signed them out. Migration 8 voided approvals owned by those retired demo accounts, then reserved items for still-active approved claimants. Old illustrated items with pending or approved claims remain available to preserve those claim workflows. Do not run `migrations apply --remote` on this already initialized database; it would first try to create tables that exist. Recent production deployments are GitHub Builds from `main`, so review the pull request before merging it.

For a new local or new remote database created through Wrangler migrations, `0003_elmina_collection_points.sql` through `0008_claim_reservations.sql` run after the original seed migration.

### New database

You need Node.js 18+ and access to **the Cloudflare account that owns `findback.khaliesahkhafizalfahmi.workers.dev`**. Run these in this folder:

```bash
npm install
npx wrangler login                          # opens a browser: sign in to that Cloudflare account
npx wrangler d1 create findback-db          # prints a database_id
```

1. Replace the existing `database_id` in `wrangler.toml` with the ID returned for this **new** database. Keep the current ID when updating the existing site.
2. Create the tables and sample data, then deploy:

```bash
npx wrangler d1 migrations apply findback-db --remote
npx wrangler deploy
```

The Worker is named `findback`, so it replaces the current site at the same URL.

**Check it worked:** open the site, tap **Start**, create a resident account, then use **Staff sign in** for the operator. On phones that already have the old version installed, reopen the app twice; the service worker cache is `v18`.

### Before sharing the link widely

- The agreed operator password is intentionally for a closed prototype and must be changed before real residents or staff use this system. To change it before deployment, run `node scripts/build-seed.mjs "your-new-password"` and review both regenerated migration 7 files.

### If sign-in shows "Error 1102" (CPU limit)

The Workers **Free** plan allows about 10 ms of CPU per request. A 100,000-iteration password hash can take longer than that. If it happens:

1. In `src/worker.js`, lower `PBKDF2_ITERATIONS` (for example to 20,000).
2. Regenerate migration 7 with `node scripts/build-seed.mjs "<password>"`, after changing the `100000` value in that script to match.
3. Delete and recreate the database, re-apply the migrations, and redeploy.

This is a weaker setting; state it as a known limitation in your report.

## Run locally

```bash
npx wrangler d1 migrations apply findback-db --local
npx wrangler dev                       # http://localhost:8787
node scripts/api-test.mjs              # 63 automated access-control checks (run against a fresh local DB)
```

## Known limitations (state these honestly)

- **QR scanning needs camera permission and HTTPS** (workers.dev is HTTPS). It was tested in Chrome with a simulated camera, not yet on a real iPhone. Rehearse once on the actual demo phone, and remember typing the code always works as a backup.
- **No push notifications.** The owner finds out their item is approved when they next open the app (Home banner).

- **Self-registration** has no email verification or proof of residency. A real township would verify residents against unit records, or set `ALLOW_REGISTRATION = "false"` and have the office create accounts.
- **No password reset or MFA.** For real staff accounts, single sign-on through the company identity provider would be the expected approach.
- **Photos are stored in the database** as compressed JPEG text. That's fine for a demo, but production would use object storage such as Cloudflare R2.
- **Login rate limiting is per email**, not per device or IP.
- Personal data (names, emails, claim evidence) is stored. A real deployment must follow Malaysia's Personal Data Protection Act; the specific obligations need verification with the organisation's data-protection officer.

# Existing Cloudflare site: deployment readiness

This is the handoff for the existing `findback` Worker and its D1 database. It records the live migration progress as well as the remaining release sequence.

## What has been checked locally

- The local preview uses D1 and the resident, item, claim, review, reservation, and handover flows were exercised in isolated tests.
- `node scripts/compare-migrations.mjs` confirms that applying the numbered Wrangler migrations and the console-paste files to fresh copies of the original seed produces matching columns, foreign keys, indexes, and seeded records.
- On 2026-10-23, `node scripts/search-test.mjs` passed 50 checks using an in-memory database and simulated AI. The local Worker preview passed 63 API checks after local migrations 1–8, including staff sign-in, role boundaries, claim review, reservation, handover, and audit events. `git diff --check` passed.
- The local preview runs with a local D1 database. Its data is separate from the Cloudflare database.

## Live Cloudflare findings (23 October 2026)

- The invited account can see `findback-db`; its UUID matches `wrangler.toml`, and the production Worker binds it as `DB`. Production also has an `AI` binding and static assets.
- D1 contains the original `users`, `sessions`, `items`, `claims`, and `audit_log` tables plus the columns and indexes from migrations 6–8. No Wrangler migration-history table is present.
- Before migration 8, an approved claim belonged to retired demo staff account `U-DEMO-STP` and pointed to a nonsample item. Migration 8 rejected that fake claim and cleared its pickup code, leaving the item available.
- A read-only D1 Time Travel bookmark was recorded in ignored `backups/live-d1-bookmark.txt`. It is a recovery point, **not** a full SQL export; its availability depends on Cloudflare's retention window.
- Recent production deployments show **GitHub Builds from `khaliesx/FindBack` `main`**. A merge to `main` can therefore trigger production deployment. Coordinate database migration **before** that merge; do not assume a separate manual deploy step.

## Backup and migration progress

- A full remote D1 SQL export was saved on 2026-10-23 at `backups/findback-before-elmina-2026-10-23.sql` (ignored by Git). Restoring it into in-memory SQLite passed `integrity_check` and returned 6 users, 5 sessions, 13 items, 2 claims, and 29 audit events. SHA-256: `4A61967F12B07C7662962E8E01BF485A58E2E93E4A06FB3D2DFB0E6CF3D80B01`. Wrangler was logged out after export.
- Before migration, the live database still had 6 users, 5 sessions, 13 items, 2 claims, and 29 audit events, with the new operator and reservation columns absent.
- `manual-migrations/3-paste-*.sql` was applied through the D1 console on 2026-10-23. All eight statements succeeded. Verification showed all 13 existing items and the three assigned operator accounts use the proposed Elmina desk names; no old desk names remained.
- `manual-migrations/4-paste-*.sql` was applied through the D1 console on 2026-10-23. The seven new photo-based sample items are available; the twelve old sample items are marked collected. The nonsample item remains available and both claims remain. The database now has 20 items. The new photo URLs will return missing images on the old production Worker until the code containing the assets is deployed.
- `manual-migrations/5-paste-*.sql` was applied through the D1 console on 2026-10-23. All four older found-location labels were replaced. Verification shows 6 items at Elmina Central Park, 6 at Elmina Green Seven, 5 at Elmina Lakeside Mall, and 3 at Elmina Urban Park.
- `manual-migrations/6-paste-item-intake.sql` was applied on 2026-10-23. All 20 existing items defaulted to `received`; the three intake columns and intake index were verified.
- `manual-migrations/7-paste-single-demo-operator.sql` was applied on 2026-10-23. The single active demo operator has username `findback_admni`; four retired demo accounts were deactivated and their sessions removed. One separate resident account remains active. All sessions were cleared.
- `manual-migrations/8-paste-claim-reservations.sql` was applied on 2026-10-23. One `reserved_at` column statement initially failed to submit in the console and the dependent backfill failed. The missing column was added and the backfill rerun successfully. Final verification found all five new item columns, the new user column, both new claim columns, and all three new indexes. There are 20 items, 2 claims, 0 sessions, and 0 reserved items. The retired staff claim `CL-5E227D` is rejected with no pickup code, and item `FB-60085C` is available and unreserved. `PRAGMA foreign_key_check` returned no violations.

## Still unverified

- The Cloudflare AI models have not been exercised against this account. The binding exists, but local-only Wrangler cannot run Workers AI.

## Next release steps

1. Keep the verified SQL export at `backups/findback-before-elmina-2026-10-23.sql` outside Git because it contains account and claim data. Do not replay migrations 3–8 on this database. The existing database was initialized by console paste, so `wrangler d1 migrations apply --remote` would try to replay initial table creation and is unsuitable without reconciling its migration history.
2. Review the local prototype changes and open the agreed single pull request from `acaplah/FindBack` to `khaliesx/FindBack`.
3. After the pull request is approved, merge to `main`. Check the GitHub Build succeeds and the new production Worker is active. The live Worker currently runs older code, so its interface and assets do not yet match the migrated database.
4. Smoke test resident sign-in, staff sign-in, item list, claim approval, pickup QR, and handover. Check a second browser session sees updated database records.

For a **new empty D1 database**, use the numbered Wrangler migrations instead of the console-paste path. Never mix the two paths for the same database.

## Review and release order

Finish and review all prototype changes locally, then open the agreed single pull request from `acaplah/FindBack` to `khaliesx/FindBack`. Keep it unmerged until the backup and database migration are complete. Recent production history shows builds from GitHub `main`, so the merge is likely the deployment trigger.

Cloudflare's documented read-only inspection uses `wrangler d1 execute ... --remote --command`, and a full backup uses `wrangler d1 export ... --remote --output`. Do not include the exported SQL in a pull request.

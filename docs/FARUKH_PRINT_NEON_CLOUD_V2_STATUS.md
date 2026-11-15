# FARUKH PRINT — Neon Cloud V2 (test)

Created 2026-11-15. **Independent project from FARUKH AI, FARUKH KITCHEN and MORE SUSHI.** No staff production endpoint modified.

## Infrastructure

- Neon project `green-king-01292452`, Free plan, database `farukh_print`, branch `main`, Frankfurt.
- PostgreSQL schema `farukh_print`: 10 tables; 4 outlet rows; 110 active products; 64 ready, 46 prep; 110 photos (56 JPEG, 54 WebP); first backup `catalog_backups`.
- Original JSON export: FARUKH_PRINT_NEON_110_товаров_2026-11-15.json, uploaded by owner. All 110 product JSON payloads and all 110 images compared byte-for-byte against Neon: no differences. Nine HACCP templates left unverified, and product print approvals remain off until manual review.
- Neon Auth provider: managed Better Auth, separate from production employee accounts.
- Owner access: a fixed Neon Auth user id checked with verified-email and non-banned account inside a `SECURITY DEFINER` `farukh_print_api.owner_access()` function. Neon account email should not be logged or embedded in public frontend.
- Neon Data API: endpoint configured to expose **only** `farukh_print_api` RPC schema, not raw `farukh_print` tables. No `add_default_grants`. Anonymous role has no EXECUTE permission. Permitted owner-only functions:
  `cloud_status`, `catalog_read`, `save_product`, `archive_product`, `snapshot_create`.
- Auth, Data API and Render preview domains are HTTPS. Access requires a valid Neon Auth JWT and owner check; `cloud_status()` and `catalog_read()` verified to return FORBIDDEN without authenticated owner.
- Test-only Render static admin URL: https://farukh-print-admin-preview-20261115.onrender.com/farukh-print-admin/
- Cloud page URL: https://farukh-print-cloud-test-20261115.onrender.com/cloud/ (links to Neon Auth-backed preview).
- Branch: `preview/farukh-print-admin-20261115`; no production branch updates.
- New frontend `public/farukh-print-admin/neon-sync.js` connects directly to Neon-managed Auth + Data API; old local editor and preview themes remain intact.

## Functional status and validations

✅ New database and product/photo transfer complete, byte-for-byte cross-check, backup preserved.
✅ Neon Auth and Data API provisioned, secure owner-only RPC functions, granted only to authenticated.
✅ Read/write cloud sync UI deployed to independent preview Render site, with fallback local export and conflict rejection.
✅ Both test Render deploys reach live.
⏳ **NEEDS OWNER INTERACTION**: authenticate with same Google account as Neon owner on preview, confirm verified email, and test a real Neon Auth JWT.
⏳ E2E mobile editor save on Android: not yet tested. Do not state automatic sync is production-ready until login, edit, reload and second-device verification pass.
⏳ Employee credentials/devices: Neon tables empty. Staff gateway stays on its existing unrelated API and is NOT connected. Do not switch employee traffic without explicit physical printer tests and validated migration.
⏳ Physical labels 58×40 and 30×20: manual print tests required, not yet verified.

## Safety constraints for further development

1. Never put DB password or session secrets in GitHub, browser JS, logs or chat; avoid passing secrets between platforms in agent tools.
2. Use Neon-managed Data API and Auth as the read/write API surface. PostgREST exposes `farukh_print_api` functions only. No public access to tables or photo bytes.
3. Keep all production staff printing available. No automatic reassignment of staff apps until end-to-end staging tested.
4. Any changed product is saved via `save_product(item,expected_updated_at)` with per-item optimistic lock; deletions are soft archives with version check. Successful saves create catalog revisions.
5. Before restoring a cloud catalog over local browser data, download a JSON backup of the local version.
6. After tests, consider rotating owner credentials / disabling unused legacy Render Cloud code and adding reliable daily backups on Free quota.

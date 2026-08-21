# Park status (Week 1 freeze)

DLMS Week 1 is locked as **`v1.0.0-week1`** on branch **`main`**. Continue Week 2 work on **`dev`**.

## In scope (frozen)

- Mobile (Expo): student + librarian floor flows; catalog soft-deactivate for staff
- Admin web: users (student↔librarian only), catalog soft-delete, config, fines, reservations, dashboard, reports (CSV + PDF)
- Express API: Auth, catalog, loans, reservations, digital books (Supabase), notifications, cron
- Hosting path: Render for public API (see `docs/deploy-render.md`)
- Docs: architecture, setup, security, VnV matrix, seed, deploy

## Out of scope / Week 2+

- Native OS push banners (needs dedicated/dev build)
- APK polish / store listing (after Render URL is stable)
- Custom OTP password reset (Firebase email link is enough)
- Demo walkthrough script document

## Operator notes

1. Client delivery = `main` + tag `v1.0.0-week1`, plus Render deployment of that API.
2. Checking out the tag on your PC only switches **your local code**. Render keeps serving whatever branch/commit you last deployed until you redeploy.
3. Re-seed catalog with `npm run seed` (no users). See `docs/seed.md`.
4. Secrets stay in `api/.env` / Render env / `secrets/` only.

## Related docs

- [`docs/deploy-render.md`](deploy-render.md)
- [`docs/polish-plan.md`](polish-plan.md)
- [`docs/security.md`](security.md)
- [`docs/vnv-matrix.md`](vnv-matrix.md)
- [`docs/seed.md`](seed.md)

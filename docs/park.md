# Park status (MVP freeze)

DLMS is parked as **`v1.0.0-mvp`** after polish blocks A-F and Block G seed/tag work. Demo script was intentionally skipped.

## In scope (frozen)

- Mobile (Expo): student + librarian floor flows
- Admin web: users, config, fines, reservations, dashboard, reports (CSV + PDF)
- Express API on LAN PC: Auth, catalog, loans, reservations, digital books (Supabase), notifications, cron
- Docs: architecture, setup, security, VnV matrix, seed

## Out of scope / later

- Native OS push banners (needs dedicated/dev build; Expo Go limited)
- Public internet hosting of the API
- Custom OTP password reset (Firebase email link is enough)
- Demo walkthrough script document

## Operator notes at freeze

1. Keep working on `dev`; promote to `main` when you want a stable mirror.
2. Tag marks the freeze point; further work should be new commits / a later tag.
3. Re-seed anytime with `npm run seed` (see `docs/seed.md`).
4. Secrets stay in `api/.env` and `secrets/` only.

## Related docs

- [`docs/polish-plan.md`](polish-plan.md)
- [`docs/security.md`](security.md)
- [`docs/vnv-matrix.md`](vnv-matrix.md)
- [`docs/seed.md`](seed.md)

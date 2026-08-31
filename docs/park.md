# Park status

DLMS Week 2 is locked as **`v2.0.0-week2`** on branch **`main`**. Continue work on **`dev`**.

Week 1 history: [`week1-archive.md`](week1-archive.md).

## In scope (frozen at Week 2)

- Mobile (Expo): student + librarian floor flows; catalog soft-deactivate for staff; desk fine collection; copy numbers; PKT due dates and greetings; PDF reader enhancements; app modals; error feedback
- Admin web: users (student↔librarian only), catalog soft-delete, config, fines, reservations, dashboard, reports (CSV + PDF)
- Express API: Auth, catalog, loans, reservations, digital books (Supabase), fines, notifications, cron
- Hosting path: Render for public API (see [`deploy-render.md`](deploy-render.md))

## Parked / future mobile

The Expo student + librarian app is parked for this phase. Circulation,
notices, scan returns, Activity copy numbers, Home greetings (PKT), and
unified-search digital covers are in the current tree.

Still later:

- Native OS push banners (needs a dedicated/dev or store build; Expo Go cannot)
- APK polish / store listing
- Custom OTP password reset (Firebase email link is enough)
- Profile photo upload
- Admin portal theme sync
- Interactive onboarding extras beyond the current tour

### Google Books (API already in use for ISBN lookup)

Parked for a later mobile pass. Same `volumes` API; we do not call these yet:

1. Title / author search when the librarian does not have an ISBN
2. Larger cover variants (`imageLinks.medium` / `large`)
3. Extra metadata: page count, subtitle, language
4. Public rating and ratings count from Google

Digital PDFs stay on first-page covers. Google Books is not inventory or loans.

## Operator notes

1. Client delivery = `main` + tag `v1.0.0-week1`, plus Render deployment of that API.
2. Checking out the tag on your PC only switches **your local code**. Render keeps serving whatever commit you last deployed.
3. Re-seed catalog with `npm run seed` (no users). See [`seed.md`](seed.md).
4. Secrets stay in `api/.env` / Render env / `secrets/` only.

## Related docs

- [`deploy-render.md`](deploy-render.md)
- [`security.md`](security.md)
- [`vnv-matrix.md`](vnv-matrix.md)
- [`seed.md`](seed.md)
- [`week1-archive.md`](week1-archive.md)

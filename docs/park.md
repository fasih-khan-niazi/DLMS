# Park status

DLMS Week 2 is locked as **`v2.0.0-week2`** on branch **`main`**. Week 3 admin uplift lives on **`dev`** and will ship as **`v3.0.0-week3`** after merge to `main`.

Week 1 history: [`week1-archive.md`](week1-archive.md).

## In scope (frozen)

### Week 2 (tagged on `main`)

- Mobile (Expo): student + librarian floor flows; catalog soft-deactivate for staff; desk fine collection; copy numbers; PKT due dates and greetings; PDF reader enhancements; app modals; error feedback
- Admin web (baseline): users, catalog soft-delete, config, fines, reservations, dashboard, reports (CSV + PDF)
- Express API: Auth, catalog, loans, reservations, digital books (Supabase), fines, notifications, cron
- Hosting: API and admin portal on Render from branch **`main`** (see [`deploy-render.md`](deploy-render.md))

### Admin uplift on `dev` (parked complete)

Admin portal polish and audit fix-pack are done and verified. Includes:

- UI kit (pagination, drawers, filters, density, theme tokens, ConfirmDialog/toasts)
- Users: server pagination + filters + bulk actions
- Catalog: Physical + Digital tabs; add book/copies; edit; PDF upload; soft status
- Loans page (active / overdue / all)
- Fines desk (`/api/fines/lookup` + collect) with accrual-aware remaining
- Config holidays CRUD + IANA timezone / weekday validation
- Reports use system timezone; range chips (7 / 30 / 90)
- Critical/high audit items C1-C3, H1-H6 addressed

**Automated coverage:** `npm run verify:suite` (includes fix-pack + park smoke). Park smoke hits every admin page backend plus student/librarian HTTP paths (borrow/return, digital upload, holidays). True browser clicks and Expo UI gestures are not in CI; treat those as optional manual spot-checks only.

## Parked / future

Still later (not blocking this park):

- Native OS push banners (needs a dedicated/dev or store build; Expo Go cannot)
- APK polish / store listing
- Custom OTP password reset (Firebase email link is enough)
- Profile photo upload
- Interactive onboarding extras beyond the current tour

### Google Books (API already in use for ISBN lookup)

Parked for a later mobile pass. Same `volumes` API; we do not call these yet:

1. Title / author search when the librarian does not have an ISBN
2. Larger cover variants (`imageLinks.medium` / `large`)
3. Extra metadata: page count, subtitle, language
4. Public rating and ratings count from Google

Digital PDFs stay on first-page covers. Google Books is not inventory or loans.

## Operator notes

1. Client delivery = `main` + tag `v2.0.0-week2`, plus Render deployment of that API and admin.
2. Checking out the tag on your PC only switches **your local code**. Render keeps serving whatever commit you last deployed from `main`.
3. Feature work happens on **`dev`**, then merge/PR into `main` when ready to ship the admin uplift.
4. Re-seed catalog with `npm run seed` (no users). See [`seed.md`](seed.md).
5. Secrets stay in `api/.env` / Render env / `secrets/` only.
6. Final local park check (API must be up): `npm run verify:park-smoke`

## Related docs

- [`deploy-render.md`](deploy-render.md)
- [`admin-web.md`](admin-web.md)
- [`app-guide.md`](app-guide.md)
- [`security.md`](security.md)
- [`vnv-matrix.md`](vnv-matrix.md)
- [`seed.md`](seed.md)
- [`week1-archive.md`](week1-archive.md)

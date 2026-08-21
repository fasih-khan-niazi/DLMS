# Security checklist (Block E)

MVP hardening for the self-hosted Express API + Firebase Spark + Supabase Storage setup. No em dashes.

## Threat model (short)

| Trust | Assumption |
|-------|------------|
| Clients | Mobile and admin are untrusted; they only get Firebase ID tokens |
| Business rules | Enforced on the API (borrow limits, fines, roles), not on the phone |
| Secrets | Live only in `api/.env` and `secrets/` (both gitignored) |
| Storage | Supabase `service_role` used only on the API; clients never hold it |
| Cron | `/internal/cron` requires `x-cron-secret` matching `CRON_SECRET` |

## Implemented controls

- [x] Helmet HTTP headers on the API
- [x] CORS via `ALLOWED_ORIGINS` (`*` for LAN demo; lock to admin origin in production-like demos)
- [x] JSON body size capped at 1MB (PDFs use multipart separately)
- [x] Auth rate limit on `/api/auth` (40 requests / 15 minutes / IP)
- [x] Register requires password length >= 8 and basic email / name checks
- [x] Firebase ID token verified on protected routes
- [x] Role and `isActive` loaded from Firestore on each authenticated request (disabled accounts blocked; role changes apply without waiting on stale custom claims)
- [x] `requireRole` on admin, catalog write, reports, PDF upload/delete, mark-fine routes
- [x] Self-register always creates `student` (no client-chosen librarian/admin)
- [x] Cron secret required and must not be the placeholder `replace_me`
- [x] Digital PDF upload limited by `config.maxPdfSizeMb` (default 25)
- [x] PDF MIME / extension filter on upload
- [x] Secrets and `Requirements.md` kept out of git via `.gitignore`

## Operator checklist (before viva / demo)

1. Confirm `api/.env` is never committed (`git status` should not list it).
2. Set a strong unique `CRON_SECRET` (not `replace_me`).
3. Keep Firebase service account JSON under `secrets/` only.
4. Rotate Supabase **service_role** if it was ever pasted into chat or a ticket.
5. Firebase Console: Authentication authorized domains include your admin host; email reset template looks correct.
6. For a tighter demo: set `ALLOWED_ORIGINS` to your admin Vite origin (e.g. `http://localhost:5173`) instead of `*`.
7. Disable unused users from Admin -> Users (`isActive: false`).
8. Restart API after changing env or system config that affects uploads.

## Known MVP limits (acceptable for park)

- API listens on `0.0.0.0` for LAN; not exposed to the public internet by design.
- No WAF / CDN; rely on campus / home network.
- Firestore security rules are secondary: clients go through Express for mutations; still keep console access locked to project owners.
- Expo Go cannot do full remote push; in-app notification list is the demo path.
- Rate limiting is per-IP memory store (fine for one PC host).

## Quick verification

| Check | How |
|-------|-----|
| Unauthenticated borrow | Call borrow without Bearer token -> 401 |
| Student hits admin config | Student token on `PUT /api/admin/config` -> 403 |
| Disabled user | Set `isActive: false`, then call `/api/auth/me` -> 403 |
| Cron without secret | `GET /internal/cron/...` without header -> 403 |
| Oversized PDF | Upload above `maxPdfSizeMb` -> 400 with clear message |

# Phase 0 baseline (Week 2 mobile)

Date: 2026-08-22  
Branch: `dev`  
API: `https://dlms-csij.onrender.com`

## Automated checks (done)

| Check | Result |
|-------|--------|
| Git branch `dev` | Pass |
| Render `/health` | Pass (200, `status: ok`) |
| `mobile/.env` → `EXPO_PUBLIC_API_URL` csij | Pass |
| `mobile` TypeScript (`tsc --noEmit`) | Pass |

## Manual Expo Go smoke (you run)

Use `npx expo start -c` in `mobile/`. First load may wait ~60s if API slept.

| # | Flow | Pass | Notes |
|---|------|------|-------|
| 1 | Login (student account) | | |
| 2 | Home loads | | |
| 3 | Catalog → open a book | | |
| 4 | Scan → borrow or return (if copy available) | | |
| 5 | Activity → see loans/reservations | | |
| 6 | Home or Profile → E-Library / digital list | | |
| 7 | Notifications inbox opens | | |
| 8 | Profile → logout → login again | | |

Optional staff account: Add book or upload PDF entry visible (no need to complete upload).

## Known pre-Week-2 issues (expected, not Phase 0 blockers)

- Book detail shows internal copy IDs and QR (fixed in Phases 4 and 8).
- Home uses link-style navigation (fixed in Phase 5).
- Profile shows Role / API URL (removed in Phase 3).
- Render free tier cold start on first request after idle.

## Phase 0 outcome

- **Automated:** Ready to start Phase 1.
- **Manual:** Mark Pass when smoke table complete; report any unexpected failures before Phase 1.

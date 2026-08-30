# Week 1 archive

Historical notes from the Week 1 freeze (`v1.0.0-week1` on `main`).  
**Current setup, deploy, and security live in the files linked below, not here.**

- Setup: [`setup.md`](setup.md)
- Architecture: [`architecture.md`](architecture.md)
- Deploy: [`deploy-render.md`](deploy-render.md)
- Security: [`security.md`](security.md)
- VnV: [`vnv-matrix.md`](vnv-matrix.md)
- Seed: [`seed.md`](seed.md)
- Park / freeze: [`park.md`](park.md)

---

## What Week 1 shipped

Phases 1–8 on the original two-week roadmap:

1. Monorepo, Express API, Expo mobile, Firebase baseline
2. Catalog + ISBN lookup (Google Books) + copies + QR payload
3. Scan borrow/return, fines, due dates (Sunday/holiday roll-forward)
4. Reservations (FIFO, ready hold, claim via QR)
5. Digital library (PDF upload, bookshelf, progress)
6. In-app notifications + cron (due / overdue / reservation ready)
7. Admin web (users, config, fines, reservations, dashboard, reports)
8. Bottom tabs (Home, Catalog, Scan, Activity, Profile), reports CSV/PDF, auth persistence

Digital PDFs moved to Supabase Storage (see [`supabase.md`](supabase.md)).

---

## Demo checklist (Week 1 public)

API health: `https://dlms-csij.onrender.com/health`

1. Point clients at Render (`admin/.env` `VITE_API_URL`, `mobile/.env` `EXPO_PUBLIC_API_URL`).
2. Optional: host admin as a Render static site (`admin/`, `VITE_API_URL` at build time). Add the admin hostname to Firebase Auth authorized domains.
3. Smoke: `/health`, admin login, mobile login, catalog, scan borrow, reserve, digital open.
4. Home LAN: set those env vars back to your PC (`http://192.168.x.x:5000`).

---

## Phase 8 notes (kept for viva)

- Activity = Loans + Reservations + Returns
- E-library and staff tools from Catalog / Profile
- Admin Reports: date range, summary, CSV (`GET /api/admin/reports/...`)

---

## Post–Phase 8 polish blocks (done)

| Block | Focus |
|-------|--------|
| A | Design system, login, Firebase email password reset |
| B | Mobile polish, skeletons, in-app inbox |
| C | Admin config grouping |
| D | PDF report export |
| E | Security checklist (`security.md`) |
| F | VnV matrix (`vnv-matrix.md`) |
| G | Seed + park tag |

Notifications: Firestore inbox always; OS banners need a standalone/APK build (Expo Go cannot show full remote push).

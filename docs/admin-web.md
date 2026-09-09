# DLMS Admin Web

Admin console for operators with the **admin** role only.

API and admin are both deployed on **Render** from git branch **`main`**. Day-to-day feature work happens on **`dev`**, then merges to `main` when ready.

## Run locally

1. Start the API (port 5000):

```bash
cd api
npm run dev
```

2. Start the admin app:

```bash
cd admin
npm install
npm run dev
```

Open http://localhost:5173 (Vite default).

Point `admin/.env` at your local API for development (`VITE_API_URL=http://localhost:5000`). Production builds use the Render API URL (or the fallback in `admin/src/config/api.ts`).

## Auth

- Firebase email/password
- After login the app calls `GET /api/auth/me`
- Only Firestore role `admin` is allowed; others are signed out
- Seed admin: `fasihxniazi+dlmsadmin@gmail.com`
- Also: `admin@dlms.com` (role `admin`)
- Forgot password: `/forgot-password` (Firebase email reset link)

See also `docs/auth.md`.

## Features

- Dashboard counts (users, loans, reservations, digital books, unpaid fines)
- Users: search, promote student↔librarian only (admin is seed-only and protected), suspend/activate
- Catalog: soft-deactivate / reactivate titles (history kept)
- Config: grouped sections (loans, fines, reservations, calendar, digital)
- Reservations: waiting/ready list
- Fines: unpaid users/loans and mark fine paid
- Reports: date-range summary, daily series, CSV and PDF download
- Shared UI kit: toasts, confirm dialogs, page headers, Poppins + mobile color tokens

### Reports API

- `GET /api/admin/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` (librarian or admin)
- `GET /api/admin/reports/export.csv?from=&to=` (same roles; authenticated blob download)
- `GET /api/admin/reports/export.pdf?from=&to=` (same roles; PDF download)
- Default range: last 30 days through today (Asia/Karachi calendar dates on the API)

## Hosting note

Admin is a Vite SPA. It is **not** served by Firebase Hosting. Production hosting is on Render alongside the API.

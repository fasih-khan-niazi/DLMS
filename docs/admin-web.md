# DLMS Admin Web

Phase 7 admin console for operators (admin role only).

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

## Auth

- Firebase email/password
- After login the app calls `GET /api/auth/me`
- Only Firestore role `admin` is allowed; others are signed out
- Seed admin: `fasihxniazi+dlmsadmin@gmail.com`
- Forgot password: `/forgot-password` (Firebase email reset link)

See also `docs/auth.md`.

## Features

- Dashboard counts (users, loans, reservations, digital books, unpaid fines)
- Users: search, role change, suspend/activate
- Config: edit `config/system` settings
- Reservations: waiting/ready list
- Fines: unpaid users/loans and mark fine paid
- Reports: date-range summary metrics, daily series table, CSV download

### Reports API

- `GET /api/admin/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` (librarian or admin)
- `GET /api/admin/reports/export.csv?from=&to=` (same roles; authenticated blob download)
- Default range: last 30 days through today (Asia/Karachi calendar dates on the API)

API base URL is `http://localhost:5000` (see `admin/src/config/api.ts`).

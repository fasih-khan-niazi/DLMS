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

## Features

- Dashboard counts (users, loans, reservations, digital books, unpaid fines)
- Users: search, role change, suspend/activate
- Config: edit `config/system` settings
- Reservations: waiting/ready list
- Fines: unpaid users/loans and mark fine paid

API base URL is `http://localhost:5000` (see `admin/src/config/api.ts`).

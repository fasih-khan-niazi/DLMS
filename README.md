# DLMS

Digital Library Management System (Android-first) - TypeScript monorepo for students, librarians, and admins.

**Live repo:** [github.com/fasih-khan-niazi/DLMS](https://github.com/fasih-khan-niazi/DLMS)

## Stack

| Layer | Tech |
|-------|------|
| Mobile | Expo (React Native) + TypeScript |
| Admin web | React + Vite (Phase 7) |
| API | Express + TypeScript on a self-hosted PC |
| Auth / DB | Firebase Auth + Firestore (Spark) |
| PDF files | **Supabase Storage** (private bucket; API proxies downloads) |
| Push | Expo push tokens / FCM via API |
| Jobs | `node-cron` inside the API (Asia/Karachi) |

## Packages

```text
.
├── mobile/     # Expo app (students + librarians)
├── admin/      # Web admin panel
├── api/        # Express backend (business rules + cron)
├── shared/     # Shared types/constants
├── docs/       # Engineering docs (for GitHub + contributors)
├── docs/fyp/   # FYP write-ups / thesis drafts (optional)
├── scripts/    # One-off tools (e.g. seed admin)
└── secrets/    # Local credentials only - never committed
```

## Current status

Phases **1-6** are implemented in this codebase:

1. Foundation (auth, seed admin, monorepo)
2. Catalog (ISBN / Google Books, copies, QR)
3. Borrow / return (limits, fines, due dates)
4. Reservations (FIFO, 72h hold, expiry cron)
5. Digital library (PDF ≤25MB, bookshelf)
6. Notifications (due / overdue / reservation-ready + cron)

**Status:** Phases 1-8 complete in codebase (tabs + admin reports). Polish/demo as needed.

## Quick start

1. Read [`docs/setup.md`](docs/setup.md) and [`docs/firebase.md`](docs/firebase.md)
2. Put Firebase credentials in `secrets/` (gitignored) and copy `api/.env.example` → `api/.env`
3. Add Supabase keys for PDF storage - see [`docs/supabase.md`](docs/supabase.md)
4. API: `cd api && npm install && npm run dev`
5. Mobile: `cd mobile && npm install && npx expo start`
6. Phone must reach the API on your LAN - see [`docs/device-setup.md`](docs/device-setup.md)

## Documentation

| Doc | Audience |
|-----|----------|
| [`docs/architecture.md`](docs/architecture.md) | System design |
| [`docs/setup.md`](docs/setup.md) | Local install |
| [`docs/roadmap.md`](docs/roadmap.md) | Phases |
| [`docs/supabase.md`](docs/supabase.md) | PDF cloud storage |
| [`docs/github-workflow.md`](docs/github-workflow.md) | Branches & commits |
| [`docs/digital-library.md`](docs/digital-library.md) | PDF / e-library |
| [`docs/polish-plan.md`](docs/polish-plan.md) | Completion / park polish blocks |
| [`docs/notifications-inbox.md`](docs/notifications-inbox.md) | In-app notification inbox |
| [`docs/security.md`](docs/security.md) | Security checklist |
| [`docs/vnv-matrix.md`](docs/vnv-matrix.md) | Business logic VnV matrix |
| [`docs/seed.md`](docs/seed.md) | MVP seed script |
| [`docs/park.md`](docs/park.md) | MVP freeze / park notes |

Engineering docs under `docs/` **are committed** - that is normal industry practice. Only secrets and uploaded PDFs are ignored.

## Security

Never commit:

- `.env` / service account JSON / `google-services.json`
- `secrets/`
- `api/uploads/` (local PDF files)

## Git workflow

- `main` - stable / demo-ready  
- `dev` - integration  
- `feat/*` - features · `chore/*` - docs/tooling  

See [`docs/github-workflow.md`](docs/github-workflow.md).

## License

MIT - see `package.json`.

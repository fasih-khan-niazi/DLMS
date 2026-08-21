# Seed script

Idempotent MVP seed for Firebase Auth + Firestore.

## Run

From the repo root (service account must exist under `secrets/` or `FIREBASE_SERVICE_ACCOUNT_PATH`):

```bash
npm run seed
```

Optional demo librarian + student accounts:

```bash
# Windows PowerShell
$env:SEED_DEMO_USERS="true"; npm run seed
```

```bash
# bash
SEED_DEMO_USERS=true npm run seed
```

## What it writes

| Item | Details |
|------|---------|
| Admin user | Default email from script / `SEED_ADMIN_EMAIL` |
| System config | Borrow limit 5, loan 14 days, fine Rs 50/day, hold 72h, PDF 25MB, Sunday off |
| Holidays | Pakistan Day 2026-03-23, Independence Day 2026-08-14 |
| Sample book | ISBN `9780141036144` (Animal Farm), 2 available copies |
| Sample QR | `cpy_seed_af_01_9780141036144`, `cpy_seed_af_02_9780141036144` |
| Demo users | Only if `SEED_DEMO_USERS=true` |

Safe to re-run: existing users/copies are updated or skipped, not duplicated as new ISBNs.

## Env overrides

| Variable | Purpose |
|----------|---------|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Admin SDK JSON |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | Admin account |
| `SEED_DEMO_USERS` | `true` to create librarian + student |
| `SEED_LIBRARIAN_EMAIL` / `SEED_LIBRARIAN_PASSWORD` | Librarian demo |
| `SEED_STUDENT_EMAIL` / `SEED_STUDENT_PASSWORD` | Student demo |

Change any default password after first login.

# Seed script

Idempotent seed for **catalog + config**. It does **not** create users.

## Why seed?

Manual entry is slow and easy to get wrong: each book needs metadata, search keywords, and multiple physical copies with QR payloads. Seeding drops a ready-made shelf into Firestore so browse, search, borrow, and reservations work immediately for demos and testing. Config and holidays get the same treatment so due dates and fines match the MVP defaults without clicking through Admin first.

Your real accounts stay as you created them.

## Run

```bash
npm run seed
```

Needs the Firebase service account under `secrets/` (or `FIREBASE_SERVICE_ACCOUNT_PATH`).

## What it writes

| Item | Details |
|------|---------|
| System config | Borrow 5, loan 14 days, fine Rs 50/day, hold 72h, PDF 25MB, Sunday off |
| Holidays | Pakistan Day, Independence Day (2026) |
| Catalog | 12 classic titles with descriptions, categories, cover URLs |
| Copies | 1-3 available copies per title with stable `cpy_seed_...` IDs and QR payloads |

Safe to re-run: existing copies are skipped; book metadata is refreshed.

Deactivate the **seeded** Great Gatsby (ISBN `9780743273565`) if your original listing has the loan history you care about. Soft-deactivate hides it from students without deleting loans or reservations.

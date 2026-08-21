# Rotate Firebase Admin SDK key

Do this if a service account JSON was pasted into chat, email, or a ticket.

## Where the key lives

| Location | What to update |
|----------|----------------|
| Local file | `secrets/*firebase-adminsdk*.json` (gitignored) |
| Local API | `api/.env` → `FIREBASE_SERVICE_ACCOUNT_PATH` points at that file |
| Render API | Environment → `FIREBASE_SERVICE_ACCOUNT_JSON` = **full new JSON** |
| Seed script | Uses `FIREBASE_SERVICE_ACCOUNT_PATH` or the default path under `secrets/` |

Mobile and admin apps do **not** use this key. Only the Express API (and seed script) do.

## Steps

1. [Firebase Console](https://console.firebase.google.com) → project `dlms-b7390`
2. Project settings (gear) → **Service accounts**
3. **Generate new private key** → download JSON
4. Save into `secrets/` (replace or add file; keep gitignored)
5. Update `api/.env` path if the filename changed
6. Render → DLMS API → Environment → replace `FIREBASE_SERVICE_ACCOUNT_JSON` with the new file contents (clipboard paste)
7. Render → Manual Deploy
8. In Google Cloud Console → IAM → Service Accounts → open the old key → **Delete** the old private key id (or disable it)

Confirm: `https://dlms-csij.onrender.com/health` still OK, then login once via admin/mobile.

Never commit the JSON. Never paste it into chat.

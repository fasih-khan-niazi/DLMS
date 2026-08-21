# Deploy Week 1 API on Render (free)

Goal: clients and off-site demos reach the Express API without your home LAN.

Firebase Auth/Firestore and Supabase stay in the cloud as today. Only the **API** moves to Render.

## Before you start

1. Week 1 is on `main` with tag `v1.0.0-week1`.
2. You have a [Render](https://render.com) account (GitHub login is easiest).
3. Collect values from local `api/.env` and the Firebase service account JSON (one line).

## Create the web service

1. Render Dashboard → **New** → **Web Service**.
2. Connect repo `fasih-khan-niazi/DLMS`.
3. Settings:

| Field | Value |
|-------|--------|
| Branch | `main` (Week 1 freeze) |
| Root Directory | `api` |
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance | Free |

4. Add environment variables (Render → Environment).

Copy values from local `api/.env`, **except**:

| Do NOT set on Render | Why |
|----------------------|-----|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No secret files on the server; this crashes startup |
| `PORT` | Render sets this automatically |

| Must set on Render | Value |
|--------------------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full contents of the Firebase Admin SDK JSON file |
| `FIREBASE_PROJECT_ID` | from `.env` |
| `FIREBASE_STORAGE_BUCKET` | from `.env` |
| `GOOGLE_BOOKS_API_KEY` | from `.env` |
| `CRON_SECRET` | from `.env` (not `replace_me`) |
| `ALLOWED_ORIGINS` | `*` |
| `SUPABASE_URL` | from `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | from `.env` |
| `SUPABASE_DIGITAL_BOOKS_BUCKET` | `digital-books` |
| `NODE_ENV` | `production` |

### Packing the service account for Render

PowerShell (repo root), copies JSON onto clipboard as one line:

```powershell
Get-Content .\secrets\dlms-b7390-firebase-adminsdk-fbsvc-9468ed8000.json -Raw | Set-Clipboard
```

In Render → Environment → add `FIREBASE_SERVICE_ACCOUNT_JSON` → paste (Ctrl+V).

If deploy logs say JSON parse error, paste as a **Secret File** is not required; multiline paste in the value box usually works on Render. The value must start with `{` and end with `}`.

### After a failed deploy

1. Delete env var `FIREBASE_SERVICE_ACCOUNT_PATH` if present.
2. Confirm `FIREBASE_SERVICE_ACCOUNT_JSON` is set.
3. Manual Deploy → clear build cache optional → Deploy.

5. Deploy. When live, open:

`https://YOUR-SERVICE.onrender.com/health`

You should see `{ "service": "dlms-api", "status": "ok", ... }`.

## Free-tier note

Render free services **sleep after idle**. First request after sleep can take 30–60 seconds. After wake, normal speed. Fine for demos; warn clients about the first load.

Cron jobs inside the API only run while the instance is awake. For Week 1 demos that is usually acceptable.

## Point clients at this API

Defaults in `admin` and `mobile` already use `https://dlms-csaj.onrender.com`.

| Client | How |
|--------|-----|
| Admin | `admin/.env` → `VITE_API_URL=...` (see `.env.example`) |
| Mobile Expo | `mobile/.env` → `EXPO_PUBLIC_API_URL=...` then `npx expo start -c` |
| Android APK | `mobile/eas.json` preview profile env (already set) |

Full checklist: `docs/week1-demo.md`.

## Redeploy Week 1 later

Deployments follow the **branch** you chose (`main`). Checking out a tag on your laptop does **not** change what Render runs until you redeploy from that commit/branch.

To force Week 1 forever on this service: keep the service branch on `main` and only merge Week 2 to `main` when you intentionally want to upgrade the hosted product (or create a second Render service from `dev`).

## Optional: admin static site on Render

1. New → **Static Site** (not Web Service).
2. Root Directory: `admin`.
3. Build: `npm install && npm run build`.
4. Publish directory: `dist`.
5. Env at **build** time: `VITE_API_URL=https://dlms-csaj.onrender.com`.
6. Firebase Console → Authentication → Authorized domains → add the new admin hostname.

See also `docs/week1-demo.md`.

## Checklist

- [ ] `/health` works from phone mobile data (not only home Wi‑Fi)
- [ ] Admin login against Render API
- [ ] Mobile login / catalog against Render API
- [ ] Upload a small PDF (Supabase still works)

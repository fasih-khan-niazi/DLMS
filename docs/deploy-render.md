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

4. Add environment variables (Render → Environment):

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `PORT` | leave unset (Render sets it) or `10000` |
| `FIREBASE_PROJECT_ID` | from your `.env` |
| `FIREBASE_STORAGE_BUCKET` | from your `.env` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **entire** service account JSON as one line (see below) |
| `GOOGLE_BOOKS_API_KEY` | from your `.env` |
| `CRON_SECRET` | strong random string (not `replace_me`) |
| `ALLOWED_ORIGINS` | `*` for Week 1, or your admin URL later |
| `SUPABASE_URL` | from your `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | from your `.env` |
| `SUPABASE_DIGITAL_BOOKS_BUCKET` | `digital-books` |

### Packing the service account for Render

On your PC (PowerShell), from the repo root:

```powershell
Get-Content secrets\YOUR-firebase-adminsdk.json -Raw
```

Copy the whole JSON (starts with `{` … ends with `}`). Paste into `FIREBASE_SERVICE_ACCOUNT_JSON`. Do **not** commit this value.

Do **not** set `FIREBASE_SERVICE_ACCOUNT_PATH` on Render.

5. Deploy. When live, open:

`https://YOUR-SERVICE.onrender.com/health`

You should see `{ "service": "dlms-api", "status": "ok", ... }`.

## Free-tier note

Render free services **sleep after idle**. First request after sleep can take 30–60 seconds. After wake, normal speed. Fine for demos; warn clients about the first load.

Cron jobs inside the API only run while the instance is awake. For Week 1 demos that is usually acceptable.

## Point clients at this API

| Client | How |
|--------|-----|
| Admin (local Vite) | Create `admin/.env`: `VITE_API_URL=https://YOUR-SERVICE.onrender.com` then restart `npm run dev` |
| Mobile Expo Go | Set in shell before start: `$env:EXPO_PUBLIC_API_URL="https://YOUR-SERVICE.onrender.com"` then `npx expo start -c` |
| Android APK (later) | EAS build with `EXPO_PUBLIC_API_URL` set to the Render URL |

## Redeploy Week 1 later

Deployments follow the **branch** you chose (`main`). Checking out a tag on your laptop does **not** change what Render runs until you redeploy from that commit/branch.

To force Week 1 forever on this service: keep the service branch on `main` and only merge Week 2 to `main` when you intentionally want to upgrade the hosted product (or create a second Render service from `dev`).

## Optional: admin static site on Render

1. New → **Static Site**.
2. Root Directory: `admin`.
3. Build: `npm install && npm run build`.
4. Publish directory: `dist`.
5. Env at build time: `VITE_API_URL=https://YOUR-API.onrender.com`.

## Checklist

- [ ] `/health` works from phone mobile data (not only home Wi‑Fi)
- [ ] Admin login against Render API
- [ ] Mobile login / catalog against Render API
- [ ] Upload a small PDF (Supabase still works)

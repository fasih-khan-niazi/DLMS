# Week 1 public demo checklist

API (done): `https://dlms-csij.onrender.com/health`

## 1. Clients point at Render

Defaults in code now use the Render API URL.

| Client | How |
|--------|-----|
| Admin local | `admin/.env` with `VITE_API_URL=https://dlms-csij.onrender.com` then `npm run dev` |
| Mobile Expo | `mobile/.env` with `EXPO_PUBLIC_API_URL=...` then `npx expo start -c` |
| APK | Set in `mobile/eas.json` preview env (already Render) |

Home LAN API: set those env vars back to `http://192.168.100.7:5000` / `http://localhost:5000`.

## 2. Host admin on Render (static)

1. Render → **New** → **Static Site**
2. Repo `fasih-khan-niazi/DLMS`, branch `main`
3. Root directory: `admin`
4. Build: `npm install && npm run build`
5. Publish directory: `dist`
6. Environment (build-time): `VITE_API_URL` = `https://dlms-csij.onrender.com`
7. After deploy, copy the admin URL (e.g. `https://dlms-admin-xxxx.onrender.com`)

### Firebase Auth authorized domain

Firebase Console → Authentication → Settings → **Authorized domains** → add:

`dlms-admin.onrender.com`

(hostname only — no `https://`, no `/login`).

This allows Firebase email/password sign-in from that website. Without it, the browser blocks Auth as an untrusted origin.

## 3. Smoke test (phone on mobile data)

1. Warm API: open `/health` once
2. Admin (hosted or local Vite): login as admin
3. Mobile: login student, browse catalog, open a book
4. Optional: borrow/return or reserve if you have copies

## 4. Android APK (EAS)

From `mobile/`:

```powershell
npm install -g eas-cli
eas login
eas build:configure
npm run build:apk
```

When finished, Expo gives an APK download link. Share that with clients (they enable Install unknown apps if needed).

## 5. Firebase Admin key rotation

See [`docs/firebase-key-rotation.md`](firebase-key-rotation.md).

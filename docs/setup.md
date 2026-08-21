# Setup Checklist

## Verified Local Prerequisites

- Node.js installed
- npm installed
- Git installed and available in `PATH`
- GitHub account configured as `fasih-khan-niazi`

## Project Credentials Collected

- Firebase project ID: `dlms-b7390`
- Android package name: `com.fyp.dlms`
- Firebase Android config file: `google-services.json`
- Firebase service account JSON file
- Google Books API key
- Cron secret
- Seed admin email

## Local Development Requirements

### General

- Cursor or VS Code
- GitHub access to `fasih-khan-niazi/DLMS`
- Android device with USB debugging enabled or Android emulator

### Firebase

- Firebase Spark project
- Firebase web app registered
- Firebase Android app registered
- Firestore, Auth, Storage, and Cloud Messaging enabled

### Self-Hosted API

- Local machine running the Express API during demos
- Optional `ngrok` tunnel for remote device testing

## Secret Handling Rules

- Keep `.env` files out of git
- Keep Firebase service account JSON out of git
- Keep `google-services.json` out of git
- Store sensitive files inside `secrets/` when local setup begins

## Completed Setup Tasks

1. Root and package-level env examples created
2. Secrets moved into `secrets/`
3. Workspace dependencies installed
4. Expo app and React admin app initialized
5. Firebase Auth + Firestore enabled
6. Catalog seed (optional): `npm run seed` - books/config only, no users ([`docs/seed.md`](docs/seed.md))

## Deferred

- (none for storage) PDF cloud storage uses Supabase - see `docs/supabase.md`

## Supabase (digital PDFs)

- Free Supabase project + private bucket `digital-books`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `api/.env`

## Device Testing Notes

- API health check: `http://localhost:5000/health`
- Phone LAN health check: `http://192.168.100.7:5000/health`
- Mobile project uses **Expo SDK 54** to match Play Store Expo Go
- Prefer `npx expo start` (LAN) when phone can reach PC IP
- Use `npm run start:tunnel` only if LAN Expo connection fails
- API auto-reload: from `api/`, run `npm run dev` (`tsx watch`) instead of plain `tsx`

## Open the app (quick)

1. API: `cd api` → `npm run dev`
2. Mobile: `cd mobile` → `npx expo start`
3. Open **Expo Go** → scan QR inside Expo Go
4. Confirm home screen shows `API: http://192.168.100.7:5000`

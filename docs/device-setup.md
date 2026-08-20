# Device Access Setup (Use the App Yourself)

Goal: open the DLMS Expo app on your Android phone and talk to the API on your PC.

## Your current PC LAN IP

Detected earlier: `192.168.100.7`

Even if the PC is on Ethernet and the phone is on Wi‑Fi, this often still works when both are on the **same router**.

## Step A - Keep the API reachable on the LAN

1. In `api/`, start the server:
   ```bash
   npx tsx src/index.ts
   ```
2. On the PC browser, confirm:
   - `http://localhost:5000/health`
3. On the phone browser (same building/router), try:
   - `http://192.168.100.7:5000/health`

If the phone browser shows the health JSON, the API is reachable. Good.

If it fails (timeout / refused), use **Step C (USB)** or **ngrok** later.

## Step B - Install Expo Go and open the app

1. Install **Expo Go** from Play Store (this project targets **Expo SDK 54**, which matches Play Store Expo Go).
2. On PC (LAN is enough if phone `/health` already works):
   ```bash
   cd mobile
   npx expo start
   ```
3. Open **Expo Go** (not the phone camera).
4. Scan the QR code from inside Expo Go.

### Only if Expo cannot connect over LAN

```bash
npm run start:tunnel
```

Tunnel needs `@expo/ngrok`. Answer **Y** when asked to install it.

### If you still see "incompatible with this version of Expo Go"

Your project SDK and Expo Go SDK must match. This repo is pinned to SDK 54 for Play Store Expo Go.

## Step C - USB option (recommended for reliability)

Install Android Platform Tools later (gives you `adb`):

1. Enable Developer Options + USB Debugging on the phone.
2. Connect USB cable.
3. Run:
   ```bash
   adb reverse tcp:5000 tcp:5000
   ```
4. Set API URL in the app to `http://127.0.0.1:5000` (already supported in config).

USB reverse means: phone `localhost:5000` → your PC API. No same-Wi‑Fi needed.

## App API URL config

File: `mobile/src/config/api.ts`

Modes:

- `lan` → `http://192.168.100.7:5000` (default for real phone)
- `usb` → `http://127.0.0.1:5000` (with `adb reverse`)
- `emulator` → `http://10.0.2.2:5000`

Change `API_MODE` in that file before starting Expo.

## Windows Firewall

If LAN health check fails from the phone, allow Node.js / port 5000 inbound in Windows Defender Firewall.

## What we are NOT doing yet

- Admin web portal (parked for later phases)
- Public APK distribution to friends (later, with ngrok/EAS)
- Postman token testing (optional; not required)

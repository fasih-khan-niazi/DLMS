# Android release signing (local APKs)

## Clarification

| Build path | Who signs |
|------------|-----------|
| `eas build` (Expo cloud) | Expo-managed keystore on their servers |
| Local `assembleRelease` before this setup | Default **debug** keystore |
| Local builds after this setup | **Our** `secrets/dlms-release.keystore` |

Clients who installed an EAS-signed or debug-signed APK must **uninstall once**, then install our custom-signed APK. After that, every APK built with the same `secrets/dlms-release.keystore` can update in place.

## Files (never commit)

- `secrets/dlms-release.keystore`
- `secrets/dlms-keystore.properties`

Keep a backup of both off-machine. Losing them means clients cannot update; they would uninstall/reinstall forever with a new key.

## Build locally

```powershell
cd F:\DLMS\mobile
npm run build:apk:local
```

Output: `mobile/dist/dlms-release.apk`

Requires JDK 17 and Android SDK (same as before).

## Expo / EAS later

To make cloud builds match this keystore, upload the same keystore via `eas credentials` for Android. Until then, prefer `build:apk:local` for client APKs.

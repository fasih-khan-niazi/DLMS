/**
 * Local release APK with DLMS custom keystore (secrets/).
 * Usage from mobile/: npm run build:apk:local
 * Or: node scripts/build-release-apk.js
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const mobile = path.join(root, "mobile");
const android = path.join(mobile, "android");
const props = path.join(root, "secrets", "dlms-keystore.properties");
const keystore = path.join(root, "secrets", "dlms-release.keystore");

if (!fs.existsSync(props) || !fs.existsSync(keystore)) {
  console.error("Missing secrets/dlms-release.keystore or secrets/dlms-keystore.properties");
  console.error("Generate them once and keep a backup. Never commit secrets/.");
  process.exit(1);
}

if (!fs.existsSync(android)) {
  console.error("android/ missing. Run: npx expo prebuild --platform android");
  process.exit(1);
}

const localProps = path.join(android, "local.properties");
if (!fs.existsSync(localProps)) {
  const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
  const sdkEscaped = sdk.replace(/\\/g, "\\\\");
  fs.writeFileSync(localProps, `sdk.dir=${sdkEscaped}\n`);
  console.log("Wrote android/local.properties ->", sdk);
}

const env = {
  ...process.env,
  JAVA_HOME: process.env.JAVA_HOME || "C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot",
  ANDROID_HOME:
    process.env.ANDROID_HOME ||
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || "C:\\g",
  NODE_ENV: "production",
  // Client APKs always target production Render (override local LAN .env)
  EXPO_PUBLIC_API_URL:
    process.env.EXPO_PUBLIC_API_URL_RELEASE || "https://dlms-csij.onrender.com",
};
env.Path = `${env.JAVA_HOME}\\bin;${env.ANDROID_HOME}\\platform-tools;${env.Path || process.env.PATH}`;

console.log("Building release APK with API:", env.EXPO_PUBLIC_API_URL);

const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const result = spawnSync(
  gradlew,
  [":app:clean", ":expo-constants:createExpoConfig", "assembleRelease", "--no-daemon"],
  {
  cwd: android,
  env,
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

const apk = path.join(android, "app", "build", "outputs", "apk", "release", "app-release.apk");
const distDir = path.join(mobile, "dist");
fs.mkdirSync(distDir, { recursive: true });
const out = path.join(distDir, "dlms-release.apk");
fs.copyFileSync(apk, out);
console.log("\nSigned release APK:", out);

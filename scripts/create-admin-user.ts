/**
 * Create or promote a Firebase Auth + Firestore admin user.
 * Usage:
 *   npx tsx scripts/create-admin-user.ts <email> <password> [displayName]
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

const DEFAULT_SA = path.resolve(
  __dirname,
  "../secrets/dlms-b7390-firebase-adminsdk-fbsvc-9468ed8000.json"
);
const serviceAccountPath = path.resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || DEFAULT_SA
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account not found: ${serviceAccountPath}`);
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccountPath) });
}

const auth = getAuth();
const db = getFirestore();

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const password = String(process.argv[3] || "");
  const displayName = String(process.argv[4] || "Admin").trim() || "Admin";

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-admin-user.ts <email> <password> [displayName]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password, displayName, emailVerified: true });
    console.log(`Updated existing Auth user ${email} (${uid})`);
  } catch (err: any) {
    if (err?.code !== "auth/user-not-found") throw err;
    const created = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`Created Auth user ${email} (${uid})`);
  }

  await auth.setCustomUserClaims(uid, { role: "admin" });

  await db.collection("users").doc(uid).set(
    {
      email,
      displayName,
      role: "admin",
      activeBorrowCount: 0,
      hasUnpaidFines: false,
      totalOutstandingFines: 0,
      fcmTokens: [],
      isActive: true,
      updatedAt: new Date(),
      createdAt: new Date(),
    },
    { merge: true }
  );

  console.log(`Admin ready: ${email} / role=admin / uid=${uid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

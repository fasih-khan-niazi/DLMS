/**
 * One-time seed script to create the first admin user and system config.
 * Run from project root: npx tsx scripts/seed-admin.ts
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import path from "path";

const serviceAccountPath = path.resolve(__dirname, "../secrets/dlms-b7390-firebase-adminsdk-fbsvc-9468ed8000.json");

initializeApp({
  credential: cert(serviceAccountPath),
});

const db = getFirestore();
const auth = getAuth();

const ADMIN_EMAIL = "fasihxniazi+dlmsadmin@gmail.com";
const ADMIN_PASSWORD = "Password123"; // Change this immediately after first login
const ADMIN_NAME = "DLMS Admin";

async function seed() {
  console.log("Seeding DLMS...\n");

  // 1. Create admin user
  let adminUid: string;
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    adminUid = existing.uid;
    console.log(`Admin user already exists: ${adminUid}`);
  } catch {
    const user = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
    });
    adminUid = user.uid;
    console.log(`Created admin user: ${adminUid}`);
  }

  // Set admin custom claims
  await auth.setCustomUserClaims(adminUid, { role: "admin" });

  // Create/update Firestore user doc
  await db.collection("users").doc(adminUid).set(
    {
      email: ADMIN_EMAIL,
      displayName: ADMIN_NAME,
      role: "admin",
      activeBorrowCount: 0,
      hasUnpaidFines: false,
      totalOutstandingFines: 0,
      fcmTokens: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    { merge: true }
  );
  console.log("Admin Firestore document written.");

  // 2. Seed system config
  await db.collection("config").doc("system").set(
    {
      timezone: "Asia/Karachi",
      maxBorrowLimit: 5,
      loanPeriodDays: 14,
      finePerDayRs: 50,
      reservationHoldHours: 72,
      blockCheckoutIfUnpaidFine: true,
      reminderDaysBefore: [2, 1],
      workingDaysOff: ["Sunday"],
      maxPdfSizeMb: 25,
      librariansCanBorrow: true,
    },
    { merge: true }
  );
  console.log("System config seeded.");

  // 3. Seed a sample holiday
  await db.collection("config").doc("holidays").collection("dates").doc("2026-03-23").set({
    name: "Pakistan Day",
    date: "2026-03-23",
  });
  console.log("Sample holiday seeded.");

  console.log("\nSeed complete. You can now log in with:");
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log("\n⚠️  Change the admin password immediately after first login.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

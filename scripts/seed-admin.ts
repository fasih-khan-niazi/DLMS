/**
 * Idempotent MVP seed: admin, system config, holidays, sample catalog copies,
 * optional demo librarian + student.
 *
 * From project root:
 *   npm run seed
 *   SEED_DEMO_USERS=true npm run seed
 *
 * Env overrides (optional):
 *   FIREBASE_SERVICE_ACCOUNT_PATH
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME
 *   SEED_DEMO_USERS=true
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
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

const db = getFirestore();
const auth = getAuth();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "fasihxniazi+dlmsadmin@gmail.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Password123";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "DLMS Admin";

const DEMO_USERS = process.env.SEED_DEMO_USERS === "true";

const SAMPLE_ISBN = "9780141036144";
const SAMPLE_TITLE = "Animal Farm";
const SAMPLE_AUTHORS = ["George Orwell"];

async function upsertAuthUser(input: {
  email: string;
  password: string;
  displayName: string;
  role: "admin" | "librarian" | "student";
}): Promise<string> {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(input.email);
    uid = existing.uid;
    console.log(`  exists ${input.role}: ${uid} (${input.email})`);
  } catch {
    const user = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    });
    uid = user.uid;
    console.log(`  created ${input.role}: ${uid} (${input.email})`);
  }

  await auth.setCustomUserClaims(uid, { role: input.role });
  await db.collection("users").doc(uid).set(
    {
      email: input.email,
      displayName: input.displayName,
      role: input.role,
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
  return uid;
}

async function seedSampleCatalog() {
  const catalogRef = db.collection("catalog").doc(SAMPLE_ISBN);
  const existing = await catalogRef.get();

  const copyDefs = [
    { copyId: "cpy_seed_af_01", barcode: "SEED-AF-01" },
    { copyId: "cpy_seed_af_02", barcode: "SEED-AF-02" },
  ];

  if (existing.exists) {
    console.log(`Sample catalog already present: ${SAMPLE_ISBN}`);
  } else {
    await catalogRef.set({
      isbn: SAMPLE_ISBN,
      title: SAMPLE_TITLE,
      authors: SAMPLE_AUTHORS,
      description: "Seed sample title for borrow / QR / reservation tests.",
      categories: ["Fiction"],
      publishedDate: "1945",
      pageCount: 112,
      thumbnailUrl: "",
      totalCopies: copyDefs.length,
      availableCount: copyDefs.length,
      issuedCount: 0,
      reservedCount: 0,
      damagedCount: 0,
      searchKeywords: [
        "animal",
        "farm",
        "orwell",
        SAMPLE_ISBN.toLowerCase(),
        SAMPLE_TITLE.toLowerCase(),
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Catalog seeded: ${SAMPLE_TITLE} (${SAMPLE_ISBN})`);
  }

  for (const def of copyDefs) {
    const copyRef = db.collection("bookCopies").doc(def.copyId);
    const copySnap = await copyRef.get();
    if (copySnap.exists) {
      console.log(`  copy exists: ${def.copyId}`);
      continue;
    }
    const qrPayload = `${def.copyId}_${SAMPLE_ISBN}`;
    await copyRef.set({
      copyId: def.copyId,
      isbn: SAMPLE_ISBN,
      title: SAMPLE_TITLE,
      authors: SAMPLE_AUTHORS,
      barcode: def.barcode,
      qrPayload,
      status: "available",
      currentLoanId: null,
      reservedForUserId: null,
      readyAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`  copy created: ${def.copyId}  QR: ${qrPayload}`);
  }

  // Keep counts consistent if catalog existed but copies were missing
  const copiesSnap = await db
    .collection("bookCopies")
    .where("isbn", "==", SAMPLE_ISBN)
    .get();
  let available = 0;
  let issued = 0;
  let reserved = 0;
  let damaged = 0;
  copiesSnap.docs.forEach((doc) => {
    const status = doc.data().status;
    if (status === "available") available += 1;
    else if (status === "issued") issued += 1;
    else if (status === "reserved") reserved += 1;
    else if (status === "damaged") damaged += 1;
  });
  await catalogRef.set(
    {
      totalCopies: copiesSnap.size,
      availableCount: available,
      issuedCount: issued,
      reservedCount: reserved,
      damagedCount: damaged,
      updatedAt: new Date(),
    },
    { merge: true }
  );
}

async function seed() {
  console.log("Seeding DLMS MVP...\n");

  console.log("1) Users");
  await upsertAuthUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    displayName: ADMIN_NAME,
    role: "admin",
  });

  if (DEMO_USERS) {
    await upsertAuthUser({
      email: process.env.SEED_LIBRARIAN_EMAIL || "fasihxniazi+dlmslib@gmail.com",
      password: process.env.SEED_LIBRARIAN_PASSWORD || "Password123",
      displayName: "DLMS Librarian",
      role: "librarian",
    });
    await upsertAuthUser({
      email: process.env.SEED_STUDENT_EMAIL || "fasihxniazi+dlmsstudent@gmail.com",
      password: process.env.SEED_STUDENT_PASSWORD || "Password123",
      displayName: "DLMS Student",
      role: "student",
    });
  } else {
    console.log("  (skip demo librarian/student; set SEED_DEMO_USERS=true to create)");
  }

  console.log("\n2) System config");
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
      updatedAt: new Date(),
    },
    { merge: true }
  );
  console.log("  config/system upserted");

  console.log("\n3) Holidays");
  const holidays = [
    { date: "2026-03-23", name: "Pakistan Day" },
    { date: "2026-08-14", name: "Independence Day" },
  ];
  for (const h of holidays) {
    await db.collection("config").doc("holidays").collection("dates").doc(h.date).set({
      name: h.name,
      date: h.date,
    });
    console.log(`  ${h.date} ${h.name}`);
  }

  console.log("\n4) Sample catalog");
  await seedSampleCatalog();

  console.log("\nSeed complete.");
  console.log(`  Admin: ${ADMIN_EMAIL}`);
  if (DEMO_USERS) {
    console.log("  Demo librarian/student emails printed above; change passwords after first login.");
  }
  console.log("  Sample QR payloads: cpy_seed_af_01_" + SAMPLE_ISBN);
  console.log("                     cpy_seed_af_02_" + SAMPLE_ISBN);
  console.log("\nChange default passwords after first login.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

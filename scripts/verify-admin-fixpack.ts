/**
 * Deep regression for the admin fix pack (C1–C3, H1–H6).
 *
 * Mutating but restores holidays/config/catalog where practical.
 *
 * Usage (from repo root, API must be on the same Firestore as service account):
 *   npx tsx scripts/verify-admin-fixpack.ts [apiBaseUrl]
 */
import axios, { type AxiosInstance } from "axios";
import { auth, db } from "../api/src/config/firebase";
import {
  fineRemaining,
  isValidIanaTimeZone,
  normalizeWorkingDaysOff,
} from "../api/src/services/loans";

const API_BASE = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const FIREBASE_WEB_API_KEY = "AIzaSyCREotdbbgVbkqSIyMTA20LVbr2Bu0ZMCQ";

let failures = 0;
const pass = (msg: string) => console.log(`  PASS  ${msg}`);
const fail = (msg: string) => {
  console.log(`  FAIL  ${msg}`);
  failures += 1;
};

async function mintClient(uid: string): Promise<AxiosInstance> {
  const customToken = await auth.createCustomToken(uid);
  const { data } = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    { token: customToken, returnSecureToken: true }
  );
  return axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${data.idToken}` },
    timeout: 45000,
    validateStatus: () => true,
  });
}

async function findRole(role: string) {
  const snap = await db.collection("users").where("role", "==", role).limit(8).get();
  const row = snap.docs.find((d) => d.data().isActive !== false);
  if (!row) throw new Error(`No active ${role} user`);
  return row.id;
}

async function main() {
  console.log(`Admin fix-pack verification against ${API_BASE}`);
  console.log("================================================");

  // --- Unit: C1 remaining math + C3 helpers (no network) ---
  console.log("\n0) Pure helpers");
  if (fineRemaining({ fineAmount: 100, finePaidAmount: 40, finePaid: false }) === 60) {
    pass("fineRemaining after partial = 60");
  } else fail("fineRemaining after partial");
  if (fineRemaining({ fineAmount: 100, finePaidAmount: 100, finePaid: true }) === 0) {
    pass("fineRemaining when paid = 0");
  } else fail("fineRemaining when paid");
  if (
    JSON.stringify(normalizeWorkingDaysOff(["sunday", "Monday", "bogus"])) ===
    JSON.stringify(["Sunday", "Monday"])
  ) {
    pass("normalizeWorkingDaysOff casing");
  } else fail("normalizeWorkingDaysOff casing");
  if (isValidIanaTimeZone("Asia/Karachi") && !isValidIanaTimeZone("Not/AZone")) {
    pass("isValidIanaTimeZone");
  } else fail("isValidIanaTimeZone");

  const adminUid = await findRole("admin");
  const librarianUid = await findRole("librarian");
  const admin = await mintClient(adminUid);
  const librarian = await mintClient(librarianUid);

  // --- Health / role gates ---
  console.log("\n1) Health and role gates");
  const health = await axios.get(`${API_BASE}/health`, { timeout: 10000, validateStatus: () => true });
  if (health.status === 200) pass("/health");
  else fail(`/health ${health.status}`);

  const libUsers = await librarian.get("/api/admin/users");
  if (libUsers.status === 403) pass("librarian blocked from Users");
  else fail(`librarian Users ${libUsers.status}`);

  // --- H1 users filters ---
  console.log("\n2) Users filters (H1)");
  const students = await admin.get("/api/admin/users", {
    params: { role: "student", page: 1, pageSize: 10 },
  });
  if (students.status === 200 && Array.isArray(students.data.users)) {
    const bad = students.data.users.filter((u: { role?: string }) => u.role !== "student");
    if (bad.length === 0) pass(`role=student returns only students (${students.data.total})`);
    else fail("role=student leaked other roles");
  } else fail(`users filter ${students.status}`);

  const suspended = await admin.get("/api/admin/users", {
    params: { status: "suspended", page: 1, pageSize: 10 },
  });
  if (suspended.status === 200) {
    const bad = (suspended.data.users || []).filter((u: { isActive?: boolean }) => u.isActive !== false);
    if (bad.length === 0) pass("status=suspended filter");
    else fail("suspended filter leaked active users");
  } else fail(`suspended ${suspended.status}`);

  // --- C3 config validation ---
  console.log("\n3) Config calendar validation (C3)");
  const badTz = await admin.put("/api/admin/config", { timezone: "Not/ARealZone" });
  if (badTz.status === 400) pass("rejects invalid timezone");
  else fail(`invalid timezone status ${badTz.status}`);

  const badDays = await admin.put("/api/admin/config", { workingDaysOff: ["sundae"] });
  if (badDays.status === 400) pass("rejects bogus weekdays");
  else fail(`bogus weekdays ${badDays.status}`);

  const okDays = await admin.put("/api/admin/config", {
    workingDaysOff: ["sunday", "Saturday"],
  });
  if (
    okDays.status === 200 &&
    JSON.stringify(okDays.data.config?.workingDaysOff) === JSON.stringify(["Sunday", "Saturday"])
  ) {
    pass("normalizes sunday/Saturday");
  } else fail(`weekday normalize ${okDays.status} ${JSON.stringify(okDays.data.config?.workingDaysOff)}`);

  // restore Sunday only
  await admin.put("/api/admin/config", { workingDaysOff: ["Sunday"] });

  // --- H3 holidays ---
  console.log("\n4) Holidays CRUD (H3)");
  const testDate = "2099-12-31";
  const upsert = await admin.post("/api/admin/holidays", {
    date: testDate,
    name: "Verify Fixture Holiday",
  });
  if (upsert.status === 200) pass("holiday upsert");
  else fail(`holiday upsert ${upsert.status} ${JSON.stringify(upsert.data)}`);

  const list = await admin.get("/api/admin/holidays");
  if (
    list.status === 200 &&
    (list.data.holidays || []).some((h: { date: string }) => h.date === testDate)
  ) {
    pass("holiday listed");
  } else fail("holiday not listed");

  const del = await admin.delete(`/api/admin/holidays/${testDate}`);
  if (del.status === 200) pass("holiday deleted");
  else fail(`holiday delete ${del.status}`);

  // --- H4 loans ---
  console.log("\n5) Loans oversight (H4)");
  const loans = await admin.get("/api/admin/loans", {
    params: { status: "all", page: 1, pageSize: 10 },
  });
  if (loans.status === 200 && Array.isArray(loans.data.loans)) {
    pass(`loans list total=${loans.data.total} overdue=${loans.data.overdueCount}`);
  } else fail(`loans ${loans.status} ${JSON.stringify(loans.data)}`);

  // --- H5 reports TZ ---
  console.log("\n6) Reports timezone (H5)");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const summary = await admin.get("/api/admin/reports/summary", {
    params: { from: today, to: today },
  });
  if (summary.status === 200 && summary.data.timeZone) {
    pass(`reports timeZone=${summary.data.timeZone}`);
  } else if (summary.status === 200) {
    fail("reports missing timeZone field (API not redeployed with H5?)");
  } else fail(`reports ${summary.status}`);

  // --- Catalog / digital staff filters (H6 prerequisites) ---
  console.log("\n7) Catalog + digital staff filters");
  const catalog = await admin.get("/api/catalog/books", {
    params: { catalogStatus: "all", page: 1, pageSize: 5 },
  });
  if (catalog.status === 200) pass(`catalog all page total=${catalog.data.total}`);
  else fail(`catalog ${catalog.status}`);

  const digital = await admin.get("/api/digital-books", {
    params: { includeUnpublished: "1", publishStatus: "all", page: 1, pageSize: 5 },
  });
  if (digital.status === 200) pass(`digital all page total=${digital.data.total}`);
  else fail(`digital ${digital.status}`);

  // --- H2 fines list accrual shape ---
  console.log("\n8) Fines list shape (H2)");
  const fines = await admin.get("/api/admin/fines", {
    params: { view: "loans", page: 1, pageSize: 10 },
  });
  if (fines.status === 200 && "loansTotal" in fines.data) {
    const sample = (fines.data.loans || [])[0];
    if (!sample || typeof sample.remaining === "number") {
      pass(`fines list remaining field (loansTotal=${fines.data.loansTotal})`);
    } else fail("fines loan rows missing remaining");
  } else fail(`fines ${fines.status} ${JSON.stringify(fines.data)}`);

  // --- C1 mark-paid accounting against a synthetic unpaid loan if we can create one ---
  console.log("\n9) Mark-paid remaining accounting (C1)");
  const studentSnap = await db
    .collection("users")
    .where("role", "==", "student")
    .limit(8)
    .get();
  const student = studentSnap.docs.find((d) => d.data().isActive !== false);
  const copies = await db.collection("bookCopies").where("status", "==", "available").limit(20).get();
  let fixtureLoanId: string | null = null;
  let fixtureCopyId: string | null = null;
  let fixtureUserId: string | null = null;
  let priorOutstanding = 0;

  try {
    if (!student) throw new Error("no student");
    fixtureUserId = student.id;
    const copyDoc = copies.docs.find((d) => {
      const isbn = String(d.data().isbn || "");
      return isbn.length > 0;
    });
    if (!copyDoc) throw new Error("no available copy");
    fixtureCopyId = copyDoc.id;
    const isbn = String(copyDoc.data().isbn || "");
    const stuClient = await mintClient(student.id);

    // Enable in-app borrow temporarily
    await db.collection("config").doc("system").set({ allowInAppCopyBorrow: true }, { merge: true });

    const borrow = await stuClient.post("/api/loans/borrow", { copyId: fixtureCopyId });
    if (borrow.status < 200 || borrow.status >= 300) {
      fail(`borrow for C1 fixture ${borrow.status} ${JSON.stringify(borrow.data)}`);
    } else {
      fixtureLoanId = String(borrow.data.loanId || "");
      const duePast = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      await db.collection("loans").doc(fixtureLoanId).update({
        dueDate: duePast,
        status: "overdue",
        fineAmount: 100,
        finePaidAmount: 40,
        finePaid: false,
      });
      const userRef = db.collection("users").doc(student.id);
      const userSnap = await userRef.get();
      priorOutstanding = Number(userSnap.data()?.totalOutstandingFines || 0);
      // Set outstanding to at least remaining 60 for clean math
      await userRef.update({
        totalOutstandingFines: Math.max(priorOutstanding, 60),
        hasUnpaidFines: true,
      });

      const mark = await admin.post(`/api/admin/loans/${fixtureLoanId}/mark-fine-paid`);
      if (mark.status !== 200) {
        fail(`mark-paid ${mark.status} ${JSON.stringify(mark.data)}`);
      } else {
        const loanFresh = await db.collection("loans").doc(fixtureLoanId).get();
        const loan = loanFresh.data() || {};
        const userFresh = await userRef.get();
        const user = userFresh.data() || {};
        const cleared = Number(mark.data.amountCleared || 0);
        if (cleared === 60) pass("amountCleared = remaining 60 (not full 100)");
        else fail(`amountCleared=${cleared} expected 60`);
        if (loan.finePaid === true && Number(loan.finePaidAmount || 0) === 100) {
          pass("loan finePaidAmount set to full assessed");
        } else fail(`loan paid state finePaidAmount=${loan.finePaidAmount}`);
        const expectedOut = Math.max(Math.max(priorOutstanding, 60) - 60, 0);
        if (Number(user.totalOutstandingFines || 0) === expectedOut) {
          pass("user outstanding decreased by remaining only");
        } else {
          fail(
            `user outstanding=${user.totalOutstandingFines} expected ${expectedOut} (prior ${priorOutstanding})`
          );
        }
      }

      // Return the copy to clean shelf
      const ret = await stuClient.post("/api/loans/return", { copyId: fixtureCopyId });
      if (ret.status >= 200 && ret.status < 300) pass("fixture loan returned");
      else {
        // Fine already paid so return should work; if not, force restore
        fail(`return after mark-paid ${ret.status} ${JSON.stringify(ret.data)}`);
        await db.collection("bookCopies").doc(fixtureCopyId).update({
          status: "available",
          currentLoanId: null,
          currentBorrowerId: null,
        });
      }
    }
  } catch (err) {
    fail(`C1 fixture setup: ${String(err)}`);
    if (fixtureCopyId) {
      await db.collection("bookCopies").doc(fixtureCopyId).update({
        status: "available",
        currentLoanId: null,
        currentBorrowerId: null,
      });
    }
  }

  // --- Dashboard ---
  console.log("\n10) Dashboard");
  const dash = await admin.get("/api/admin/dashboard");
  if (dash.status === 200 && typeof dash.data.overdueLoans === "number") {
    pass(`dashboard overdueLoans=${dash.data.overdueLoans}`);
  } else fail(`dashboard ${dash.status}`);

  console.log("\n======== ADMIN FIX-PACK SCORECARD ========");
  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

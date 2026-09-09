/** ye script park smoke: admin pages + student/librarian mobile paths check karta hai */
import axios, { type AxiosInstance } from "axios";
import PDFDocument from "pdfkit";
import FormData from "form-data";
import { PassThrough } from "stream";
import { auth, db } from "../api/src/config/firebase";

const API_BASE = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const FIREBASE_WEB_API_KEY = "AIzaSyCREotdbbgVbkqSIyMTA20LVbr2Bu0ZMCQ";
const FIXTURE_ISBN = "9780000000099";
const FIXTURE_HOLIDAY = "2099-01-01";

let failures = 0;
const pass = (msg: string) => console.log(`  PASS  ${msg}`);
const fail = (msg: string) => {
  console.log(`  FAIL  ${msg}`);
  failures += 1;
};

async function mint(uid: string): Promise<AxiosInstance> {
  const customToken = await auth.createCustomToken(uid);
  const { data } = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    { token: customToken, returnSecureToken: true }
  );
  return axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${data.idToken}` },
    timeout: 60000,
    validateStatus: () => true,
  });
}

async function findRole(role: string) {
  const snap = await db.collection("users").where("role", "==", role).limit(8).get();
  const row = snap.docs.find((d) => d.data().isActive !== false);
  if (!row) throw new Error(`No active ${role}`);
  return { uid: row.id, email: String(row.data()?.email || "") };
}

async function tinyPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (c) => chunks.push(Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    doc.pipe(stream);
    doc.fontSize(18).text("DLMS park smoke PDF");
    doc.end();
  });
}

async function pickAvailableCopy() {
  const copies = await db.collection("bookCopies").where("status", "==", "available").limit(30).get();
  for (const doc of copies.docs) {
    const isbn = String(doc.data().isbn || "");
    if (isbn === FIXTURE_ISBN) continue;
    const cat = await db.collection("catalog").doc(isbn).get();
    if (cat.exists && cat.data()?.isActive !== false) {
      return { copyId: doc.id, isbn, title: String(cat.data()?.title || isbn) };
    }
  }
  return null;
}

async function main() {
  console.log(`Park smoke against ${API_BASE}`);
  console.log("==============================");

  const adminUser = await findRole("admin");
  const librarian = await findRole("librarian");
  const studentSnap = await db.collection("users").where("role", "==", "student").limit(16).get();
  const students = studentSnap.docs
    .filter((d) => d.data().isActive !== false)
    .sort((a, b) => {
      const fineA = Number(a.data().totalOutstandingFines || 0);
      const fineB = Number(b.data().totalOutstandingFines || 0);
      if (fineA !== fineB) return fineA - fineB;
      return Number(a.data().activeBorrowCount || 0) - Number(b.data().activeBorrowCount || 0);
    });
  if (students.length < 1) throw new Error("Need a student");
  const student = { uid: students[0].id, email: String(students[0].data().email || "") };

  const admin = await mint(adminUser.uid);
  const lib = await mint(librarian.uid);
  const stu = await mint(student.uid);

  // Student paths ke liye borrowability restore
  await db.collection("config").doc("system").set(
    { allowInAppCopyBorrow: true, blockCheckoutIfUnpaidFine: true, librariansCanBorrow: false },
    { merge: true }
  );

  // A) Admin portal backends
  console.log("\nA) Admin portal page backends");

  const dash = await admin.get("/api/admin/dashboard");
  if (dash.status === 200 && typeof dash.data.users === "number") pass("Dashboard");
  else fail(`Dashboard ${dash.status}`);

  const users = await admin.get("/api/admin/users", { params: { page: 1, pageSize: 10 } });
  if (users.status === 200 && Array.isArray(users.data.users)) pass("Users list");
  else fail(`Users ${users.status}`);

  const loans = await admin.get("/api/admin/loans", { params: { status: "overdue", page: 1 } });
  if (loans.status === 200) pass(`Loans overdue (${loans.data.total ?? 0})`);
  else fail(`Loans ${loans.status}`);

  const fines = await admin.get("/api/admin/fines", { params: { view: "loans", page: 1 } });
  if (fines.status === 200) pass("Fines list");
  else fail(`Fines ${fines.status}`);

  if (student.email) {
    const lookup = await admin.get("/api/fines/lookup", { params: { email: student.email } });
    if (lookup.status === 200) pass("Fines desk lookup");
    else fail(`Fines lookup ${lookup.status} ${JSON.stringify(lookup.data)}`);
  }

  const reservations = await admin.get("/api/admin/reservations");
  if (reservations.status === 200) pass("Reservations list");
  else fail(`Reservations ${reservations.status}`);

  const reconcile = await admin.post("/api/admin/reservations/reconcile", {});
  if (reconcile.status === 200) pass("Reservations reconcile");
  else fail(`Reconcile ${reconcile.status}`);

  const cfg = await admin.get("/api/admin/config", { params: { _t: Date.now() } });
  if (cfg.status === 200 && cfg.data.config) pass("Config read");
  else fail(`Config ${cfg.status}`);

  const holidayUpsert = await admin.post("/api/admin/holidays", {
    date: FIXTURE_HOLIDAY,
    name: "Park Smoke Holiday",
  });
  const holidayList = await admin.get("/api/admin/holidays");
  const holidayDel = await admin.delete(`/api/admin/holidays/${FIXTURE_HOLIDAY}`);
  if (
    holidayUpsert.status === 200 &&
    holidayList.status === 200 &&
    (holidayList.data.holidays || []).some((h: { date: string }) => h.date === FIXTURE_HOLIDAY) &&
    holidayDel.status === 200
  ) {
    pass("Config holidays CRUD");
  } else fail("Config holidays CRUD");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: String(cfg.data.config?.timezone || "Asia/Karachi"),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const summary = await admin.get("/api/admin/reports/summary", {
    params: { from: today, to: today },
  });
  const csv = await admin.get("/api/admin/reports/export.csv", {
    params: { from: today, to: today },
    responseType: "text",
  });
  const pdf = await admin.get("/api/admin/reports/export.pdf", {
    params: { from: today, to: today },
    responseType: "arraybuffer",
  });
  if (summary.status === 200 && summary.data.timeZone) pass("Reports summary");
  else fail(`Reports summary ${summary.status}`);
  if (csv.status === 200 && String(csv.data).includes("metric")) pass("Reports CSV");
  else fail(`Reports CSV ${csv.status}`);
  if (pdf.status === 200 && Buffer.from(pdf.data).slice(0, 4).toString() === "%PDF") {
    pass("Reports PDF");
  } else fail(`Reports PDF ${pdf.status}`);

  // B) Catalog create / edit / digital
  console.log("\nB) Admin Catalog create / edit / status / digital");

  const addBook = await admin.post("/api/catalog/books", {
    isbn: FIXTURE_ISBN,
    title: "Park Smoke Fixture Book",
    authors: ["QA Bot"],
    description: "Temporary fixture for park smoke",
    useGoogleBooks: false,
  });
  if (addBook.status === 200 || addBook.status === 201) pass("Add physical title");
  else fail(`Add book ${addBook.status} ${JSON.stringify(addBook.data)}`);

  const addCopies = await admin.post("/api/catalog/copies", {
    isbn: FIXTURE_ISBN,
    quantity: 1,
  });
  if (addCopies.status === 200 || addCopies.status === 201) pass("Add copies");
  else fail(`Add copies ${addCopies.status} ${JSON.stringify(addCopies.data)}`);

  const editBook = await admin.patch(`/api/catalog/books/${FIXTURE_ISBN}`, {
    title: "Park Smoke Fixture Book (edited)",
    authors: ["QA Bot", "Editor"],
    description: "Edited",
  });
  if (editBook.status === 200) pass("Edit physical metadata");
  else fail(`Edit book ${editBook.status}`);

  const deactivate = await admin.patch(`/api/catalog/books/${FIXTURE_ISBN}/status`, {
    isActive: false,
  });
  const reactivate = await admin.patch(`/api/catalog/books/${FIXTURE_ISBN}/status`, {
    isActive: true,
  });
  if (deactivate.status === 200 && reactivate.status === 200) pass("Soft-deactivate / reactivate");
  else fail(`Status toggle ${deactivate.status}/${reactivate.status}`);

  const catalogAll = await admin.get("/api/catalog/books", {
    params: { catalogStatus: "all", q: "Park Smoke", page: 1, pageSize: 10 },
  });
  if (
    catalogAll.status === 200 &&
    (catalogAll.data.results || []).some((b: { isbn?: string }) => b.isbn === FIXTURE_ISBN)
  ) {
    pass("Catalog search finds fixture");
  } else fail("Catalog search missed fixture");

  let uploadedDigitalId: string | null = null;
  try {
    const pdfBuf = await tinyPdf();
    const form = new FormData();
    form.append("file", pdfBuf, { filename: "park-smoke.pdf", contentType: "application/pdf" });
    form.append("title", "Park Smoke E-book");
    form.append("author", "QA Bot");
    const upload = await admin.post("/api/digital-books", form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    });
    if (upload.status === 201 && upload.data.digitalBookId) {
      uploadedDigitalId = String(upload.data.digitalBookId);
      pass(`Upload digital PDF (${uploadedDigitalId})`);
      const unpublish = await admin.patch(`/api/digital-books/${uploadedDigitalId}/status`, {
        isPublished: false,
      });
      const publish = await admin.patch(`/api/digital-books/${uploadedDigitalId}/status`, {
        isPublished: true,
      });
      if (unpublish.status === 200 && publish.status === 200) pass("Digital publish toggle");
      else fail(`Digital status ${unpublish.status}/${publish.status}`);
    } else {
      fail(`Digital upload ${upload.status} ${JSON.stringify(upload.data)}`);
    }
  } catch (err) {
    fail(`Digital upload exception: ${String(err)}`);
  }

  // C) Mobile student paths
  console.log("\nC) Mobile student paths");

  const appCfg = await stu.get("/api/config/app");
  if (appCfg.status === 200 && "allowInAppCopyBorrow" in appCfg.data) pass("Mobile /config/app");
  else fail(`config/app ${appCfg.status}`);

  const me = await stu.get("/api/auth/me");
  if (me.status === 200 && me.data.role === "student") pass("Student /auth/me");
  else fail(`auth/me ${me.status}`);

  const browse = await stu.get("/api/catalog/books", { params: { page: 1, pageSize: 5 } });
  if (browse.status === 200) pass("Student catalog browse");
  else fail(`Student catalog ${browse.status}`);

  const digitalList = await stu.get("/api/digital-books", { params: { page: 1, pageSize: 5 } });
  if (digitalList.status === 200) pass("Student digital library");
  else fail(`Student digital ${digitalList.status}`);

  {
    // Leftover unpaid balance clear taake borrow smoke block na ho
    const loansSnap = await db.collection("loans").where("userId", "==", student.uid).get();
    for (const loanDoc of loansSnap.docs) {
      await admin.post(`/api/admin/loans/${loanDoc.id}/mark-fine-paid`);
    }
    await db.collection("users").doc(student.uid).set(
      { totalOutstandingFines: 0, hasUnpaidFines: false },
      { merge: true }
    );
  }

  const book = await pickAvailableCopy();
  if (!book) {
    fail("No available copy for student borrow smoke");
  } else {
    const borrow = await stu.post("/api/loans/borrow", { copyId: book.copyId });
    if (borrow.status >= 200 && borrow.status < 300) {
      pass(`Student borrow ${book.title}`);
      const mine = await stu.get("/api/loans/mine", { params: { status: "active" } });
      if (mine.status === 200) pass("Student Activity loans");
      else fail(`loans/mine ${mine.status}`);
      const ret = await stu.post("/api/loans/return", { copyId: book.copyId });
      if (ret.status >= 200 && ret.status < 300) pass("Student return");
      else fail(`return ${ret.status} ${JSON.stringify(ret.data)}`);
    } else {
      fail(`Student borrow ${borrow.status} ${JSON.stringify(borrow.data)}`);
    }
  }

  const notices = await stu.get("/api/notifications");
  if (notices.status === 200) pass("Student notifications inbox");
  else fail(`notifications ${notices.status}`);

  // D) Mobile librarian paths
  console.log("\nD) Mobile librarian paths");

  const libMe = await lib.get("/api/auth/me");
  if (libMe.status === 200 && (libMe.data.role === "librarian" || libMe.data.role === "admin")) {
    pass("Librarian /auth/me");
  } else fail(`Librarian me ${libMe.status}`);

  const libCatalog = await lib.get("/api/catalog/books", {
    params: { catalogStatus: "inactive", page: 1, pageSize: 5 },
  });
  if (libCatalog.status === 200) pass("Librarian inactive catalog filter");
  else fail(`Librarian catalog ${libCatalog.status}`);

  if (student.email) {
    const desk = await lib.get("/api/fines/lookup", { params: { email: student.email } });
    if (desk.status === 200 || desk.status === 403) {
      if (desk.status === 200) pass("Librarian Collect fines lookup");
      else fail(`Librarian lookup ${desk.status} ${JSON.stringify(desk.data)}`);
    } else fail(`Librarian lookup ${desk.status}`);
  }

  const gateBorrow = await lib.post("/api/loans/borrow", {
    copyId: book?.copyId || "cpy_missing",
  });
  if (gateBorrow.status === 403 && String(gateBorrow.data?.error || "").includes("Librarian")) {
    pass("Librarian borrow gated off");
  } else if (gateBorrow.status === 403) {
    pass(`Librarian borrow blocked (${gateBorrow.data?.error})`);
  } else {
    fail(`Librarian gate borrow ${gateBorrow.status} ${JSON.stringify(gateBorrow.data)}`);
  }

  // E) Fixture cleanup
  console.log("\nE) Cleanup fixtures");
  try {
    // Fixture copies hatao, title soft-deactivate
    const copies = await db.collection("bookCopies").where("isbn", "==", FIXTURE_ISBN).get();
    for (const c of copies.docs) {
      await c.ref.delete();
    }
    await db.collection("catalog").doc(FIXTURE_ISBN).set(
      {
        isActive: false,
        availableCount: 0,
        totalCopies: 0,
        issuedCount: 0,
        reservedCount: 0,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    pass("Fixture physical title cleaned");
  } catch (err) {
    fail(`Physical cleanup ${String(err)}`);
  }

  if (uploadedDigitalId) {
    const unpub = await admin.patch(`/api/digital-books/${uploadedDigitalId}/status`, {
      isPublished: false,
    });
    if (unpub.status === 200) pass("Uploaded e-book unpublished after smoke");
    else fail(`E-book cleanup ${unpub.status}`);
  }

  console.log("\n======== PARK SMOKE SCORECARD ========");
  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

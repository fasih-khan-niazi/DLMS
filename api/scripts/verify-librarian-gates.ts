/**
 * Librarian borrow/reserve gates.
 *
 * When librariansCanBorrow is off, a librarian must get 403 on borrow and
 * reserve. A student must not get that same error for the same endpoints
 * (they may get 409 for other business reasons — that is still a pass).
 *
 * Restores the original config flag.
 *
 * Usage (from api/):
 *   npx tsx scripts/verify-librarian-gates.ts [apiBaseUrl]
 */
import axios, { type AxiosInstance } from "axios";
import { auth, db } from "../src/config/firebase";

const API_BASE = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const FIREBASE_WEB_API_KEY = "AIzaSyCREotdbbgVbkqSIyMTA20LVbr2Bu0ZMCQ";

let failures = 0;
const pass = (msg: string) => console.log(`  PASS  ${msg}`);
const fail = (msg: string) => {
  console.log(`  FAIL  ${msg}`);
  failures += 1;
};

async function client(uid: string): Promise<AxiosInstance> {
  const customToken = await auth.createCustomToken(uid);
  const { data } = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    { token: customToken, returnSecureToken: true }
  );
  return axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${data.idToken}` },
    timeout: 30000,
    validateStatus: () => true,
  });
}

async function main() {
  console.log(`Librarian gate check against ${API_BASE}`);
  console.log("=======================================");

  const libSnap = await db.collection("users").where("role", "==", "librarian").limit(3).get();
  const librarian = libSnap.docs.find((d) => d.data().isActive !== false);
  if (!librarian) throw new Error("No active librarian account found");

  const stuSnap = await db.collection("users").where("role", "==", "student").limit(3).get();
  const student = stuSnap.docs.find((d) => d.data().isActive !== false);
  if (!student) throw new Error("No active student account found");

  const copies = await db.collection("bookCopies").where("status", "==", "available").limit(1).get();
  if (copies.empty) throw new Error("No available copy to attempt borrow against");
  const copyId = copies.docs[0].id;
  const isbn = String(copies.docs[0].data().isbn || "");

  const cfgRef = db.collection("config").doc("system");
  const original = (await cfgRef.get()).data()?.librariansCanBorrow;
  await cfgRef.set({ librariansCanBorrow: false }, { merge: true });

  const lib = await client(librarian.id);
  const stu = await client(student.id);

  try {
    console.log(`\nLibrarian ${librarian.id}, student ${student.id}`);
    console.log(`Probe copy ${copyId} / ${isbn}`);

    console.log(`\n1) Librarian borrow while gate is off`);
    const borrow = await lib.post("/api/loans/borrow", { copyId });
    if (borrow.status === 403 && String(borrow.data?.error || "").toLowerCase().includes("librarian")) {
      pass(`403 "${borrow.data.error}"`);
    } else {
      fail(`expected librarian 403, got ${borrow.status} ${JSON.stringify(borrow.data)}`);
    }

    console.log(`\n2) Librarian reserve while gate is off`);
    const reserve = await lib.post("/api/reservations", { isbn });
    if (reserve.status === 403 && String(reserve.data?.error || "").toLowerCase().includes("librarian")) {
      pass(`403 "${reserve.data.error}"`);
    } else {
      fail(`expected librarian 403, got ${reserve.status} ${JSON.stringify(reserve.data)}`);
    }

    console.log(`\n3) Student is not blocked by the librarian gate`);
    const stuBorrow = await stu.post("/api/loans/borrow", { copyId });
    const stuMsg = String(stuBorrow.data?.error || stuBorrow.data?.message || "");
    if (stuBorrow.status === 403 && stuMsg.toLowerCase().includes("librarian")) {
      fail("student received the librarian-only 403");
    } else {
      pass(`student borrow ${stuBorrow.status} (not the librarian gate)`);
      if (stuBorrow.status === 201 || stuBorrow.status === 200) {
        try {
          await stu.post("/api/loans/return", { copyId });
          console.log("   returned accidental student loan");
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    if (original === undefined) {
      await cfgRef.set({ librariansCanBorrow: false }, { merge: true });
    } else {
      await cfgRef.set({ librariansCanBorrow: original }, { merge: true });
    }
    console.log(`\n   librariansCanBorrow restored to ${String(original ?? false)}`);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Librarian-gate test crashed:", error?.response?.data || error?.message || error);
  process.exit(2);
});

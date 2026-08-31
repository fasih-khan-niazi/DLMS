/**
 * Desk fine collection: lookup, partial/full pay, return blocked until paid.
 *
 * Restores copies and config. Usage (from repo root):
 *   npx tsx scripts/verify-fines-collect.ts [apiBaseUrl]
 */
import axios, { type AxiosInstance } from "axios";
import { auth, db } from "../api/src/config/firebase";

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

function qrPayload(copyId: string, isbn: string) {
  return `${copyId}_${isbn}`;
}

async function pickStudents(count: number) {
  const snap = await db.collection("users").where("role", "==", "student").limit(16).get();
  const rows = snap.docs
    .filter((d) => d.data().isActive !== false && String(d.data().email || "").includes("@"))
    .sort(
      (a, b) =>
        Number(a.data().activeBorrowCount || 0) - Number(b.data().activeBorrowCount || 0)
    );
  if (rows.length < count) throw new Error("Need two student accounts with emails");
  return rows.slice(0, count).map((d) => ({
    uid: d.id,
    email: String(d.data().email).toLowerCase(),
  }));
}

async function pickLibrarian() {
  const snap = await db.collection("users").where("role", "==", "librarian").limit(8).get();
  const row = snap.docs.find(
    (d) => d.data().isActive !== false && String(d.data().email || "").includes("@")
  );
  if (!row) throw new Error("No librarian with an email was found");
  return { uid: row.id, email: String(row.data().email).toLowerCase() };
}

async function pickAnotherCopy(excludeId: string) {
  const copies = await db.collection("bookCopies").where("status", "==", "available").limit(30).get();
  for (const doc of copies.docs) {
    if (doc.id === excludeId) continue;
    const isbn = String(doc.data().isbn || "");
    const catalog = await db.collection("catalog").doc(isbn).get();
    if (catalog.exists && catalog.data()?.isActive !== false) {
      return { copyId: doc.id, isbn };
    }
  }
  return null;
}

async function pickFreeCopy() {
  const copies = await db.collection("bookCopies").where("status", "==", "available").limit(20).get();
  for (const doc of copies.docs) {
    const isbn = String(doc.data().isbn || "");
    const catalog = await db.collection("catalog").doc(isbn).get();
    if (catalog.exists && catalog.data()?.isActive !== false) {
      return { copyId: doc.id, isbn, title: String(catalog.data()?.title || isbn) };
    }
  }
  throw new Error("No available copy on an active title");
}

async function main() {
  console.log(`Fine collection against ${API_BASE}`);
  console.log("=================================");

  const [student, otherStudent] = await pickStudents(2);
  const librarian = await pickLibrarian();
  const book = await pickFreeCopy();

  if (otherStudent.uid === student.uid) {
    throw new Error("Need two distinct student accounts");
  }

  console.log(`Student ${student.email}`);
  console.log(`Other student ${otherStudent.email}`);
  console.log(`Librarian ${librarian.email}`);
  console.log(`Copy ${book.copyId} / ${book.title}`);

  const stu = await client(student.uid);
  const other = await client(otherStudent.uid);
  const lib = await client(librarian.uid);

  const cfgRef = db.collection("config").doc("system");
  const originalInApp = (await cfgRef.get()).data()?.allowInAppCopyBorrow;
  const originalBlock = (await cfgRef.get()).data()?.blockCheckoutIfUnpaidFine;
  await cfgRef.set(
    { allowInAppCopyBorrow: true, blockCheckoutIfUnpaidFine: true },
    { merge: true }
  );

  let borrowed = false;
  let extraBorrowed: { copyId: string; isbn: string } | null = null;

  try {
    console.log("\n1) Role gates");
    const stuLookup = await stu.get("/api/fines/lookup", { params: { email: student.email } });
    if (stuLookup.status === 403) pass("students cannot open Collect fines");
    else fail(`student lookup ${stuLookup.status}`);

    const selfLookup = await lib.get("/api/fines/lookup", { params: { email: librarian.email } });
    if (selfLookup.status === 403) pass("librarian cannot collect their own fines");
    else fail(`librarian self lookup ${selfLookup.status} ${JSON.stringify(selfLookup.data)}`);

    console.log("\n2) Borrow, backdate, accrue");
    const borrow = await stu.post("/api/loans/borrow", { copyId: book.copyId });
    if (borrow.status >= 200 && borrow.status < 300) {
      borrowed = true;
      pass("student borrowed a copy");
    } else {
      fail(`borrow ${borrow.status} ${JSON.stringify(borrow.data)}`);
      return;
    }

    const loanId = String(borrow.data.loanId || "");
    const duePast = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await db.collection("loans").doc(loanId).update({ dueDate: duePast });

    const looked = await lib.get("/api/fines/lookup", { params: { email: student.email } });
    if (looked.status !== 200) {
      fail(`lookup ${looked.status} ${JSON.stringify(looked.data)}`);
      return;
    }
    const outstanding = Number(looked.data.outstanding || 0);
    if (outstanding > 0) pass(`lookup shows Rs ${outstanding} outstanding`);
    else fail("lookup outstanding is 0 after backdating the due date");

    console.log("\n2b) Borrow block config");
    const extra = await pickAnotherCopy(book.copyId);
    if (extra) {
      const blockedBorrow = await stu.post("/api/loans/borrow", { copyId: extra.copyId });
      if (
        blockedBorrow.status === 403 &&
        String(blockedBorrow.data?.error || "").toLowerCase().includes("outstanding fines")
      ) {
        pass("block ON: cannot borrow another copy with unpaid fines");
      } else {
        fail(
          `block ON borrow ${blockedBorrow.status} ${JSON.stringify(blockedBorrow.data)}`
        );
      }

      await cfgRef.set({ blockCheckoutIfUnpaidFine: false }, { merge: true });
      const allowedBorrow = await stu.post("/api/loans/borrow", { copyId: extra.copyId });
      if (allowedBorrow.status >= 200 && allowedBorrow.status < 300) {
        extraBorrowed = { copyId: extra.copyId, isbn: extra.isbn };
        pass("block OFF: can borrow another copy with unpaid fines");
        const extraReturn = await stu.post("/api/loans/return", {
          qrPayload: qrPayload(extra.copyId, extra.isbn),
        });
        if (extraReturn.status >= 200 && extraReturn.status < 300) {
          extraBorrowed = null;
          pass("extra copy returned (no fine on that loan)");
        } else {
          fail(`extra return ${extraReturn.status} ${JSON.stringify(extraReturn.data)}`);
        }
      } else {
        fail(`block OFF borrow ${allowedBorrow.status} ${JSON.stringify(allowedBorrow.data)}`);
      }
      await cfgRef.set({ blockCheckoutIfUnpaidFine: true }, { merge: true });
    } else {
      console.log("   (no second free copy; skipped borrow-block toggle check)");
    }

    const otherReturn = await other.post("/api/loans/return", {
      qrPayload: qrPayload(book.copyId, book.isbn),
    });
    if (otherReturn.status === 403) pass("another student cannot return this copy");
    else fail(`other student return ${otherReturn.status} ${JSON.stringify(otherReturn.data)}`);

    console.log("\n3) Partial collection, return still blocked");
    const firstPay = Math.min(50, Math.max(1, outstanding - 1));
    const partial = await lib.post("/api/fines/collect", {
      email: student.email,
      amount: firstPay,
    });
    if (partial.status >= 200 && partial.status < 300 && Number(partial.data.collected) === firstPay) {
      pass(`partial collect Rs ${firstPay}`);
    } else {
      fail(`partial collect ${partial.status} ${JSON.stringify(partial.data)}`);
    }

    const blocked = await stu.post("/api/loans/return", {
      qrPayload: qrPayload(book.copyId, book.isbn),
    });
    if (
      blocked.status === 409 &&
      String(blocked.data?.error || "").toLowerCase().includes("unpaid fine")
    ) {
      pass("return blocked until the remaining fine is paid");
    } else {
      fail(`return while unpaid ${blocked.status} ${JSON.stringify(blocked.data)}`);
    }

    console.log("\n4) Overpay clamps, then full remaining");
    const afterPartial = await lib.get("/api/fines/lookup", { params: { email: student.email } });
    const left = Number(afterPartial.data.outstanding || 0);
    const over = await lib.post("/api/fines/collect", {
      email: student.email,
      amount: left + 500,
    });
    if (over.status >= 200 && over.status < 300 && Number(over.data.collected) === left) {
      pass(`over-amount clamped to Rs ${left}`);
    } else {
      fail(`overpay collect ${over.status} ${JSON.stringify(over.data)}`);
    }

    const afterFull = await lib.get("/api/fines/lookup", { params: { email: student.email } });
    if (Number(afterFull.data.outstanding || 0) === 0) pass("outstanding is now Rs 0");
    else fail(`outstanding still ${afterFull.data.outstanding}`);

    const returned = await stu.post("/api/loans/return", {
      qrPayload: qrPayload(book.copyId, book.isbn),
    });
    if (returned.status >= 200 && returned.status < 300) {
      borrowed = false;
      pass("return succeeds after fines are cleared");
    } else {
      fail(`return after pay ${returned.status} ${JSON.stringify(returned.data)}`);
    }
  } finally {
    if (borrowed) {
      try {
        await stu.post("/api/loans/return", { qrPayload: qrPayload(book.copyId, book.isbn) });
      } catch {
        /* ignore */
      }
    }
    if (extraBorrowed) {
      try {
        await stu.post("/api/loans/return", {
          qrPayload: qrPayload(extraBorrowed.copyId, extraBorrowed.isbn),
        });
      } catch {
        /* ignore */
      }
    }
    await cfgRef.set(
      {
        allowInAppCopyBorrow: originalInApp === undefined ? false : originalInApp,
        blockCheckoutIfUnpaidFine: originalBlock === undefined ? true : originalBlock,
      },
      { merge: true }
    );
    console.log(`\n   allowInAppCopyBorrow restored to ${String(originalInApp ?? false)}`);
    console.log(`   blockCheckoutIfUnpaidFine restored to ${String(originalBlock ?? true)}`);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Fine-collection test crashed:", error?.response?.data || error?.message || error);
  process.exit(2);
});

/**
 * Return must match the copy that is actually issued to the scanner.
 *
 * A librarian/student with Copy 2 on loan must not get a success payload
 * when they scan Copy 1 (available or issued to someone else). Their own
 * loan must stay open until they scan the issued copy.
 *
 * A student must not be able to return (or take) another student's issued copy
 * by scanning that copy's QR from their own account.
 *
 *   npx tsx scripts/verify-return-copy.ts [apiBaseUrl]
 */
import axios, { type AxiosInstance } from "axios";
import { auth, db } from "../api/src/config/firebase";
import { sortCopies } from "../api/src/utils/copies";

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

async function pickTitleWithTwoFreeCopies(): Promise<{
  isbn: string;
  title: string;
  copyOne: { copyId: string; copyNumber: number };
  copyTwo: { copyId: string; copyNumber: number };
}> {
  const catalogSnap = await db.collection("catalog").get();
  for (const doc of catalogSnap.docs) {
    if (doc.data().isActive === false) continue;
    const copies = await db.collection("bookCopies").where("isbn", "==", doc.id).get();
    const sorted = sortCopies(
      copies.docs.map((c) => ({
        copyId: c.id,
        createdAt: c.data().createdAt,
        status: String(c.data().status || ""),
      }))
    );
    const available = sorted.filter((c) => c.status === "available");
    if (available.length < 2) continue;

    const reservations = await db
      .collection("reservations")
      .where("isbn", "==", doc.id)
      .where("status", "in", ["waiting", "ready"])
      .get();
    if (!reservations.empty) continue;

    const first = available[0];
    const second = available[1];
    return {
      isbn: doc.id,
      title: String(doc.data().title || doc.id),
      copyOne: {
        copyId: first.copyId!,
        copyNumber: sorted.findIndex((c) => c.copyId === first.copyId) + 1,
      },
      copyTwo: {
        copyId: second.copyId!,
        copyNumber: sorted.findIndex((c) => c.copyId === second.copyId) + 1,
      },
    };
  }
  throw new Error("Need a live title with at least two free copies and no holds");
}

async function pickUsers(role: "student" | "librarian", isbn: string, count: number): Promise<string[]> {
  const snap = await db.collection("users").where("role", "==", role).limit(16).get();
  const active = snap.docs.filter((d) => d.data().isActive !== false);
  const ranked: Array<{ id: string; count: number }> = [];
  for (const doc of active) {
    const [loansA, loansB] = await Promise.all([
      db.collection("loans").where("userId", "==", doc.id).where("status", "==", "active").get(),
      db.collection("loans").where("userId", "==", doc.id).where("status", "==", "overdue").get(),
    ]);
    const live = [...loansA.docs, ...loansB.docs];
    if (live.some((row) => String(row.data().isbn || "") === isbn)) continue;
    ranked.push({ id: doc.id, count: live.length });
  }
  ranked.sort((a, b) => a.count - b.count);
  if (ranked.length < count) {
    throw new Error(`Need ${count} active ${role}(s) free of a live loan on ${isbn}`);
  }
  return ranked.slice(0, count).map((row) => row.id);
}

async function copyDoc(copyId: string) {
  const doc = await db.collection("bookCopies").doc(copyId).get();
  return doc.data() || {};
}

async function liveLoanCount(uid: string) {
  const [active, overdue] = await Promise.all([
    db.collection("loans").where("userId", "==", uid).where("status", "==", "active").get(),
    db.collection("loans").where("userId", "==", uid).where("status", "==", "overdue").get(),
  ]);
  return active.size + overdue.size;
}

async function returnIfIssued(api: AxiosInstance, copyId: string, isbn: string) {
  const data = await copyDoc(copyId);
  if (String(data.status) === "issued") {
    await api.post("/api/loans/return", { qrPayload: qrPayload(copyId, isbn) });
  }
}

async function main() {
  console.log(`Return-copy match against ${API_BASE}`);
  console.log("====================================");

  const isbnTarget = await pickTitleWithTwoFreeCopies();
  const copyOne = isbnTarget.copyOne.copyId;
  const copyTwo = isbnTarget.copyTwo.copyId;
  const n1 = isbnTarget.copyOne.copyNumber;
  const n2 = isbnTarget.copyTwo.copyNumber;
  const [studentId, studentBId] = await pickUsers("student", isbnTarget.isbn, 2);
  const [librarianId] = await pickUsers("librarian", isbnTarget.isbn, 1);

  console.log(`\nTitle: ${isbnTarget.title} (${isbnTarget.isbn})`);
  console.log(`Copy ${n1} ${copyOne}`);
  console.log(`Copy ${n2} ${copyTwo}`);
  console.log(`Student A ${studentId}`);
  console.log(`Student B ${studentBId}`);
  console.log(`Librarian ${librarianId}`);

  const student = await client(studentId);
  const studentB = await client(studentBId);
  const librarian = await client(librarianId);

  const cfgRef = db.collection("config").doc("system");
  const cfgSnap = await cfgRef.get();
  const originalBorrow = cfgSnap.data()?.librariansCanBorrow;
  const originalInApp = cfgSnap.data()?.allowInAppCopyBorrow;
  await cfgRef.set(
    { librariansCanBorrow: true, allowInAppCopyBorrow: true },
    { merge: true }
  );

  const borrowed = new Set<string>();

  try {
    console.log(`\n1) Student borrows Copy ${n2}, then scans Copy ${n1} to return`);
    const borrowTwo = await student.post("/api/loans/borrow", { copyId: copyTwo });
    if (borrowTwo.status >= 200 && borrowTwo.status < 300) {
      borrowed.add(copyTwo);
      pass(`student borrowed Copy ${n2}`);
    } else {
      fail(`student borrow Copy ${n2} → ${borrowTwo.status} ${JSON.stringify(borrowTwo.data)}`);
      return;
    }

    const wrong = await student.post("/api/loans/return", {
      qrPayload: qrPayload(copyOne, isbnTarget.isbn),
    });
    if (wrong.status === 409 && String(wrong.data?.error || "").toLowerCase().includes("different copy")) {
      pass(`wrong-copy scan rejected: "${wrong.data.error}"`);
    } else {
      fail(`expected WRONG_COPY 409, got ${wrong.status} ${JSON.stringify(wrong.data)}`);
    }

    const stillTwo = await copyDoc(copyTwo);
    const stillOne = await copyDoc(copyOne);
    if (String(stillTwo.status) === "issued") pass(`Copy ${n2} is still issued to the student`);
    else fail(`Copy ${n2} status is ${stillTwo.status} after the wrong scan`);
    if (String(stillOne.status) === "available") pass(`Copy ${n1} stayed available`);
    else fail(`Copy ${n1} status is ${stillOne.status}, expected available`);

    const mineAfterWrong = await student.get("/api/loans/mine", { params: { status: "active" } });
    const activeAfterWrong = mineAfterWrong.data?.loans || [];
    const loanTwo = activeAfterWrong.find((row: { copyId?: string }) => row.copyId === copyTwo);
    if (loanTwo) pass(`Activity still lists the Copy ${n2} loan`);
    else fail("student /mine lost the loan after the wrong-copy scan");
    if (loanTwo && Number(loanTwo.copyNumber) === n2) pass(`loan card copyNumber is ${n2}`);
    else if (loanTwo) fail(`loan copyNumber is ${loanTwo.copyNumber}, expected ${n2}`);

    console.log(`\n2) Student scans the issued Copy ${n2}`);
    const right = await student.post("/api/loans/return", {
      qrPayload: qrPayload(copyTwo, isbnTarget.isbn),
    });
    if (right.status >= 200 && right.status < 300) {
      borrowed.delete(copyTwo);
      pass(`Copy ${n2} returned: ${right.data?.message || "ok"}`);
    } else {
      fail(`issued-copy return → ${right.status} ${JSON.stringify(right.data)}`);
    }

    const afterRight = await copyDoc(copyTwo);
    if (String(afterRight.status) === "available" || String(afterRight.status) === "reserved") {
      pass(`Copy ${n2} is ${afterRight.status} after the matching return`);
    } else {
      fail(`Copy ${n2} left as ${afterRight.status}`);
    }

    const mineAfterRight = await student.get("/api/loans/mine", { params: { status: "active" } });
    const stillListed = (mineAfterRight.data?.loans || []).some(
      (row: { copyId?: string }) => row.copyId === copyTwo
    );
    if (!stillListed) pass("returned loan left the Loans tab");
    else fail(`returned Copy ${n2} is still listed as an active loan`);

    const history = await student.get("/api/loans/mine", { params: { status: "returned" } });
    const returnedRow = (history.data?.loans || []).find(
      (row: { copyId?: string }) => row.copyId === copyTwo
    );
    if (returnedRow) pass(`Returns tab includes the Copy ${n2} return`);
    else fail(`Returns tab is missing the Copy ${n2} return`);
    if (returnedRow && Number(returnedRow.copyNumber) === n2) {
      pass(`returned loan copyNumber is ${n2}`);
    } else if (returnedRow) {
      fail(`returned copyNumber is ${returnedRow.copyNumber}, expected ${n2}`);
    }

    console.log(`\n3) Librarian has Copy ${n2}; student has Copy ${n1}; librarian scans Copy ${n1}`);
    const libBorrow = await librarian.post("/api/loans/borrow", { copyId: copyTwo });
    if (libBorrow.status >= 200 && libBorrow.status < 300) {
      borrowed.add(copyTwo);
      pass(`librarian borrowed Copy ${n2}`);
    } else {
      fail(`librarian borrow Copy ${n2} → ${libBorrow.status} ${JSON.stringify(libBorrow.data)}`);
      return;
    }

    const stuBorrow = await student.post("/api/loans/borrow", { copyId: copyOne });
    if (stuBorrow.status >= 200 && stuBorrow.status < 300) {
      borrowed.add(copyOne);
      pass(`student borrowed Copy ${n1}`);
    } else {
      fail(`student borrow Copy ${n1} → ${stuBorrow.status} ${JSON.stringify(stuBorrow.data)}`);
      return;
    }

    const libWrong = await librarian.post("/api/loans/return", {
      qrPayload: qrPayload(copyOne, isbnTarget.isbn),
    });
    if (
      libWrong.status === 409 &&
      String(libWrong.data?.error || "").toLowerCase().includes("different copy")
    ) {
      pass(`librarian cannot close the student's Copy ${n1} while holding Copy ${n2}`);
    } else {
      fail(
        `librarian wrong-copy scan → ${libWrong.status} ${JSON.stringify(libWrong.data)}`
      );
    }

    const studentCopy = await copyDoc(copyOne);
    if (String(studentCopy.status) === "issued") pass(`student's Copy ${n1} is still issued`);
    else fail(`student's Copy ${n1} became ${studentCopy.status}`);

    const libLoans = await liveLoanCount(librarianId);
    const stuLoans = await liveLoanCount(studentId);
    if (libLoans >= 1) pass("librarian still has an active loan");
    else fail("librarian loan count dropped after scanning the student's copy");
    if (stuLoans >= 1) pass("student still has an active loan");
    else fail("student loan disappeared after the librarian's wrong scan");

    const libRight = await librarian.post("/api/loans/return", {
      qrPayload: qrPayload(copyTwo, isbnTarget.isbn),
    });
    if (libRight.status >= 200 && libRight.status < 300) {
      borrowed.delete(copyTwo);
      pass(`librarian returned their own Copy ${n2}`);
    } else {
      fail(`librarian Copy ${n2} return → ${libRight.status} ${JSON.stringify(libRight.data)}`);
    }

    const stuRight = await student.post("/api/loans/return", {
      qrPayload: qrPayload(copyOne, isbnTarget.isbn),
    });
    if (stuRight.status >= 200 && stuRight.status < 300) {
      borrowed.delete(copyOne);
      pass(`student returned Copy ${n1}`);
    } else {
      fail(`student Copy ${n1} return → ${stuRight.status} ${JSON.stringify(stuRight.data)}`);
    }

    const catalog = await student.get(`/api/catalog/books/${isbnTarget.isbn}`);
    const copies = catalog.data?.copies || [];
    const i1 = copies.findIndex((c: { copyId?: string }) => c.copyId === copyOne);
    const i2 = copies.findIndex((c: { copyId?: string }) => c.copyId === copyTwo);
    if (i1 + 1 === n1 && i2 + 1 === n2) {
      pass("catalog copy labels match the QR copy numbers used in this test");
    } else {
      fail(`catalog indexes Copy ${n1}=${i1 + 1}, Copy ${n2}=${i2 + 1}`);
    }

    console.log(`\n4) Student B cannot return or steal Student A's issued copy`);
    const aBorrow = await student.post("/api/loans/borrow", { copyId: copyOne });
    if (aBorrow.status >= 200 && aBorrow.status < 300) {
      borrowed.add(copyOne);
      pass(`Student A borrowed Copy ${n1}`);
    } else {
      fail(`Student A borrow Copy ${n1} → ${aBorrow.status} ${JSON.stringify(aBorrow.data)}`);
      return;
    }

    const loansBeforeTamper = await liveLoanCount(studentId);
    const bQr = await studentB.post("/api/loans/return", {
      qrPayload: qrPayload(copyOne, isbnTarget.isbn),
    });
    const bMsg = String(bQr.data?.error || "");
    if (bQr.status === 403 && bMsg.toLowerCase().includes("another reader")) {
      pass(`Student B QR return blocked: "${bMsg}"`);
    } else {
      fail(`Student B QR return → ${bQr.status} ${JSON.stringify(bQr.data)}`);
    }

    const bCopyId = await studentB.post("/api/loans/return", { copyId: copyOne });
    if (bCopyId.status === 403) {
      pass("Student B in-app return of A's copy is also blocked");
    } else {
      fail(`Student B copyId return → ${bCopyId.status} ${JSON.stringify(bCopyId.data)}`);
    }

    const bSteal = await studentB.post("/api/loans/borrow", { copyId: copyOne });
    if (bSteal.status >= 400) {
      pass(`Student B cannot borrow an issued copy (${bSteal.status})`);
    } else {
      fail(`Student B borrowed A's issued copy: ${JSON.stringify(bSteal.data)}`);
    }

    const stillA = await copyDoc(copyOne);
    if (String(stillA.status) === "issued" && String(stillA.currentLoanId || "")) {
      pass(`Copy ${n1} is still issued after Student B's attempts`);
    } else {
      fail(`Copy ${n1} status is ${stillA.status} after tamper attempts`);
    }
    if ((await liveLoanCount(studentId)) === loansBeforeTamper) {
      pass("Student A's loan count is unchanged");
    } else {
      fail("Student A's loan count changed after Student B scanned their copy");
    }
    const bMine = await studentB.get("/api/loans/mine", { params: { status: "active" } });
    const stole = (bMine.data?.loans || []).some(
      (row: { copyId?: string }) => row.copyId === copyOne
    );
    if (!stole) pass("Student B's Loans tab does not show A's copy");
    else fail("Student B now lists Student A's copy as their loan");

    const aReturn = await student.post("/api/loans/return", {
      qrPayload: qrPayload(copyOne, isbnTarget.isbn),
    });
    if (aReturn.status >= 200 && aReturn.status < 300) {
      borrowed.delete(copyOne);
      pass("Student A can still return their own copy");
    } else {
      fail(`Student A return → ${aReturn.status} ${JSON.stringify(aReturn.data)}`);
    }
  } finally {
    for (const copyId of [...borrowed]) {
      try {
        await returnIfIssued(student, copyId, isbnTarget.isbn);
        await returnIfIssued(studentB, copyId, isbnTarget.isbn);
        await returnIfIssued(librarian, copyId, isbnTarget.isbn);
      } catch {
        /* restore best-effort */
      }
    }
    await cfgRef.set(
      {
        librariansCanBorrow: originalBorrow === undefined ? false : originalBorrow,
        allowInAppCopyBorrow: originalInApp === undefined ? false : originalInApp,
      },
      { merge: true }
    );
    console.log(
      `\n   librariansCanBorrow restored to ${String(originalBorrow ?? false)}`
    );
    console.log(
      `   allowInAppCopyBorrow restored to ${String(originalInApp ?? false)}`
    );
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Return-copy test crashed:", error?.response?.data || error?.message || error);
  process.exit(2);
});

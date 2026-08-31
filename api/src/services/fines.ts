import { db } from "../config/firebase";
import { createId } from "../utils/ids";
import { copyNumberMap } from "../utils/copies";
import {
  assessedFineForLoan,
  calculateFineAmount,
  fineRemaining,
  getSystemConfig,
  toFineDate,
} from "./loans";

export type FineLoanRow = {
  loanId: string;
  copyId: string | null;
  copyNumber: number | null;
  isbn: string;
  title: string;
  status: string;
  dueDate: Date | null;
  borrowedAt: Date | null;
  returnedAt: Date | null;
  fineAmount: number;
  finePaidAmount: number;
  remaining: number;
  finePaid: boolean;
};

function serializeStamp(value: Date | null) {
  return value ? value.toISOString() : null;
}

export function assertCollectTarget(input: {
  actorUid: string;
  actorRole: string;
  targetUid: string;
  targetRole: string;
}): string | null {
  if (input.actorUid === input.targetUid) return "CANNOT_COLLECT_OWN";
  if (input.targetRole === "admin") return "NOT_A_PATRON";
  if (input.actorRole === "librarian" && input.targetRole !== "student") {
    return "STUDENTS_ONLY";
  }
  if (input.actorRole === "admin" && input.targetRole !== "student" && input.targetRole !== "librarian") {
    return "NOT_A_PATRON";
  }
  return null;
}

async function copyNumbersForIsbns(isbns: string[]): Promise<Map<string, number>> {
  const numberByCopy = new Map<string, number>();
  const unique = [...new Set(isbns.filter(Boolean))];
  await Promise.all(
    unique.map(async (isbn) => {
      const copiesSnap = await db.collection("bookCopies").where("isbn", "==", isbn).get();
      const rows = copiesSnap.docs.map((doc) => ({
        copyId: String(doc.data().copyId || doc.id),
        docId: doc.id,
        createdAt: doc.data().createdAt,
      }));
      const mapped = copyNumberMap(rows);
      rows.forEach((row) => {
        const n = mapped.get(row.copyId);
        if (!n) return;
        numberByCopy.set(row.copyId, n);
        numberByCopy.set(row.docId, n);
      });
    })
  );
  return numberByCopy;
}

async function loadUserLoans(userId: string) {
  return db.collection("loans").where("userId", "==", userId).get();
}

export async function persistAccruedFines(userId: string): Promise<number> {
  const config = await getSystemConfig();
  const timezone = String(config.timezone || "Asia/Karachi");
  const finePerDay = Number(config.finePerDayRs || 50);
  const now = new Date();
  const snap = await loadUserLoans(userId);
  let outstanding = 0;

  const batch = db.batch();
  let writes = 0;
  for (const doc of snap.docs) {
    const loan = doc.data();
    const status = String(loan.status || "");
    let fineAmount = Number(loan.fineAmount || 0);
    if (status === "active" || status === "overdue") {
      const assessed = assessedFineForLoan(loan, now, finePerDay, timezone);
      if (assessed !== fineAmount || (assessed > 0 && status === "active")) {
        batch.update(doc.ref, {
          fineAmount: assessed,
          status: assessed > 0 ? "overdue" : status,
          updatedAt: now,
        });
        writes += 1;
      }
      fineAmount = assessed;
    }
    const remaining = loan.finePaid
      ? 0
      : Math.max(fineAmount - Number(loan.finePaidAmount || 0), 0);
    outstanding += remaining;
  }

  const userRef = db.collection("users").doc(userId);
  batch.update(userRef, {
    totalOutstandingFines: outstanding,
    hasUnpaidFines: outstanding > 0,
    updatedAt: now,
  });
  writes += 1;
  if (writes > 0) await batch.commit();
  return outstanding;
}

export async function lookupFinesByEmail(emailRaw: string) {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("EMAIL_REQUIRED");
  }

  const usersSnap = await db.collection("users").where("email", "==", email).limit(2).get();
  if (usersSnap.empty) {
    throw new Error("USER_NOT_FOUND");
  }
  const userDoc = usersSnap.docs[0];
  const userId = userDoc.id;
  await persistAccruedFines(userId);

  const user = userDoc.data()!;
  const loansSnap = await loadUserLoans(userId);
  const isbns = loansSnap.docs.map((doc) => String(doc.data().isbn || ""));
  const numbers = await copyNumbersForIsbns(isbns);

  const items: FineLoanRow[] = [];
  const onLoan: FineLoanRow[] = [];

  for (const doc of loansSnap.docs) {
    const loan = doc.data();
    const remaining = fineRemaining({
      ...loan,
      fineAmount: Number(loan.fineAmount || 0),
    });
    const row: FineLoanRow = {
      loanId: String(loan.loanId || doc.id),
      copyId: loan.copyId ? String(loan.copyId) : null,
      copyNumber: numbers.get(String(loan.copyId || "")) || null,
      isbn: String(loan.isbn || ""),
      title: String(loan.title || "Untitled"),
      status: String(loan.status || ""),
      dueDate: toFineDate(loan.dueDate),
      borrowedAt: toFineDate(loan.borrowedAt),
      returnedAt: toFineDate(loan.returnedAt),
      fineAmount: Number(loan.fineAmount || 0),
      finePaidAmount: Number(loan.finePaidAmount || 0),
      remaining,
      finePaid: remaining === 0 && Number(loan.fineAmount || 0) > 0,
    };
    if (["active", "overdue"].includes(row.status)) onLoan.push(row);
    if (remaining > 0) items.push(row);
  }

  items.sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));
  const outstanding = items.reduce((sum, row) => sum + row.remaining, 0);

  const stampRow = (row: FineLoanRow) => ({
    loanId: row.loanId,
    copyId: row.copyId,
    copyNumber: row.copyNumber,
    isbn: row.isbn,
    title: row.title,
    status: row.status,
    dueDate: serializeStamp(row.dueDate),
    borrowedAt: serializeStamp(row.borrowedAt),
    returnedAt: serializeStamp(row.returnedAt),
    fineAmount: row.fineAmount,
    finePaidAmount: row.finePaidAmount,
    remaining: row.remaining,
    finePaid: row.finePaid,
  });

  return {
    user: {
      uid: userId,
      email: String(user.email || email),
      displayName: String(user.displayName || ""),
      role: String(user.role || "student"),
      activeBorrowCount: Number(user.activeBorrowCount || 0),
    },
    outstanding,
    items: items.map(stampRow),
    onLoan: onLoan.map((row) => ({
      loanId: row.loanId,
      title: row.title,
      copyNumber: row.copyNumber,
      status: row.status,
      dueDate: serializeStamp(row.dueDate),
      remaining: row.remaining,
    })),
  };
}

export async function collectFines(input: {
  actorUid: string;
  actorRole: string;
  email: string;
  amount: number;
}): Promise<{
  collected: number;
  outstanding: number;
  allocations: Array<{ loanId: string; title: string; applied: number; remaining: number }>;
  user: { uid: string; email: string; displayName: string };
}> {
  const email = String(input.email || "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("EMAIL_REQUIRED");

  const requested = Math.floor(Number(input.amount));
  if (!Number.isFinite(requested) || requested <= 0) throw new Error("AMOUNT_INVALID");

  const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (usersSnap.empty) throw new Error("USER_NOT_FOUND");
  const userDoc = usersSnap.docs[0];
  const targetRole = String(userDoc.data()?.role || "student");
  const denied = assertCollectTarget({
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    targetUid: userDoc.id,
    targetRole,
  });
  if (denied) throw new Error(denied);

  await persistAccruedFines(userDoc.id);

  const config = await getSystemConfig();
  const timezone = String(config.timezone || "Asia/Karachi");
  const finePerDay = Number(config.finePerDayRs || 50);
  const now = new Date();

  const result = await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(userDoc.id);
    const [freshUser, loansSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(db.collection("loans").where("userId", "==", userDoc.id)),
    ]);
    if (!freshUser.exists) throw new Error("USER_NOT_FOUND");

    const rows = loansSnap.docs
      .map((doc) => {
        const loan = doc.data();
        const assessed = assessedFineForLoan(loan, now, finePerDay, timezone);
        const paid = Number(loan.finePaidAmount || 0);
        const remaining = loan.finePaid === true ? 0 : Math.max(assessed - paid, 0);
        const due = toFineDate(loan.dueDate);
        return { doc, loan, assessed, paid, remaining, due };
      })
      .filter((row) => row.remaining > 0)
      .sort((a, b) => (a.due?.getTime() || 0) - (b.due?.getTime() || 0));

    const totalDue = rows.reduce((sum, row) => sum + row.remaining, 0);
    if (totalDue <= 0) throw new Error("NO_FINES");

    let left = Math.min(requested, totalDue);
    const collected = left;
    const allocations: Array<{ loanId: string; title: string; applied: number; remaining: number }> = [];

    for (const row of rows) {
      if (left <= 0) break;
      const applied = Math.min(left, row.remaining);
      const nextPaid = row.paid + applied;
      const nextRemaining = row.assessed - nextPaid;
      const status = String(row.loan.status || "");
      tx.update(row.doc.ref, {
        fineAmount: row.assessed,
        finePaidAmount: nextPaid,
        finePaid: nextRemaining <= 0,
        finePaidAt: nextRemaining <= 0 ? now : row.loan.finePaidAt || null,
        finePaidBy: nextRemaining <= 0 ? input.actorUid : row.loan.finePaidBy || null,
        status: status === "active" && row.assessed > 0 ? "overdue" : status,
        updatedAt: now,
      });
      allocations.push({
        loanId: String(row.loan.loanId || row.doc.id),
        title: String(row.loan.title || "Untitled"),
        applied,
        remaining: Math.max(nextRemaining, 0),
      });
      left -= applied;
    }

    const outstanding = totalDue - collected;
    tx.update(userRef, {
      totalOutstandingFines: outstanding,
      hasUnpaidFines: outstanding > 0,
      updatedAt: now,
    });

    return {
      collected,
      outstanding,
      allocations,
      user: {
        uid: userDoc.id,
        email: String(freshUser.data()?.email || email),
        displayName: String(freshUser.data()?.displayName || ""),
      },
    };
  });

  const paymentId = createId("finepay");
  await db.collection("finePayments").doc(paymentId).set({
    paymentId,
    userId: result.user.uid,
    email,
    collectedBy: input.actorUid,
    collectedByRole: input.actorRole,
    amount: result.collected,
    outstandingAfter: result.outstanding,
    allocations: result.allocations,
    createdAt: now,
  });

  await db.collection("auditLog").add({
    action: "fines_collected",
    actorId: input.actorUid,
    targetId: result.user.uid,
    metadata: {
      amount: result.collected,
      outstandingAfter: result.outstanding,
      email,
      paymentId,
    },
    timestamp: now,
  });

  return result;
}

export { calculateFineAmount, fineRemaining };

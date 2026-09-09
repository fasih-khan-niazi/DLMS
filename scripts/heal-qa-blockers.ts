/**
 * Heal orphan issued copies and clear unpaid-fine flags that block QA students.
 * Safe for demos: only fixes copies whose loan is not active/overdue, and
 * zeros outstanding for users whose unpaid loans are already paid/cleared.
 *
 *   npx tsx scripts/heal-qa-blockers.ts
 */
import { db } from "../api/src/config/firebase";
import { fineRemaining } from "../api/src/services/loans";

async function main() {
  console.log("Heal QA blockers");
  console.log("================");

  const copies = await db.collection("bookCopies").where("status", "==", "issued").get();
  let healedCopies = 0;
  for (const doc of copies.docs) {
    const data = doc.data();
    const loanId = String(data.currentLoanId || "");
    if (!loanId) {
      await doc.ref.update({
        status: "available",
        currentLoanId: null,
        currentBorrowerId: null,
        updatedAt: new Date(),
      });
      healedCopies += 1;
      console.log(`  healed copy ${doc.id} (no loan id)`);
      continue;
    }
    const loan = await db.collection("loans").doc(loanId).get();
    const status = String(loan.data()?.status || "");
    if (!loan.exists || (status !== "active" && status !== "overdue")) {
      await doc.ref.update({
        status: "available",
        currentLoanId: null,
        currentBorrowerId: null,
        updatedAt: new Date(),
      });
      healedCopies += 1;
      console.log(`  healed copy ${doc.id} (loan ${loanId} status=${status || "missing"})`);
    }
  }
  console.log(`Copies healed: ${healedCopies}`);

  const users = await db.collection("users").where("hasUnpaidFines", "==", true).limit(50).get();
  let usersFixed = 0;
  for (const userDoc of users.docs) {
    const loansSnap = await db.collection("loans").where("userId", "==", userDoc.id).get();
    let outstanding = 0;
    for (const loanDoc of loansSnap.docs) {
      outstanding += fineRemaining(loanDoc.data() || {});
    }
    const current = Number(userDoc.data()?.totalOutstandingFines || 0);
    if (outstanding !== current || (outstanding === 0 && userDoc.data()?.hasUnpaidFines)) {
      await userDoc.ref.update({
        totalOutstandingFines: outstanding,
        hasUnpaidFines: outstanding > 0,
        updatedAt: new Date(),
      });
      usersFixed += 1;
      console.log(
        `  user ${userDoc.data()?.email || userDoc.id}: outstanding ${current} → ${outstanding}`
      );
    }
  }
  console.log(`Users reconciled: ${usersFixed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

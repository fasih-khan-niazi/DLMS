/**
 * Read-only inspector for a single physical copy and its active loan.
 *
 * Usage (from api/): npx tsx scripts/inspect-copy.ts <copyId>
 */
import { db } from "../src/config/firebase";

async function main() {
  const copyId = process.argv[2];
  if (!copyId) throw new Error("Pass a copyId");

  const snap = await db.collection("bookCopies").doc(copyId).get();
  if (!snap.exists) {
    console.log(`Copy ${copyId} does not exist`);
    return;
  }

  const data = snap.data()!;
  console.log(`copy      : ${copyId}`);
  console.log(`isbn      : ${data.isbn}`);
  console.log(`title     : ${data.title}`);
  console.log(`status    : ${data.status}`);
  console.log(`loanId    : ${data.currentLoanId || "(none)"}`);
  console.log(`heldFor   : ${data.reservedForUserId || "(none)"}`);

  if (data.currentLoanId) {
    const loan = await db.collection("loans").doc(String(data.currentLoanId)).get();
    if (loan.exists) {
      const l = loan.data()!;
      console.log(`loanStatus: ${l.status}`);
      console.log(`loanUser  : ${l.userId}`);
      console.log(`dueDate   : ${l.dueDate?.toDate ? l.dueDate.toDate().toISOString() : l.dueDate}`);
    } else {
      console.log(`loanStatus: loan document missing`);
    }
  }
}

main().catch((error) => {
  console.error("Failed:", error?.message || error);
  process.exit(1);
});

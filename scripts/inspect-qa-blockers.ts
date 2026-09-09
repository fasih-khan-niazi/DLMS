import { db } from "../api/src/config/firebase";
import { fineRemaining } from "../api/src/services/loans";

async function main() {
  const ids = [
    "10PoHROLkfU9TexgeLgdR6NJrkK2",
    "je1Rm99M3SeHp3o2KY2YD6pV3fI2",
    "L5SM2RPaN4Tq5KGgRWIapQFj9Vo1",
  ];
  for (const id of ids) {
    const u = await db.collection("users").doc(id).get();
    const d = u.data() || {};
    console.log(
      "USER",
      d.email,
      "role",
      d.role,
      "hasUnpaid",
      d.hasUnpaidFines,
      "total",
      d.totalOutstandingFines
    );
    const loans = await db.collection("loans").where("userId", "==", id).get();
    for (const l of loans.docs) {
      const x = l.data();
      const rem = fineRemaining(x);
      if (rem > 0 || x.finePaid === false) {
        console.log(
          "  loan",
          l.id,
          "status",
          x.status,
          "fine",
          x.fineAmount,
          "paidAmt",
          x.finePaidAmount,
          "finePaid",
          x.finePaid,
          "rem",
          rem,
          "title",
          x.title
        );
      }
    }
  }

  const issued = await db.collection("bookCopies").where("status", "==", "issued").limit(20).get();
  console.log("issued copies sample", issued.size);
  for (const c of issued.docs) {
    const loanId = String(c.data().currentLoanId || "");
    const loan = loanId ? await db.collection("loans").doc(loanId).get() : null;
    console.log(
      "  copy",
      c.id,
      "loan",
      loanId || "-",
      "loanStatus",
      loan?.exists ? loan.data()?.status : "missing"
    );
  }

  const unpaidUsers = await db.collection("users").where("hasUnpaidFines", "==", true).get();
  console.log("users with hasUnpaidFines", unpaidUsers.size);
  for (const u of unpaidUsers.docs) {
    console.log(" ", u.data()?.email, u.data()?.role, u.data()?.totalOutstandingFines);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

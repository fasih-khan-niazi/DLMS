import { db } from "../api/src/config/firebase";

async function main() {
  const catalog = await db.collection("catalog").get();
  for (const doc of catalog.docs) {
    const data = doc.data();
    if (data.title && data.title.toLowerCase().includes("gatsby")) {
      console.log(`\nFound Title: ${data.title} (ISBN: ${doc.id})`);
      console.log(`Stored counts: available=${data.availableCount}, issued=${data.issuedCount}, reserved=${data.reservedCount}, total=${data.totalCopies}`);
      
      const copies = await db.collection("bookCopies").where("isbn", "==", doc.id).get();
      for (const c of copies.docs) {
        const cd = c.data();
        console.log(`\n  Copy ID: ${c.id}`);
        console.log(`  Status: ${cd.status}`);
        console.log(`  currentLoanId: ${cd.currentLoanId || "none"}`);
        console.log(`  reservedForUserId: ${cd.reservedForUserId || "none"}`);
        
        if (cd.currentLoanId) {
          const loan = await db.collection("loans").doc(cd.currentLoanId).get();
          if (loan.exists) {
            const ld = loan.data()!;
            console.log(`  Loan ID: ${loan.id}`);
            console.log(`  Loan Status: ${ld.status}`);
            console.log(`  Loan CreatedAt: ${ld.createdAt?.toDate ? ld.createdAt.toDate().toISOString() : ld.createdAt}`);
            console.log(`  Loan DueDate: ${ld.dueDate?.toDate ? ld.dueDate.toDate().toISOString() : ld.dueDate}`);
            console.log(`  Borrower UID: ${ld.userId}`);
            
            const user = await db.collection("users").doc(ld.userId).get();
            if (user.exists) {
              const ud = user.data()!;
              console.log(`  Borrower Email: ${ud.email}`);
              console.log(`  Borrower Name: ${ud.displayName}`);
              console.log(`  Borrower Role: ${ud.role}`);
            } else {
              console.log(`  Borrower: user doc not found in Firestore`);
            }
          } else {
            console.log(`  Loan doc ${cd.currentLoanId} does not exist!`);
          }
        }
      }

      const res = await db.collection("reservations").where("isbn", "==", doc.id).get();
      console.log(`\n  Reservations on this title: ${res.size}`);
      for (const r of res.docs) {
        const rd = r.data();
        const user = await db.collection("users").doc(rd.userId).get();
        const email = user.exists ? user.data()!.email : "unknown";
        const name = user.exists ? user.data()!.displayName : "unknown";
        console.log(`    Res ${r.id}: status=${rd.status}, userId=${rd.userId} (${email} - ${name}), copyId=${rd.assignedCopyId || "none"}`);
      }
    }
  }
}

main().catch(console.error);

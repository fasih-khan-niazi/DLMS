/** ye script QA unpaid fines clear karta hai taake borrow scripts chal saken */
import axios from "axios";
import { auth, db } from "../api/src/config/firebase";
import { fineRemaining } from "../api/src/services/loans";

const API_BASE = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const FIREBASE_WEB_API_KEY = "AIzaSyCREotdbbgVbkqSIyMTA20LVbr2Bu0ZMCQ";

async function main() {
  const adminSnap = await db.collection("users").where("role", "==", "admin").limit(1).get();
  if (adminSnap.empty) throw new Error("no admin");
  const customToken = await auth.createCustomToken(adminSnap.docs[0].id);
  const { data } = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    { token: customToken, returnSecureToken: true }
  );
  const admin = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${data.idToken}` },
    validateStatus: () => true,
  });

  // Unpaid users ke loans mark-paid
  const unpaidUsers = await db.collection("users").where("hasUnpaidFines", "==", true).get();
  for (const userDoc of unpaidUsers.docs) {
    const loans = await db.collection("loans").where("userId", "==", userDoc.id).get();
    for (const loanDoc of loans.docs) {
      const rem = fineRemaining(loanDoc.data() || {});
      if (rem <= 0) continue;
      const res = await admin.post(`/api/admin/loans/${loanDoc.id}/mark-fine-paid`);
      console.log(
        userDoc.data()?.email,
        loanDoc.id,
        rem,
        res.status,
        res.data?.amountCleared ?? res.data?.error
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

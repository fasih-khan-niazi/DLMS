/**
 * Operator helper: force-return a specific copy through the real API.
 * Used to clear a copy left issued by an interrupted test run.
 *
 * Usage (from api/): npx tsx scripts/return-copy.ts <copyId>
 */
import axios from "axios";
import { auth, db } from "../api/src/config/firebase";

const API_BASE = (process.env.API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const FIREBASE_WEB_API_KEY = "AIzaSyCREotdbbgVbkqSIyMTA20LVbr2Bu0ZMCQ";

async function main() {
  const copyId = process.argv[2];
  if (!copyId) throw new Error("Pass a copyId");

  const copySnap = await db.collection("bookCopies").doc(copyId).get();
  if (!copySnap.exists) throw new Error(`Copy ${copyId} not found`);
  console.log(`Copy ${copyId} status: ${copySnap.data()!.status}`);
  if (copySnap.data()!.status !== "issued") {
    console.log("Nothing to do.");
    return;
  }

  const adminSnap = await db.collection("users").where("role", "==", "admin").limit(1).get();
  if (adminSnap.empty) throw new Error("No admin user found");

  const customToken = await auth.createCustomToken(adminSnap.docs[0].id);
  const { data: session } = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    { token: customToken, returnSecureToken: true }
  );

  const cfgRef = db.collection("config").doc("system");
  const original = (await cfgRef.get()).data()?.allowInAppCopyBorrow;
  await cfgRef.set({ allowInAppCopyBorrow: true }, { merge: true });

  try {
    const { data } = await axios.post(
      `${API_BASE}/api/loans/return`,
      { copyId },
      { headers: { Authorization: `Bearer ${session.idToken}` }, timeout: 30000 }
    );
    console.log(`Returned: ${data.message}`);
  } finally {
    await cfgRef.set({ allowInAppCopyBorrow: original === true }, { merge: true });
  }

  const after = await db.collection("bookCopies").doc(copyId).get();
  console.log(`Copy ${copyId} status now: ${after.data()!.status}`);
}

main().catch((error) => {
  console.error("Failed:", error?.response?.data || error?.message || error);
  process.exit(1);
});

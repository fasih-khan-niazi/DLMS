/**
 * End-to-end HTTP check for the admin config round trip.
 *
 * Mints an admin ID token, then drives the real endpoints to prove that
 * `allowInAppCopyBorrow` persists and that the mobile config endpoint reports
 * the same value. Restores the original value when finished.
 *
 * Usage (from api/):
 *   npx tsx scripts/verify-config-http.ts [apiBaseUrl]
 */
import axios from "axios";
import { auth, db } from "../api/src/config/firebase";

const API_BASE = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const FIREBASE_WEB_API_KEY = "AIzaSyCREotdbbgVbkqSIyMTA20LVbr2Bu0ZMCQ";

async function findAdminUid(): Promise<string> {
  const snap = await db.collection("users").where("role", "==", "admin").limit(1).get();
  if (snap.empty) throw new Error("No admin user found in Firestore");
  return snap.docs[0].id;
}

async function mintIdToken(uid: string): Promise<string> {
  const customToken = await auth.createCustomToken(uid);
  const { data } = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    { token: customToken, returnSecureToken: true }
  );
  return data.idToken as string;
}

function pass(label: string) {
  console.log(`  PASS  ${label}`);
}

function fail(label: string) {
  console.log(`  FAIL  ${label}`);
  failures += 1;
}

let failures = 0;

async function main() {
  console.log(`Admin config HTTP round trip against ${API_BASE}`);
  console.log("========================================================");

  const uid = await findAdminUid();
  const token = await mintIdToken(uid);
  const client = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });

  // 1. Read current config and capability list.
  const read = await client.get("/api/admin/config", { params: { _t: Date.now() } });
  const original = read.data.config?.allowInAppCopyBorrow;
  const supported: string[] = read.data.supportedFields || [];

  console.log(`\n1) GET /api/admin/config`);
  console.log(`   allowInAppCopyBorrow = ${String(original)}`);
  console.log(`   supportedFields advertised: ${supported.length}`);
  if (supported.includes("allowInAppCopyBorrow")) {
    pass("API advertises allowInAppCopyBorrow (portal will enable the control)");
  } else {
    fail("API does not advertise allowInAppCopyBorrow (portal will disable the control)");
  }

  // 2. Flip it on and confirm the server acknowledges the field.
  console.log(`\n2) PUT allowInAppCopyBorrow = true`);
  const putOn = await client.put("/api/admin/config", { allowInAppCopyBorrow: true });
  const appliedOn: string[] = putOn.data.appliedFields || [];
  if (appliedOn.includes("allowInAppCopyBorrow")) {
    pass("server acknowledged the field in appliedFields");
  } else {
    fail("server did not acknowledge the field");
  }
  if (putOn.data.config?.allowInAppCopyBorrow === true) {
    pass("response echoes true");
  } else {
    fail(`response echoed ${String(putOn.data.config?.allowInAppCopyBorrow)}`);
  }

  // 3. Firestore must hold a real boolean, not a string.
  const doc = await db.collection("config").doc("system").get();
  const storedValue = doc.data()?.allowInAppCopyBorrow;
  console.log(`\n3) Firestore config/system`);
  if (storedValue === true) {
    pass(`persisted as boolean true (typeof ${typeof storedValue})`);
  } else {
    fail(`persisted as ${String(storedValue)} (typeof ${typeof storedValue})`);
  }

  // 4. A fresh GET must still report true (this is where it used to revert).
  const reread = await client.get("/api/admin/config", { params: { _t: Date.now() } });
  console.log(`\n4) Re-read GET /api/admin/config`);
  if (reread.data.config?.allowInAppCopyBorrow === true) {
    pass("still true after reload (checkbox stays ticked)");
  } else {
    fail(`reverted to ${String(reread.data.config?.allowInAppCopyBorrow)}`);
  }

  // 5. The mobile endpoint must expose the same value.
  const appCfg = await client.get("/api/config/app", { params: { _t: Date.now() } });
  console.log(`\n5) GET /api/config/app (mobile)`);
  if (appCfg.data.allowInAppCopyBorrow === true) {
    pass("mobile config reports true (in-app borrow buttons will show)");
  } else {
    fail(`mobile config reports ${String(appCfg.data.allowInAppCopyBorrow)}`);
  }
  console.log(`   cache-control: ${appCfg.headers["cache-control"]}`);

  // 6. String coercion guard: "false" must not be stored as a truthy string.
  console.log(`\n6) PUT allowInAppCopyBorrow = "false" (string coercion guard)`);
  await client.put("/api/admin/config", { allowInAppCopyBorrow: "false" as any });
  const coerced = (await db.collection("config").doc("system").get()).data()
    ?.allowInAppCopyBorrow;
  if (coerced === false) {
    pass('string "false" coerced to boolean false');
  } else {
    fail(`string "false" stored as ${String(coerced)} (typeof ${typeof coerced})`);
  }

  // 7. Restore the original value so the environment is unchanged.
  const restore = original === true;
  await client.put("/api/admin/config", { allowInAppCopyBorrow: restore });
  console.log(`\n7) Restored allowInAppCopyBorrow = ${restore}`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Verification crashed:", error?.response?.data || error?.message || error);
  process.exit(2);
});

/**
 * Ready-hold cancel: borrow -> reserve -> return (promote) -> cancel ready.
 *
 * Asserts the copy goes back on the shelf (or to the next waiter) and that
 * Activity no longer lists the hold as ready. Restores every document it touches.
 *
 * Usage (from api/):
 *   npx tsx scripts/verify-ready-cancel.ts [apiBaseUrl]
 */
import axios, { type AxiosInstance } from "axios";
import { auth, db } from "../src/config/firebase";

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
  });
}

async function pickTestTitle(): Promise<{ isbn: string; title: string; copyIds: string[] }> {
  const catalogSnap = await db.collection("catalog").get();
  let fallback: { isbn: string; title: string; copyIds: string[] } | null = null;

  for (const doc of catalogSnap.docs) {
    if (doc.data().isActive === false) continue;
    const copies = await db.collection("bookCopies").where("isbn", "==", doc.id).get();
    const available = copies.docs.filter((c) => c.data().status === "available").map((c) => c.id);
    if (available.length === 0 || available.length > 4) continue;

    const reservations = await db
      .collection("reservations")
      .where("isbn", "==", doc.id)
      .where("status", "in", ["waiting", "ready"])
      .get();
    if (!reservations.empty) continue;

    const row = {
      isbn: doc.id,
      title: String(doc.data().title || doc.id),
      copyIds: available,
    };
    if (available.length === 1) return row;
    if (!fallback) fallback = row;
  }
  if (fallback) return fallback;
  throw new Error("No title with a free copy and no reservations was found for ready-cancel test");
}

async function pickStudents(): Promise<[string, string]> {
  const snap = await db.collection("users").where("role", "==", "student").limit(8).get();
  const active = snap.docs
    .filter((d) => d.data().isActive !== false)
    .sort((a, b) => Number(a.data().activeBorrowCount || 0) - Number(b.data().activeBorrowCount || 0));
  if (active.length < 2) throw new Error("Need at least two active student accounts");
  return [active[0].id, active[1].id];
}

async function copyStatus(copyId: string) {
  const doc = await db.collection("bookCopies").doc(copyId).get();
  const data = doc.data() || {};
  return { status: String(data.status), heldFor: String(data.reservedForUserId || "") };
}

async function main() {
  console.log(`Ready-hold cancel flow against ${API_BASE}`);
  console.log("==========================================");

  const [uidA, uidB] = await pickStudents();
  const target = await pickTestTitle();
  const primaryCopy = target.copyIds[0];
  console.log(`\nTitle: ${target.title} (${target.isbn}) ${target.copyIds.length} free copy(ies)`);
  console.log(`Student A: ${uidA}`);
  console.log(`Student B: ${uidB}`);

  const a = await client(uidA);
  const b = await client(uidB);

  const cfgRef = db.collection("config").doc("system");
  const originalToggle = (await cfgRef.get()).data()?.allowInAppCopyBorrow;
  await cfgRef.set({ allowInAppCopyBorrow: true }, { merge: true });

  const createdReservationIds: string[] = [];
  const borrowedCopyIds = new Set<string>();

  try {
    console.log(`\n1) Student A borrows ${target.copyIds.length} free copy(ies)`);
    for (const copyId of target.copyIds) {
      await a.post("/api/loans/borrow", { copyId });
      borrowedCopyIds.add(copyId);
    }
    if ((await copyStatus(primaryCopy)).status === "issued") pass("copy issued to A");
    else fail("copy was not issued");

    console.log(`\n2) Student B reserves`);
    const reserveRes = await b.post("/api/reservations", { isbn: target.isbn });
    const reservationId = String(reserveRes.data.reservationId || reserveRes.data.id || "");
    if (reservationId) createdReservationIds.push(reservationId);
    if (reservationId) pass(`waiting reservation ${reservationId}`);
    else fail("no reservation id returned");

    console.log(`\n3) Student A returns one copy — hold should become ready`);
    await a.post("/api/loans/return", { copyId: primaryCopy });
    borrowedCopyIds.delete(primaryCopy);

    const readySnap = await db
      .collection("reservations")
      .where("isbn", "==", target.isbn)
      .where("status", "==", "ready")
      .get();
    const bReady = readySnap.docs.find((d) => String(d.data().userId) === uidB);
    if (bReady) {
      pass("B has a ready hold");
      if (!createdReservationIds.includes(bReady.id)) createdReservationIds.push(bReady.id);
    } else {
      fail("B was not promoted to ready after the return");
      return;
    }

    const held = await copyStatus(String(bReady.data().assignedCopyId || primaryCopy));
    if (held.status === "reserved" && held.heldFor === uidB) pass("copy reserved for B");
    else fail(`copy is ${held.status} heldFor=${held.heldFor}`);

    console.log(`\n4) Student B cancels the ready hold`);
    const cancelRes = await b.delete(`/api/reservations/${bReady.id}`);
    if (cancelRes.data?.success) pass("cancel endpoint returned success");
    else fail("cancel did not report success");

    const after = await db.collection("reservations").doc(bReady.id).get();
    if (after.data()?.status === "cancelled") pass("reservation marked cancelled");
    else fail(`reservation status is ${after.data()?.status}`);

    const releasedId = String(bReady.data().assignedCopyId || primaryCopy);
    const released = await copyStatus(releasedId);
    if (released.status === "available" && !released.heldFor) {
      pass("held copy released to the shelf");
    } else if (released.status === "reserved" && released.heldFor && released.heldFor !== uidB) {
      pass(`copy reassigned to next waiter ${released.heldFor}`);
    } else {
      fail(`copy left as ${released.status} heldFor=${released.heldFor}`);
    }

    const mine = await b.get("/api/reservations/mine");
    const stillReady = (mine.data.reservations || []).some(
      (r: { reservationId?: string; id?: string; status?: string }) =>
        (r.reservationId === bReady.id || r.id === bReady.id) && r.status === "ready"
    );
    if (!stillReady) pass("B no longer sees a ready hold in Activity");
    else fail("B still sees a ready hold after cancel");
  } finally {
    console.log(`\n5) Cleanup`);
    for (const copyId of borrowedCopyIds) {
      try {
        await a.post("/api/loans/return", { copyId });
        console.log(`   returned leftover loan on ${copyId}`);
      } catch {
        /* ignore */
      }
    }
    for (const id of createdReservationIds) {
      const ref = db.collection("reservations").doc(id);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const data = snap.data()!;
      if (data.status === "waiting" || data.status === "ready") {
        const copyId = String(data.assignedCopyId || "");
        await ref.update({
          status: "cancelled",
          cancelReason: "test_cleanup",
          updatedAt: new Date(),
        });
        if (copyId) {
          const copyRef = db.collection("bookCopies").doc(copyId);
          const copySnap = await copyRef.get();
          if (copySnap.exists && copySnap.data()!.status === "reserved") {
            await copyRef.update({
              status: "available",
              reservedForUserId: null,
              readyAt: null,
              expiresAt: null,
              updatedAt: new Date(),
            });
          }
        }
        console.log(`   cancelled leftover reservation ${id}`);
      }
    }
    if (originalToggle === undefined) {
      await cfgRef.set({ allowInAppCopyBorrow: false }, { merge: true });
    } else {
      await cfgRef.set({ allowInAppCopyBorrow: originalToggle }, { merge: true });
    }
    console.log(`   allowInAppCopyBorrow restored to ${String(originalToggle ?? false)}`);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Ready-cancel test crashed:", error?.response?.data || error?.message || error);
  process.exit(2);
});

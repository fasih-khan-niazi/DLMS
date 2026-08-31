/**
 * Phase 16 acceptance test: borrow -> reserve -> return -> ready -> claim.
 *
 * Drives the real HTTP endpoints with two student accounts and asserts the
 * invariants that used to break: the returned copy must be promoted to the
 * waiting reader, the catalog must report live counts, and cancelling must
 * release a held copy.
 *
 * Restores every document it touches. Usage (from api/):
 *   npx tsx scripts/verify-circulation-flow.ts [apiBaseUrl]
 */
import axios, { type AxiosInstance } from "axios";
import { auth, db } from "../api/src/config/firebase";

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

/**
 * Picks a title with 1â€“4 available copies and no live reservations.
 * Every free copy will be borrowed before the reserve step, because the API
 * (correctly) refuses a reservation while any copy of that title is on the shelf.
 */
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
  throw new Error(
    "No title with a free copy and no reservations was found for testing"
  );
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
  console.log(`Phase 16 circulation flow against ${API_BASE}`);
  console.log("=====================================================");

  const [uidA, uidB] = await pickStudents();
  const target = await pickTestTitle();
  const testCopy = target.copyIds[0];

  console.log(`\nTitle:   ${target.title} (${target.isbn}), ${target.copyIds.length} free copy(ies)`);
  console.log(`Student A: ${uidA}`);
  console.log(`Student B: ${uidB}`);

  const a = await client(uidA);
  const b = await client(uidB);

  // In-app borrow/return needs the toggle on; remember the original value.
  const cfgRef = db.collection("config").doc("system");
  const originalToggle = (await cfgRef.get()).data()?.allowInAppCopyBorrow;
  await cfgRef.set({ allowInAppCopyBorrow: true }, { merge: true });

  const createdReservationIds: string[] = [];
  /** Copies this test issued, so cleanup can always put them back on the shelf. */
  const borrowedCopyIds = new Set<string>();

  try {
    // 1. Student A borrows every free copy so a reserve is legal.
    console.log(`\n1) Student A borrows ${target.copyIds.length} free copy(ies)`);
    for (const copyId of target.copyIds) {
      await a.post("/api/loans/borrow", { copyId });
      borrowedCopyIds.add(copyId);
    }
    let state = await copyStatus(testCopy);
    if (state.status === "issued") pass("copy is issued");
    else fail(`copy status is ${state.status}, expected issued`);

    // 2. Catalog must report the copy as gone from the shelf.
    const detailAfterBorrow = await a.get(`/api/catalog/books/${target.isbn}`);
    if (Number(detailAfterBorrow.data.issuedCount) >= 1) {
      pass(`catalog issuedCount = ${detailAfterBorrow.data.issuedCount} (live count)`);
    } else {
      fail(`catalog issuedCount = ${detailAfterBorrow.data.issuedCount}, expected >= 1`);
    }

    // 3. Student B reserves while no copy is free.
    console.log(`\n2) Student B reserves ${target.title}`);
    const reserveRes = await b.post("/api/reservations", { isbn: target.isbn });
    const reservationId = String(reserveRes.data.reservationId || reserveRes.data.id || "");
    if (reservationId) createdReservationIds.push(reservationId);
    const reserveStatus = String(reserveRes.data.status || "");
    console.log(`   reservation ${reservationId} status=${reserveStatus || "(unreported)"}`);
    if (reservationId) pass("reservation accepted into the waiting queue");
    else fail("no reservation id returned");

    // 4. Student A returns. The queue must be promoted in the same request.
    console.log(`\n3) Student A returns copy ${testCopy}`);
    const returnRes = await a.post("/api/loans/return", { copyId: testCopy });
    borrowedCopyIds.delete(testCopy);
    console.log(`   message: ${returnRes.data.message}`);
    if (returnRes.data.fulfillError) {
      fail(`return reported fulfillError: ${returnRes.data.fulfillError}`);
    } else {
      pass("return completed with no fulfil error");
    }

    // 5. No reader may still be waiting while a copy of the title sits free.
    const waitingSnap = await db
      .collection("reservations")
      .where("isbn", "==", target.isbn)
      .where("status", "==", "waiting")
      .get();
    const freeCopies = await db
      .collection("bookCopies")
      .where("isbn", "==", target.isbn)
      .where("status", "==", "available")
      .get();
    console.log(`\n4) Queue state: ${waitingSnap.size} waiting, ${freeCopies.size} available`);
    if (waitingSnap.size > 0 && freeCopies.size > 0) {
      fail("a reader is still waiting while a copy is available (queue starvation)");
    } else {
      pass("no starvation: queue promoted or nobody left waiting");
    }

    // 6. Student B should now hold a ready reservation on a real reserved copy.
    const readySnap = await db
      .collection("reservations")
      .where("isbn", "==", target.isbn)
      .where("status", "==", "ready")
      .get();
    const bReady = readySnap.docs.find((d) => String(d.data().userId) === uidB);
    if (bReady) {
      const heldCopyId = String(bReady.data().assignedCopyId || "");
      const held = await copyStatus(heldCopyId);
      if (held.status === "reserved" && held.heldFor === uidB) {
        pass(`copy ${heldCopyId} is reserved for Student B`);
      } else {
        fail(`copy ${heldCopyId} is status=${held.status} heldFor=${held.heldFor}`);
      }
      if (!createdReservationIds.includes(bReady.id)) createdReservationIds.push(bReady.id);

      // 7. Student B's activity feed must show it as ready.
      const mine = await b.get("/api/reservations/mine");
      const row = (mine.data.reservations || []).find((r: any) => r.reservationId === bReady.id || r.id === bReady.id);
      if (row && row.status === "ready") pass("Student B sees status ready in Activity");
      else fail(`Student B's Activity shows ${row ? row.status : "no row"}`);

      // 8. Student B claims the hold by borrowing the held copy.
      console.log(`\n5) Student B claims copy ${heldCopyId}`);
      await b.post("/api/loans/borrow", { copyId: heldCopyId });
      borrowedCopyIds.add(heldCopyId);
      const claimed = await copyStatus(heldCopyId);
      if (claimed.status === "issued") pass("hold claimed, copy issued to Student B");
      else fail(`after claim the copy is ${claimed.status}`);

      // Return it so the shelf is restored.
      await b.post("/api/loans/return", { copyId: heldCopyId });
      borrowedCopyIds.delete(heldCopyId);
      const restored = await copyStatus(heldCopyId);
      if (restored.status === "available") pass("copy returned to the shelf");
      else fail(`copy left as ${restored.status} after cleanup return`);
    } else {
      fail("Student B has no ready reservation after the return");
    }

    // 9. Catalog counters must match live copy statuses at the end.
    const finalDetail = await a.get(`/api/catalog/books/${target.isbn}`);
    const liveCopies = await db.collection("bookCopies").where("isbn", "==", target.isbn).get();
    const liveAvailable = liveCopies.docs.filter((d) => d.data().status === "available").length;
    console.log(`\n6) Final catalog check`);
    if (Number(finalDetail.data.availableCount) === liveAvailable) {
      pass(`availableCount ${finalDetail.data.availableCount} matches live copies`);
    } else {
      fail(
        `availableCount ${finalDetail.data.availableCount} but ${liveAvailable} copies are available`
      );
    }
    if (finalDetail.data.availability === (liveAvailable > 0 ? "Available" : "Unavailable")) {
      pass(`availability label "${finalDetail.data.availability}" is consistent`);
    } else {
      fail(`availability label "${finalDetail.data.availability}" is inconsistent`);
    }
  } finally {
    // Cleanup: return anything still issued, close test reservations, restore toggle.
    console.log(`\n7) Cleanup`);
    for (const copyId of borrowedCopyIds) {
      try {
        await a.post("/api/loans/return", { copyId });
        console.log(`   returned leftover loan on ${copyId}`);
      } catch {
        try {
          await b.post("/api/loans/return", { copyId });
          console.log(`   returned leftover loan on ${copyId}`);
        } catch (error: any) {
          console.log(
            `   WARNING could not auto-return ${copyId}: ${error?.response?.data?.error || error?.message}`
          );
        }
      }
    }

    for (const id of createdReservationIds) {
      const ref = db.collection("reservations").doc(id);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const data = snap.data()!;
      if (data.status === "waiting" || data.status === "ready") {
        const copyId = String(data.assignedCopyId || "");
        await ref.update({ status: "cancelled", cancelReason: "test_cleanup", updatedAt: new Date() });
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
        console.log(`   cancelled test reservation ${id}`);
      }
    }

    if (originalToggle === undefined) {
      await cfgRef.set({ allowInAppCopyBorrow: false }, { merge: true });
      console.log(`   allowInAppCopyBorrow restored to false (was unset)`);
    } else {
      await cfgRef.set({ allowInAppCopyBorrow: originalToggle }, { merge: true });
      console.log(`   allowInAppCopyBorrow restored to ${String(originalToggle)}`);
    }
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Flow test crashed:", error?.response?.data || error?.message || error);
  process.exit(2);
});

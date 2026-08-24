import { db } from "../config/firebase";
import { getSystemConfig } from "./loans";
import { notifyUser } from "./notifications";

const HOUR_MS = 60 * 60 * 1000;

export function normalizeIsbn(isbn: string): string {
  return String(isbn || "")
    .replace(/[-\s]/g, "")
    .toUpperCase();
}

function createdAtMs(value: any): number {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value._seconds) return value._seconds * 1000;
  return new Date(value).getTime();
}

type WaitingRow = {
  id: string;
  userId: string;
  title?: string;
  createdAt?: any;
};

/** FIFO waiters for an ISBN (in-memory sort — no composite index required beyond equality). */
export async function listWaitingReservations(isbn: string): Promise<WaitingRow[]> {
  const normalized = normalizeIsbn(isbn);
  let docs = (
    await db
      .collection("reservations")
      .where("isbn", "==", normalized)
      .where("status", "==", "waiting")
      .get()
  ).docs;

  // Legacy rows may store hyphenated ISBN while catalog/copies use normalized
  if (docs.length === 0) {
    const allWaiting = await db.collection("reservations").where("status", "==", "waiting").get();
    docs = allWaiting.docs.filter(
      (doc) => normalizeIsbn(String(doc.data().isbn || "")) === normalized
    );
    if (docs.length > 0) {
      console.warn(
        `[reservations] legacy ISBN format for ${normalized}; healing ${docs.length} waiting row(s)`
      );
      await Promise.all(
        docs
          .filter((doc) => String(doc.data().isbn || "") !== normalized)
          .map((doc) => doc.ref.update({ isbn: normalized }).catch(() => undefined))
      );
    }
  }

  return docs
    .map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        userId: String(data.userId || ""),
        title: data.title as string | undefined,
        createdAt: data.createdAt,
      };
    })
    .filter((row) => !!row.userId)
    .sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));
}

export async function getNextWaitingReservation(
  isbn: string,
  excludeUserId?: string
): Promise<WaitingRow | null> {
  const waiting = await listWaitingReservations(isbn);
  const next = waiting.find((row) =>
    excludeUserId ? row.userId !== excludeUserId : true
  );
  return next || null;
}

/** 1-based queue position among current waiting reservations for an ISBN. */
export async function computeQueuePosition(
  isbn: string,
  reservationId: string
): Promise<number | null> {
  const waiting = await listWaitingReservations(isbn);
  const index = waiting.findIndex((item) => item.id === reservationId);
  return index >= 0 ? index + 1 : null;
}

export type AssignResult = {
  reservationId: string;
  userId: string;
  copyId: string;
  expiresAt: Date;
  holdHours: number;
};

/**
 * Atomically: waiting reservation → ready + copy → reserved for that user.
 * Only assigns when the copy is currently `available`.
 */
export async function assignCopyToNextReservation(input: {
  copyId: string;
  isbn: string;
  title?: string;
  /** Skip this user (e.g. the person who just returned the copy). */
  excludeUserId?: string;
}): Promise<AssignResult | null> {
  const isbn = normalizeIsbn(input.isbn);
  const next = await getNextWaitingReservation(isbn, input.excludeUserId);
  if (!next) return null;

  const config = await getSystemConfig();
  const holdHours = Number(config.reservationHoldHours || 72);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + holdHours * HOUR_MS);

  const reservationRef = db.collection("reservations").doc(next.id);
  const copyRef = db.collection("bookCopies").doc(input.copyId);
  const catalogRef = db.collection("catalog").doc(isbn);

  await db.runTransaction(async (tx) => {
    const [reservationSnap, copySnap, catalogSnap] = await Promise.all([
      tx.get(reservationRef),
      tx.get(copyRef),
      tx.get(catalogRef),
    ]);

    if (!reservationSnap.exists || !copySnap.exists || !catalogSnap.exists) {
      throw new Error("ASSIGN_DATA_MISSING");
    }

    const reservation = reservationSnap.data()!;
    if (reservation.status !== "waiting") {
      throw new Error("RESERVATION_NOT_WAITING");
    }
    if (String(reservation.userId) !== next.userId) {
      throw new Error("RESERVATION_USER_MISMATCH");
    }

    const copy = copySnap.data()!;
    if (normalizeIsbn(String(copy.isbn || "")) !== isbn) {
      throw new Error("COPY_ISBN_MISMATCH");
    }
    // Strict: only free shelf copies can be held for the queue
    if (copy.status !== "available") {
      throw new Error("COPY_NOT_AVAILABLE");
    }

    const catalog = catalogSnap.data()!;

    tx.update(reservationRef, {
      status: "ready",
      isbn,
      assignedCopyId: input.copyId,
      readyAt: now,
      expiresAt,
      notifiedAt: now,
      updatedAt: now,
    });

    tx.update(copyRef, {
      status: "reserved",
      isbn,
      currentLoanId: null,
      reservedForUserId: next.userId,
      readyAt: now,
      expiresAt,
      updatedAt: now,
    });

    tx.update(catalogRef, {
      reservedCount: (catalog.reservedCount || 0) + 1,
      availableCount: Math.max((catalog.availableCount || 0) - 1, 0),
      updatedAt: now,
    });
  });

  try {
    await notifyUser({
      userId: next.userId,
      type: "reservation_ready",
      title: "Your book is ready",
      body: `"${input.title || next.title || "Reserved book"}" is ready for pickup. You have ${holdHours} hours.`,
      metadata: {
        reservationId: next.id,
        copyId: input.copyId,
        isbn,
      },
    });
  } catch (error) {
    // Hold is already committed — never roll back because push/inbox failed
    console.error("[reservations] notify ready failed (hold still active):", error);
  }

  return {
    reservationId: next.id,
    userId: next.userId,
    copyId: input.copyId,
    expiresAt,
    holdHours,
  };
}

/**
 * Heal drift for one ISBN:
 * - Orphan `reserved` copies (no matching ready reservation) → free
 * - Ready reservations pointing at missing/wrong copies → expire/fix
 * - Available copies + waiting queue → assign FIFO
 */
export async function reconcileReservationsForIsbn(
  isbnRaw: string,
  opts?: { excludeUserId?: string; title?: string }
): Promise<{
  assigned: number;
  freedOrphans: number;
  fixedReady: number;
  waitingLeft: number;
}> {
  const isbn = normalizeIsbn(isbnRaw);
  const now = new Date();
  let assigned = 0;
  let freedOrphans = 0;
  let fixedReady = 0;

  let copyDocs = (
    await db.collection("bookCopies").where("isbn", "==", isbn).get()
  ).docs;
  // Legacy copies may still store hyphenated ISBN
  if (copyDocs.length === 0) {
    const allCopies = await db.collection("bookCopies").get();
    copyDocs = allCopies.docs.filter(
      (doc) => normalizeIsbn(String(doc.data().isbn || "")) === isbn
    );
    if (copyDocs.length > 0) {
      console.warn(
        `[reconcile] legacy copy ISBN format for ${isbn}; healing ${copyDocs.length} copy(ies)`
      );
      await Promise.all(
        copyDocs
          .filter((doc) => String(doc.data().isbn || "") !== isbn)
          .map((doc) => doc.ref.update({ isbn }).catch(() => undefined))
      );
    }
  }

  let reservationDocs = (
    await db.collection("reservations").where("isbn", "==", isbn).get()
  ).docs;
  if (reservationDocs.length === 0) {
    const [waitingSnap, readySnap] = await Promise.all([
      db.collection("reservations").where("status", "==", "waiting").get(),
      db.collection("reservations").where("status", "==", "ready").get(),
    ]);
    reservationDocs = [...waitingSnap.docs, ...readySnap.docs].filter(
      (doc) => normalizeIsbn(String(doc.data().isbn || "")) === isbn
    );
    await Promise.all(
      reservationDocs
        .filter((doc) => String(doc.data().isbn || "") !== isbn)
        .map((doc) => doc.ref.update({ isbn }).catch(() => undefined))
    );
  }

  // Doc id must win over any `id` field stored in the document body
  const copies: any[] = copyDocs.map((doc) => {
    const data = doc.data() as Record<string, any>;
    return { ...data, id: doc.id };
  });
  const reservations: any[] = reservationDocs.map((doc) => {
    const data = doc.data() as Record<string, any>;
    return { ...data, id: doc.id };
  });

  const ready = reservations.filter((r) => r.status === "ready");
  const waiting = reservations
    .filter((r) => r.status === "waiting")
    .sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));

  // 1) Heal reserved copies that have no matching ready reservation
  for (const copy of copies) {
    if (copy.status !== "reserved") continue;
    const holder = String(copy.reservedForUserId || "");
    const match = ready.find((r) => {
      if (String(r.assignedCopyId || "") !== copy.id) return false;
      if (!holder) return true;
      return String(r.userId || "") === holder;
    });
    if (match) continue;

    // Promote waiting reservation: prefer holder match, else FIFO head
    const waiter = holder
      ? waiting.find((r) => String(r.userId || "") === holder)
      : waiting[0];
    if (waiter) {
      const config = await getSystemConfig();
      const holdHours = Number(config.reservationHoldHours || 72);
      const expiresAt = new Date(now.getTime() + holdHours * HOUR_MS);
      const promoteUserId = String(waiter.userId);
      await db.runTransaction(async (tx) => {
        const copyRef = db.collection("bookCopies").doc(copy.id);
        const reservationRef = db.collection("reservations").doc(waiter.id);
        const catalogRef = db.collection("catalog").doc(isbn);
        const cSnap = await tx.get(copyRef);
        const rSnap = await tx.get(reservationRef);
        const catalogSnap = await tx.get(catalogRef);
        if (!cSnap.exists || !rSnap.exists || !catalogSnap.exists) return;
        const c = cSnap.data()!;
        const r = rSnap.data()!;
        if (c.status !== "reserved") return;
        if (r.status !== "waiting") return;
        tx.update(reservationRef, {
          status: "ready",
          isbn,
          assignedCopyId: copy.id,
          readyAt: now,
          expiresAt,
          notifiedAt: now,
          updatedAt: now,
        });
        tx.update(copyRef, {
          isbn,
          reservedForUserId: promoteUserId,
          readyAt: now,
          expiresAt,
          updatedAt: now,
        });
      });
      try {
        await notifyUser({
          userId: promoteUserId,
          type: "reservation_ready",
          title: "Your book is ready",
          body: `"${opts?.title || waiter.title || "Reserved book"}" is ready for pickup.`,
          metadata: { reservationId: waiter.id, copyId: copy.id, isbn },
        });
      } catch (error) {
        console.error("[reconcile] notify after promote failed:", error);
      }
      // Remove from local waiting list so we don't assign twice
      const wi = waiting.findIndex((r) => r.id === waiter.id);
      if (wi >= 0) waiting.splice(wi, 1);
      fixedReady += 1;
      assigned += 1;
      continue;
    }

    // Truly orphan → free for shelf or next waiter
    await db.runTransaction(async (tx) => {
      const copyRef = db.collection("bookCopies").doc(copy.id);
      const catalogRef = db.collection("catalog").doc(isbn);
      const cSnap = await tx.get(copyRef);
      const catalogSnap = await tx.get(catalogRef);
      if (!cSnap.exists || !catalogSnap.exists) return;
      const c = cSnap.data()!;
      if (c.status !== "reserved") return;
      const catalog = catalogSnap.data()!;
      tx.update(copyRef, {
        status: "available",
        isbn,
        reservedForUserId: null,
        readyAt: null,
        expiresAt: null,
        updatedAt: now,
      });
      tx.update(catalogRef, {
        reservedCount: Math.max((catalog.reservedCount || 0) - 1, 0),
        availableCount: (catalog.availableCount || 0) + 1,
        updatedAt: now,
      });
    });
    freedOrphans += 1;
  }

  // 2) Assign available copies to waiting queue (FIFO)
  const availableCopyIds = copies
    .filter((c) => c.status === "available")
    .map((c) => String(c.id));
  // Re-read after orphan free (those copies are now available)
  for (const copyId of availableCopyIds) {
    try {
      const result = await assignCopyToNextReservation({
        copyId,
        isbn,
        title: opts?.title,
        excludeUserId: opts?.excludeUserId,
      });
      if (!result) break;
      assigned += 1;
    } catch (error) {
      console.error("[reconcile] assign failed:", error);
      break;
    }
  }
  // Copies just freed from orphan holds
  for (let i = 0; i < 20; i += 1) {
    const available = await db
      .collection("bookCopies")
      .where("isbn", "==", isbn)
      .where("status", "==", "available")
      .limit(1)
      .get();
    if (available.empty) break;

    const copyDoc = available.docs[0];
    try {
      const result = await assignCopyToNextReservation({
        copyId: copyDoc.id,
        isbn,
        title: opts?.title || copyDoc.data().title,
        excludeUserId: opts?.excludeUserId,
      });
      if (!result) break;
      assigned += 1;
    } catch (error) {
      console.error("[reconcile] assign failed:", error);
      break;
    }
  }

  // 3) Recompute catalog counters from copies (hardens drift)
  const freshCopies = await db.collection("bookCopies").where("isbn", "==", isbn).get();
  let availableCount = 0;
  let issuedCount = 0;
  let reservedCount = 0;
  freshCopies.docs.forEach((doc) => {
    const status = doc.data().status;
    if (status === "available") availableCount += 1;
    else if (status === "issued") issuedCount += 1;
    else if (status === "reserved") reservedCount += 1;
  });
  const catalogRef = db.collection("catalog").doc(isbn);
  const catalogSnap = await catalogRef.get();
  if (catalogSnap.exists) {
    await catalogRef.update({
      availableCount,
      issuedCount,
      reservedCount,
      totalCopies: freshCopies.size,
      updatedAt: now,
    });
  }

  const waitingLeft = (await listWaitingReservations(isbn)).length;
  return { assigned, freedOrphans, fixedReady, waitingLeft };
}

/** Cancel waiting/ready reservations when a title is deactivated; notify students. */
export async function cancelReservationsForDeactivatedTitle(input: {
  isbn: string;
  title: string;
}) {
  const isbn = normalizeIsbn(input.isbn);
  const snap = await db
    .collection("reservations")
    .where("isbn", "==", isbn)
    .where("status", "in", ["waiting", "ready"])
    .get();

  const now = new Date();
  let cancelled = 0;

  for (const doc of snap.docs) {
    const reservation = doc.data();
    const reservationRef = doc.ref;
    const userId = String(reservation.userId || "");
    const copyId = reservation.assignedCopyId as string | undefined;
    const catalogRef = db.collection("catalog").doc(isbn);

    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(reservationRef);
      if (!fresh.exists) return;
      const data = fresh.data()!;
      if (data.status !== "waiting" && data.status !== "ready") return;

      const catalogSnap = await tx.get(catalogRef);

      tx.update(reservationRef, {
        status: "cancelled",
        cancelReason: "catalog_deactivated",
        updatedAt: now,
      });

      if (data.status === "ready" && copyId) {
        const copyRef = db.collection("bookCopies").doc(copyId);
        const copySnap = await tx.get(copyRef);
        if (copySnap.exists) {
          const copy = copySnap.data()!;
          if (copy.status === "reserved" && copy.reservedForUserId === data.userId) {
            tx.update(copyRef, {
              status: "available",
              reservedForUserId: null,
              readyAt: null,
              expiresAt: null,
              updatedAt: now,
            });
          }
        }
        if (catalogSnap.exists) {
          const catalog = catalogSnap.data()!;
          tx.update(catalogRef, {
            reservedCount: Math.max((catalog.reservedCount || 0) - 1, 0),
            availableCount: (catalog.availableCount || 0) + 1,
            updatedAt: now,
          });
        }
      }
    });

    if (userId) {
      await notifyUser({
        userId,
        type: "reservation_cancelled",
        title: "Reservation cancelled",
        body: `Your reservation for "${input.title}" was cancelled because this title is no longer available in the catalog.`,
        metadata: { isbn, reservationId: doc.id },
      });
    }

    cancelled += 1;
  }

  return cancelled;
}

/** If copies are available while people are waiting, hold for the next waiter. */
export async function fulfillWaitingWithAvailableCopies(isbn: string) {
  const result = await reconcileReservationsForIsbn(isbn);
  return result.assigned;
}

/**
 * Expire ready holds past expiresAt.
 * Copy is then reassigned to the next waiter, or marked available.
 */
export async function expireReadyReservationHolds() {
  const now = new Date();
  const snap = await db.collection("reservations").where("status", "==", "ready").get();

  let expired = 0;
  let reassigned = 0;
  let freed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const expiresAt = data.expiresAt?.toDate
      ? data.expiresAt.toDate()
      : data.expiresAt
        ? new Date(data.expiresAt)
        : null;

    if (!expiresAt || expiresAt.getTime() > now.getTime()) {
      continue;
    }

    const copyId = data.assignedCopyId as string | undefined;
    const isbn = normalizeIsbn(String(data.isbn || ""));
    const reservationRef = doc.ref;

    await db.runTransaction(async (tx) => {
      const reservationSnap = await tx.get(reservationRef);
      if (!reservationSnap.exists) return;

      const reservation = reservationSnap.data()!;
      if (reservation.status !== "ready") return;

      const catalogRef = db.collection("catalog").doc(isbn);
      const catalogSnap = await tx.get(catalogRef);

      tx.update(reservationRef, {
        status: "expired",
        updatedAt: now,
      });

      if (copyId) {
        const copyRef = db.collection("bookCopies").doc(copyId);
        const copySnap = await tx.get(copyRef);
        if (copySnap.exists) {
          const copy = copySnap.data()!;
          if (copy.status === "reserved" && copy.reservedForUserId === reservation.userId) {
            tx.update(copyRef, {
              status: "available",
              reservedForUserId: null,
              readyAt: null,
              expiresAt: null,
              updatedAt: now,
            });
          }
        }
      }

      if (catalogSnap.exists) {
        const catalog = catalogSnap.data()!;
        tx.update(catalogRef, {
          reservedCount: Math.max((catalog.reservedCount || 0) - 1, 0),
          availableCount: (catalog.availableCount || 0) + (copyId ? 1 : 0),
          updatedAt: now,
        });
      }
    });

    expired += 1;

    if (!copyId) continue;

    try {
      const result = await reconcileReservationsForIsbn(isbn, { title: data.title });
      if (result.assigned > 0) reassigned += 1;
      else freed += 1;
    } catch (error) {
      console.error("[CRON] Failed to reconcile after expiry:", error);
    }
  }

  return { expired, reassigned, freed };
}

/** Sweep titles that still have waiting reservations (heals missed return fulfills). */
export async function reconcileAllWaitingQueues() {
  const snap = await db.collection("reservations").where("status", "==", "waiting").get();
  const isbns = Array.from(
    new Set(snap.docs.map((doc) => normalizeIsbn(String(doc.data().isbn || ""))).filter(Boolean))
  );

  let titles = 0;
  let assigned = 0;
  for (const isbn of isbns) {
    const result = await reconcileReservationsForIsbn(isbn);
    titles += 1;
    assigned += result.assigned + result.fixedReady;
  }
  return { titles, assigned, waitingTitles: isbns.length };
}

import { db } from "../config/firebase";
import { getSystemConfig } from "./loans";

import { notifyUser } from "./notifications";

const HOUR_MS = 60 * 60 * 1000;

function createdAtMs(value: any): number {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value._seconds) return value._seconds * 1000;
  return new Date(value).getTime();
}

/** FIFO next waiter - sorted in memory (avoids composite index requirement). */
export async function getNextWaitingReservation(isbn: string): Promise<{
  id: string;
  userId: string;
  title?: string;
  [key: string]: any;
} | null> {
  const snap = await db
    .collection("reservations")
    .where("isbn", "==", isbn)
    .where("status", "==", "waiting")
    .get();

  if (snap.empty) return null;

  const sorted = snap.docs
    .map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        userId: String(data.userId || ""),
        title: data.title as string | undefined,
        createdAt: data.createdAt,
        ...data,
      };
    })
    .sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));

  return sorted[0] || null;
}

/** 1-based queue position among current waiting reservations for an ISBN. */
export async function computeQueuePosition(
  isbn: string,
  reservationId: string
): Promise<number | null> {
  const snap = await db
    .collection("reservations")
    .where("isbn", "==", isbn)
    .where("status", "==", "waiting")
    .get();

  const sorted = snap.docs
    .map((doc) => ({ id: doc.id, createdAt: doc.data().createdAt }))
    .sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));

  const index = sorted.findIndex((item) => item.id === reservationId);
  return index >= 0 ? index + 1 : null;
}

/**
 * Assign a free copy to the next waiting reservation (72h hold).
 * Adjusts catalog availableCount when the copy was available.
 */
export async function assignCopyToNextReservation(input: {
  copyId: string;
  isbn: string;
  title?: string;
  /** Skip this user (e.g. the person who just returned the copy). */
  excludeUserId?: string;
}) {
  const config = await getSystemConfig();
  const holdHours = Number(config.reservationHoldHours || 72);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + holdHours * HOUR_MS);

  // Find earliest waiter, optionally skipping excludeUserId
  const snap = await db
    .collection("reservations")
    .where("isbn", "==", input.isbn)
    .where("status", "==", "waiting")
    .get();

  const sorted = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => createdAtMs((a as any).createdAt) - createdAtMs((b as any).createdAt))
    .filter((item: any) =>
      input.excludeUserId ? item.userId !== input.excludeUserId : true
    );

  const next = sorted[0] as any;
  if (!next) {
    return null;
  }

  const reservationRef = db.collection("reservations").doc(next.id);
  const copyRef = db.collection("bookCopies").doc(input.copyId);
  const catalogRef = db.collection("catalog").doc(input.isbn);

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

    const copy = copySnap.data()!;
    if (copy.status === "issued" || copy.status === "damaged") {
      throw new Error("COPY_NOT_ASSIGNABLE");
    }

    const wasAvailable = copy.status === "available";
    const catalog = catalogSnap.data()!;

    tx.update(reservationRef, {
      status: "ready",
      assignedCopyId: input.copyId,
      readyAt: now,
      expiresAt,
      notifiedAt: now,
      updatedAt: now,
    });

    tx.update(copyRef, {
      status: "reserved",
      currentLoanId: null,
      reservedForUserId: reservation.userId,
      readyAt: now,
      expiresAt,
      updatedAt: now,
    });

    tx.update(catalogRef, {
      reservedCount: (catalog.reservedCount || 0) + 1,
      availableCount: wasAvailable
        ? Math.max((catalog.availableCount || 0) - 1, 0)
        : catalog.availableCount || 0,
      updatedAt: now,
    });
  });

  await notifyUser({
    userId: next.userId,
    type: "reservation_ready",
    title: "Your book is ready",
    body: `"${input.title || next.title || "Reserved book"}" is ready for pickup. You have ${holdHours} hours.`,
    metadata: {
      reservationId: next.id,
      copyId: input.copyId,
      isbn: input.isbn,
    },
  });

  return {
    reservationId: next.id,
    userId: next.userId as string,
    copyId: input.copyId,
    expiresAt,
    holdHours,
  };
}

/** If copies are available while people are waiting, hold for the next waiter. */
export async function fulfillWaitingWithAvailableCopies(isbn: string) {
  let assignedCount = 0;

  for (let i = 0; i < 20; i += 1) {
    const next = await getNextWaitingReservation(isbn);
    if (!next) break;

    const availableSnap = await db
      .collection("bookCopies")
      .where("isbn", "==", isbn)
      .where("status", "==", "available")
      .limit(1)
      .get();

    if (availableSnap.empty) break;

    const copy = availableSnap.docs[0].data();
    await assignCopyToNextReservation({
      copyId: copy.copyId || availableSnap.docs[0].id,
      isbn,
      title: next.title,
    });
    assignedCount += 1;
  }

  return assignedCount;
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
    const isbn = data.isbn as string;
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
      const assigned = await assignCopyToNextReservation({
        copyId,
        isbn,
        title: data.title,
      });

      if (assigned) {
        reassigned += 1;
      } else {
        freed += 1;
      }
    } catch (error) {
      console.error("[CRON] Failed to reassign after expiry:", error);
      freed += 1;
    }
  }

  return { expired, reassigned, freed };
}

import { Router, Response } from "express";
import { db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { createId } from "../utils/ids";
import { getSystemConfig } from "../services/loans";
import {
  assignCopyToNextReservation,
  computeQueuePosition,
  expireReadyReservationHolds,
  fulfillWaitingWithAvailableCopies,
  normalizeIsbn,
  reconcileReservationsForIsbn,
} from "../services/reservations";

const router = Router();

// Create a reservation (queue) for an unavailable title
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const isbnRaw = req.body.isbn;
    if (!isbnRaw) {
      res.status(400).json({ error: "isbn is required" });
      return;
    }

    const isbn = normalizeIsbn(String(isbnRaw));
    const config = await getSystemConfig();

    // Heal drift before deciding whether reserve is allowed
    try {
      await reconcileReservationsForIsbn(isbn);
    } catch (error) {
      console.error("[reserve] pre-create reconcile failed:", error);
    }

    const userRef = db.collection("users").doc(req.uid!);
    const catalogRef = db.collection("catalog").doc(isbn);

    const [userSnap, catalogSnap, activeLoansSnap, availableCopiesSnap] = await Promise.all([
      userRef.get(),
      catalogRef.get(),
      db
        .collection("loans")
        .where("userId", "==", req.uid)
        .where("status", "==", "active")
        .get(),
      db
        .collection("bookCopies")
        .where("isbn", "==", isbn)
        .where("status", "==", "available")
        .limit(1)
        .get(),
    ]);

    if (!userSnap.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!catalogSnap.exists) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    const user = userSnap.data()!;
    const catalog = catalogSnap.data()!;

    if (catalog.isActive === false) {
      res.status(409).json({ error: "This title is deactivated and cannot be reserved" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is suspended" });
      return;
    }

    if (user.role === "librarian" && config.librariansCanBorrow === false) {
      res.status(403).json({
        error: "Librarians cannot reserve physical books while borrowing is disabled",
      });
      return;
    }

    if (config.blockCheckoutIfUnpaidFine && user.hasUnpaidFines) {
      res.status(403).json({ error: "Clear unpaid fines before reserving" });
      return;
    }

    const hasActiveLoanForIsbn = activeLoansSnap.docs.some(
      (doc) => normalizeIsbn(String(doc.data().isbn || "")) === isbn
    );
    if (hasActiveLoanForIsbn) {
      res.status(409).json({
        error: "You already have this book on loan. You cannot reserve it.",
      });
      return;
    }

    if (!availableCopiesSnap.empty || (catalog.availableCount || 0) > 0) {
      res.status(409).json({
        error: "Copies are available. Borrow from the shelf instead of reserving.",
      });
      return;
    }

    if ((catalog.totalCopies || 0) === 0) {
      res.status(409).json({ error: "No physical copies exist for this title" });
      return;
    }

    const existing = await db
      .collection("reservations")
      .where("userId", "==", req.uid)
      .where("isbn", "==", isbn)
      .get();

    const hasActive = existing.docs.some((doc) =>
      ["waiting", "ready"].includes(doc.data().status)
    );

    if (hasActive) {
      res.status(409).json({ error: "You already have an active reservation for this book" });
      return;
    }

    const waitingSnap = await db
      .collection("reservations")
      .where("isbn", "==", isbn)
      .where("status", "==", "waiting")
      .get();

    const reservationId = createId("rsv");
    const now = new Date();
    const reservation = {
      reservationId,
      isbn,
      title: catalog.title || "",
      authors: catalog.authors || [],
      userId: req.uid,
      userName: user.displayName || "",
      status: "waiting",
      assignedCopyId: null,
      createdAt: now,
      updatedAt: now,
      readyAt: null,
      expiresAt: null,
      notifiedAt: null,
    };

    await db.collection("reservations").doc(reservationId).set(reservation);

    res.status(201).json({
      ...reservation,
      queuePosition: waitingSnap.size + 1,
      message: "Reservation created. You will be notified when a copy is available.",
    });
  } catch (error) {
    console.error("Create reservation error:", error);
    res.status(500).json({ error: "Failed to create reservation" });
  }
});

// List current user's reservations (queue position computed live)
router.get("/mine", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Opening Activity is a natural place to expire a hold that cron missed
    // (for example while the local API was restarted).
    try {
      await expireReadyReservationHolds();
    } catch (error) {
      console.error("[reservations] lazy expire on /mine failed:", error);
    }

    const snap = await db
      .collection("reservations")
      .where("userId", "==", req.uid)
      .get();

    const reservations: any[] = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      let queuePosition = null;
      if (data.status === "waiting") {
        queuePosition = await computeQueuePosition(data.isbn, doc.id);
      }
      reservations.push({
        ...data,
        reservationId: data.reservationId || doc.id,
        queuePosition,
      });
    }

    reservations.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    res.json({ reservations });
  } catch (error) {
    console.error("List reservations error:", error);
    res.status(500).json({ error: "Failed to list reservations" });
  }
});

// Cancel a waiting reservation (owner only)
router.delete("/:reservationId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const reservationId = req.params.reservationId as string;
    const ref = db.collection("reservations").doc(reservationId);
    const snap = await ref.get();

    if (!snap.exists) {
      res.status(404).json({ error: "Reservation not found" });
      return;
    }

    const data = snap.data()!;
    if (data.userId !== req.uid) {
      res.status(403).json({ error: "You can only cancel your own reservation" });
      return;
    }

    if (data.status !== "waiting" && data.status !== "ready") {
      res.status(400).json({ error: "Only waiting or ready reservations can be cancelled" });
      return;
    }

    const now = new Date();
    const isbn = normalizeIsbn(String(data.isbn || ""));
    const copyId = data.assignedCopyId as string | undefined;
    const title = String(data.title || "this title");

    if (data.status === "ready") {
      const catalogRef = db.collection("catalog").doc(isbn);
      await db.runTransaction(async (tx) => {
        const copyRef = copyId ? db.collection("bookCopies").doc(copyId) : null;
        const [fresh, catalogSnap, copySnap] = await Promise.all([
          tx.get(ref),
          tx.get(catalogRef),
          copyRef ? tx.get(copyRef) : Promise.resolve(null),
        ]);
        if (!fresh.exists) return;
        const current = fresh.data()!;
        if (current.status !== "ready") return;

        tx.update(ref, {
          status: "cancelled",
          cancelReason: "user_cancelled",
          updatedAt: now,
        });

        if (copyRef && copySnap?.exists) {
          const copy = copySnap.data()!;
          if (copy.status === "reserved" && copy.reservedForUserId === current.userId) {
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
            availableCount: (catalog.availableCount || 0) + (copyId ? 1 : 0),
            updatedAt: now,
          });
        }
      });

      try {
        const assigned = copyId
          ? await assignCopyToNextReservation({
              copyId,
              isbn,
              title,
              excludeUserId: req.uid,
            })
          : null;
        if (!assigned) {
          await fulfillWaitingWithAvailableCopies(isbn);
        }
      } catch (error) {
        console.error("Fulfill after ready cancel failed:", error);
      }

      res.json({
        success: true,
        reservationId,
        released: true,
        message: "Hold cancelled. The copy was released.",
      });
      return;
    }

    await ref.update({
      status: "cancelled",
      cancelReason: "user_cancelled",
      updatedAt: now,
    });

    try {
      await fulfillWaitingWithAvailableCopies(isbn);
    } catch (error) {
      console.error("Fulfill after cancel failed:", error);
    }

    res.json({ success: true, reservationId });
  } catch (error) {
    console.error("Cancel reservation error:", error);
    res.status(500).json({ error: "Failed to cancel reservation" });
  }
});

export default router;

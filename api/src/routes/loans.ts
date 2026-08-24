import { Router, Response } from "express";
import { db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { createId } from "../utils/ids";
import {
  calculateDueDate,
  calculateFineAmount,
  getSystemConfig,
} from "../services/loans";
import { assignCopyToNextReservation } from "../services/reservations";

const router = Router();

function parseQrPayload(payload: string): { copyId: string; isbn: string } | null {
  const separator = payload.lastIndexOf("_");
  if (separator <= 0 || separator === payload.length - 1) {
    return null;
  }
  return {
    copyId: payload.slice(0, separator),
    isbn: payload.slice(separator + 1),
  };
}

async function resolveCopyId(input: { copyId?: string; qrPayload?: string }) {
  if (input.copyId) return input.copyId;
  if (input.qrPayload) {
    const parsed = parseQrPayload(String(input.qrPayload));
    if (!parsed) return null;
    return parsed.copyId;
  }
  return null;
}

// Borrow a physical copy via copyId or QR payload
router.post("/borrow", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const copyId = await resolveCopyId(req.body);
    if (!copyId) {
      res.status(400).json({
        error: "That QR code is not a valid library book label. Try again with a clearer scan.",
      });
      return;
    }

    const config = await getSystemConfig();
    const userRef = db.collection("users").doc(req.uid!);
    const copyRef = db.collection("bookCopies").doc(copyId);

    // Pre-lookup ready reservation for this user+copy (claim flow)
    const readyReservationSnap = await db
      .collection("reservations")
      .where("userId", "==", req.uid)
      .where("assignedCopyId", "==", copyId)
      .where("status", "==", "ready")
      .limit(1)
      .get();
    const readyReservationId = readyReservationSnap.empty
      ? null
      : readyReservationSnap.docs[0].id;

    const result = await db.runTransaction(async (tx) => {
      const [userSnap, copySnap] = await Promise.all([tx.get(userRef), tx.get(copyRef)]);

      if (!userSnap.exists) {
        throw new Error("USER_NOT_FOUND");
      }
      if (!copySnap.exists) {
        throw new Error("COPY_NOT_FOUND");
      }

      const user = userSnap.data()!;
      const copy = copySnap.data()!;

      if (!user.isActive) {
        throw new Error("USER_INACTIVE");
      }

      if (user.role === "librarian" && config.librariansCanBorrow === false) {
        throw new Error("LIBRARIAN_BORROW_DISABLED");
      }

      if (config.blockCheckoutIfUnpaidFine && user.hasUnpaidFines) {
        throw new Error("UNPAID_FINES");
      }

      if ((user.activeBorrowCount || 0) >= (config.maxBorrowLimit || 5)) {
        throw new Error("BORROW_LIMIT");
      }

      if (copy.status === "issued") {
        throw new Error("ALREADY_ISSUED");
      }

      if (copy.status === "damaged") {
        throw new Error("COPY_DAMAGED");
      }

      if (copy.status === "reserved") {
        if (copy.reservedForUserId !== req.uid) {
          throw new Error("RESERVED_FOR_OTHER");
        }
      } else if (copy.status !== "available") {
        throw new Error("COPY_UNAVAILABLE");
      }

      const catalogRef = db.collection("catalog").doc(copy.isbn);
      const catalogSnap = await tx.get(catalogRef);
      if (!catalogSnap.exists) {
        throw new Error("CATALOG_MISSING");
      }
      if (catalogSnap.data()?.isActive === false) {
        throw new Error("CATALOG_INACTIVE");
      }

      const now = new Date();
      const loanId = createId("loan");
      const loanRef = db.collection("loans").doc(loanId);

      const loanData = {
        loanId,
        userId: req.uid,
        userName: user.displayName || "",
        copyId,
        isbn: copy.isbn,
        title: copy.title,
        authors: copy.authors || [],
        borrowedAt: now,
        dueDate: now,
        returnedAt: null,
        status: "active",
        fineAmount: 0,
        finePaid: false,
        finePaidAt: null,
        borrowedByRole: user.role,
        returnedVia: null,
      };

      if (readyReservationId) {
        const readyRef = db.collection("reservations").doc(readyReservationId);
        const readyDoc = await tx.get(readyRef);
        if (readyDoc.exists && readyDoc.data()?.status === "ready") {
          tx.update(readyRef, {
            status: "fulfilled",
            updatedAt: now,
          });
        }
      }

      tx.set(loanRef, loanData);
      tx.update(copyRef, {
        status: "issued",
        currentLoanId: loanId,
        reservedForUserId: null,
        readyAt: null,
        expiresAt: null,
        updatedAt: now,
      });
      tx.update(userRef, {
        activeBorrowCount: (user.activeBorrowCount || 0) + 1,
        updatedAt: now,
      });

      const catalog = catalogSnap.data()!;
      tx.update(catalogRef, {
        availableCount:
          copy.status === "available"
            ? Math.max((catalog.availableCount || 0) - 1, 0)
            : catalog.availableCount || 0,
        issuedCount: (catalog.issuedCount || 0) + 1,
        reservedCount:
          copy.status === "reserved"
            ? Math.max((catalog.reservedCount || 0) - 1, 0)
            : catalog.reservedCount || 0,
        updatedAt: now,
      });

      return { loanId, isbn: copy.isbn, title: copy.title, borrowedAt: now };
    });

    const dueDate = await calculateDueDate(result.borrowedAt);
    await db.collection("loans").doc(result.loanId).update({ dueDate });

    // Cancel any waiting reservation this user had for the same ISBN
    try {
      const waiting = await db
        .collection("reservations")
        .where("userId", "==", req.uid)
        .where("isbn", "==", result.isbn)
        .get();

      const batch = db.batch();
      waiting.docs.forEach((doc) => {
        if (doc.data().status === "waiting") {
          batch.update(doc.ref, { status: "cancelled", updatedAt: new Date() });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to clear waiting reservation after borrow:", error);
    }

    res.status(201).json({
      ...result,
      dueDate,
      message: "Book borrowed successfully",
    });
  } catch (error: any) {
    const map: Record<string, [number, string]> = {
      USER_NOT_FOUND: [404, "User not found"],
      COPY_NOT_FOUND: [404, "Copy not found"],
      USER_INACTIVE: [403, "Account is suspended"],
      LIBRARIAN_BORROW_DISABLED: [403, "Librarians cannot borrow books"],
      UNPAID_FINES: [403, "Clear unpaid fines before borrowing"],
      BORROW_LIMIT: [403, "Borrow limit reached"],
      ALREADY_ISSUED: [409, "Book already issued"],
      COPY_DAMAGED: [409, "Copy is damaged"],
      RESERVED_FOR_OTHER: [
        409,
        "This copy is reserved for another student. Please pick another available copy or another book.",
      ],
      COPY_UNAVAILABLE: [409, "Copy is not available"],
      CATALOG_MISSING: [404, "Catalog entry missing"],
      CATALOG_INACTIVE: [409, "This title is deactivated and cannot be borrowed"],
    };

    const mapped = map[error.message];
    if (mapped) {
      res.status(mapped[0]).json({ error: mapped[1] });
      return;
    }

    console.error("Borrow error:", error);
    res.status(500).json({ error: "Failed to borrow book" });
  }
});

// Return a physical copy via copyId or QR payload
router.post("/return", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const copyId = await resolveCopyId(req.body);
    if (!copyId) {
      res.status(400).json({
        error: "That QR code is not a valid library book label. Try again with a clearer scan.",
      });
      return;
    }

    const config = await getSystemConfig();
    const finePerDay = Number(config.finePerDayRs || 50);
    const copyRef = db.collection("bookCopies").doc(copyId);

    const result = await db.runTransaction(async (tx) => {
      const copySnap = await tx.get(copyRef);
      if (!copySnap.exists) {
        throw new Error("COPY_NOT_FOUND");
      }

      const copy = copySnap.data()!;
      if (copy.status !== "issued" || !copy.currentLoanId) {
        throw new Error("NOT_ISSUED");
      }

      const loanRef = db.collection("loans").doc(copy.currentLoanId);
      const loanSnap = await tx.get(loanRef);
      if (!loanSnap.exists) {
        throw new Error("LOAN_NOT_FOUND");
      }

      const loan = loanSnap.data()!;
      const isOwner = loan.userId === req.uid;
      const isStaff = req.role === "librarian" || req.role === "admin";
      if (!isOwner && !isStaff) {
        throw new Error("NOT_ALLOWED");
      }

      const userRef = db.collection("users").doc(loan.userId);
      const catalogRef = db.collection("catalog").doc(copy.isbn);
      const [userSnap, catalogSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(catalogRef),
      ]);

      if (!userSnap.exists || !catalogSnap.exists) {
        throw new Error("DATA_MISSING");
      }

      const now = new Date();
      const dueDate = loan.dueDate?.toDate ? loan.dueDate.toDate() : new Date(loan.dueDate);
      const fineAmount = calculateFineAmount(dueDate, now, finePerDay);
      const user = userSnap.data()!;
      const catalog = catalogSnap.data()!;

      tx.update(loanRef, {
        returnedAt: now,
        status: "returned",
        fineAmount,
        finePaid: fineAmount === 0,
        returnedVia: "qr_scan",
        updatedAt: now,
      });

      // Temporarily mark available; may become reserved if queue exists (handled after tx)
      tx.update(copyRef, {
        status: "available",
        currentLoanId: null,
        reservedForUserId: null,
        readyAt: null,
        expiresAt: null,
        updatedAt: now,
      });

      tx.update(userRef, {
        activeBorrowCount: Math.max((user.activeBorrowCount || 0) - 1, 0),
        hasUnpaidFines: fineAmount > 0 ? true : user.hasUnpaidFines || false,
        totalOutstandingFines: (user.totalOutstandingFines || 0) + fineAmount,
        updatedAt: now,
      });

      tx.update(catalogRef, {
        availableCount: (catalog.availableCount || 0) + 1,
        issuedCount: Math.max((catalog.issuedCount || 0) - 1, 0),
        updatedAt: now,
      });

      return {
        loanId: loan.loanId,
        copyId,
        isbn: copy.isbn,
        title: copy.title,
        fineAmount,
        dueDate,
        returnedAt: now,
        returnedByUserId: loan.userId,
      };
    });

    // Fulfill next reservation if anyone is waiting (skip the borrower who just returned)
    let reservationHold = null as Awaited<ReturnType<typeof assignCopyToNextReservation>>;
    try {
      reservationHold = await assignCopyToNextReservation({
        copyId: result.copyId,
        isbn: result.isbn,
        title: result.title,
        excludeUserId: result.returnedByUserId,
      });
      // availableCount already adjusted inside assign when copy was available
    } catch (error) {
      console.error("Reservation assign after return failed:", error);
    }

    const baseMessage =
      result.fineAmount > 0
        ? `Returned with fine Rs ${result.fineAmount}`
        : "Returned successfully";

    res.json({
      ...result,
      reservationHold,
      message: reservationHold
        ? `${baseMessage}. Copy held for next student in queue.`
        : baseMessage,
    });
  } catch (error: any) {
    const map: Record<string, [number, string]> = {
      COPY_NOT_FOUND: [404, "Copy not found"],
      NOT_ISSUED: [409, "Copy is not currently issued"],
      LOAN_NOT_FOUND: [404, "Loan record not found"],
      NOT_ALLOWED: [403, "You cannot return this loan"],
      DATA_MISSING: [404, "Related user or catalog data missing"],
    };

    const mapped = map[error.message];
    if (mapped) {
      res.status(mapped[0]).json({ error: mapped[1] });
      return;
    }

    console.error("Return error:", error);
    res.status(500).json({ error: "Failed to return book" });
  }
});

// List current user's loans
router.get("/mine", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.query.status || "").trim();
    let query = db.collection("loans").where("userId", "==", req.uid);

    if (status) {
      query = query.where("status", "==", status) as typeof query;
    }

    const snap = await query.get();
    const loans = snap.docs
      .map((doc) => doc.data())
      .sort((a, b) => {
        const aTime = a.borrowedAt?.toMillis?.() || 0;
        const bTime = b.borrowedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

    res.json({ loans });
  } catch (error) {
    console.error("List loans error:", error);
    res.status(500).json({ error: "Failed to list loans" });
  }
});

// Librarian/admin marks a fine as paid
router.post(
  "/:loanId/mark-fine-paid",
  authenticate,
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const loanId = req.params.loanId as string;
      const loanRef = db.collection("loans").doc(loanId);
      const loanSnap = await loanRef.get();

      if (!loanSnap.exists) {
        res.status(404).json({ error: "Loan not found" });
        return;
      }

      const loan = loanSnap.data()!;
      if (!loan.fineAmount || loan.finePaid) {
        res.status(400).json({ error: "No unpaid fine on this loan" });
        return;
      }

      const userRef = db.collection("users").doc(loan.userId);

      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          throw new Error("USER_NOT_FOUND");
        }

        const user = userSnap.data()!;
        const remaining = Math.max(
          (user.totalOutstandingFines || 0) - (loan.fineAmount || 0),
          0
        );

        tx.update(loanRef, {
          finePaid: true,
          finePaidAt: new Date(),
          finePaidBy: req.uid,
        });

        tx.update(userRef, {
          totalOutstandingFines: remaining,
          hasUnpaidFines: remaining > 0,
          updatedAt: new Date(),
        });
      });

      await db.collection("auditLog").add({
        action: "fine_paid",
        actorId: req.uid,
        targetId: loanId,
        metadata: { amount: loan.fineAmount, userId: loan.userId },
        timestamp: new Date(),
      });

      res.json({ success: true, loanId });
    } catch (error: any) {
      if (error.message === "USER_NOT_FOUND") {
        res.status(404).json({ error: "User not found" });
        return;
      }
      console.error("Mark fine paid error:", error);
      res.status(500).json({ error: "Failed to mark fine paid" });
    }
  }
);

export default router;

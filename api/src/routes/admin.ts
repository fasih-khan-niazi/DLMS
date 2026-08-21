import { Router, Response } from "express";
import { auth, db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { getSystemConfig } from "../services/loans";

const router = Router();

router.use(authenticate);

const CONFIG_ALLOWED_FIELDS = [
  "maxBorrowLimit",
  "loanPeriodDays",
  "finePerDayRs",
  "reservationHoldHours",
  "blockCheckoutIfUnpaidFine",
  "reminderDaysBefore",
  "workingDaysOff",
  "maxPdfSizeMb",
  "librariansCanBorrow",
  "timezone",
] as const;

type ConfigField = (typeof CONFIG_ALLOWED_FIELDS)[number];

function serializeDoc(id: string, data: Record<string, any>) {
  const out: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value.toDate === "function") {
      out[key] = value.toDate().toISOString();
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Dashboard counts (librarian + admin)
router.get(
  "/dashboard",
  requireRole("librarian", "admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const now = new Date();

      const [
        usersSnap,
        activeLoansSnap,
        waitingResSnap,
        readyResSnap,
        digitalBooksSnap,
        unpaidFineUsersSnap,
      ] = await Promise.all([
        db.collection("users").count().get(),
        db.collection("loans").where("status", "==", "active").get(),
        db.collection("reservations").where("status", "==", "waiting").count().get(),
        db.collection("reservations").where("status", "==", "ready").count().get(),
        db.collection("digitalBooks").where("isPublished", "==", true).count().get(),
        db.collection("users").where("hasUnpaidFines", "==", true).get(),
      ]);

      let overdueLoans = 0;
      activeLoansSnap.docs.forEach((doc) => {
        const due = doc.data().dueDate;
        if (!due) return;
        const dueDate = typeof due.toDate === "function" ? due.toDate() : new Date(due);
        if (dueDate.getTime() < now.getTime()) {
          overdueLoans += 1;
        }
      });

      let unpaidFinesTotal = 0;
      unpaidFineUsersSnap.docs.forEach((doc) => {
        unpaidFinesTotal += Number(doc.data().totalOutstandingFines || 0);
      });

      res.json({
        users: usersSnap.data().count,
        activeLoans: activeLoansSnap.size,
        overdueLoans,
        waitingReservations: waitingResSnap.data().count,
        readyReservations: readyResSnap.data().count,
        publishedDigitalBooks: digitalBooksSnap.data().count,
        unpaidFinesTotal,
      });
    } catch (error) {
      console.error("Admin dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  }
);

// List users (admin-only)
router.get("/users", requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || "")
      .trim()
      .toLowerCase();

    const snap = await db.collection("users").limit(100).get();
    let users = snap.docs.map((doc) => serializeDoc(doc.id, doc.data()));

    if (q) {
      users = users.filter((user) => {
        const email = String(user.email || "").toLowerCase();
        const name = String(user.displayName || "").toLowerCase();
        return email.includes(q) || name.includes(q);
      });
    }

    res.json({ users });
  } catch (error) {
    console.error("Admin users list error:", error);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// Read system config (admin-only)
router.get("/config", requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const config = await getSystemConfig();
    res.json({ config });
  } catch (error) {
    console.error("Admin config read error:", error);
    res.status(500).json({ error: "Failed to read config" });
  }
});

// Merge-update system config (admin-only)
router.put("/config", requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body || {};
    const updates: Record<string, unknown> = {};

    for (const field of CONFIG_ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updates[field as ConfigField] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No allowed config fields provided" });
      return;
    }

    updates.updatedAt = new Date();
    updates.updatedBy = req.uid;

    const ref = db.collection("config").doc("system");
    await ref.set(updates, { merge: true });

    await db.collection("auditLog").add({
      action: "config_updated",
      actorId: req.uid,
      targetId: "system",
      metadata: { fields: Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "updatedBy") },
      timestamp: new Date(),
    });

    const config = await getSystemConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error("Admin config update error:", error);
    res.status(500).json({ error: "Failed to update config" });
  }
});

// Active reservations (librarian + admin)
router.get(
  "/reservations",
  requireRole("librarian", "admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const snap = await db
        .collection("reservations")
        .where("status", "in", ["waiting", "ready"])
        .limit(100)
        .get();

      const reservations = snap.docs.map((doc) => serializeDoc(doc.id, doc.data()));
      res.json({ reservations });
    } catch (error) {
      console.error("Admin reservations list error:", error);
      res.status(500).json({ error: "Failed to list reservations" });
    }
  }
);

// Unpaid fines overview (librarian + admin)
router.get(
  "/fines",
  requireRole("librarian", "admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const [usersSnap, loansSnap] = await Promise.all([
        db.collection("users").where("hasUnpaidFines", "==", true).limit(100).get(),
        db
          .collection("loans")
          .where("finePaid", "==", false)
          .limit(100)
          .get(),
      ]);

      const users = usersSnap.docs.map((doc) => serializeDoc(doc.id, doc.data()));

      const loans = loansSnap.docs
        .map((doc) => serializeDoc(doc.id, doc.data()))
        .filter((loan) => Number(loan.fineAmount || 0) > 0);

      res.json({ users, loans });
    } catch (error) {
      console.error("Admin fines list error:", error);
      res.status(500).json({ error: "Failed to list fines" });
    }
  }
);

// Mark fine paid (librarian + admin) - mirrors loans route
router.post(
  "/loans/:loanId/mark-fine-paid",
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
        metadata: { amount: loan.fineAmount, userId: loan.userId, via: "admin" },
        timestamp: new Date(),
      });

      res.json({ success: true, loanId });
    } catch (error: any) {
      if (error.message === "USER_NOT_FOUND") {
        res.status(404).json({ error: "User not found" });
        return;
      }
      console.error("Admin mark fine paid error:", error);
      res.status(500).json({ error: "Failed to mark fine paid" });
    }
  }
);

// Promote or demote a user's role (admin-only)
router.post("/users/:uid/role", requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.params.uid as string;
    const { role } = req.body;

    if (!["student", "librarian"].includes(role)) {
      res.status(400).json({
        error: "Invalid role. Only student or librarian can be assigned here. Admin is seed-only.",
      });
      return;
    }

    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userData = userDoc.data()!;

    if (userData.role === "admin") {
      res.status(400).json({
        error: "The admin account role cannot be changed from the portal",
      });
      return;
    }

    if (uid === req.uid) {
      res.status(400).json({ error: "You cannot change your own role" });
      return;
    }

    // Block promotion if user has unpaid fines
    if (role !== "student" && userData.hasUnpaidFines) {
      res.status(400).json({ error: "Cannot promote user with unpaid fines" });
      return;
    }

    // Block promotion if user is suspended
    if (!userData.isActive) {
      res.status(400).json({ error: "Cannot change role of a suspended account" });
      return;
    }

    // If promoting from student, cancel waiting reservations
    if (userData.role === "student" && role !== "student") {
      const waitingReservations = await db
        .collection("reservations")
        .where("userId", "==", uid)
        .where("status", "==", "waiting")
        .get();

      const batch = db.batch();
      waitingReservations.docs.forEach((doc) => {
        batch.update(doc.ref, { status: "cancelled", updatedAt: new Date() });
      });

      // Check for ready reservations (block promotion)
      const readyReservations = await db
        .collection("reservations")
        .where("userId", "==", uid)
        .where("status", "==", "ready")
        .get();

      if (!readyReservations.empty) {
        res.status(400).json({
          error: "User has a reservation ready for pickup. Resolve before promoting.",
        });
        return;
      }

      await batch.commit();
    }

    // Update custom claims and Firestore
    await auth.setCustomUserClaims(uid, { role });
    await db.collection("users").doc(uid).update({ role, updatedAt: new Date() });

    // Audit log
    await db.collection("auditLog").add({
      action: "role_changed",
      actorId: req.uid,
      targetId: uid,
      metadata: { from: userData.role, to: role },
      timestamp: new Date(),
    });

    res.json({ success: true, uid, role });
  } catch (error) {
    console.error("Role change error:", error);
    res.status(500).json({ error: "Failed to change role" });
  }
});

// Suspend or activate a user (admin-only)
router.post("/users/:uid/status", requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.params.uid as string;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive must be a boolean" });
      return;
    }

    const target = await db.collection("users").doc(uid).get();
    if (!target.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target.data()?.role === "admin" && isActive === false) {
      res.status(400).json({ error: "The admin account cannot be suspended" });
      return;
    }
    if (uid === req.uid && isActive === false) {
      res.status(400).json({ error: "You cannot suspend your own account" });
      return;
    }

    await db.collection("users").doc(uid).update({ isActive, updatedAt: new Date() });
    await auth.updateUser(uid, { disabled: !isActive });

    await db.collection("auditLog").add({
      action: isActive ? "user_activated" : "user_suspended",
      actorId: req.uid,
      targetId: uid,
      metadata: {},
      timestamp: new Date(),
    });

    res.json({ success: true, uid, isActive });
  } catch (error) {
    console.error("Status change error:", error);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

export default router;

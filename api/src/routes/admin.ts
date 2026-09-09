import { Router, Response } from "express";
import { auth, db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import {
  clampCatalogPageSize,
  fineRemaining,
  getSystemConfig,
  isValidIanaTimeZone,
  normalizeWorkingDaysOff,
} from "../services/loans";
import {
  normalizeIsbn,
  reconcileAllWaitingQueues,
  reconcileReservationsForIsbn,
  cancelLibrarianReservations,
} from "../services/reservations";
import { clearLoginLock } from "../services/loginLock";
import { persistAccruedFines } from "../services/fines";
import { notifyUser } from "../services/notifications";
import { paginateArray, parseListQuery, LIST_FETCH_CAP } from "../utils/pagination";

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
  "allowInAppCopyBorrow",
  "timezone",
  "catalogPageSize",
] as const;

type ConfigField = (typeof CONFIG_ALLOWED_FIELDS)[number];

/** Fields stored as real booleans so a checkbox can never round-trip as a string. */
const CONFIG_BOOLEAN_FIELDS = new Set<ConfigField>([
  "blockCheckoutIfUnpaidFine",
  "librariansCanBorrow",
  "allowInAppCopyBorrow",
]);

function coerceConfigValue(field: ConfigField, value: unknown): unknown {
  if (CONFIG_BOOLEAN_FIELDS.has(field)) {
    if (typeof value === "string") {
      return value === "true" || value === "1" || value === "on";
    }
    return value === true;
  }
  return value;
}

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
    const roleFilter = String(req.query.role || "")
      .trim()
      .toLowerCase();
    const statusFilter = String(req.query.status || "")
      .trim()
      .toLowerCase();
    const finesFilter = String(req.query.fines || "")
      .trim()
      .toLowerCase();
    const { page, pageSize } = parseListQuery(req.query as Record<string, unknown>, 20);

    const snap = await db.collection("users").limit(LIST_FETCH_CAP).get();
    let users = snap.docs.map((doc) => serializeDoc(doc.id, doc.data()));

    if (q) {
      users = users.filter((user) => {
        const email = String(user.email || "").toLowerCase();
        const name = String(user.displayName || "").toLowerCase();
        return email.includes(q) || name.includes(q);
      });
    }

    if (roleFilter === "student" || roleFilter === "librarian" || roleFilter === "admin") {
      users = users.filter((user) => String(user.role || "student") === roleFilter);
    }

    if (statusFilter === "active") {
      users = users.filter((user) => user.isActive !== false);
    } else if (statusFilter === "suspended") {
      users = users.filter((user) => user.isActive === false);
    }

    if (finesFilter === "unpaid" || finesFilter === "1" || finesFilter === "true") {
      users = users.filter((user) => !!user.hasUnpaidFines);
    }

    users.sort((a, b) =>
      String(a.displayName || a.email || "").localeCompare(String(b.displayName || b.email || ""))
    );

    const truncated = snap.size >= LIST_FETCH_CAP;
    const paged = paginateArray(users, page, pageSize);
    res.json({
      users: paged.results,
      page: paged.page,
      pageSize: paged.pageSize,
      total: paged.total,
      totalPages: paged.totalPages,
      truncated,
    });
  } catch (error) {
    console.error("Admin users list error:", error);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// Read system config (admin-only)
router.get("/config", requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const config = await getSystemConfig();
    // supportedFields lets the portal detect an older API that would silently
    // drop newer settings instead of quietly reverting the control.
    res.json({ config, supportedFields: [...CONFIG_ALLOWED_FIELDS] });
  } catch (error) {
    console.error("Admin config read error:", error);
    res.status(500).json({ error: "Failed to read config" });
  }
});

// Merge-update system config (admin-only)
router.put("/config", requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const body = req.body || {};
    const updates: Record<string, unknown> = {};

    for (const field of CONFIG_ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updates[field as ConfigField] = coerceConfigValue(field, body[field]);
      }
    }

    const appliedFields = Object.keys(updates);
    const ignoredFields = Object.keys(body).filter(
      (key) => !(CONFIG_ALLOWED_FIELDS as readonly string[]).includes(key)
    );

    if (appliedFields.length === 0) {
      res.status(400).json({ error: "No allowed config fields provided" });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "catalogPageSize")) {
      updates.catalogPageSize = clampCatalogPageSize(updates.catalogPageSize);
    }

    if (Object.prototype.hasOwnProperty.call(updates, "timezone")) {
      const tz = String(updates.timezone || "").trim();
      if (!isValidIanaTimeZone(tz)) {
        res.status(400).json({
          error: "Invalid timezone. Use a valid IANA name such as Asia/Karachi.",
        });
        return;
      }
      updates.timezone = tz;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "workingDaysOff")) {
      const normalized = normalizeWorkingDaysOff(updates.workingDaysOff);
      if (
        Array.isArray(updates.workingDaysOff) &&
        updates.workingDaysOff.length > 0 &&
        normalized.length === 0
      ) {
        res.status(400).json({
          error:
            "workingDaysOff must use English weekday names (Sunday, Monday, Tuesday, …).",
        });
        return;
      }
      updates.workingDaysOff = normalized;
    }

    const prevConfig = await getSystemConfig();
    const disablingLibrarianBorrow =
      Object.prototype.hasOwnProperty.call(updates, "librariansCanBorrow") &&
      updates.librariansCanBorrow === false &&
      prevConfig.librariansCanBorrow !== false;

    updates.updatedAt = new Date();
    updates.updatedBy = req.uid;

    const ref = db.collection("config").doc("system");
    await ref.set(updates, { merge: true });

    let cancelledLibrarianReservations = 0;
    if (disablingLibrarianBorrow) {
      try {
        cancelledLibrarianReservations = await cancelLibrarianReservations();
      } catch (error) {
        console.error("Cancel librarian reservations after config change:", error);
      }
    }

    await db.collection("auditLog").add({
      action: "config_updated",
      actorId: req.uid,
      targetId: "system",
      metadata: {
        fields: appliedFields,
        cancelledLibrarianReservations,
      },
      timestamp: new Date(),
    });

    const config = await getSystemConfig();
    res.json({
      success: true,
      config,
      appliedFields,
      ignoredFields,
      supportedFields: [...CONFIG_ALLOWED_FIELDS],
    });
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
  async (req: AuthRequest, res: Response) => {
    try {
      const { page, pageSize } = parseListQuery(
        req.query as Record<string, unknown>,
        20
      );
      const view = String(req.query.view || "loans").trim().toLowerCase();

      const [usersSnap, loansSnap] = await Promise.all([
        db
          .collection("users")
          .where("hasUnpaidFines", "==", true)
          .limit(LIST_FETCH_CAP)
          .get(),
        db.collection("loans").where("finePaid", "==", false).limit(LIST_FETCH_CAP).get(),
      ]);

      const accrueIds = new Set<string>(
        usersSnap.docs.map((doc) => doc.id).concat(
          loansSnap.docs.map((doc) => String(doc.data().userId || "")).filter(Boolean)
        )
      );
      await Promise.all(
        [...accrueIds].map(async (uid) => {
          try {
            await persistAccruedFines(uid);
          } catch (error) {
            console.error("Admin fines accrual error:", uid, error);
          }
        })
      );

      const [usersFresh, loansFresh] = await Promise.all([
        db
          .collection("users")
          .where("hasUnpaidFines", "==", true)
          .limit(LIST_FETCH_CAP)
          .get(),
        db.collection("loans").where("finePaid", "==", false).limit(LIST_FETCH_CAP).get(),
      ]);

      const users = usersFresh.docs.map((doc) => serializeDoc(doc.id, doc.data()));
      const loans = loansFresh.docs
        .map((doc) => {
          const row = serializeDoc(doc.id, doc.data());
          const remaining = fineRemaining({
            fineAmount: Number(row.fineAmount || 0),
            finePaidAmount: Number(row.finePaidAmount || 0),
            finePaid: row.finePaid === true,
          });
          return { ...row, remaining };
        })
        .filter((loan) => Number(loan.remaining || 0) > 0);

      const truncated =
        usersFresh.size >= LIST_FETCH_CAP || loansFresh.size >= LIST_FETCH_CAP;
      const usersPaged = paginateArray(users, page, pageSize);
      const loansPaged = paginateArray(loans, page, pageSize);
      const active = view === "users" ? usersPaged : loansPaged;

      res.json({
        users: usersPaged.results,
        loans: loansPaged.results,
        page: active.page,
        pageSize: active.pageSize,
        total: active.total,
        totalPages: active.totalPages,
        usersTotal: usersPaged.total,
        loansTotal: loansPaged.total,
        truncated,
        view: view === "users" ? "users" : "loans",
      });
    } catch (error) {
      console.error("Admin fines list error:", error);
      res.status(500).json({ error: "Failed to list fines" });
    }
  }
);

// Mark fine paid (librarian + admin) - mirrors loans route (partial-safe)
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

      const unpaidOnLoan = fineRemaining(loan);
      if (!unpaidOnLoan) {
        res.status(400).json({ error: "No unpaid fine on this loan" });
        return;
      }

      const userRef = db.collection("users").doc(loan.userId);
      let cleared = unpaidOnLoan;

      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          throw new Error("USER_NOT_FOUND");
        }

        const user = userSnap.data()!;
        const remaining = Math.max((user.totalOutstandingFines || 0) - unpaidOnLoan, 0);
        cleared = unpaidOnLoan;

        tx.update(loanRef, {
          finePaid: true,
          finePaidAmount: Number(loan.fineAmount || 0),
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
        metadata: {
          amount: cleared,
          fineAmount: loan.fineAmount,
          userId: loan.userId,
          via: "admin",
        },
        timestamp: new Date(),
      });

      try {
        await notifyUser({
          userId: String(loan.userId),
          type: "fine_paid",
          title: "Fine cleared",
          body: `Rs ${cleared} was marked paid at the desk.`,
          metadata: { amount: String(cleared), loanId },
          dedupeKey: `fine_paid:${loanId}:${cleared}`,
        });
      } catch (error) {
        console.error("Admin mark fine paid notify error:", error);
      }

      res.json({ success: true, loanId, amountCleared: cleared });
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

/** Heal reservation/copy drift for one ISBN or all waiting queues (admin). */
router.post(
  "/reservations/reconcile",
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const isbnRaw = req.body?.isbn || req.query?.isbn;
      if (isbnRaw) {
        const isbn = normalizeIsbn(String(isbnRaw));
        const result = await reconcileReservationsForIsbn(isbn);
        res.json({ scope: "isbn", isbn, ...result });
        return;
      }
      const result = await reconcileAllWaitingQueues();
      res.json({ scope: "all_waiting", ...result });
    } catch (error) {
      console.error("Admin reservation reconcile error:", error);
      res.status(500).json({ error: "Failed to reconcile reservations" });
    }
  }
);

/** Clear login lock for an email (admin). */
router.post("/login-locks/unlock", requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const email = String(req.body?.email || "").trim();
    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    await clearLoginLock(email);

    await db.collection("auditLog").add({
      action: "login_lock_cleared",
      actorId: req.uid,
      targetId: email.toLowerCase(),
      metadata: {},
      timestamp: new Date(),
    });

    res.json({ success: true, email });
  } catch (error) {
    console.error("Login lock unlock error:", error);
    res.status(500).json({ error: "Failed to unlock login" });
  }
});

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** List library holidays (due-date skip dates). */
router.get("/holidays", requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const snap = await db.collection("config").doc("holidays").collection("dates").get();
    const holidays = snap.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          date: String(data.date || doc.id),
          name: String(data.name || doc.id),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    res.json({ holidays });
  } catch (error) {
    console.error("Admin holidays list error:", error);
    res.status(500).json({ error: "Failed to list holidays" });
  }
});

/** Add or update a holiday date. */
router.post("/holidays", requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const date = String(req.body?.date || "").trim();
    const name = String(req.body?.name || "").trim() || date;
    if (!DATE_KEY_RE.test(date)) {
      res.status(400).json({ error: "date must be YYYY-MM-DD" });
      return;
    }

    await db.collection("config").doc("holidays").collection("dates").doc(date).set({
      date,
      name,
      updatedAt: new Date(),
      updatedBy: req.uid,
    });

    await db.collection("auditLog").add({
      action: "holiday_upserted",
      actorId: req.uid,
      targetId: date,
      metadata: { name },
      timestamp: new Date(),
    });

    res.json({ success: true, holiday: { date, name } });
  } catch (error) {
    console.error("Admin holiday upsert error:", error);
    res.status(500).json({ error: "Failed to save holiday" });
  }
});

/** Remove a holiday date. */
router.delete(
  "/holidays/:date",
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const date = String(req.params.date || "").trim();
      if (!DATE_KEY_RE.test(date)) {
        res.status(400).json({ error: "date must be YYYY-MM-DD" });
        return;
      }

      await db.collection("config").doc("holidays").collection("dates").doc(date).delete();

      await db.collection("auditLog").add({
        action: "holiday_deleted",
        actorId: req.uid,
        targetId: date,
        metadata: {},
        timestamp: new Date(),
      });

      res.json({ success: true, date });
    } catch (error) {
      console.error("Admin holiday delete error:", error);
      res.status(500).json({ error: "Failed to delete holiday" });
    }
  }
);

/** Active / overdue loans oversight. */
router.get(
  "/loans",
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const statusFilter = String(req.query.status || "all")
        .trim()
        .toLowerCase();
      const q = String(req.query.q || "")
        .trim()
        .toLowerCase();
      const { page, pageSize } = parseListQuery(
        req.query as Record<string, unknown>,
        20
      );
      const now = Date.now();

      const [activeSnap, overdueSnap] = await Promise.all([
        db.collection("loans").where("status", "==", "active").limit(LIST_FETCH_CAP).get(),
        db.collection("loans").where("status", "==", "overdue").limit(LIST_FETCH_CAP).get(),
      ]);

      const byId = new Map<string, Record<string, unknown>>();
      for (const doc of [...activeSnap.docs, ...overdueSnap.docs]) {
        byId.set(doc.id, serializeDoc(doc.id, doc.data()));
      }

      type LoanRow = Record<string, unknown> & {
        isOverdue: boolean;
        remainingFine: number;
        userEmail?: string;
        userDisplayName?: string;
      };

      let loans: LoanRow[] = [...byId.values()].map((loan) => {
        const dueMs = loan.dueDate ? new Date(String(loan.dueDate)).getTime() : NaN;
        const isOverdue =
          String(loan.status) === "overdue" ||
          (String(loan.status) === "active" && Number.isFinite(dueMs) && dueMs < now);
        return {
          ...loan,
          isOverdue,
          remainingFine: fineRemaining({
            fineAmount: loan.fineAmount,
            finePaidAmount: loan.finePaidAmount,
            finePaid: loan.finePaid,
          }),
        };
      });

      if (statusFilter === "overdue") {
        loans = loans.filter((loan) => loan.isOverdue);
      } else if (statusFilter === "active") {
        loans = loans.filter((loan) => !loan.isOverdue);
      }

      const overdueCount = [...byId.values()].filter((loan) => {
        const dueMs = loan.dueDate ? new Date(String(loan.dueDate)).getTime() : NaN;
        return (
          String(loan.status) === "overdue" ||
          (String(loan.status) === "active" && Number.isFinite(dueMs) && dueMs < now)
        );
      }).length;
      const activeCount = byId.size - overdueCount;

      const userIds = [...new Set(loans.map((loan) => String(loan.userId || "")).filter(Boolean))];
      const userSnaps = await Promise.all(
        userIds.map((uid) => db.collection("users").doc(uid).get())
      );
      const usersById = new Map(
        userSnaps
          .filter((snap) => snap.exists)
          .map((snap) => {
            const data = snap.data() || {};
            return [
              snap.id,
              {
                email: String(data.email || ""),
                displayName: String(data.displayName || ""),
              },
            ] as const;
          })
      );

      loans = loans.map((loan) => {
        const user = usersById.get(String(loan.userId || ""));
        return {
          ...loan,
          userEmail: user?.email || "",
          userDisplayName: user?.displayName || "",
        };
      });

      if (q) {
        loans = loans.filter((loan) => {
          const hay = [
            loan.title,
            loan.isbn,
            loan.copyId,
            loan.userId,
            loan.userEmail,
            loan.userDisplayName,
            loan.id,
          ]
            .map((v) => String(v || "").toLowerCase())
            .join(" ");
          return hay.includes(q);
        });
      }

      loans.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return String(a.dueDate || "").localeCompare(String(b.dueDate || ""));
      });

      const truncated =
        activeSnap.size >= LIST_FETCH_CAP || overdueSnap.size >= LIST_FETCH_CAP;
      const paged = paginateArray(loans, page, pageSize);

      res.json({
        loans: paged.results,
        page: paged.page,
        pageSize: paged.pageSize,
        total: paged.total,
        totalPages: paged.totalPages,
        truncated,
        overdueCount,
        activeCount,
      });
    } catch (error) {
      console.error("Admin loans list error:", error);
      res.status(500).json({ error: "Failed to list loans" });
    }
  }
);

export default router;

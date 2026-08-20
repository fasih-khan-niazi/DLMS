import { Router, Response } from "express";
import { auth, db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin"));

// Promote or demote a user's role
router.post("/users/:uid/role", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.params.uid as string;
    const { role } = req.body;

    if (!["student", "librarian", "admin"].includes(role)) {
      res.status(400).json({ error: "Invalid role. Must be student, librarian, or admin" });
      return;
    }

    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userData = userDoc.data()!;

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

// Suspend or activate a user
router.post("/users/:uid/status", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.params.uid as string;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive must be a boolean" });
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

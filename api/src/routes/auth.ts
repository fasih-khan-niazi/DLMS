import { Router, Request, Response } from "express";
import { auth, db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { getLoginLockStatus, recordLoginAttempt } from "../services/loginLock";

const router = Router();

function serializeLock(status: Awaited<ReturnType<typeof getLoginLockStatus>>) {
  return {
    email: status.email,
    locked: status.locked,
    failedAttempts: status.failedAttempts,
    attemptsRemaining: status.attemptsRemaining,
    lockedUntil: status.lockedUntil ? status.lockedUntil.toISOString() : null,
    lockedForSeconds: status.lockedForSeconds,
  };
}

/** Check whether an email is temporarily locked after failed sign-ins. */
router.get("/login-lock", async (req: Request, res: Response) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email.includes("@")) {
      res.status(400).json({ error: "email is required" });
      return;
    }
    const status = await getLoginLockStatus(email);
    res.json(serializeLock(status));
  } catch (error) {
    console.error("Login lock check error:", error);
    res.status(500).json({ error: "Failed to check login lock" });
  }
});

/**
 * Record a client-side sign-in attempt.
 * success:false increments failures and may lock for 15 minutes after 3 fails.
 * success:true clears the lock counter.
 */
router.post("/login-attempt", async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || "").trim();
    const success = req.body?.success === true;
    if (!email.includes("@")) {
      res.status(400).json({ error: "email is required" });
      return;
    }
    const status = await recordLoginAttempt({ email, success });
    res.json(serializeLock(status));
  } catch (error) {
    console.error("Login attempt record error:", error);
    res.status(500).json({ error: "Failed to record login attempt" });
  }
});

// Register a new user (always as student)
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      res.status(400).json({ error: "email, password, and displayName are required" });
      return;
    }

    const emailStr = String(email).trim().toLowerCase();
    const nameStr = String(displayName).trim();
    const passwordStr = String(password);

    if (!emailStr.includes("@") || nameStr.length < 2) {
      res.status(400).json({ error: "Valid email and displayName (min 2 chars) are required" });
      return;
    }
    if (passwordStr.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const userRecord = await auth.createUser({
      email: emailStr,
      password: passwordStr,
      displayName: nameStr,
    });

    // Set custom claims (role = student by default)
    await auth.setCustomUserClaims(userRecord.uid, { role: "student" });

    // Create Firestore user document
    await db.collection("users").doc(userRecord.uid).set({
      email: emailStr,
      displayName: nameStr,
      role: "student",
      activeBorrowCount: 0,
      hasUnpaidFines: false,
      totalOutstandingFines: 0,
      fcmTokens: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      role: "student",
    });
  } catch (error: any) {
    if (error.code === "auth/email-already-exists") {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Get current user profile
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userDoc = await db.collection("users").doc(req.uid!).get();

    if (!userDoc.exists) {
      res.status(404).json({ error: "User profile not found" });
      return;
    }

    res.json({ uid: req.uid, ...userDoc.data() });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Update FCM token
router.post("/fcm-token", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const userRef = db.collection("users").doc(req.uid!);
    const userDoc = await userRef.get();
    const data = userDoc.data();
    const tokens: string[] = data?.fcmTokens || [];

    if (!tokens.includes(token)) {
      tokens.push(token);
      await userRef.update({ fcmTokens: tokens, updatedAt: new Date() });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("FCM token update error:", error);
    res.status(500).json({ error: "Failed to update FCM token" });
  }
});

export default router;

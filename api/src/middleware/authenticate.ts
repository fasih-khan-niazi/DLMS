import { Request, Response, NextFunction } from "express";
import { auth, db } from "../config/firebase";

export interface AuthRequest extends Request {
  uid?: string;
  role?: string;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  try {
    const token = header.split("Bearer ")[1];
    const decoded = await auth.verifyIdToken(token);

    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) {
      res.status(401).json({ error: "User profile not found" });
      return;
    }

    const data = userDoc.data()!;
    if (data.isActive === false) {
      res.status(403).json({ error: "Account is disabled" });
      return;
    }

    req.uid = decoded.uid;
    // Firestore role is source of truth (custom claims can lag after role changes)
    req.role = typeof data.role === "string" ? data.role : "student";
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

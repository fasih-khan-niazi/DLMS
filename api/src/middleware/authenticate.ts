import { Request, Response, NextFunction } from "express";
import { auth } from "../config/firebase";

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
    req.uid = decoded.uid;
    req.role = (decoded as any).role || "student";
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

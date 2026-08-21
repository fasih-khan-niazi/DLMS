import { Request, Response, NextFunction } from "express";

export function cronAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected === "replace_me") {
    res.status(503).json({ error: "Cron secret is not configured on the server" });
    return;
  }

  const secret = req.headers["x-cron-secret"];
  if (typeof secret !== "string" || secret !== expected) {
    res.status(403).json({ error: "Invalid cron secret" });
    return;
  }
  next();
}

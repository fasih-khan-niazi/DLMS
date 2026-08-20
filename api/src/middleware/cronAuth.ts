import { Request, Response, NextFunction } from "express";

export function cronAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) {
    res.status(403).json({ error: "Invalid cron secret" });
    return;
  }
  next();
}

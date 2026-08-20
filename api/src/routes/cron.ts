import { Router, Response } from "express";
import { cronAuth } from "../middleware/cronAuth";
import { runDailyLoanNotifications } from "../services/notifications";
import { expireReadyReservationHolds } from "../services/reservations";

const router = Router();

router.use(cronAuth);

router.post("/daily-loans", async (_req, res: Response) => {
  try {
    const result = await runDailyLoanNotifications();
    res.json({ ok: true, result });
  } catch (error) {
    console.error("Manual daily cron failed:", error);
    res.status(500).json({ error: "Daily loan cron failed" });
  }
});

router.post("/reservations", async (_req, res: Response) => {
  try {
    const result = await expireReadyReservationHolds();
    res.json({ ok: true, result });
  } catch (error) {
    console.error("Manual reservation cron failed:", error);
    res.status(500).json({ error: "Reservation cron failed" });
  }
});

export default router;

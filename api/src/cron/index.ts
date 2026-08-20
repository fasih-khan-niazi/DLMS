import cron from "node-cron";
import { expireReadyReservationHolds } from "../services/reservations";
import { runDailyLoanNotifications } from "../services/notifications";

export function startCronJobs() {
  // Daily job: due-date reminders and overdue alerts (midnight Asia/Karachi)
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("[CRON] Running daily loan check...");
      try {
        const result = await runDailyLoanNotifications();
        console.log("[CRON] Daily loan notifications:", result);
      } catch (error) {
        console.error("[CRON] Daily loan check failed:", error);
      }
    },
    { timezone: "Asia/Karachi" }
  );

  // Every 6 hours: expire 72h reservation holds
  cron.schedule(
    "0 */6 * * *",
    async () => {
      console.log("[CRON] Running reservation expiry check...");
      try {
        const result = await expireReadyReservationHolds();
        console.log("[CRON] Reservation expiry result:", result);
      } catch (error) {
        console.error("[CRON] Reservation expiry failed:", error);
      }
    },
    { timezone: "Asia/Karachi" }
  );

  console.log("Cron jobs scheduled (Asia/Karachi timezone)");
}

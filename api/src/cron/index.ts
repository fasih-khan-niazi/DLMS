import cron from "node-cron";
import { runCirculationMaintenance } from "../services/reservations";
import { runDailyLoanNotifications } from "../services/notifications";

export function startCronJobs() {
  // Daily: due reminders, overdue alerts, estimated fine notices (midnight Karachi)
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

  // Every 15 minutes: expire overdue ready holds, then assign waiting queues.
  // Frequent enough that a 72h hold cannot sit days past expiresAt.
  cron.schedule(
    "*/15 * * * *",
    async () => {
      console.log("[CRON] Circulation maintenance...");
      try {
        const result = await runCirculationMaintenance();
        console.log("[CRON] Circulation maintenance:", JSON.stringify(result));
      } catch (error) {
        console.error("[CRON] Circulation maintenance failed:", error);
      }
    },
    { timezone: "Asia/Karachi" }
  );

  console.log("Cron jobs scheduled (Asia/Karachi timezone)");

  // Local watch/restarts never wait 6 hours. Expire + heal immediately after boot.
  setTimeout(() => {
    console.log("[CRON] Startup circulation maintenance...");
    runCirculationMaintenance()
      .then((result) => console.log("[CRON] Startup circulation maintenance:", JSON.stringify(result)))
      .catch((error) => console.error("[CRON] Startup circulation maintenance failed:", error));
  }, 4000);
}

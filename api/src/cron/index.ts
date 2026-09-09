import cron from "node-cron";
import { runCirculationMaintenance } from "../services/reservations";
import { runDailyLoanNotifications } from "../services/notifications";

// Cron jobs - daily reminders aur hold expiry Asia/Karachi timezone mein
export function startCronJobs() {
  // Roz raat 12 baje: due reminders, overdue alerts, fine notices
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

  // Har 15 minute: expire ready holds, phir waiting queue assign karo
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

  // Server start par turant expire + heal chalao (local restart ke liye)
  setTimeout(() => {
    console.log("[CRON] Startup circulation maintenance...");
    runCirculationMaintenance()
      .then((result) => console.log("[CRON] Startup circulation maintenance:", JSON.stringify(result)))
      .catch((error) => console.error("[CRON] Startup circulation maintenance failed:", error));
  }, 4000);
}

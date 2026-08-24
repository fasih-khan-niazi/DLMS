import cron from "node-cron";
import {
  expireReadyReservationHolds,
  reconcileAllWaitingQueues,
} from "../services/reservations";
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

  // Every 15 minutes: heal stuck waiting queues (missed return fulfills, orphan holds)
  cron.schedule(
    "*/15 * * * *",
    async () => {
      console.log("[CRON] Reconciling waiting reservation queues...");
      try {
        const result = await reconcileAllWaitingQueues();
        console.log("[CRON] Waiting queue reconcile:", result);
      } catch (error) {
        console.error("[CRON] Waiting queue reconcile failed:", error);
      }
    },
    { timezone: "Asia/Karachi" }
  );

  console.log("Cron jobs scheduled (Asia/Karachi timezone)");

  // Heal any stuck queues immediately after deploy/restart (covers the live A-returned / B-waiting case)
  setTimeout(() => {
    console.log("[CRON] Startup waiting-queue reconcile...");
    reconcileAllWaitingQueues()
      .then((result) => console.log("[CRON] Startup waiting-queue reconcile:", result))
      .catch((error) => console.error("[CRON] Startup waiting-queue reconcile failed:", error));
  }, 4000);
}

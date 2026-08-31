import axios from "axios";
import { db, messaging } from "../config/firebase";

function sanitizeDedupeKey(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
}

export async function saveNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  /** Same key = one inbox row. Stops cron + /mine + reconcile double-fires. */
  dedupeKey?: string;
}): Promise<{ id: string; created: boolean }> {
  const now = new Date();
  const payload = {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    ...(input.metadata || {}),
    read: false,
    sentAt: now,
  };

  if (input.dedupeKey) {
    const id = sanitizeDedupeKey(input.dedupeKey);
    const ref = db.collection("notifications").doc(id);
    const created = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, { ...payload, dedupeKey: id });
      return true;
    });
    return { id, created };
  }

  const ref = await db.collection("notifications").add(payload);
  return { id: ref.id, created: true };
}

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  const type = data.type || "";
  const channelId = type.startsWith("reservation")
    ? "reservations"
    : type.includes("due") || type === "overdue"
      ? "loans"
      : "default";

  await axios.post("https://exp.host/--/api/v2/push/send", {
    to: token,
    title,
    body,
    data,
    sound: "default",
    channelId,
  });
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) return { sent: 0 };

  const tokens: string[] = userSnap.data()?.fcmTokens || [];
  if (tokens.length === 0) return { sent: 0 };

  let sent = 0;
  const invalid: string[] = [];

  for (const token of tokens) {
    try {
      if (token.startsWith("ExponentPushToken")) {
        await sendExpoPush(token, title, body, data);
      } else {
        await messaging.send({
          token,
          notification: { title, body },
          data,
        });
      }
      sent += 1;
    } catch (error: any) {
      const code = error?.code || "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token")
      ) {
        invalid.push(token);
      }
      console.error(`Push send failed for user ${userId}:`, error?.message || error);
    }
  }

  if (invalid.length > 0) {
    const remaining = tokens.filter((t) => !invalid.includes(t));
    await db.collection("users").doc(userId).update({ fcmTokens: remaining });
  }

  return { sent };
}

export async function notifyUser(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
}) {
  const saved = await saveNotification(input);
  if (!saved.created) {
    return { sent: 0, skipped: true };
  }
  const data: Record<string, string> = { type: input.type };
  if (input.metadata) {
    Object.entries(input.metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        data[key] = String(value);
      }
    });
  }
  return sendPushToUser(input.userId, input.title, input.body, data);
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value._seconds) return new Date(value._seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDayInTz(timeZone: string, base = new Date()): Date {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
  // Interpret as UTC midnight of that calendar day for day-diff math
  return new Date(`${key}T00:00:00.000Z`);
}

function calendarDaysBetween(a: Date, b: Date): number {
  const ms = startOfDayInTz("UTC", b).getTime() - startOfDayInTz("UTC", a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * Daily loan reminders:
 * - 2 days before due: reminder
 * - 1 day before due: urgent reminder
 * - due date passed: overdue + mark loan overdue + fine alert
 */
let dailyJobRunning = false;

export async function runDailyLoanNotifications() {
  if (dailyJobRunning) {
    return { reminders: 0, urgent: 0, overdue: 0, checked: 0, skipped: "in_process" };
  }
  dailyJobRunning = true;
  try {
    return await runDailyLoanNotificationsInner();
  } finally {
    dailyJobRunning = false;
  }
}

async function alreadySentLoanNotice(
  loanId: string,
  type: string,
  todayKey: string,
  timezone: string
): Promise<boolean> {
  const snap = await db.collection("notifications").where("loanId", "==", loanId).limit(20).get();
  return snap.docs.some((doc) => {
    const data = doc.data();
    if (String(data.type || "") !== type) return false;
    const sent = toDate(data.sentAt);
    if (!sent) return false;
    const sentKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(sent);
    return sentKey === todayKey;
  });
}

async function runDailyLoanNotificationsInner() {
  const configSnap = await db.collection("config").doc("system").get();
  const config = configSnap.data() || {};
  const timezone = config.timezone || "Asia/Karachi";
  const finePerDay = Number(config.finePerDayRs || 50);
  const reminderDays: number[] = (config.reminderDaysBefore || [2, 1])
    .map((n: unknown) => Number(n))
    .filter((n: number) => Number.isFinite(n) && n > 0);

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [activeSnap, overdueSnap] = await Promise.all([
    db.collection("loans").where("status", "==", "active").get(),
    db.collection("loans").where("status", "==", "overdue").get(),
  ]);

  const docs = [...activeSnap.docs, ...overdueSnap.docs];

  let reminders = 0;
  let urgent = 0;
  let overdue = 0;

  for (const doc of docs) {
    const loan = doc.data();
    const dueDate = toDate(loan.dueDate);
    if (!dueDate) continue;

    const dueKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dueDate);

    // Approximate day difference using timezone calendar dates
    const today = new Date(`${todayKey}T12:00:00`);
    const due = new Date(`${dueKey}T12:00:00`);
    const daysUntilDue = calendarDaysBetween(today, due);

    const titleName = loan.title || "your book";

    if (daysUntilDue > 0 && reminderDays.includes(daysUntilDue)) {
      const isUrgent = daysUntilDue === 1;
      const loanId = String(loan.loanId || doc.id);
      const kind = isUrgent ? "due_reminder_urgent" : "due_reminder";
      if (await alreadySentLoanNotice(loanId, kind, todayKey, timezone)) {
        continue;
      }
      await notifyUser({
        userId: loan.userId,
        type: kind,
        title: isUrgent ? "Due tomorrow" : `Due in ${daysUntilDue} days`,
        body: isUrgent
          ? `"${titleName}" is due tomorrow. Please return it on time.`
          : `"${titleName}" is due in ${daysUntilDue} days.`,
        metadata: { loanId },
        dedupeKey: `${kind}_${loanId}_${todayKey}`,
      });
      if (isUrgent) urgent += 1;
      else reminders += 1;
    } else if (daysUntilDue < 0) {
      const lateDays = Math.abs(daysUntilDue);
      const fineAmount = lateDays * finePerDay;

      if (loan.status !== "overdue") {
        await doc.ref.update({ status: "overdue", updatedAt: new Date() });
      }

      const loanId = String(loan.loanId || doc.id);
      if (await alreadySentLoanNotice(loanId, "overdue", todayKey, timezone)) {
        overdue += 1;
        continue;
      }
      await notifyUser({
        userId: loan.userId,
        type: "overdue",
        title: "Book overdue",
        body: `"${titleName}" is overdue by ${lateDays} day(s). Estimated fine Rs ${fineAmount}.`,
        metadata: { loanId, fineAmount: String(fineAmount) },
        dedupeKey: `overdue_${loanId}_${todayKey}`,
      });
      overdue += 1;
    }
  }

  return { reminders, urgent, overdue, checked: docs.length };
}

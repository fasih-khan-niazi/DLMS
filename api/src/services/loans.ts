import { db } from "../config/firebase";

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getWeekdayName(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(date);
}

export async function getSystemConfig() {
  const snap = await db.collection("config").doc("system").get();
  return (
    snap.data() || {
      timezone: "Asia/Karachi",
      maxBorrowLimit: 5,
      loanPeriodDays: 14,
      finePerDayRs: 50,
      reservationHoldHours: 72,
      blockCheckoutIfUnpaidFine: true,
      workingDaysOff: ["Sunday"],
      librariansCanBorrow: true,
      maxPdfSizeMb: 25,
      reminderDaysBefore: [2, 1],
    }
  );
}

export async function getHolidaySet(): Promise<Set<string>> {
  const snap = await db.collection("config").doc("holidays").collection("dates").get();
  return new Set(snap.docs.map((doc) => doc.id));
}

export async function calculateDueDate(from = new Date()): Promise<Date> {
  const config = await getSystemConfig();
  const holidays = await getHolidaySet();
  const timezone = config.timezone || "Asia/Karachi";
  const loanDays = Number(config.loanPeriodDays || 14);
  const daysOff: string[] = config.workingDaysOff || ["Sunday"];

  // Start from issue date + loanDays calendar days
  let due = new Date(from.getTime() + loanDays * DAY_MS);

  // Roll forward while Sunday/holiday
  for (let i = 0; i < 30; i += 1) {
    const key = toDateKey(due, timezone);
    const weekday = getWeekdayName(due, timezone);
    if (!daysOff.includes(weekday) && !holidays.has(key)) {
      break;
    }
    due = new Date(due.getTime() + DAY_MS);
  }

  return due;
}

export function calculateFineAmount(
  dueDate: Date,
  returnedAt: Date,
  finePerDayRs: number
): number {
  if (returnedAt.getTime() <= dueDate.getTime()) {
    return 0;
  }

  const lateMs = returnedAt.getTime() - dueDate.getTime();
  const lateDays = Math.ceil(lateMs / DAY_MS);
  return lateDays * finePerDayRs;
}

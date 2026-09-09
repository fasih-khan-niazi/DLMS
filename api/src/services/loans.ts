import { db } from "../config/firebase";

// Loan helpers: due date, holidays, fine calculate
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

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_LOOKUP = new Map(
  WEEKDAY_NAMES.map((name) => [name.toLowerCase(), name] as const)
);

// Free-text weekday list ko English long names mein normalize
export function normalizeWorkingDaysOff(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ["Sunday"];
  const out: string[] = [];
  for (const item of raw) {
    const key = String(item || "")
      .trim()
      .toLowerCase();
    const match = WEEKDAY_LOOKUP.get(key);
    if (match && !out.includes(match)) out.push(match);
  }
  return out;
}

export function isValidIanaTimeZone(value: unknown): boolean {
  const tz = String(value || "").trim();
  if (!tz) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_SYSTEM_CONFIG = {
  timezone: "Asia/Karachi",
  maxBorrowLimit: 5,
  loanPeriodDays: 14,
  finePerDayRs: 50,
  reservationHoldHours: 72,
  blockCheckoutIfUnpaidFine: true,
  workingDaysOff: ["Sunday"],
  librariansCanBorrow: true,
  allowInAppCopyBorrow: false,
  maxPdfSizeMb: 25,
  reminderDaysBefore: [2, 1],
  catalogPageSize: 10,
};

// Config Firestore se read karo
export async function getSystemConfig() {
  const snap = await db.collection("config").doc("system").get();
  if (!snap.exists) return { ...DEFAULT_SYSTEM_CONFIG };
  const data = snap.data() || {};
  return {
    ...DEFAULT_SYSTEM_CONFIG,
    ...data,
    workingDaysOff: normalizeWorkingDaysOff(
      data.workingDaysOff ?? DEFAULT_SYSTEM_CONFIG.workingDaysOff
    ),
    timezone: isValidIanaTimeZone(data.timezone)
      ? String(data.timezone).trim()
      : DEFAULT_SYSTEM_CONFIG.timezone,
  };
}

export function clampCatalogPageSize(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 10;
  return Math.min(Math.max(Math.round(n), 5), 50);
}

export async function getHolidaySet(): Promise<Set<string>> {
  const snap = await db.collection("config").doc("holidays").collection("dates").get();
  return new Set(snap.docs.map((doc) => doc.id));
}

// Due date: loan days + Sunday/holiday skip
export async function calculateDueDate(from = new Date()): Promise<Date> {
  const config = await getSystemConfig();
  const holidays = await getHolidaySet();
  const timezone = config.timezone || "Asia/Karachi";
  const loanDays = Number(config.loanPeriodDays || 14);
  const daysOff = normalizeWorkingDaysOff(config.workingDaysOff || ["Sunday"]);

  let due = new Date(from.getTime() + loanDays * DAY_MS);

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

export function pktCalendarDaysLate(
  dueDate: Date,
  asOf: Date,
  timeZone = "Asia/Karachi"
): number {
  const dayKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  const today = new Date(`${dayKey(asOf)}T12:00:00`);
  const dueNoon = new Date(`${dayKey(dueDate)}T12:00:00`);
  return Math.max(0, Math.round((today.getTime() - dueNoon.getTime()) / DAY_MS));
}

// Yahan fine calculate hota hai (late days * finePerDay)
export function calculateFineAmount(
  dueDate: Date,
  returnedAt: Date,
  finePerDayRs: number,
  timeZone = "Asia/Karachi"
): number {
  return pktCalendarDaysLate(dueDate, returnedAt, timeZone) * Number(finePerDayRs || 0);
}

export function toFineDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") {
      const d = fn.call(value);
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
  }
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fineRemaining(loan: {
  fineAmount?: unknown;
  finePaidAmount?: unknown;
  finePaid?: unknown;
}): number {
  if (loan.finePaid === true) return 0;
  return Math.max(Number(loan.fineAmount || 0) - Number(loan.finePaidAmount || 0), 0);
}

// Live loan pe accruing fine; return ke baad freeze
export function assessedFineForLoan(
  loan: Record<string, unknown>,
  now: Date,
  finePerDayRs: number,
  timeZone = "Asia/Karachi"
): number {
  const stored = Number(loan.fineAmount || 0);
  const status = String(loan.status || "");
  if (status === "returned") return stored;
  const due = toFineDate(loan.dueDate);
  if (!due) return stored;
  const accrued = calculateFineAmount(due, now, finePerDayRs, timeZone);
  return Math.max(stored, accrued);
}

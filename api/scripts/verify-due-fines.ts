/**
 * Due-date / holiday / fine math plus a live loan audit.
 *
 * 1. Unit-tests calculateFineAmount (on-time, 1 day late, multi-day).
 * 2. Calls calculateDueDate with the live config and asserts it never lands
 *    on a configured day-off or holiday (Asia/Karachi).
 * 3. Read-only scan of active loans: overdue rows should look overdue.
 *
 * Usage (from api/):
 *   npx tsx scripts/verify-due-fines.ts
 */
import { db } from "../src/config/firebase";
import { calculateDueDate, calculateFineAmount, getSystemConfig } from "../src/services/loans";

let failures = 0;
const pass = (msg: string) => console.log(`  PASS  ${msg}`);
const fail = (msg: string) => {
  console.log(`  FAIL  ${msg}`);
  failures += 1;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function weekday(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date);
}

function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const fn = (value as { toMillis?: () => number }).toMillis;
    if (typeof fn === "function") return fn.call(value);
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

async function main() {
  console.log("Due dates, holidays, and fines");
  console.log("==============================");

  const config = await getSystemConfig();
  const timezone = String(config.timezone || "Asia/Karachi");
  const daysOff: string[] = config.workingDaysOff || ["Sunday"];
  const finePerDay = Number(config.finePerDayRs || 50);
  const loanDays = Number(config.loanPeriodDays || 14);

  console.log(`\nConfig: timezone=${timezone} loanPeriodDays=${loanDays} finePerDayRs=${finePerDay}`);
  console.log(`        workingDaysOff=${daysOff.join(", ") || "(none)"}`);

  console.log(`\n1) Fine math`);
  const due = new Date("2026-08-20T12:00:00+05:00");
  if (calculateFineAmount(due, due, finePerDay) === 0) pass("on-time return is Rs 0");
  else fail("on-time return was not Rs 0");

  const oneDayLate = calculateFineAmount(due, new Date(due.getTime() + DAY_MS), finePerDay);
  if (oneDayLate === finePerDay) pass(`1 day late = Rs ${finePerDay}`);
  else fail(`1 day late = ${oneDayLate}, expected ${finePerDay}`);

  const threeDays = calculateFineAmount(due, new Date(due.getTime() + 3 * DAY_MS), finePerDay);
  if (threeDays === 3 * finePerDay) pass(`3 days late = Rs ${3 * finePerDay}`);
  else fail(`3 days late = ${threeDays}, expected ${3 * finePerDay}`);

  if (calculateFineAmount(due, new Date(due.getTime() - DAY_MS), finePerDay) === 0) {
    pass("early return is Rs 0");
  } else {
    fail("early return produced a fine");
  }

  console.log(`\n2) Due date never lands on a closed day`);
  const holidaysSnap = await db.collection("config").doc("holidays").collection("dates").get();
  const holidays = new Set(holidaysSnap.docs.map((d) => d.id));
  console.log(`   ${holidays.size} holiday date(s) loaded`);

  const samples = [0, 1, 2, 3, 6, 7, 13].map((offset) => {
    const from = new Date();
    from.setDate(from.getDate() + offset);
    return from;
  });

  for (const from of samples) {
    const computed = await calculateDueDate(from);
    const key = toDateKey(computed, timezone);
    const day = weekday(computed, timezone);
    if (daysOff.includes(day)) {
      fail(`due ${key} is ${day}, which is a day off`);
    } else if (holidays.has(key)) {
      fail(`due ${key} is a configured holiday`);
    } else {
      pass(`from ${toDateKey(from, timezone)} → due ${key} (${day})`);
    }
  }

  if (timezone === "Asia/Karachi") pass("library timezone is Asia/Karachi (PKT)");
  else fail(`timezone is ${timezone}, expected Asia/Karachi`);

  console.log(`\n3) Live active-loan audit (read-only)`);
  const loans = await db.collection("loans").where("status", "in", ["active", "overdue"]).get();
  const now = Date.now();
  let overdueRows = 0;
  let mismatched = 0;
  for (const doc of loans.docs) {
    const data = doc.data();
    const dueMs = toMs(data.dueDate);
    const isPast = dueMs > 0 && dueMs < now;
    if (isPast) overdueRows += 1;
    if (data.status === "overdue" && !isPast) {
      mismatched += 1;
      fail(`loan ${doc.id} marked overdue but dueDate is in the future`);
    }
  }
  console.log(`   ${loans.size} active/overdue loan(s), ${overdueRows} past dueDate`);
  if (mismatched === 0) pass("no loan is labelled overdue while still before its due date");

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Due/fines test crashed:", error?.message || error);
  process.exit(2);
});

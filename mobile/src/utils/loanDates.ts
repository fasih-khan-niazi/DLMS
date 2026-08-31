const DAY_MS = 24 * 60 * 60 * 1000;

export function parseFirestoreDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as { _seconds?: number; toDate?: () => Date };
    if (typeof record.toDate === "function") return record.toDate();
    if (typeof record._seconds === "number") return new Date(record._seconds * 1000);
  }
  return null;
}

export function formatShortDate(value: unknown): string {
  const date = parseFirestoreDate(value);
  return date ? date.toLocaleDateString() : "-";
}

export type DueTone = "success" | "warning" | "danger" | "muted";

export function dueCountdown(dueDateValue: unknown): { label: string; tone: DueTone; overdue: boolean } {
  const due = parseFirestoreDate(dueDateValue);
  if (!due) return { label: "Due date unknown", tone: "muted", overdue: false };

  const tz = "Asia/Karachi";
  const dayKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);

  const today = new Date(`${dayKey(new Date())}T12:00:00`);
  const dueNoon = new Date(`${dayKey(due)}T12:00:00`);
  const diffDays = Math.round((dueNoon.getTime() - today.getTime()) / DAY_MS);

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return {
      label: days === 1 ? "Overdue by 1 day" : `Overdue by ${days} days`,
      tone: "danger",
      overdue: true,
    };
  }

  if (diffDays === 0) {
    return { label: "Due today", tone: "warning", overdue: false };
  }

  if (diffDays === 1) {
    return { label: "Due in 1 day", tone: "success", overdue: false };
  }

  return { label: `Due in ${diffDays} days`, tone: "success", overdue: false };
}

export function loanStatusChip(status: string, dueDateValue: unknown): { label: string; tone: DueTone } {
  if (status === "returned") return { label: "Returned", tone: "muted" };
  const due = dueCountdown(dueDateValue);
  if (due.overdue) return { label: "Overdue", tone: "danger" };
  return { label: "Active", tone: "success" };
}

export function reservationStatusChip(status: string): { label: string; tone: DueTone | "warning" } {
  switch (status) {
    case "ready":
      return { label: "Ready", tone: "success" };
    case "waiting":
      return { label: "Waiting", tone: "warning" };
    case "cancelled":
      return { label: "Cancelled", tone: "muted" };
    case "expired":
      return { label: "Expired", tone: "muted" };
    case "fulfilled":
      return { label: "Fulfilled", tone: "success" };
    default:
      return { label: status || "Unknown", tone: "muted" };
  }
}

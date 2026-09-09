import { Router, Response } from "express";
import { db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { getSystemConfig } from "../services/loans";

const router = Router();

router.use(authenticate);
router.use(requireRole("librarian", "admin"));

const FETCH_CAP = 3000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type DayBucket = {
  date: string;
  loans: number;
  returns: number;
  reservations: number;
};

function dateKeyInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** First UTC instant that falls on `dateStr` in `timeZone`, and last ms of that day. */
function dayBoundsInTz(
  dateStr: string,
  timeZone: string
): { start: Date; end: Date } {
  let start: Date | null = null;
  const probe = new Date(`${dateStr}T00:00:00.000Z`);
  for (let h = -14; h <= 36; h += 1) {
    const d = new Date(probe.getTime() + h * 60 * 60 * 1000);
    if (dateKeyInTz(d, timeZone) === dateStr) {
      if (!start) start = d;
    } else if (start) {
      return { start, end: new Date(d.getTime() - 1) };
    }
  }
  // Fallback: treat as UTC calendar day
  return {
    start: new Date(`${dateStr}T00:00:00.000Z`),
    end: new Date(`${dateStr}T23:59:59.999Z`),
  };
}

function todayInTz(timeZone: string): string {
  return dateKeyInTz(new Date(), timeZone);
}

function addCalendarDays(dateStr: string, deltaDays: number, timeZone: string): string {
  const { start } = dayBoundsInTz(dateStr, timeZone);
  const shifted = new Date(start.getTime() + deltaDays * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
  return dateKeyInTz(shifted, timeZone);
}

async function parseRange(
  req: AuthRequest
): Promise<{ from: string; to: string; fromDate: Date; toDate: Date; timeZone: string } | null> {
  const config = await getSystemConfig();
  const timeZone = String(config.timezone || "Asia/Karachi");
  const today = todayInTz(timeZone);
  const fromRaw = String(req.query.from || "").trim() || addCalendarDays(today, -30, timeZone);
  const toRaw = String(req.query.to || "").trim() || today;

  if (!DATE_RE.test(fromRaw) || !DATE_RE.test(toRaw)) {
    return null;
  }
  if (fromRaw > toRaw) {
    return null;
  }

  const fromBounds = dayBoundsInTz(fromRaw, timeZone);
  const toBounds = dayBoundsInTz(toRaw, timeZone);

  return {
    from: fromRaw,
    to: toRaw,
    fromDate: fromBounds.start,
    toDate: toBounds.end,
    timeZone,
  };
}

function toJsDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toIso(value: unknown): string {
  const d = toJsDate(value);
  return d ? d.toISOString() : "";
}

function reportDateKey(value: unknown, timeZone: string): string | null {
  const d = toJsDate(value);
  if (!d) return null;
  return dateKeyInTz(d, timeZone);
}

function inRange(value: unknown, fromDate: Date, toDate: Date): boolean {
  const d = toJsDate(value);
  if (!d) return false;
  const t = d.getTime();
  return t >= fromDate.getTime() && t <= toDate.getTime();
}

function buildEmptySeries(from: string, to: string, timeZone: string): DayBucket[] {
  const series: DayBucket[] = [];
  let cursor = from;
  while (cursor <= to) {
    series.push({ date: cursor, loans: 0, returns: 0, reservations: 0 });
    cursor = addCalendarDays(cursor, 1, timeZone);
  }
  return series;
}

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cols: unknown[]): string {
  return cols.map(csvEscape).join(",");
}

type ReportMetrics = {
  loansCreated: number;
  returnsCompleted: number;
  overdueLoans: number;
  reservationsCreated: number;
  finesAssessedRs: number;
  finesPaidRs: number;
  newUsers: number;
  digitalBooksUploaded: number;
  activeLoansNow: number;
};

type LoanLine = {
  loanId: string;
  userId: string;
  isbn: string;
  status: string;
  borrowedAt: string;
  dueDate: string;
  returnedAt: string;
  fineAmount: number;
  finePaid: boolean;
};

async function computeReport(
  from: string,
  to: string,
  fromDate: Date,
  toDate: Date,
  timeZone: string
) {
  const now = new Date();
  const series = buildEmptySeries(from, to, timeZone);
  const byDate = new Map(series.map((b) => [b.date, b]));

  const [loansSnap, reservationsSnap, usersSnap, digitalSnap] = await Promise.all([
    db.collection("loans").limit(FETCH_CAP).get(),
    db.collection("reservations").limit(FETCH_CAP).get(),
    db.collection("users").limit(FETCH_CAP).get(),
    db.collection("digitalBooks").limit(FETCH_CAP).get(),
  ]);

  let loansCreated = 0;
  let returnsCompleted = 0;
  let overdueLoans = 0;
  let activeLoansNow = 0;
  let finesAssessedRs = 0;
  let finesPaidRs = 0;
  const loanLines: LoanLine[] = [];

  for (const doc of loansSnap.docs) {
    const data = doc.data();
    const borrowedAt = data.borrowedAt ?? data.createdAt;
    const returnedAt = data.returnedAt;
    const dueDate = data.dueDate;
    const status = String(data.status || "");
    const fineAmount = Number(data.fineAmount || 0);
    const finePaid = Boolean(data.finePaid);

    const borrowedInRange = inRange(borrowedAt, fromDate, toDate);
    const returnedInRange = inRange(returnedAt, fromDate, toDate);

    if (borrowedInRange) {
      loansCreated += 1;
      const key = reportDateKey(borrowedAt, timeZone);
      if (key && byDate.has(key)) {
        byDate.get(key)!.loans += 1;
      }
    }

    if (returnedInRange) {
      returnsCompleted += 1;
      const key = reportDateKey(returnedAt, timeZone);
      if (key && byDate.has(key)) {
        byDate.get(key)!.returns += 1;
      }
      if (fineAmount > 0) {
        finesAssessedRs += fineAmount;
      }
    }

    if (inRange(data.finePaidAt, fromDate, toDate) && finePaid && fineAmount > 0) {
      finesPaidRs += fineAmount;
    }

    if (status === "active") {
      activeLoansNow += 1;
      const due = toJsDate(dueDate);
      if (due && due.getTime() < now.getTime()) {
        overdueLoans += 1;
      }
    } else if (status === "overdue") {
      overdueLoans += 1;
      activeLoansNow += 1;
    }

    if (borrowedInRange || returnedInRange) {
      loanLines.push({
        loanId: doc.id,
        userId: String(data.userId || ""),
        isbn: String(data.isbn || ""),
        status,
        borrowedAt: toIso(borrowedAt),
        dueDate: toIso(dueDate),
        returnedAt: toIso(returnedAt),
        fineAmount,
        finePaid,
      });
    }
  }

  let reservationsCreated = 0;
  for (const doc of reservationsSnap.docs) {
    const data = doc.data();
    const createdAt = data.createdAt ?? data.requestedAt;
    if (!inRange(createdAt, fromDate, toDate)) continue;
    reservationsCreated += 1;
    const key = reportDateKey(createdAt, timeZone);
    if (key && byDate.has(key)) {
      byDate.get(key)!.reservations += 1;
    }
  }

  let newUsers = 0;
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (inRange(data.createdAt, fromDate, toDate)) newUsers += 1;
  }

  let digitalBooksUploaded = 0;
  for (const doc of digitalSnap.docs) {
    const data = doc.data();
    if (inRange(data.createdAt ?? data.uploadedAt, fromDate, toDate)) {
      digitalBooksUploaded += 1;
    }
  }

  const metrics: ReportMetrics = {
    loansCreated,
    returnsCompleted,
    overdueLoans,
    reservationsCreated,
    finesAssessedRs,
    finesPaidRs,
    newUsers,
    digitalBooksUploaded,
    activeLoansNow,
  };

  return { metrics, series, loanLines, timeZone };
}

router.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const range = await parseRange(req);
    if (!range) {
      res.status(400).json({ error: "Invalid from/to. Use YYYY-MM-DD with from <= to" });
      return;
    }

    const { metrics, series, timeZone } = await computeReport(
      range.from,
      range.to,
      range.fromDate,
      range.toDate,
      range.timeZone
    );

    res.json({
      from: range.from,
      to: range.to,
      timeZone,
      metrics,
      series,
    });
  } catch (error) {
    console.error("Reports summary error:", error);
    res.status(500).json({ error: "Failed to build report summary" });
  }
});

router.get("/export.csv", async (req: AuthRequest, res: Response) => {
  try {
    const range = await parseRange(req);
    if (!range) {
      res.status(400).json({ error: "Invalid from/to. Use YYYY-MM-DD with from <= to" });
      return;
    }

    const { metrics, series, loanLines, timeZone } = await computeReport(
      range.from,
      range.to,
      range.fromDate,
      range.toDate,
      range.timeZone
    );

    const lines: string[] = [];
    lines.push(`# DLMS report ${range.from} to ${range.to} (${timeZone})`);
    lines.push(csvRow(["metric", "value"]));
    for (const [key, value] of Object.entries(metrics)) {
      lines.push(csvRow([key, value]));
    }
    lines.push("");
    lines.push(csvRow(["date", "loans", "returns", "reservations"]));
    for (const day of series) {
      lines.push(csvRow([day.date, day.loans, day.returns, day.reservations]));
    }
    lines.push("");
    lines.push(
      csvRow([
        "loanId",
        "userId",
        "isbn",
        "status",
        "borrowedAt",
        "dueDate",
        "returnedAt",
        "fineAmount",
        "finePaid",
      ])
    );
    for (const loan of loanLines) {
      lines.push(
        csvRow([
          loan.loanId,
          loan.userId,
          loan.isbn,
          loan.status,
          loan.borrowedAt,
          loan.dueDate,
          loan.returnedAt,
          loan.fineAmount,
          loan.finePaid,
        ])
      );
    }

    const filename = `dlms-report-${range.from}-${range.to}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(lines.join("\n"));
  } catch (error) {
    console.error("Reports CSV error:", error);
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

router.get("/export.pdf", async (req: AuthRequest, res: Response) => {
  try {
    const range = await parseRange(req);
    if (!range) {
      res.status(400).json({ error: "Invalid from/to. Use YYYY-MM-DD with from <= to" });
      return;
    }

    const { metrics, series, timeZone } = await computeReport(
      range.from,
      range.to,
      range.fromDate,
      range.toDate,
      range.timeZone
    );

    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const filename = `dlms-report-${range.from}-${range.to}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).fillColor("#2E4A62").text("DLMS Library Report", { align: "left" });
    doc.moveDown(0.4);
    doc
      .fontSize(11)
      .fillColor("#667788")
      .text(`Period: ${range.from} to ${range.to} (${timeZone})`);
    doc.text(`Generated: ${new Date().toLocaleString("en-PK", { timeZone })}`);
    doc.moveDown();

    doc.fontSize(14).fillColor("#2E4A62").text("Summary metrics");
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#2a2a2a");
    for (const [key, value] of Object.entries(metrics)) {
      doc.text(`${key}: ${value}`);
    }

    doc.moveDown();
    doc.fontSize(14).fillColor("#2E4A62").text("Daily activity");
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#2a2a2a");
    doc.text("Date            Loans   Returns   Reservations");
    doc.moveDown(0.3);

    for (const day of series) {
      const line = `${day.date}      ${String(day.loans).padStart(5)}   ${String(day.returns).padStart(7)}   ${String(day.reservations).padStart(12)}`;
      doc.text(line);
      if (doc.y > 750) {
        doc.addPage();
      }
    }

    doc.end();
  } catch (error) {
    console.error("Reports PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to export PDF" });
    }
  }
});

export default router;

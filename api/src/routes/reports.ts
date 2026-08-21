import { Router, Response } from "express";
import { db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.use(authenticate);
router.use(requireRole("librarian", "admin"));

const FETCH_CAP = 3000;
const TZ = "Asia/Karachi";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type DayBucket = {
  date: string;
  loans: number;
  returns: number;
  reservations: number;
};

function karachiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addCalendarDays(dateStr: string, deltaDays: number): string {
  const base = new Date(`${dateStr}T12:00:00+05:00`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

function parseRange(req: AuthRequest): { from: string; to: string; fromDate: Date; toDate: Date } | null {
  const today = karachiToday();
  const fromRaw = String(req.query.from || "").trim() || addCalendarDays(today, -30);
  const toRaw = String(req.query.to || "").trim() || today;

  if (!DATE_RE.test(fromRaw) || !DATE_RE.test(toRaw)) {
    return null;
  }
  if (fromRaw > toRaw) {
    return null;
  }

  return {
    from: fromRaw,
    to: toRaw,
    fromDate: new Date(`${fromRaw}T00:00:00+05:00`),
    toDate: new Date(`${toRaw}T23:59:59.999+05:00`),
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

function karachiDateKey(value: unknown): string | null {
  const d = toJsDate(value);
  if (!d) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function inRange(value: unknown, fromDate: Date, toDate: Date): boolean {
  const d = toJsDate(value);
  if (!d) return false;
  const t = d.getTime();
  return t >= fromDate.getTime() && t <= toDate.getTime();
}

function buildEmptySeries(from: string, to: string): DayBucket[] {
  const series: DayBucket[] = [];
  let cursor = from;
  while (cursor <= to) {
    series.push({ date: cursor, loans: 0, returns: 0, reservations: 0 });
    cursor = addCalendarDays(cursor, 1);
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

async function computeReport(from: string, to: string, fromDate: Date, toDate: Date) {
  const now = new Date();
  const series = buildEmptySeries(from, to);
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
      const key = karachiDateKey(borrowedAt);
      if (key && byDate.has(key)) {
        byDate.get(key)!.loans += 1;
      }
    }

    if (returnedInRange) {
      returnsCompleted += 1;
      const key = karachiDateKey(returnedAt);
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
    const createdAt = data.createdAt;
    if (!inRange(createdAt, fromDate, toDate)) continue;
    reservationsCreated += 1;
    const key = karachiDateKey(createdAt);
    if (key && byDate.has(key)) {
      byDate.get(key)!.reservations += 1;
    }
  }

  let newUsers = 0;
  for (const doc of usersSnap.docs) {
    if (inRange(doc.data().createdAt, fromDate, toDate)) {
      newUsers += 1;
    }
  }

  let digitalBooksUploaded = 0;
  for (const doc of digitalSnap.docs) {
    if (inRange(doc.data().createdAt, fromDate, toDate)) {
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

  return { metrics, series, loanLines };
}

router.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const range = parseRange(req);
    if (!range) {
      res.status(400).json({ error: "Invalid from/to. Use YYYY-MM-DD with from <= to" });
      return;
    }

    const { metrics, series } = await computeReport(
      range.from,
      range.to,
      range.fromDate,
      range.toDate
    );

    res.json({
      from: range.from,
      to: range.to,
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
    const range = parseRange(req);
    if (!range) {
      res.status(400).json({ error: "Invalid from/to. Use YYYY-MM-DD with from <= to" });
      return;
    }

    const { metrics, series, loanLines } = await computeReport(
      range.from,
      range.to,
      range.fromDate,
      range.toDate
    );

    const lines: string[] = [];
    lines.push("section,key,value");
    lines.push(csvRow(["summary", "from", range.from]));
    lines.push(csvRow(["summary", "to", range.to]));
    for (const [key, value] of Object.entries(metrics)) {
      lines.push(csvRow(["summary", key, value]));
    }

    lines.push("");
    lines.push("section,date,loans,returns,reservations");
    for (const day of series) {
      lines.push(csvRow(["daily", day.date, day.loans, day.returns, day.reservations]));
    }

    lines.push("");
    lines.push(
      "section,loanId,userId,isbn,status,borrowedAt,dueDate,returnedAt,fineAmount,finePaid"
    );
    for (const loan of loanLines) {
      lines.push(
        csvRow([
          "loan",
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
    console.error("Reports CSV export error:", error);
    res.status(500).json({ error: "Failed to export report CSV" });
  }
});

router.get("/export.pdf", async (req: AuthRequest, res: Response) => {
  try {
    const range = parseRange(req);
    if (!range) {
      res.status(400).json({ error: "Invalid from/to. Use YYYY-MM-DD with from <= to" });
      return;
    }

    const { metrics, series } = await computeReport(
      range.from,
      range.to,
      range.fromDate,
      range.toDate
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
      .text(`Period: ${range.from} to ${range.to} (Asia/Karachi)`);
    doc.text(`Generated: ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`);
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
        doc.fontSize(10).fillColor("#2a2a2a");
      }
    }

    if (series.length === 0) {
      doc.text("No daily activity in this range.");
    }

    doc.end();
  } catch (error) {
    console.error("Reports PDF export error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to export report PDF" });
    }
  }
});

export default router;

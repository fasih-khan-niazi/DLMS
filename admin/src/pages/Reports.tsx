// date-range reports, charts, CSV/PDF export
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { api } from "../config/api";
import { EmptyState, FilterChips, PageHeader, useToast } from "../components/ui";
import { extractApiError } from "../utils/apiError";

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

type DayBucket = {
  date: string;
  loans: number;
  returns: number;
  reservations: number;
};

type SummaryResponse = {
  from: string;
  to: string;
  timeZone?: string;
  metrics: ReportMetrics;
  series: DayBucket[];
};

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoLocalIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const METRIC_LABELS: { key: keyof ReportMetrics; label: string }[] = [
  { key: "loansCreated", label: "Loans created" },
  { key: "returnsCompleted", label: "Returns completed" },
  { key: "overdueLoans", label: "Overdue loans (now)" },
  { key: "reservationsCreated", label: "Reservations created" },
  { key: "finesAssessedRs", label: "Fines assessed (Rs)" },
  { key: "finesPaidRs", label: "Fines paid (Rs)" },
  { key: "newUsers", label: "New users" },
  { key: "digitalBooksUploaded", label: "Digital books uploaded" },
  { key: "activeLoansNow", label: "Active loans (now)" },
];

const PRESETS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "custom", label: "Custom", days: 0 },
];

export function ReportsPage() {
  const { showToast } = useToast();
  const [from, setFrom] = useState(() => daysAgoLocalIso(30));
  const [to, setTo] = useState(() => todayLocalIso());
  const [preset, setPreset] = useState("30");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (fromDate: string, toDate: string) => {
      // date range pe summary metrics
      if (fromDate > toDate) {
        const msg = "From date must be on or before To date.";
        setError(msg);
        showToast(msg, "error");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<SummaryResponse>("/api/admin/reports/summary", {
          params: { from: fromDate, to: toDate },
        });
        setSummary(data);
        showToast("Report summary loaded", "success");
      } catch (err) {
        const msg = extractApiError(err, "Failed to load report summary");
        setError(msg);
        setSummary(null);
        showToast(msg, "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  function applyPreset(id: string) {
    setPreset(id);
    if (id === "custom") return;
    const days = PRESETS.find((p) => p.id === id)?.days || 30;
    const nextFrom = daysAgoLocalIso(days - 1);
    const nextTo = todayLocalIso();
    setFrom(nextFrom);
    setTo(nextTo);
    void loadSummary(nextFrom, nextTo);
  }

  function onLoad(e: FormEvent) {
    e.preventDefault();
    setPreset("custom");
    void loadSummary(from, to);
  }

  // CSV ya PDF download
  async function download(kind: "csv" | "pdf") {
    if (from > to) {
      const msg = "From date must be on or before To date.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    setExporting(kind);
    setError(null);
    try {
      const response = await api.get(
        kind === "csv" ? "/api/admin/reports/export.csv" : "/api/admin/reports/export.pdf",
        {
          params: { from, to },
          responseType: "blob",
        }
      );
      const blob = new Blob([response.data], {
        type: kind === "csv" ? "text/csv;charset=utf-8" : "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dlms-report-${from}-${to}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(
        kind === "csv" ? "CSV downloaded" : "PDF downloaded",
        "success"
      );
    } catch (err) {
      const msg = extractApiError(
        err,
        kind === "csv" ? "Failed to download CSV" : "Failed to download PDF"
      );
      setError(msg);
      showToast(msg, "error");
    } finally {
      setExporting(null);
    }
  }

  const cards = useMemo(() => {
    if (!summary) return [];
    return METRIC_LABELS.map((item) => ({
      label: item.label,
      value: summary.metrics[item.key],
    }));
  }, [summary]);

  return (
    <div className="page reports-print">
      <PageHeader
        subtitle="Date-range circulation metrics. CSV is spreadsheet-friendly; PDF is a printable summary."
        actions={
          <button
            type="button"
            className="btn btn-soft no-print"
            onClick={() => window.print()}
          >
            Print view
          </button>
        }
      />

      <FilterChips
        chips={PRESETS.map((p) => ({ id: p.id, label: p.label }))}
        value={preset}
        onChange={applyPreset}
        ariaLabel="Report range presets"
      />

      <form className="toolbar reports-toolbar no-print" onSubmit={onLoad}>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset("custom");
            }}
            required
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset("custom");
            }}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading || !!exporting}>
          {loading ? "Loading..." : "Load summary"}
        </button>
        <button
          type="button"
          className="btn btn-soft"
          disabled={!!exporting || loading}
          onClick={() => void download("csv")}
        >
          {exporting === "csv" ? "Downloading..." : "Download CSV"}
        </button>
        <button
          type="button"
          className="btn btn-soft"
          disabled={!!exporting || loading}
          onClick={() => void download("pdf")}
        >
          {exporting === "pdf" ? "Downloading..." : "Download PDF"}
        </button>
      </form>

      <p className="muted small reports-note no-print">
        CSV includes daily series and totals for the selected range. PDF is a compact printable
        overview of the same metrics.
      </p>

      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? (
        <div className="stat-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="stat-card skeleton-card" />
          ))}
        </div>
      ) : null}

      {summary && !loading ? (
        <>
          <p className="muted">
            Showing {summary.from} to {summary.to}
            {summary.timeZone ? ` · ${summary.timeZone}` : ""}
          </p>
          <div className="stat-grid">
            {cards.map((card) => (
              <div key={card.label} className="stat-card">
                <p className="stat-label">{card.label}</p>
                <p className="stat-value">{card.value}</p>
              </div>
            ))}
          </div>

          <h2 className="section-title">Daily activity</h2>
          <div className="table-wrap sticky-head">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Loans</th>
                  <th>Returns</th>
                  <th>Reservations</th>
                </tr>
              </thead>
              <tbody>
                {summary.series.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.loans}</td>
                    <td>{row.returns}</td>
                    <td>{row.reservations}</td>
                  </tr>
                ))}
                {summary.series.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      No daily rows in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!summary && !loading && !error ? (
        <EmptyState
          title="Load a report range"
          message="Pick a preset or choose From and To dates, then load the summary. You can export CSV or PDF for the same range."
        />
      ) : null}
    </div>
  );
}

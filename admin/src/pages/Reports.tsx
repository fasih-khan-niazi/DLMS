import { useCallback, useMemo, useState, type FormEvent } from "react";
import { api } from "../config/api";

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

export function ReportsPage() {
  const [from, setFrom] = useState(() => daysAgoLocalIso(30));
  const [to, setTo] = useState(() => todayLocalIso());
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<SummaryResponse>("/api/admin/reports/summary", {
        params: { from: fromDate, to: toDate },
      });
      setSummary(data);
    } catch {
      setError("Failed to load report summary");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function onLoad(e: FormEvent) {
    e.preventDefault();
    void loadSummary(from, to);
  }

  async function downloadCsv() {
    setExporting(true);
    setError(null);
    try {
      const response = await api.get("/api/admin/reports/export.csv", {
        params: { from, to },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dlms-report-${from}-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download CSV");
    } finally {
      setExporting(false);
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
    <div className="page">
      <header className="page-header">
        <h1>Reports</h1>
        <p className="muted">Date-range metrics and CSV export (Asia/Karachi calendar days on the API)</p>
      </header>

      <form className="toolbar" onSubmit={onLoad}>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Loading..." : "Load summary"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={exporting || loading}
          onClick={() => void downloadCsv()}
        >
          {exporting ? "Downloading..." : "Download CSV"}
        </button>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}

      {summary ? (
        <>
          <p className="muted">
            Showing {summary.from} to {summary.to}
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
          <div className="table-wrap">
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
                    <td colSpan={4}>No daily rows</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!summary && !loading && !error ? (
        <p className="muted">Choose a date range and load the summary.</p>
      ) : null}
    </div>
  );
}

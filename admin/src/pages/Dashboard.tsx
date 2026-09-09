// ye page dashboard stats aur 7-day activity dikhata hai
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../config/api";
import { PageHeader, useToast } from "../components/ui";
import { extractApiError } from "../utils/apiError";

type DashboardStats = {
  users: number;
  activeLoans: number;
  overdueLoans: number;
  waitingReservations: number;
  readyReservations: number;
  publishedDigitalBooks: number;
  unpaidFinesTotal: number;
};

type DayBucket = {
  date: string;
  loans: number;
  returns: number;
  reservations: number;
};

const CACHE_KEY = "dlms.admin.dashboard";

function daysAgoLocalIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DashboardPage() {
  const { showToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as DashboardStats) : null;
    } catch {
      return null;
    }
  });
  const [series, setSeries] = useState<DayBucket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!stats);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(stats ? new Date() : null);

  const load = useCallback(
    async (opts?: { silent?: boolean; toast?: boolean }) => {
      if (opts?.silent && stats) setRefreshing(true);
      else if (!opts?.silent) setLoading(true);
      try {
        const [dash, report] = await Promise.all([
          api.get<DashboardStats>("/api/admin/dashboard"),
          api
            .get<{ series: DayBucket[] }>("/api/admin/reports/summary", {
              params: { from: daysAgoLocalIso(6), to: todayLocalIso() },
            })
            .catch(() => ({ data: { series: [] as DayBucket[] } })),
        ]);
        setStats(dash.data);
        setSeries(report.data.series || []);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(dash.data));
        setError(null);
        setLastRefreshed(new Date());
        if (opts?.toast) showToast("Dashboard updated", "success");
      } catch (err) {
        const msg = extractApiError(err, "Failed to load dashboard");
        if (!stats) setError(msg);
        showToast(msg, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast, stats]
  );

  useEffect(() => {
    void load({ silent: !!stats });
    // sirf pehli mount pe load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attention = stats
    ? [
        {
          label: "Overdue loans",
          value: stats.overdueLoans,
          tone: "danger" as const,
          to: "/loans",
          hint: "Open loan list filtered to overdue",
        },
        {
          label: "Unpaid fines (Rs)",
          value: stats.unpaidFinesTotal,
          tone: "warning" as const,
          to: "/fines",
          hint: "Balances waiting at the desk",
        },
        {
          label: "Ready for pickup",
          value: stats.readyReservations,
          tone: "amber" as const,
          to: "/reservations",
          hint: "Holds waiting on the shelf",
        },
      ]
    : [];

  const overview = stats
    ? [
        { label: "Users", value: stats.users, to: "/users" },
        { label: "Active loans", value: stats.activeLoans, to: "/loans" },
        { label: "Waiting reservations", value: stats.waitingReservations, to: "/reservations" },
        { label: "Digital books", value: stats.publishedDigitalBooks, to: "/catalog" },
      ]
    : [];

  return (
    <div className="page">
      <PageHeader
        subtitle="What needs attention across circulation and accounts"
        actions={
          <div className="page-header-actions">
            {lastRefreshed ? (
              <span className="pill muted-pill">
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            ) : null}
            <button
              type="button"
              className="btn btn-soft"
              disabled={refreshing || loading}
              onClick={() => void load({ silent: true, toast: true })}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        }
      />

      {error ? <p className="error-banner">{error}</p> : null}

      {loading && !stats ? (
        <div className="stat-grid">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="stat-card skeleton-card" />
          ))}
        </div>
      ) : null}

      {stats ? (
        <>
          <section className="dash-section">
            <h2 className="section-title">Needs attention</h2>
            <div className="stat-grid attention-grid">
              {attention.map((card) => (
                <Link
                  key={card.label}
                  to={card.to}
                  className={`stat-card attention-card tone-${card.tone}`}
                >
                  <p className="stat-label">{card.label}</p>
                  <p className="stat-value">{card.value}</p>
                  <p className="stat-hint">{card.hint}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="dash-section">
            <h2 className="section-title">Overview</h2>
            <div className="stat-grid">
              {overview.map((card) =>
                card.to ? (
                  <Link key={card.label} to={card.to} className="stat-card stat-card-link">
                    <p className="stat-label">{card.label}</p>
                    <p className="stat-value">{card.value}</p>
                  </Link>
                ) : (
                  <div key={card.label} className="stat-card">
                    <p className="stat-label">{card.label}</p>
                    <p className="stat-value">{card.value}</p>
                  </div>
                )
              )}
            </div>
          </section>

          {series.length > 0 ? (
            <section className="dash-section">
              <h2 className="section-title">Last 7 days</h2>
              <div className="activity-strip" aria-label="Daily loans last week">
                {series.map((day) => {
                  const max = Math.max(...series.map((d) => d.loans), 1);
                  const height = Math.max(8, Math.round((day.loans / max) * 56));
                  return (
                    <div key={day.date} className="activity-day" title={`${day.date}: ${day.loans} loans`}>
                      <div className="activity-bar" style={{ height }} />
                      <span className="activity-label muted small">
                        {day.date.slice(5)}
                      </span>
                      <span className="activity-count muted small">{day.loans}</span>
                    </div>
                  );
                })}
              </div>
              <p className="muted small">Bars show loans created each day. Open Reports for full ranges.</p>
            </section>
          ) : null}

          <section className="dash-section">
            <h2 className="section-title">Quick links</h2>
            <div className="quick-links">
              <Link className="quick-link" to="/users">
                Manage users
              </Link>
              <Link className="quick-link" to="/fines">
                Review fines
              </Link>
              <Link className="quick-link" to="/reservations">
                Reservation queue
              </Link>
              <Link className="quick-link" to="/config">
                System config
              </Link>
              <Link className="quick-link" to="/reports">
                Export reports
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

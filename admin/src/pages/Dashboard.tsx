import { useEffect, useState } from "react";
import { api } from "../config/api";

type DashboardStats = {
  users: number;
  activeLoans: number;
  overdueLoans: number;
  waitingReservations: number;
  readyReservations: number;
  publishedDigitalBooks: number;
  unpaidFinesTotal: number;
};

const CACHE_KEY = "dlms.admin.dashboard";

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as DashboardStats) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!stats);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (stats) setRefreshing(true);
      try {
        const { data } = await api.get<DashboardStats>("/api/admin/dashboard");
        if (cancelled) return;
        setStats(data);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        setError(null);
      } catch {
        if (!cancelled && !stats) setError("Failed to load dashboard");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = stats
    ? [
        { label: "Users", value: stats.users },
        { label: "Active loans", value: stats.activeLoans },
        { label: "Overdue loans", value: stats.overdueLoans },
        { label: "Waiting reservations", value: stats.waitingReservations },
        { label: "Ready for pickup", value: stats.readyReservations },
        { label: "Digital books", value: stats.publishedDigitalBooks },
        { label: "Unpaid fines (Rs)", value: stats.unpaidFinesTotal },
      ]
    : [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Operations overview for the library</p>
        </div>
        {refreshing ? <span className="pill">Refreshing...</span> : null}
      </header>

      {loading ? (
        <div className="stat-grid">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="stat-card skeleton-card" />
          ))}
        </div>
      ) : null}

      {error ? <p className="error-banner">{error}</p> : null}

      {!loading ? (
        <div className="stat-grid">
          {cards.map((card) => (
            <div key={card.label} className="stat-card">
              <p className="stat-label">{card.label}</p>
              <p className="stat-value">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

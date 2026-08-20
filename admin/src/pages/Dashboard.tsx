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

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<DashboardStats>("/api/admin/dashboard");
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setError("Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
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
        { label: "Ready reservations", value: stats.readyReservations },
        { label: "Published digital books", value: stats.publishedDigitalBooks },
        { label: "Unpaid fines (Rs)", value: stats.unpaidFinesTotal },
      ]
    : [];

  return (
    <div className="page">
      <header className="page-header">
        <h1>Dashboard</h1>
        <p className="muted">Library overview</p>
      </header>
      {loading ? <p>Loading...</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}
      <div className="stat-grid">
        {cards.map((card) => (
          <div key={card.label} className="stat-card">
            <p className="stat-label">{card.label}</p>
            <p className="stat-value">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

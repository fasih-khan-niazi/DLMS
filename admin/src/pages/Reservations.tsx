import { useEffect, useState } from "react";
import { api } from "../config/api";

type Reservation = {
  id: string;
  userId?: string;
  isbn?: string;
  title?: string;
  status?: string;
  position?: number;
  assignedCopyId?: string;
  expiresAt?: string;
  createdAt?: string;
};

export function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ reservations: Reservation[] }>(
          "/api/admin/reservations"
        );
        if (!cancelled) setReservations(data.reservations);
      } catch {
        if (!cancelled) setError("Failed to load reservations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Reservations</h1>
        <p className="muted">Waiting and ready holds (limit 100)</p>
      </header>

      {loading ? <p>Loading...</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Title / ISBN</th>
              <th>User</th>
              <th>Copy</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`badge badge-${r.status || "waiting"}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  <div>{r.title || "-"}</div>
                  <div className="muted small">{r.isbn}</div>
                </td>
                <td className="mono">{r.userId}</td>
                <td className="mono">{r.assignedCopyId || "-"}</td>
                <td>{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
            {!loading && reservations.length === 0 ? (
              <tr>
                <td colSpan={5}>No waiting or ready reservations</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

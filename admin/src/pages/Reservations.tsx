// reservation queue list + reconcile action
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../config/api";
import {
  ConfirmDialog,
  CopyId,
  FilterChips,
  PageHeader,
  Pagination,
  useToast,
} from "../components/ui";
import { extractApiError } from "../utils/apiError";

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

const PAGE_SIZE = 20;

export function ReservationsPage() {
  const { showToast } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmReconcile, setConfirmReconcile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ reservations: Reservation[] }>(
        "/api/admin/reservations"
      );
      setReservations(data.reservations);
      setPage(1);
    } catch (err) {
      const msg = extractApiError(err, "Failed to load reservations");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // queue reconcile - waiting titles pe copies assign
  async function runReconcile() {
    setBusy(true);
    try {
      const { data } = await api.post<{
        titles?: number;
        assigned?: number;
        waitingTitles?: number;
      }>("/api/admin/reservations/reconcile");
      const assigned = Number(data.assigned ?? 0);
      const titles = Number(data.titles ?? data.waitingTitles ?? 0);
      showToast(
        assigned > 0
          ? `Reconciled ${titles} titles · ${assigned} copies assigned`
          : `Checked ${titles} waiting titles · no drift found`,
        "success"
      );
      setConfirmReconcile(false);
      await load();
    } catch (err) {
      const msg = extractApiError(err, "Failed to reconcile reservations");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  const waiting = reservations.filter((r) => r.status === "waiting").length;
  const ready = reservations.filter((r) => r.status === "ready").length;

  const filtered = useMemo(() => {
    if (filter === "waiting") return reservations.filter((r) => r.status === "waiting");
    if (filter === "ready") return reservations.filter((r) => r.status === "ready");
    return reservations;
  }, [reservations, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div className="page">
      <PageHeader
        subtitle="Waiting and ready holds (up to 100). Reconcile heals orphan holds and counter drift."
        actions={
          <div className="page-header-actions">
            <span className="pill">Waiting {waiting}</span>
            <span className="pill pill-amber">Ready {ready}</span>
            <button
              type="button"
              className="btn btn-soft"
              disabled={loading}
              onClick={() => void load()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setConfirmReconcile(true)}
            >
              Reconcile queues
            </button>
          </div>
        }
      />

      <FilterChips
        chips={[
          { id: "all", label: `All (${reservations.length})` },
          { id: "waiting", label: `Waiting (${waiting})` },
          { id: "ready", label: `Ready (${ready})` },
        ]}
        value={filter}
        onChange={(id) => {
          setFilter(id);
          setPage(1);
        }}
        ariaLabel="Reservation status"
      />

      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? (
        <div className="skeleton-stack">
          <div className="skeleton-block tall" />
        </div>
      ) : (
        <>
          <div className="table-wrap sticky-head">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Title / ISBN</th>
                  <th>User</th>
                  <th>Copy</th>
                  <th>Expires</th>
                  <th>Next step</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      No waiting or ready reservations.
                    </td>
                  </tr>
                ) : (
                  paged.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className={`badge badge-${r.status || "waiting"}`}>
                          {r.status}
                          {r.status === "waiting" && r.position
                            ? ` · #${r.position}`
                            : ""}
                        </span>
                      </td>
                      <td>
                        <div>{r.title || "-"}</div>
                        <div className="muted small">{r.isbn}</div>
                      </td>
                      <td>
                        <CopyId value={String(r.userId || "")} label="User ID" />
                      </td>
                      <td className="mono">{r.assignedCopyId || "-"}</td>
                      <td>
                        {r.expiresAt ? new Date(r.expiresAt).toLocaleString() : "-"}
                      </td>
                      <td className="muted small">
                        {r.status === "ready"
                          ? "Reader should scan that copy to claim"
                          : "Waiting for a free copy"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={Math.min(page, totalPages)}
            totalPages={filtered.length === 0 ? 0 : totalPages}
            total={filtered.length}
            disabled={loading}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={confirmReconcile}
        title="Reconcile reservation queues?"
        message="This heals orphan reserved copies and waiting-queue drift across active titles. Safe to run; it does not cancel valid holds."
        confirmLabel="Reconcile"
        variant="info"
        busy={busy}
        onConfirm={() => void runReconcile()}
        onCancel={() => setConfirmReconcile(false)}
      />
    </div>
  );
}

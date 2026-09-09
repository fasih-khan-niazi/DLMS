import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../config/api";
import {
  CopyId,
  FilterChips,
  PageHeader,
  Pagination,
  useToast,
} from "../components/ui";
import { extractApiError } from "../utils/apiError";

type AdminLoan = {
  id: string;
  userId?: string;
  userEmail?: string;
  userDisplayName?: string;
  isbn?: string;
  title?: string;
  copyId?: string;
  status?: string;
  dueDate?: string;
  borrowedAt?: string;
  isOverdue?: boolean;
  remainingFine?: number;
  fineAmount?: number;
};

export function LoansPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("overdue");
  const [q, setQ] = useState("");
  const [loans, setLoans] = useState<AdminLoan[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextStatus: string, search: string, nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<{
          loans: AdminLoan[];
          page: number;
          total: number;
          totalPages: number;
          truncated?: boolean;
          overdueCount?: number;
          activeCount?: number;
        }>("/api/admin/loans", {
          params: {
            status: nextStatus,
            page: nextPage,
            pageSize: 20,
            ...(search ? { q: search } : {}),
          },
        });
        setLoans(data.loans || []);
        setPage(data.page || nextPage);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        setTruncated(!!data.truncated);
        setOverdueCount(data.overdueCount ?? 0);
        setActiveCount(data.activeCount ?? 0);
      } catch (err) {
        const msg = extractApiError(err, "Failed to load loans");
        setError(msg);
        showToast(msg, "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void load(status, q.trim(), 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(status, q.trim(), 1);
  }

  return (
    <div className="page">
      <PageHeader
        subtitle="Active and overdue physical loans. Use Fines for balances; Scan on mobile for return."
        actions={
          <Link className="btn btn-soft" to="/fines">
            Open fines
          </Link>
        }
      />

      <FilterChips
        chips={[
          { id: "overdue", label: `Overdue (${overdueCount})` },
          { id: "active", label: `On time (${activeCount})` },
          { id: "all", label: `All open (${overdueCount + activeCount})` },
        ]}
        value={status}
        onChange={(id) => {
          setStatus(id);
          setPage(1);
        }}
        ariaLabel="Loan status"
      />

      <form className="toolbar" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="Search title, ISBN, copy, email, or user"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-search="1"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {truncated ? (
        <p className="muted small">Showing up to the first 500 active/overdue loans.</p>
      ) : null}
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
                  <th>Book</th>
                  <th>Borrower</th>
                  <th>Due</th>
                  <th>Fine left</th>
                  <th>Copy</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      No open loans in this view.
                    </td>
                  </tr>
                ) : (
                  loans.map((loan) => (
                    <tr key={loan.id}>
                      <td>
                        <span
                          className={
                            loan.isOverdue ? "status-pill danger" : "status-pill ok"
                          }
                        >
                          {loan.isOverdue ? "Overdue" : "Active"}
                        </span>
                      </td>
                      <td>
                        <div>{loan.title || "-"}</div>
                        <div className="muted small">{loan.isbn}</div>
                      </td>
                      <td>
                        <div>{loan.userDisplayName || "-"}</div>
                        <div className="muted small">{loan.userEmail || "-"}</div>
                        <CopyId value={String(loan.userId || "")} label="User ID" />
                      </td>
                      <td>
                        {loan.dueDate
                          ? new Date(loan.dueDate).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        {Number(loan.remainingFine || 0) > 0 ? (
                          <span className="status-pill danger">
                            Rs {loan.remainingFine}
                          </span>
                        ) : (
                          <span className="muted small">Rs 0</span>
                        )}
                      </td>
                      <td className="mono">{loan.copyId || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            disabled={loading}
            onPageChange={(next) => void load(status, q.trim(), next)}
          />
        </>
      )}
    </div>
  );
}

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

type FineUser = {
  id: string;
  email?: string;
  displayName?: string;
  totalOutstandingFines?: number;
};

type FineLoan = {
  id: string;
  userId?: string;
  copyId?: string;
  isbn?: string;
  title?: string;
  fineAmount?: number;
  finePaid?: boolean;
  status?: string;
};

type PendingPay = {
  loanId: string;
  title: string;
  amount: number;
};

const PAGE_SIZE = 15;

export function FinesPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<FineUser[]>([]);
  const [loans, setLoans] = useState<FineLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPay | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("loans");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ users: FineUser[]; loans: FineLoan[] }>(
        "/api/admin/fines"
      );
      setUsers(data.users);
      setLoans(data.loans);
      setPage(1);
    } catch (err) {
      const msg = extractApiError(err, "Failed to load fines");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmMarkPaid() {
    if (!pending) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/loans/${pending.loanId}/mark-fine-paid`);
      showToast(`Marked Rs ${pending.amount} paid for ${pending.title}`, "success");
      setPending(null);
      await load();
    } catch (err) {
      const msg = extractApiError(err, "Failed to mark fine paid");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return users.slice(start, start + PAGE_SIZE);
  }, [users, page]);

  const pagedLoans = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return loans.slice(start, start + PAGE_SIZE);
  }, [loans, page]);

  const total = view === "users" ? users.length : loans.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page">
      <PageHeader
        subtitle="Outstanding balances and loan-level fines. Mark paid clears the full fine on one loan. Partial cash collection is done in the mobile Collect fines desk flow."
        actions={
          <button
            type="button"
            className="btn btn-soft"
            disabled={loading}
            onClick={() => void load()}
          >
            Refresh
          </button>
        }
      />

      <FilterChips
        chips={[
          { id: "loans", label: `Loans (${loans.length})` },
          { id: "users", label: `Users (${users.length})` },
        ]}
        value={view}
        onChange={(id) => {
          setView(id);
          setPage(1);
        }}
        ariaLabel="Fines views"
      />

      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? (
        <div className="skeleton-stack">
          <div className="skeleton-block tall" />
          <div className="skeleton-block tall" />
        </div>
      ) : view === "users" ? (
        <>
          <div className="table-wrap sticky-head">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Outstanding (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-cell">
                      No users with unpaid fines.
                    </td>
                  </tr>
                ) : (
                  pagedUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.displayName || "-"}</td>
                      <td>{u.email || "-"}</td>
                      <td>
                        <span className="status-pill danger">
                          Rs {u.totalOutstandingFines ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={Math.min(page, totalPages)}
            totalPages={users.length === 0 ? 0 : totalPages}
            total={users.length}
            disabled={loading}
            onPageChange={setPage}
          />
        </>
      ) : (
        <>
          <div className="table-wrap sticky-head">
            <table>
              <thead>
                <tr>
                  <th>Book</th>
                  <th>User</th>
                  <th>Loan</th>
                  <th>Amount (Rs)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedLoans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      No unpaid loan fines.
                    </td>
                  </tr>
                ) : (
                  pagedLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td>
                        <div>{loan.title || "-"}</div>
                        <div className="muted small">{loan.isbn || loan.copyId}</div>
                      </td>
                      <td>
                        <CopyId value={String(loan.userId || "")} label="User ID" />
                      </td>
                      <td>
                        <CopyId value={loan.id} label="Loan ID" />
                      </td>
                      <td>
                        <span className="status-pill danger">Rs {loan.fineAmount ?? 0}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-small btn-primary"
                          onClick={() =>
                            setPending({
                              loanId: loan.id,
                              title: loan.title || loan.id,
                              amount: Number(loan.fineAmount || 0),
                            })
                          }
                        >
                          Mark paid
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={Math.min(page, totalPages)}
            totalPages={loans.length === 0 ? 0 : totalPages}
            total={loans.length}
            disabled={loading}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Mark this fine paid?"
        message={
          pending
            ? `Clear the full Rs ${pending.amount} fine on "${pending.title}". This records payment in full for that loan. For partial desk cash, use Collect fines on mobile.`
            : ""
        }
        confirmLabel="Mark paid"
        variant="info"
        busy={busy}
        onConfirm={() => void confirmMarkPaid()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

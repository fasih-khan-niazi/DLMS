import { useCallback, useEffect, useState } from "react";
import { api } from "../config/api";
import { ConfirmDialog, PageHeader, useToast } from "../components/ui";
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

export function FinesPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<FineUser[]>([]);
  const [loans, setLoans] = useState<FineLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPay | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ users: FineUser[]; loans: FineLoan[] }>(
        "/api/admin/fines"
      );
      setUsers(data.users);
      setLoans(data.loans);
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

  return (
    <div className="page">
      <PageHeader
        title="Fines"
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

      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? (
        <div className="skeleton-stack">
          <div className="skeleton-block tall" />
          <div className="skeleton-block tall" />
        </div>
      ) : (
        <>
          <h2 className="section-title">Users with unpaid fines</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Outstanding (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-cell">
                      No users with unpaid fines.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
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

          <h2 className="section-title">Loans with unpaid fines</h2>
          <div className="table-wrap">
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
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      No unpaid loan fines.
                    </td>
                  </tr>
                ) : (
                  loans.map((loan) => (
                    <tr key={loan.id}>
                      <td>
                        <div>{loan.title || "-"}</div>
                        <div className="muted small">{loan.isbn || loan.copyId}</div>
                      </td>
                      <td className="mono">{loan.userId}</td>
                      <td className="mono">{loan.id}</td>
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

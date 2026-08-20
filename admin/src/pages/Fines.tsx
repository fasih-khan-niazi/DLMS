import { useCallback, useEffect, useState } from "react";
import { api } from "../config/api";

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

export function FinesPage() {
  const [users, setUsers] = useState<FineUser[]>([]);
  const [loans, setLoans] = useState<FineLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ users: FineUser[]; loans: FineLoan[] }>(
        "/api/admin/fines"
      );
      setUsers(data.users);
      setLoans(data.loans);
    } catch {
      setError("Failed to load fines");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaid(loanId: string) {
    setMessage(null);
    setError(null);
    try {
      await api.post(`/api/admin/loans/${loanId}/mark-fine-paid`);
      setMessage(`Marked fine paid for loan ${loanId}`);
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setError(msg || "Failed to mark fine paid");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Fines</h1>
        <p className="muted">Users with unpaid balances and loan-level fines</p>
      </header>

      {message ? <p className="success-banner">{message}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p>Loading...</p> : null}

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
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName || "-"}</td>
                <td>{u.email || "-"}</td>
                <td>{u.totalOutstandingFines ?? 0}</td>
              </tr>
            ))}
            {!loading && users.length === 0 ? (
              <tr>
                <td colSpan={3}>No users with unpaid fines</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Loans with unpaid fines</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Loan</th>
              <th>User</th>
              <th>Book</th>
              <th>Amount (Rs)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td className="mono">{loan.id}</td>
                <td className="mono">{loan.userId}</td>
                <td>
                  <div>{loan.title || "-"}</div>
                  <div className="muted small">{loan.isbn || loan.copyId}</div>
                </td>
                <td>{loan.fineAmount ?? 0}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    onClick={() => void markPaid(loan.id)}
                  >
                    Mark paid
                  </button>
                </td>
              </tr>
            ))}
            {!loading && loans.length === 0 ? (
              <tr>
                <td colSpan={5}>No unpaid loan fines</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

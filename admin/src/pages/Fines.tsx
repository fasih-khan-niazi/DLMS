// unpaid fines list, email lookup, aur payment collect
import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  finePaidAmount?: number;
  remaining?: number;
  finePaid?: boolean;
  status?: string;
};

type LookupResult = {
  user: { uid: string; email: string; displayName: string; role: string };
  outstanding: number;
  items: Array<{
    loanId: string;
    title: string;
    fineAmount: number;
    finePaidAmount: number;
    remaining: number;
  }>;
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
  const [view, setView] = useState("loans");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [loansTotal, setLoansTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);

  const [lookupEmail, setLookupEmail] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectBusy, setCollectBusy] = useState(false);

  const load = useCallback(
    async (nextView: string, nextPage: number) => {
      // fines users/loans view load
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<{
          users: FineUser[];
          loans: FineLoan[];
          page: number;
          totalPages: number;
          total: number;
          usersTotal: number;
          loansTotal: number;
          truncated?: boolean;
        }>("/api/admin/fines", {
          params: { view: nextView, page: nextPage, pageSize: 15 },
        });
        setUsers(data.users);
        setLoans(data.loans);
        setPage(data.page || nextPage);
        setTotalPages(data.totalPages || 0);
        setTotal(data.total || 0);
        setUsersTotal(data.usersTotal ?? data.users.length);
        setLoansTotal(data.loansTotal ?? data.loans.length);
        setTruncated(!!data.truncated);
      } catch (err) {
        const msg = extractApiError(err, "Failed to load fines");
        setError(msg);
        showToast(msg, "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void load(view, 1);
  }, [load, view]);

  // fine paid mark confirm dialog
  async function confirmMarkPaid() {
    if (!pending) return;
    setBusy(true);
    try {
      const { data } = await api.post<{ amountCleared?: number }>(
        `/api/admin/loans/${pending.loanId}/mark-fine-paid`
      );
      const cleared = data.amountCleared ?? pending.amount;
      showToast(`Marked Rs ${cleared} paid for ${pending.title}`, "success");
      setPending(null);
      await load(view, page);
      if (lookup) await runLookup(lookup.user.email, true);
    } catch (err) {
      const msg = extractApiError(err, "Failed to mark fine paid");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  async function runLookup(email: string, silent = false) {
    setLookupBusy(true);
    if (!silent) setError(null);
    try {
      const { data } = await api.get<LookupResult>("/api/fines/lookup", {
        params: { email },
      });
      setLookup(data);
      setCollectAmount(data.outstanding > 0 ? String(data.outstanding) : "");
      if (!silent) {
        showToast(
          data.outstanding > 0
            ? `Outstanding Rs ${data.outstanding}`
            : "No unpaid fines for this account",
          "success"
        );
      }
    } catch (err) {
      setLookup(null);
      const msg = extractApiError(err, "Lookup failed");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLookupBusy(false);
    }
  }

  function onLookup(e: FormEvent) {
    e.preventDefault();
    void runLookup(lookupEmail.trim().toLowerCase());
  }

  // payment collect by amount
  async function onCollect(e: FormEvent) {
    e.preventDefault();
    if (!lookup) return;
    const amount = Math.floor(Number(collectAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a positive whole-rupee amount", "error");
      return;
    }
    setCollectBusy(true);
    try {
      const { data } = await api.post<{
        collected: number;
        outstanding: number;
        message?: string;
      }>("/api/fines/collect", {
        email: lookup.user.email,
        amount,
      });
      showToast(
        data.message || `Recorded Rs ${data.collected}. Remaining Rs ${data.outstanding}.`,
        "success"
      );
      await runLookup(lookup.user.email, true);
      await load(view, page);
    } catch (err) {
      const msg = extractApiError(err, "Could not record payment");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setCollectBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        subtitle="Accrued balances, desk lookup, partial collect, or clear a loan remaining balance in full."
        actions={
          <button
            type="button"
            className="btn btn-soft"
            disabled={loading}
            onClick={() => void load(view, page)}
          >
            Refresh
          </button>
        }
      />

      <section className="config-section" style={{ marginBottom: "1.25rem" }}>
        <div className="config-section-head">
          <h2>Desk lookup</h2>
          <p className="muted small">Same accrual and partial-payment path as mobile Collect fines</p>
        </div>
        <form className="toolbar" onSubmit={onLookup}>
          <input
            type="search"
            placeholder="Patron email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            data-search="1"
            required
          />
          <button type="submit" className="btn btn-primary" disabled={lookupBusy}>
            {lookupBusy ? "Looking up..." : "Lookup"}
          </button>
        </form>

        {lookup ? (
          <div className="drawer-facts" style={{ marginTop: "0.85rem" }}>
            <p>
              <strong>Patron</strong> {lookup.user.displayName || lookup.user.email} ({lookup.user.role})
            </p>
            <p>
              <strong>Outstanding</strong> Rs {lookup.outstanding}
            </p>
            {lookup.items.length > 0 ? (
              <div className="table-wrap sticky-head">
                <table>
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>Assessed</th>
                      <th>Paid</th>
                      <th>Remaining</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lookup.items.map((item) => (
                      <tr key={item.loanId}>
                        <td>{item.title}</td>
                        <td>Rs {item.fineAmount}</td>
                        <td>Rs {item.finePaidAmount}</td>
                        <td>
                          <span className="status-pill danger">Rs {item.remaining}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            onClick={() =>
                              setPending({
                                loanId: item.loanId,
                                title: item.title,
                                amount: item.remaining,
                              })
                            }
                          >
                            Mark remaining paid
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {lookup.outstanding > 0 ? (
              <form className="toolbar" onSubmit={onCollect}>
                <label>
                  Collect amount (Rs)
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    required
                  />
                </label>
                <button type="submit" className="btn btn-primary" disabled={collectBusy}>
                  {collectBusy ? "Recording..." : "Record partial / full payment"}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>

      <FilterChips
        chips={[
          { id: "loans", label: `Loans (${loansTotal})` },
          { id: "users", label: `Users (${usersTotal})` },
        ]}
        value={view}
        onChange={(id) => {
          setView(id);
          setPage(1);
        }}
        ariaLabel="Fines views"
      />

      {truncated ? (
        <p className="muted small">Showing up to the first 500 unpaid rows after accrual.</p>
      ) : null}

      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? (
        <div className="skeleton-stack">
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
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            disabled={loading}
            onPageChange={(next) => void load(view, next)}
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
                  <th>Remaining (Rs)</th>
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
                  loans.map((loan) => {
                    const remaining = Number(
                      loan.remaining ??
                        Math.max(
                          Number(loan.fineAmount || 0) - Number(loan.finePaidAmount || 0),
                          0
                        )
                    );
                    return (
                      <tr key={loan.id}>
                        <td>
                          <div>{loan.title || "-"}</div>
                          <div className="muted small">{loan.isbn || loan.copyId}</div>
                          {Number(loan.finePaidAmount || 0) > 0 ? (
                            <div className="muted small">
                              Assessed Rs {loan.fineAmount} · paid Rs {loan.finePaidAmount}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <CopyId value={String(loan.userId || "")} label="User ID" />
                        </td>
                        <td>
                          <CopyId value={loan.id} label="Loan ID" />
                        </td>
                        <td>
                          <span className="status-pill danger">Rs {remaining}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            onClick={() =>
                              setPending({
                                loanId: loan.id,
                                title: loan.title || loan.id,
                                amount: remaining,
                              })
                            }
                          >
                            Mark paid
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            disabled={loading}
            onPageChange={(next) => void load(view, next)}
          />
        </>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Mark remaining fine paid?"
        message={
          pending
            ? `Clear the remaining Rs ${pending.amount} on "${pending.title}". This only subtracts what is still unpaid (safe after partial desk payments).`
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

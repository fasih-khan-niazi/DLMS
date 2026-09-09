import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../config/api";
import { ConfirmDialog, PageHeader, useToast } from "../components/ui";
import { extractApiError } from "../utils/apiError";

type AdminUser = {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
  isActive?: boolean;
  hasUnpaidFines?: boolean;
  activeBorrowCount?: number;
  totalOutstandingFines?: number;
};

type PendingAction =
  | {
      kind: "role";
      uid: string;
      name: string;
      role: string;
      previous: string;
    }
  | {
      kind: "status";
      uid: string;
      name: string;
      activate: boolean;
    }
  | {
      kind: "unlock";
      email: string;
      name: string;
    };

const CACHE_KEY = "dlms.admin.users";

export function UsersPage() {
  const { showToast } = useToast();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as AdminUser[]) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(users.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});

  const load = useCallback(async (search: string, opts?: { background?: boolean }) => {
    if (opts?.background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ users: AdminUser[] }>("/api/admin/users", {
        params: search ? { q: search } : undefined,
      });
      setUsers(data.users);
      const drafts: Record<string, string> = {};
      data.users.forEach((u) => {
        drafts[u.id] = u.role || "student";
      });
      setRoleDraft(drafts);
      if (!search) {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data.users));
      }
    } catch (err) {
      const msg = extractApiError(err, "Failed to load users");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load("", { background: users.length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q.trim());
  }

  function requestRoleChange(user: AdminUser, role: string) {
    const previous = user.role || "student";
    setRoleDraft((d) => ({ ...d, [user.id]: role }));
    if (role === previous) return;
    setPending({
      kind: "role",
      uid: user.id,
      name: user.displayName || user.email || user.id,
      role,
      previous,
    });
  }

  async function runPending() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "role") {
        await api.post(`/api/admin/users/${pending.uid}/role`, { role: pending.role });
        showToast(`Role updated to ${pending.role}`, "success");
      } else if (pending.kind === "status") {
        await api.post(`/api/admin/users/${pending.uid}/status`, {
          isActive: pending.activate,
        });
        showToast(pending.activate ? "User activated" : "User suspended", "success");
      } else {
        await api.post("/api/admin/login-locks/unlock", { email: pending.email });
        showToast(`Login lock cleared for ${pending.email}`, "success");
      }
      setPending(null);
      await load(q.trim(), { background: true });
    } catch (err) {
      const msg = extractApiError(err, "Action failed");
      setError(msg);
      showToast(msg, "error");
      if (pending.kind === "role") {
        setRoleDraft((d) => ({ ...d, [pending.uid]: pending.previous }));
      }
      await load(q.trim(), { background: true });
    } finally {
      setBusy(false);
    }
  }

  function cancelPending() {
    if (pending?.kind === "role") {
      setRoleDraft((d) => ({ ...d, [pending.uid]: pending.previous }));
    }
    setPending(null);
  }

  const dialogCopy = (() => {
    if (!pending) return { title: "", message: "", confirm: "Confirm", variant: "info" as const };
    if (pending.kind === "role") {
      return {
        title: `Change role to ${pending.role}?`,
        message: `${pending.name} will become a ${pending.role}. Admin accounts stay seed-only and cannot be assigned here.`,
        confirm: "Change role",
        variant: "info" as const,
      };
    }
    if (pending.kind === "status") {
      return {
        title: pending.activate ? "Activate this account?" : "Suspend this account?",
        message: pending.activate
          ? `${pending.name} will be able to sign in again.`
          : `${pending.name} will be blocked from the app and API until reactivated.`,
        confirm: pending.activate ? "Activate" : "Suspend",
        variant: pending.activate ? ("info" as const) : ("danger" as const),
      };
    }
    return {
      title: "Clear login lock?",
      message: `Remove any temporary lock on ${pending.email} so they can try signing in again.`,
      confirm: "Unlock",
      variant: "info" as const,
    };
  })();

  return (
    <div className="page">
      <PageHeader
        title="Users"
        subtitle="Promote students to librarian, suspend accounts, or clear login locks. Admin is seed-only."
        actions={refreshing ? <span className="pill">Refreshing...</span> : null}
      />

      <form className="toolbar" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="Search email or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? (
        <div className="skeleton-stack">
          <div className="skeleton-block tall" />
          <div className="skeleton-block tall" />
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Fines</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No users match this search.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName || "-"}</td>
                    <td>{user.email || "-"}</td>
                    <td>
                      {user.role === "admin" ? (
                        <span className="status-pill ok">admin</span>
                      ) : (
                        <select
                          value={roleDraft[user.id] || user.role || "student"}
                          onChange={(e) => requestRoleChange(user, e.target.value)}
                        >
                          <option value="student">student</option>
                          <option value="librarian">librarian</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          user.isActive === false ? "status-pill danger" : "status-pill ok"
                        }
                      >
                        {user.isActive === false ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td>
                      {user.hasUnpaidFines ? (
                        <span className="status-pill danger">
                          Rs {user.totalOutstandingFines ?? 0}
                        </span>
                      ) : (
                        <span className="muted">None</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className={
                            user.isActive === false
                              ? "btn btn-small btn-soft"
                              : "btn btn-small btn-danger-soft"
                          }
                          disabled={user.role === "admin"}
                          onClick={() =>
                            setPending({
                              kind: "status",
                              uid: user.id,
                              name: user.displayName || user.email || user.id,
                              activate: user.isActive === false,
                            })
                          }
                        >
                          {user.role === "admin"
                            ? "Protected"
                            : user.isActive === false
                              ? "Activate"
                              : "Suspend"}
                        </button>
                        {user.email && user.role !== "admin" ? (
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() =>
                              setPending({
                                kind: "unlock",
                                email: user.email!,
                                name: user.displayName || user.email!,
                              })
                            }
                          >
                            Unlock login
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={dialogCopy.title}
        message={dialogCopy.message}
        confirmLabel={dialogCopy.confirm}
        variant={dialogCopy.variant}
        busy={busy}
        onConfirm={() => void runPending()}
        onCancel={cancelPending}
      />
    </div>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../config/api";

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

const CACHE_KEY = "dlms.admin.users";

export function UsersPage() {
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
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (search: string, opts?: { background?: boolean }) => {
    if (opts?.background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ users: AdminUser[] }>("/api/admin/users", {
        params: search ? { q: search } : undefined,
      });
      setUsers(data.users);
      if (!search) {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data.users));
      }
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("", { background: users.length > 0 });
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q.trim());
  }

  async function changeRole(uid: string, role: string, previous: string) {
    if (role === previous) return;
    if (!window.confirm(`Change this user's role to ${role}?`)) {
      await load(q.trim(), { background: true });
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await api.post(`/api/admin/users/${uid}/role`, { role });
      setMessage(`Role updated to ${role}`);
      await load(q.trim(), { background: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setError(msg || "Failed to change role");
      await load(q.trim(), { background: true });
    }
  }

  async function toggleStatus(uid: string, isActive: boolean) {
    const action = isActive ? "activate" : "suspend";
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
    setMessage(null);
    setError(null);
    try {
      await api.post(`/api/admin/users/${uid}/status`, { isActive });
      setMessage(isActive ? "User activated" : "User suspended");
      await load(q.trim(), { background: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setError(msg || "Failed to update status");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Users</h1>
          <p className="muted">Promote students to librarian, or suspend accounts. Admin is seed-only.</p>
        </div>
        {refreshing ? <span className="pill">Refreshing...</span> : null}
      </header>

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

      {message ? <p className="success-banner">{message}</p> : null}
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
                          value={user.role || "student"}
                          onChange={(e) =>
                            void changeRole(user.id, e.target.value, user.role || "student")
                          }
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
                      {user.hasUnpaidFines
                        ? `Rs ${user.totalOutstandingFines ?? 0}`
                        : "None"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={user.role === "admin"}
                        onClick={() =>
                          void toggleStatus(user.id, user.isActive === false)
                        }
                      >
                        {user.role === "admin"
                          ? "Protected"
                          : user.isActive === false
                            ? "Activate"
                            : "Suspend"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

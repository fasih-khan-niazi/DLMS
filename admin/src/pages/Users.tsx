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

export function UsersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ users: AdminUser[] }>("/api/admin/users", {
        params: search ? { q: search } : undefined,
      });
      setUsers(data.users);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q.trim());
  }

  async function changeRole(uid: string, role: string) {
    setMessage(null);
    setError(null);
    try {
      await api.post(`/api/admin/users/${uid}/role`, { role });
      setMessage(`Role updated to ${role}`);
      await load(q.trim());
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setError(msg || "Failed to change role");
    }
  }

  async function toggleStatus(uid: string, isActive: boolean) {
    setMessage(null);
    setError(null);
    try {
      await api.post(`/api/admin/users/${uid}/status`, { isActive });
      setMessage(isActive ? "User activated" : "User suspended");
      await load(q.trim());
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
        <h1>Users</h1>
        <p className="muted">Search, change roles, suspend accounts</p>
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
      {loading ? <p>Loading...</p> : null}

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
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.displayName || "-"}</td>
                <td>{user.email || "-"}</td>
                <td>
                  <select
                    value={user.role || "student"}
                    onChange={(e) => void changeRole(user.id, e.target.value)}
                  >
                    <option value="student">student</option>
                    <option value="librarian">librarian</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>{user.isActive === false ? "Suspended" : "Active"}</td>
                <td>
                  {user.hasUnpaidFines
                    ? `Rs ${user.totalOutstandingFines ?? 0}`
                    : "None"}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() =>
                      void toggleStatus(user.id, user.isActive === false)
                    }
                  >
                    {user.isActive === false ? "Activate" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

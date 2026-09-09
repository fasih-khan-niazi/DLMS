import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../config/api";
import {
  Avatar,
  ConfirmDialog,
  CopyId,
  Drawer,
  FilterChips,
  PageHeader,
  Pagination,
  useToast,
} from "../components/ui";
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
  | { kind: "role"; uid: string; name: string; role: string; previous: string }
  | { kind: "status"; uid: string; name: string; activate: boolean }
  | { kind: "unlock"; email: string; name: string }
  | { kind: "bulk-status"; activate: boolean; ids: string[] };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "student", label: "Students" },
  { id: "librarian", label: "Librarians" },
  { id: "suspended", label: "Suspended" },
  { id: "fines", label: "Unpaid fines" },
];

export function UsersPage() {
  const { showToast } = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null);

  const load = useCallback(
    async (search: string, nextPage: number, opts?: { background?: boolean }) => {
      if (opts?.background) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<{
          users: AdminUser[];
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        }>("/api/admin/users", {
          params: {
            page: nextPage,
            pageSize: 20,
            ...(search ? { q: search } : {}),
          },
        });
        setUsers(data.users);
        setPage(data.page || nextPage);
        setTotal(data.total || data.users.length);
        setTotalPages(data.totalPages || 1);
        const drafts: Record<string, string> = {};
        data.users.forEach((u) => {
          drafts[u.id] = u.role || "student";
        });
        setRoleDraft(drafts);
        setSelected(new Set());
      } catch (err) {
        const msg = extractApiError(err, "Failed to load users");
        setError(msg);
        showToast(msg, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void load("", 1);
  }, [load]);

  const visibleUsers = useMemo(() => {
    return users.filter((user) => {
      switch (filter) {
        case "student":
          return user.role === "student";
        case "librarian":
          return user.role === "librarian";
        case "suspended":
          return user.isActive === false;
        case "fines":
          return !!user.hasUnpaidFines;
        default:
          return true;
      }
    });
  }, [users, filter]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q.trim(), 1);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === visibleUsers.filter((u) => u.role !== "admin").length) {
      setSelected(new Set());
      return;
    }
    setSelected(
      new Set(visibleUsers.filter((u) => u.role !== "admin").map((u) => u.id))
    );
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
      } else if (pending.kind === "unlock") {
        await api.post("/api/admin/login-locks/unlock", { email: pending.email });
        showToast(`Login lock cleared for ${pending.email}`, "success");
      } else {
        await Promise.all(
          pending.ids.map((id) =>
            api.post(`/api/admin/users/${id}/status`, { isActive: pending.activate })
          )
        );
        showToast(
          pending.activate
            ? `Activated ${pending.ids.length} accounts`
            : `Suspended ${pending.ids.length} accounts`,
          "success"
        );
      }
      setPending(null);
      setDrawerUser(null);
      await load(q.trim(), page, { background: true });
    } catch (err) {
      const msg = extractApiError(err, "Action failed");
      setError(msg);
      showToast(msg, "error");
      if (pending.kind === "role") {
        setRoleDraft((d) => ({ ...d, [pending.uid]: pending.previous }));
      }
      await load(q.trim(), page, { background: true });
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
        message: `${pending.name} will become a ${pending.role}.`,
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
    if (pending.kind === "bulk-status") {
      return {
        title: pending.activate ? "Activate selected accounts?" : "Suspend selected accounts?",
        message: `${pending.ids.length} accounts will be updated.`,
        confirm: pending.activate ? "Activate all" : "Suspend all",
        variant: pending.activate ? ("info" as const) : ("danger" as const),
      };
    }
    return {
      title: "Clear login lock?",
      message: `Remove any temporary lock on ${pending.email}.`,
      confirm: "Unlock",
      variant: "info" as const,
    };
  })();

  return (
    <div className="page">
      <PageHeader
        subtitle="Promote students to librarian, suspend accounts, or clear login locks. Admin is seed-only."
        actions={refreshing ? <span className="pill">Refreshing...</span> : null}
      />

      <form className="toolbar" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="Search email or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-search="1"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <FilterChips chips={FILTERS} value={filter} onChange={setFilter} ariaLabel="User filters" />

      {selected.size > 0 ? (
        <div className="bulk-bar">
          <span className="muted small">{selected.size} selected</span>
          <button
            type="button"
            className="btn btn-small btn-danger-soft"
            onClick={() =>
              setPending({
                kind: "bulk-status",
                activate: false,
                ids: Array.from(selected),
              })
            }
          >
            Suspend selected
          </button>
          <button
            type="button"
            className="btn btn-small btn-soft"
            onClick={() =>
              setPending({
                kind: "bulk-status",
                activate: true,
                ids: Array.from(selected),
              })
            }
          >
            Activate selected
          </button>
        </div>
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
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={
                        visibleUsers.filter((u) => u.role !== "admin").length > 0 &&
                        selected.size ===
                          visibleUsers.filter((u) => u.role !== "admin").length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Fines</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      No users match this view.
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${user.email || user.id}`}
                          disabled={user.role === "admin"}
                          checked={selected.has(user.id)}
                          onChange={() => toggleSelect(user.id)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="identity-btn"
                          onClick={() => setDrawerUser(user)}
                        >
                          <Avatar name={user.displayName} email={user.email} />
                          <span>
                            <span className="identity-name">
                              {user.displayName || "Unnamed"}
                            </span>
                            <span className="muted small identity-email">
                              {user.email || "-"}
                            </span>
                          </span>
                        </button>
                      </td>
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
                            className="btn btn-small"
                            onClick={() => setDrawerUser(user)}
                          >
                            Details
                          </button>
                        </div>
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
            disabled={loading || refreshing}
            onPageChange={(next) => void load(q.trim(), next, { background: true })}
          />
        </>
      )}

      <Drawer
        open={!!drawerUser}
        title={drawerUser?.displayName || drawerUser?.email || "User"}
        subtitle={drawerUser?.email}
        onClose={() => setDrawerUser(null)}
        footer={
          drawerUser && drawerUser.role !== "admin" ? (
            <div className="row-actions">
              <button
                type="button"
                className={
                  drawerUser.isActive === false
                    ? "btn btn-soft"
                    : "btn btn-danger-soft"
                }
                onClick={() =>
                  setPending({
                    kind: "status",
                    uid: drawerUser.id,
                    name: drawerUser.displayName || drawerUser.email || drawerUser.id,
                    activate: drawerUser.isActive === false,
                  })
                }
              >
                {drawerUser.isActive === false ? "Activate" : "Suspend"}
              </button>
              {drawerUser.email ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setPending({
                      kind: "unlock",
                      email: drawerUser.email!,
                      name: drawerUser.displayName || drawerUser.email!,
                    })
                  }
                >
                  Unlock login
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {drawerUser ? (
          <div className="drawer-facts">
            <p>
              <strong>Role</strong> {drawerUser.role || "student"}
            </p>
            <p>
              <strong>Status</strong>{" "}
              {drawerUser.isActive === false ? "Suspended" : "Active"}
            </p>
            <p>
              <strong>Active loans</strong> {drawerUser.activeBorrowCount ?? 0}
            </p>
            <p>
              <strong>Outstanding fines</strong> Rs{" "}
              {drawerUser.totalOutstandingFines ?? 0}
            </p>
            <p>
              <strong>User ID</strong> <CopyId value={drawerUser.id} label="User ID" />
            </p>
          </div>
        ) : null}
      </Drawer>

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

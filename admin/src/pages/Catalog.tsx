import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../config/api";
import { ConfirmDialog, PageHeader, useToast } from "../components/ui";
import { extractApiError } from "../utils/apiError";

type CatalogBook = {
  isbn?: string;
  title?: string;
  authors?: string[];
  availableCount?: number;
  totalCopies?: number;
  isActive?: boolean;
  availability?: string;
};

type PendingToggle = {
  isbn: string;
  title: string;
  nextActive: boolean;
};

export function CatalogPage() {
  const { showToast } = useToast();
  const [q, setQ] = useState("");
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingToggle | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (search: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<{ results: CatalogBook[] }>("/api/catalog/books", {
          params: {
            includeInactive: "1",
            ...(search ? { q: search } : { limit: 100 }),
          },
        });
        setBooks(data.results || []);
      } catch (err) {
        const msg = extractApiError(err, "Failed to load catalog");
        setError(msg);
        showToast(msg, "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void load("");
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q.trim());
  }

  async function confirmToggle() {
    if (!pending) return;
    setBusy(true);
    try {
      await api.patch(`/api/catalog/books/${encodeURIComponent(pending.isbn)}/status`, {
        isActive: pending.nextActive,
      });
      showToast(
        pending.nextActive ? "Title reactivated in the catalog" : "Title deactivated",
        "success"
      );
      setPending(null);
      await load(q.trim());
    } catch (err) {
      const msg = extractApiError(
        err,
        pending.nextActive ? "Failed to reactivate book" : "Failed to deactivate book"
      );
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Catalog"
        subtitle="Soft-deactivate duplicates or retired titles. Loan and reservation history stays."
      />

      <form className="toolbar" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="Search title, author, or ISBN"
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
                <th>Title</th>
                <th>ISBN</th>
                <th>Copies</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No books match this search.
                  </td>
                </tr>
              ) : (
                books.map((book) => {
                  const isbn = String(book.isbn || "");
                  const active = book.isActive !== false;
                  const issued = Math.max(
                    0,
                    (book.totalCopies ?? 0) - (book.availableCount ?? 0)
                  );
                  return (
                    <tr key={isbn}>
                      <td>
                        <div>{book.title || "-"}</div>
                        <div className="muted small">
                          {(book.authors || []).join(", ") || "Unknown author"}
                        </div>
                      </td>
                      <td className="mono">{isbn}</td>
                      <td>
                        <div>
                          {book.availableCount ?? 0} / {book.totalCopies ?? 0} available
                        </div>
                        {issued > 0 ? (
                          <div className="muted small">{issued} on loan</div>
                        ) : null}
                      </td>
                      <td>
                        <span className={active ? "status-pill ok" : "status-pill danger"}>
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={
                            active ? "btn btn-small btn-danger-soft" : "btn btn-small btn-soft"
                          }
                          onClick={() =>
                            setPending({
                              isbn,
                              title: book.title || isbn,
                              nextActive: !active,
                            })
                          }
                        >
                          {active ? "Deactivate" : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={pending?.nextActive ? "Reactivate this title?" : "Deactivate this title?"}
        message={
          pending?.nextActive
            ? `"${pending.title}" will appear in the student catalog again.`
            : `"${pending?.title}" will be hidden from students. History stays. Titles with copies on loan cannot be deactivated.`
        }
        confirmLabel={pending?.nextActive ? "Reactivate" : "Deactivate"}
        variant={pending?.nextActive ? "info" : "danger"}
        busy={busy}
        onConfirm={() => void confirmToggle()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../config/api";

type CatalogBook = {
  isbn?: string;
  title?: string;
  authors?: string[];
  availableCount?: number;
  totalCopies?: number;
  isActive?: boolean;
  availability?: string;
};

export function CatalogPage() {
  const [q, setQ] = useState("");
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
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
    } catch {
      setError("Failed to load catalog");
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

  async function toggleActive(isbn: string, nextActive: boolean) {
    const action = nextActive ? "reactivate" : "deactivate";
    if (
      !window.confirm(
        nextActive
          ? "Reactivate this title in the student catalog?"
          : "Deactivate this title? Students will not see it. Loan and reservation history stays."
      )
    ) {
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await api.patch(`/api/catalog/books/${encodeURIComponent(isbn)}/status`, {
        isActive: nextActive,
      });
      setMessage(nextActive ? "Book reactivated" : "Book deactivated");
      await load(q.trim());
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(msg || `Failed to ${action} book`);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Catalog</h1>
          <p className="muted">
            Soft-deactivate duplicates or retired titles. History is kept.
          </p>
        </div>
      </header>

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
                        {book.availableCount ?? 0} / {book.totalCopies ?? 0} available
                      </td>
                      <td>
                        <span className={active ? "status-pill ok" : "status-pill danger"}>
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => void toggleActive(isbn, !active)}
                        >
                          {active ? "Deactivate" : "Activate"}
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
    </div>
  );
}

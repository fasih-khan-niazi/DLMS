import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../config/api";
import {
  ConfirmDialog,
  FilterChips,
  PageHeader,
  Pagination,
  useToast,
} from "../components/ui";
import { extractApiError } from "../utils/apiError";

type CatalogBook = {
  isbn?: string;
  title?: string;
  authors?: string[];
  availableCount?: number;
  totalCopies?: number;
  isActive?: boolean;
};

type DigitalBook = {
  digitalBookId?: string;
  title?: string;
  author?: string;
  isPublished?: boolean;
};

type Kind = "physical" | "digital";
type Pending =
  | { kind: "physical"; isbn: string; title: string; nextActive: boolean }
  | { kind: "digital"; id: string; title: string; nextPublished: boolean }
  | { kind: "bulk-physical"; nextActive: boolean; isbns: string[] };

export function CatalogPage() {
  const { showToast } = useToast();
  const [kind, setKind] = useState<Kind>("physical");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [digital, setDigital] = useState<DigitalBook[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadPhysical = useCallback(
    async (search: string, nextPage: number, status: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<{
          results: CatalogBook[];
          page: number;
          total: number;
          totalPages: number;
        }>("/api/catalog/books", {
          params: {
            catalogStatus:
              status === "inactive" ? "inactive" : status === "active" ? "active" : "all",
            page: nextPage,
            pageSize: 20,
            ...(search ? { q: search } : {}),
          },
        });
        setBooks(data.results || []);
        setPage(data.page || nextPage);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        setSelected(new Set());
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

  const loadDigital = useCallback(
    async (search: string, nextPage: number, status: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<{
          results: DigitalBook[];
          page: number;
          total: number;
          totalPages: number;
        }>("/api/digital-books", {
          params: {
            includeUnpublished: "1",
            publishStatus:
              status === "inactive"
                ? "unpublished"
                : status === "active"
                  ? "published"
                  : "all",
            page: nextPage,
            pageSize: 20,
            ...(search ? { q: search } : {}),
          },
        });
        setDigital(data.results || []);
        setPage(data.page || nextPage);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        setSelected(new Set());
      } catch (err) {
        const msg = extractApiError(err, "Failed to load digital books");
        setError(msg);
        showToast(msg, "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  const reload = useCallback(
    (search: string, nextPage: number, status = statusFilter) => {
      if (kind === "physical") return loadPhysical(search, nextPage, status);
      return loadDigital(search, nextPage, status);
    },
    [kind, loadDigital, loadPhysical, statusFilter]
  );

  useEffect(() => {
    void reload(q.trim(), 1);
    // Reload when kind or status filter changes (search stays).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, statusFilter]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void reload(q.trim(), 1);
  }

  function switchKind(next: Kind) {
    setKind(next);
    setQ("");
    setStatusFilter("all");
    setPage(1);
  }

  function onStatusFilter(next: string) {
    setStatusFilter(next);
    setPage(1);
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "physical") {
        await api.patch(`/api/catalog/books/${encodeURIComponent(pending.isbn)}/status`, {
          isActive: pending.nextActive,
        });
        showToast(
          pending.nextActive ? "Title reactivated" : "Title deactivated",
          "success"
        );
      } else if (pending.kind === "digital") {
        await api.patch(`/api/digital-books/${pending.id}/status`, {
          isPublished: pending.nextPublished,
        });
        showToast(
          pending.nextPublished ? "E-book published" : "E-book unpublished",
          "success"
        );
      } else {
        await Promise.all(
          pending.isbns.map((isbn) =>
            api.patch(`/api/catalog/books/${encodeURIComponent(isbn)}/status`, {
              isActive: pending.nextActive,
            })
          )
        );
        showToast(
          pending.nextActive
            ? `Reactivated ${pending.isbns.length} titles`
            : `Deactivated ${pending.isbns.length} titles`,
          "success"
        );
      }
      setPending(null);
      await reload(q.trim(), page);
    } catch (err) {
      const msg = extractApiError(err, "Could not update catalog item");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader subtitle="Manage physical titles and digital PDFs. Soft-hide keeps history." />

      <div className="config-tabs" role="tablist" aria-label="Catalog type">
        <button
          type="button"
          role="tab"
          className={kind === "physical" ? "config-tab active" : "config-tab"}
          aria-selected={kind === "physical"}
          onClick={() => switchKind("physical")}
        >
          Physical
        </button>
        <button
          type="button"
          role="tab"
          className={kind === "digital" ? "config-tab active" : "config-tab"}
          aria-selected={kind === "digital"}
          onClick={() => switchKind("digital")}
        >
          Digital
        </button>
      </div>

      <form className="toolbar" onSubmit={onSearch}>
        <input
          type="search"
          placeholder={
            kind === "physical"
              ? "Search title, author, or ISBN"
              : "Search digital title or author"
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-search="1"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <FilterChips
        chips={[
          { id: "all", label: "All" },
          { id: "active", label: kind === "physical" ? "Active" : "Published" },
          { id: "inactive", label: kind === "physical" ? "Inactive" : "Unpublished" },
        ]}
        value={statusFilter}
        onChange={onStatusFilter}
        ariaLabel="Status filter"
      />

      {kind === "physical" && selected.size > 0 ? (
        <div className="bulk-bar">
          <span className="muted small">{selected.size} selected</span>
          <button
            type="button"
            className="btn btn-small btn-danger-soft"
            onClick={() =>
              setPending({
                kind: "bulk-physical",
                nextActive: false,
                isbns: Array.from(selected),
              })
            }
          >
            Deactivate selected
          </button>
          <button
            type="button"
            className="btn btn-small btn-soft"
            onClick={() =>
              setPending({
                kind: "bulk-physical",
                nextActive: true,
                isbns: Array.from(selected),
              })
            }
          >
            Reactivate selected
          </button>
        </div>
      ) : null}

      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? (
        <div className="skeleton-stack">
          <div className="skeleton-block tall" />
        </div>
      ) : kind === "physical" ? (
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
                        books.length > 0 && selected.size === books.length
                      }
                      onChange={() => {
                        if (selected.size === books.length) {
                          setSelected(new Set());
                        } else {
                          setSelected(
                            new Set(books.map((b) => String(b.isbn || "")))
                          );
                        }
                      }}
                    />
                  </th>
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
                    <td colSpan={6} className="empty-cell">
                      No physical titles match this view.
                    </td>
                  </tr>
                ) : (
                  books.map((book) => {
                    const isbn = String(book.isbn || "");
                    const active = book.isActive !== false;
                    return (
                      <tr key={isbn}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(isbn)}
                            onChange={() => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(isbn)) next.delete(isbn);
                                else next.add(isbn);
                                return next;
                              });
                            }}
                          />
                        </td>
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
                            className={
                              active ? "btn btn-small btn-danger-soft" : "btn btn-small btn-soft"
                            }
                            onClick={() =>
                              setPending({
                                kind: "physical",
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
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            disabled={loading}
            onPageChange={(next) => void reload(q.trim(), next)}
          />
        </>
      ) : (
        <>
          <div className="table-wrap sticky-head">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {digital.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      No digital books match this view.
                    </td>
                  </tr>
                ) : (
                  digital.map((book) => {
                    const id = String(book.digitalBookId || "");
                    const published = book.isPublished !== false;
                    return (
                      <tr key={id}>
                        <td>{book.title || "-"}</td>
                        <td>{book.author || "-"}</td>
                        <td>
                          <span
                            className={published ? "status-pill ok" : "status-pill danger"}
                          >
                            {published ? "Published" : "Unpublished"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={
                              published
                                ? "btn btn-small btn-danger-soft"
                                : "btn btn-small btn-soft"
                            }
                            onClick={() =>
                              setPending({
                                kind: "digital",
                                id,
                                title: book.title || id,
                                nextPublished: !published,
                              })
                            }
                          >
                            {published ? "Unpublish" : "Publish"}
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
            onPageChange={(next) => void reload(q.trim(), next)}
          />
        </>
      )}

      <ConfirmDialog
        open={!!pending}
        title={
          pending?.kind === "digital"
            ? pending.nextPublished
              ? "Publish this e-book?"
              : "Unpublish this e-book?"
            : pending?.kind === "bulk-physical"
              ? pending.nextActive
                ? "Reactivate selected titles?"
                : "Deactivate selected titles?"
              : pending?.nextActive
                ? "Reactivate this title?"
                : "Deactivate this title?"
        }
        message={
          pending?.kind === "digital"
            ? pending.nextPublished
              ? `"${pending.title}" will be visible in the digital library again.`
              : `"${pending.title}" will be hidden from students. The PDF file is kept.`
            : pending?.kind === "bulk-physical"
              ? `${pending.isbns.length} physical titles will be updated.`
              : pending?.nextActive
                ? `"${pending?.title}" will appear in the student catalog again.`
                : `"${pending?.title}" will be hidden from students. History stays.`
        }
        confirmLabel="Confirm"
        variant={
          pending &&
          (("nextActive" in pending && !pending.nextActive) ||
            ("nextPublished" in pending && !pending.nextPublished))
            ? "danger"
            : "info"
        }
        busy={busy}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

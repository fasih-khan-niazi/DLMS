import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../config/api";
import {
  ConfirmDialog,
  Drawer,
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
  description?: string;
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

  const [showAddPhysical, setShowAddPhysical] = useState(false);
  const [showUploadDigital, setShowUploadDigital] = useState(false);
  const [editBook, setEditBook] = useState<CatalogBook | null>(null);
  const [copiesBook, setCopiesBook] = useState<CatalogBook | null>(null);

  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [description, setDescription] = useState("");
  const [initialCopies, setInitialCopies] = useState("1");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const [copyQty, setCopyQty] = useState("1");
  const [copyBusy, setCopyBusy] = useState(false);

  const [digitalTitle, setDigitalTitle] = useState("");
  const [digitalAuthor, setDigitalAuthor] = useState("");
  const [digitalFile, setDigitalFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editAuthors, setEditAuthors] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBusy, setEditBusy] = useState(false);

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
    setShowAddPhysical(false);
    setShowUploadDigital(false);
  }

  function onStatusFilter(next: string) {
    setStatusFilter(next);
    setPage(1);
  }

  async function lookupIsbn() {
    const cleaned = isbn.trim();
    if (!cleaned) return;
    setLookupBusy(true);
    try {
      const { data } = await api.get<{
        title?: string;
        authors?: string[];
        description?: string;
      }>(`/api/catalog/lookup/${encodeURIComponent(cleaned)}`);
      setTitle(data.title || "");
      setAuthors((data.authors || []).join(", "));
      setDescription(data.description || "");
      showToast("Metadata loaded from Google Books", "success");
    } catch (err) {
      showToast(
        extractApiError(err, "No metadata found. Enter title manually."),
        "info"
      );
    } finally {
      setLookupBusy(false);
    }
  }

  async function savePhysical(e: FormEvent) {
    e.preventDefault();
    setSaveBusy(true);
    try {
      const authorList = authors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      await api.post("/api/catalog/books", {
        isbn: isbn.trim(),
        title: title.trim(),
        authors: authorList,
        description: description.trim(),
        useGoogleBooks: true,
      });
      const qty = Math.max(1, Math.min(50, Math.floor(Number(initialCopies) || 1)));
      await api.post("/api/catalog/copies", {
        isbn: isbn.trim(),
        quantity: qty,
      });
      showToast(`Saved title with ${qty} copie${qty === 1 ? "" : "s"}`, "success");
      setIsbn("");
      setTitle("");
      setAuthors("");
      setDescription("");
      setInitialCopies("1");
      setShowAddPhysical(false);
      await reload(q.trim(), 1);
    } catch (err) {
      showToast(extractApiError(err, "Failed to save book"), "error");
    } finally {
      setSaveBusy(false);
    }
  }

  async function addCopies(e: FormEvent) {
    e.preventDefault();
    if (!copiesBook?.isbn) return;
    setCopyBusy(true);
    try {
      const qty = Math.max(1, Math.min(50, Math.floor(Number(copyQty) || 1)));
      await api.post("/api/catalog/copies", {
        isbn: copiesBook.isbn,
        quantity: qty,
      });
      showToast(`Added ${qty} copie${qty === 1 ? "" : "s"}`, "success");
      setCopiesBook(null);
      setCopyQty("1");
      await reload(q.trim(), page);
    } catch (err) {
      showToast(extractApiError(err, "Failed to add copies"), "error");
    } finally {
      setCopyBusy(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editBook?.isbn) return;
    setEditBusy(true);
    try {
      await api.patch(`/api/catalog/books/${encodeURIComponent(editBook.isbn)}`, {
        title: editTitle.trim(),
        authors: editAuthors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        description: editDescription.trim(),
      });
      showToast("Title updated", "success");
      setEditBook(null);
      await reload(q.trim(), page);
    } catch (err) {
      showToast(extractApiError(err, "Failed to update title"), "error");
    } finally {
      setEditBusy(false);
    }
  }

  async function uploadDigital(e: FormEvent) {
    e.preventDefault();
    if (!digitalFile) {
      showToast("Choose a PDF file", "error");
      return;
    }
    setUploadBusy(true);
    try {
      const body = new FormData();
      body.append("file", digitalFile);
      body.append("title", digitalTitle.trim());
      body.append("author", digitalAuthor.trim());
      await api.post("/api/digital-books", body);
      showToast("E-book uploaded and published", "success");
      setDigitalTitle("");
      setDigitalAuthor("");
      setDigitalFile(null);
      setShowUploadDigital(false);
      setKind("digital");
      await loadDigital("", 1, "all");
    } catch (err) {
      showToast(extractApiError(err, "Failed to upload PDF"), "error");
    } finally {
      setUploadBusy(false);
    }
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
        let ok = 0;
        let fail = 0;
        for (const isbnValue of pending.isbns) {
          try {
            await api.patch(`/api/catalog/books/${encodeURIComponent(isbnValue)}/status`, {
              isActive: pending.nextActive,
            });
            ok += 1;
          } catch {
            fail += 1;
          }
        }
        if (fail === 0) {
          showToast(
            pending.nextActive ? `Reactivated ${ok} titles` : `Deactivated ${ok} titles`,
            "success"
          );
        } else {
          showToast(
            `${ok} updated, ${fail} failed (often still on loan). Refresh and retry.`,
            "error"
          );
        }
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
      <PageHeader
        subtitle="Add physical titles and copies, upload PDFs, and soft-hide items. Soft-hide keeps history."
        actions={
          kind === "physical" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddPhysical((v) => !v)}
            >
              {showAddPhysical ? "Hide add form" : "Add physical book"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowUploadDigital((v) => !v)}
            >
              {showUploadDigital ? "Hide upload" : "Upload e-book PDF"}
            </button>
          )
        }
      />

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

      {kind === "physical" && showAddPhysical ? (
        <form className="config-section" onSubmit={savePhysical} style={{ marginBottom: "1rem" }}>
          <div className="config-section-head">
            <h2>Add physical title</h2>
            <p className="muted small">ISBN lookup fills Google Books metadata when available</p>
          </div>
          <div className="config-grid">
            <label>
              ISBN
              <div className="toolbar" style={{ margin: 0 }}>
                <input value={isbn} onChange={(e) => setIsbn(e.target.value)} required />
                <button
                  type="button"
                  className="btn btn-soft"
                  disabled={lookupBusy || !isbn.trim()}
                  onClick={() => void lookupIsbn()}
                >
                  {lookupBusy ? "Looking up..." : "Lookup"}
                </button>
              </div>
            </label>
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              Authors
              <input
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Comma-separated"
              />
            </label>
            <label>
              Initial copies
              <input
                type="number"
                min={1}
                max={50}
                value={initialCopies}
                onChange={(e) => setInitialCopies(e.target.value)}
              />
            </label>
            <label className="config-span">
              Description
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
          <div className="config-actions">
            <button type="submit" className="btn btn-primary" disabled={saveBusy}>
              {saveBusy ? "Saving..." : "Save title + copies"}
            </button>
          </div>
        </form>
      ) : null}

      {kind === "digital" && showUploadDigital ? (
        <form className="config-section" onSubmit={uploadDigital} style={{ marginBottom: "1rem" }}>
          <div className="config-section-head">
            <h2>Upload e-book</h2>
            <p className="muted small">PDF uploads publish immediately. Size limit comes from Config.</p>
          </div>
          <div className="config-grid">
            <label>
              Title
              <input
                value={digitalTitle}
                onChange={(e) => setDigitalTitle(e.target.value)}
                required
              />
            </label>
            <label>
              Author
              <input
                value={digitalAuthor}
                onChange={(e) => setDigitalAuthor(e.target.value)}
              />
            </label>
            <label className="config-span">
              PDF file
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setDigitalFile(e.target.files?.[0] || null)}
                required
              />
            </label>
          </div>
          <div className="config-actions">
            <button type="submit" className="btn btn-primary" disabled={uploadBusy}>
              {uploadBusy ? "Uploading..." : "Upload and publish"}
            </button>
          </div>
        </form>
      ) : null}

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
          {
            id: "inactive",
            label: kind === "physical" ? "Inactive" : "Unpublished",
          },
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
                      checked={books.length > 0 && selected.size === books.length}
                      onChange={() => {
                        if (selected.size === books.length) setSelected(new Set());
                        else setSelected(new Set(books.map((b) => String(b.isbn || ""))));
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
                    const bookIsbn = String(book.isbn || "");
                    const active = book.isActive !== false;
                    return (
                      <tr key={bookIsbn}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(bookIsbn)}
                            onChange={() => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(bookIsbn)) next.delete(bookIsbn);
                                else next.add(bookIsbn);
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
                        <td className="mono">{bookIsbn}</td>
                        <td>
                          {book.availableCount ?? 0} / {book.totalCopies ?? 0} available
                        </td>
                        <td>
                          <span className={active ? "status-pill ok" : "status-pill danger"}>
                            {active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn btn-small"
                              onClick={() => {
                                setEditBook(book);
                                setEditTitle(book.title || "");
                                setEditAuthors((book.authors || []).join(", "));
                                setEditDescription(book.description || "");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-small btn-soft"
                              onClick={() => {
                                setCopiesBook(book);
                                setCopyQty("1");
                              }}
                            >
                              Add copies
                            </button>
                            <button
                              type="button"
                              className={
                                active
                                  ? "btn btn-small btn-danger-soft"
                                  : "btn btn-small btn-soft"
                              }
                              onClick={() =>
                                setPending({
                                  kind: "physical",
                                  isbn: bookIsbn,
                                  title: book.title || bookIsbn,
                                  nextActive: !active,
                                })
                              }
                            >
                              {active ? "Deactivate" : "Reactivate"}
                            </button>
                          </div>
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

      <Drawer
        open={!!editBook}
        title="Edit title"
        subtitle={editBook?.isbn}
        onClose={() => setEditBook(null)}
        footer={
          <button
            type="submit"
            form="edit-book-form"
            className="btn btn-primary"
            disabled={editBusy}
          >
            {editBusy ? "Saving..." : "Save changes"}
          </button>
        }
      >
        <form id="edit-book-form" className="config-grid" onSubmit={saveEdit}>
          <label className="config-span">
            Title
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          </label>
          <label className="config-span">
            Authors
            <input value={editAuthors} onChange={(e) => setEditAuthors(e.target.value)} />
          </label>
          <label className="config-span">
            Description
            <textarea
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </label>
        </form>
      </Drawer>

      <Drawer
        open={!!copiesBook}
        title="Add copies"
        subtitle={copiesBook?.title}
        onClose={() => setCopiesBook(null)}
        footer={
          <button
            type="submit"
            form="add-copies-form"
            className="btn btn-primary"
            disabled={copyBusy}
          >
            {copyBusy ? "Adding..." : "Add copies"}
          </button>
        }
      >
        <form id="add-copies-form" onSubmit={addCopies}>
          <label>
            Quantity (1–50)
            <input
              type="number"
              min={1}
              max={50}
              value={copyQty}
              onChange={(e) => setCopyQty(e.target.value)}
              required
            />
          </label>
          <p className="muted small">
            Print QR labels from the mobile librarian flow after copies are created.
          </p>
        </form>
      </Drawer>

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
                : `"${pending?.title}" will be hidden from students. Waiting and ready reservations for this title are cancelled.`
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

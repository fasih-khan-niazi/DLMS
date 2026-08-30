import { Router, Response } from "express";
import { db } from "../config/firebase";
import { isSupabaseConfigured } from "../config/supabase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { uploadCover } from "../middleware/uploadCover";
import {
  buildSearchKeywords,
  fetchBookByIsbn,
  BookMetadata,
} from "../services/googleBooks";
import {
  coverObjectPathForIsbn,
  downloadBookCover,
  guessContentTypeFromPath,
  uploadBookCover,
} from "../services/bookCoverStorage";
import { cancelReservationsForDeactivatedTitle } from "../services/reservations";
import {
  getCatalogUserReview,
  listCatalogReviews,
  summarizeReviews,
  upsertCatalogReview,
} from "../services/catalogReviews";
import { clampCatalogPageSize, getSystemConfig } from "../services/loans";
import { createId } from "../utils/ids";
import {
  LIST_FETCH_CAP,
  paginateArray,
  parseListQuery,
  toMillis,
} from "../utils/pagination";
import { matchesTextQuery } from "../utils/textSearch";

const router = Router();

function sortCatalogResults(items: Record<string, unknown>[], sort: string) {
  const copy = [...items];
  switch (sort) {
    case "title_desc":
      return copy.sort((a, b) => String(b.title || "").localeCompare(String(a.title || "")));
    case "newest":
      return copy.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    default:
      return copy.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  }
}

function matchesAvailabilityFilter(doc: Record<string, unknown>, availability: string) {
  if (!availability || availability === "all" || availability === "inactive") return true;
  const label = getAvailabilityLabel({
    availableCount: Number(doc.availableCount) || 0,
    issuedCount: Number(doc.issuedCount) || 0,
    reservedCount: Number(doc.reservedCount) || 0,
  }).toLowerCase();
  return label === availability.toLowerCase();
}

function resolveCatalogStatusFilter(
  query: Record<string, unknown>,
  isStaff: boolean
): "active" | "inactive" {
  const requested = String(query.catalogStatus || "active").trim().toLowerCase();
  if (isStaff && requested === "inactive") return "inactive";
  return "active";
}

function matchesCatalogStatus(doc: Record<string, unknown>, catalogStatus: "active" | "inactive") {
  const active = doc.isActive !== false;
  return catalogStatus === "inactive" ? !active : active;
}

function buildCoverImageUrl(req: AuthRequest, isbn: string): string {
  const host = req.get("host") || "localhost:5000";
  const protocol = req.protocol || "http";
  return `${protocol}://${host}/api/catalog/books/${encodeURIComponent(isbn)}/cover-image`;
}

function resolveCoverThumbnail(doc: Record<string, unknown>, req: AuthRequest, isbn: string) {
  const url = String(doc.thumbnailUrl || "");
  if (
    doc.coverStoragePath ||
    (doc.coverImageSource === "manual" && url.includes("supabase"))
  ) {
    return buildCoverImageUrl(req, isbn);
  }
  return url;
}

function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "").toUpperCase();
}

function buildQrPayload(copyId: string, isbn: string): string {
  return `${copyId}_${isbn}`;
}

function resolveThumbnail(input: {
  thumbnailUrl?: string;
  metadata?: BookMetadata | null;
  existing?: Record<string, unknown>;
}) {
  const manualUrl = String(input.thumbnailUrl || "").trim();
  if (manualUrl) {
    return { thumbnailUrl: manualUrl, coverImageSource: "manual" as const };
  }

  if (input.existing?.coverImageSource === "manual" && input.existing.thumbnailUrl) {
    return {
      thumbnailUrl: input.existing.thumbnailUrl,
      coverImageSource: "manual" as const,
    };
  }

  if (input.metadata?.thumbnailUrl) {
    return {
      thumbnailUrl: input.metadata.thumbnailUrl,
      coverImageSource: "google_books" as const,
    };
  }

  return {
    thumbnailUrl: input.existing?.thumbnailUrl || "",
    coverImageSource: (input.existing?.coverImageSource as string) || "google_books",
  };
}

function getAvailabilityLabel(doc: {
  availableCount?: number;
  issuedCount?: number;
  reservedCount?: number;
}) {
  if ((doc.availableCount || 0) > 0) return "Available";
  if ((doc.reservedCount || 0) > 0) return "Reserved";
  if ((doc.issuedCount || 0) > 0) return "Issued";
  return "Unavailable";
}

/** Derives catalog counters from live copy rows (the source of truth). */
function countCopyStatuses(copies: Array<{ status?: string }>) {
  let availableCount = 0;
  let issuedCount = 0;
  let reservedCount = 0;

  for (const copy of copies) {
    if (copy.status === "available") availableCount += 1;
    else if (copy.status === "issued") issuedCount += 1;
    else if (copy.status === "reserved") reservedCount += 1;
  }

  return {
    availableCount,
    issuedCount,
    reservedCount,
    totalCopies: copies.length,
  };
}

// Lookup ISBN metadata via Google Books (manual fallback handled by client if null)
router.get(
  "/lookup/:isbn",
  authenticate,
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const isbn = normalizeIsbn(req.params.isbn as string);
      const metadata = await fetchBookByIsbn(isbn);

      if (!metadata) {
        res.status(404).json({
          error: "No metadata found for this ISBN. Enter details manually.",
          isbn,
        });
        return;
      }

      res.json(metadata);
    } catch (error: any) {
      console.error("ISBN lookup error:", error);
      const status = error?.response?.status;
      if (status === 503 || status === 429) {
        res.status(503).json({
          error: "Google Books is temporarily unavailable. Enter details manually.",
          isbn: normalizeIsbn(req.params.isbn as string),
        });
        return;
      }
      res.status(500).json({ error: "Failed to look up ISBN" });
    }
  }
);

// Add or update a catalog title (ISBN + Google Books or manual fields)
router.post(
  "/books",
  authenticate,
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        isbn,
        title,
        authors,
        publisher,
        publishedDate,
        description,
        thumbnailUrl,
        categories,
        useGoogleBooks,
      } = req.body;

      if (!isbn) {
        res.status(400).json({ error: "isbn is required" });
        return;
      }

      const cleanedIsbn = normalizeIsbn(isbn);
      let metadata: BookMetadata | null = null;

      if (useGoogleBooks !== false) {
        try {
          metadata = await fetchBookByIsbn(cleanedIsbn);
        } catch (error) {
          // Google Books can return 503 / timeouts; don't block save if fields are filled
          console.warn("Google Books unavailable during save; using provided fields.", error);
          metadata = null;
        }
      }

      const finalTitle = title || metadata?.title;
      const finalAuthors: string[] = authors || metadata?.authors || [];

      if (!finalTitle) {
        res.status(400).json({
          error:
            "title is required when Google Books metadata is unavailable. Fill title manually or retry lookup.",
        });
        return;
      }

      const categoryList: string[] = categories || metadata?.categories || [];
      const searchKeywords = buildSearchKeywords({
        title: finalTitle,
        authors: finalAuthors,
        isbn: cleanedIsbn,
        categories: categoryList,
      });

      const existing = await db.collection("catalog").doc(cleanedIsbn).get();
      const now = new Date();
      const existingData = existing.exists ? existing.data() : undefined;
      const cover = resolveThumbnail({
        thumbnailUrl,
        metadata,
        existing: existingData,
      });

      const catalogData = {
        isbn: cleanedIsbn,
        title: finalTitle,
        authors: finalAuthors,
        publisher: publisher || metadata?.publisher || "",
        publishedDate: publishedDate || metadata?.publishedDate || "",
        description: description || metadata?.description || "",
        thumbnailUrl: cover.thumbnailUrl,
        coverImageSource: cover.coverImageSource,
        categories: categoryList,
        searchKeywords,
        source: metadata ? "google_books" : "manual",
        isActive: existing.exists ? existing.data()?.isActive !== false : true,
        totalCopies: existing.exists ? existing.data()?.totalCopies || 0 : 0,
        availableCount: existing.exists ? existing.data()?.availableCount || 0 : 0,
        issuedCount: existing.exists ? existing.data()?.issuedCount || 0 : 0,
        reservedCount: existing.exists ? existing.data()?.reservedCount || 0 : 0,
        damagedCount: existing.exists ? existing.data()?.damagedCount || 0 : 0,
        updatedAt: now,
        ...(existing.exists ? {} : { createdAt: now, createdBy: req.uid }),
      };

      await db.collection("catalog").doc(cleanedIsbn).set(catalogData, { merge: true });

      res.status(existing.exists ? 200 : 201).json({
        ...catalogData,
        availability: getAvailabilityLabel(catalogData),
      });
    } catch (error) {
      console.error("Add book error:", error);
      res.status(500).json({ error: "Failed to add book" });
    }
  }
);

// Add one or more physical copies for an ISBN
router.post(
  "/copies",
  authenticate,
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { isbn, quantity = 1, location = "" } = req.body;

      if (!isbn) {
        res.status(400).json({ error: "isbn is required" });
        return;
      }

      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
        res.status(400).json({ error: "quantity must be an integer between 1 and 50" });
        return;
      }

      const cleanedIsbn = normalizeIsbn(isbn);
      const catalogRef = db.collection("catalog").doc(cleanedIsbn);
      const catalogDoc = await catalogRef.get();

      if (!catalogDoc.exists) {
        res.status(404).json({
          error: "Catalog entry not found. Add the book first.",
        });
        return;
      }

      const catalog = catalogDoc.data()!;
      const now = new Date();
      const createdCopies: Array<Record<string, unknown>> = [];

      await db.runTransaction(async (tx) => {
        const freshCatalog = await tx.get(catalogRef);
        if (!freshCatalog.exists) {
          throw new Error("CATALOG_MISSING");
        }

        for (let i = 0; i < qty; i += 1) {
          const copyId = createId("cpy");
          const qrPayload = buildQrPayload(copyId, cleanedIsbn);
          const copyRef = db.collection("bookCopies").doc(copyId);

          const copyData = {
            copyId,
            isbn: cleanedIsbn,
            title: catalog.title,
            authors: catalog.authors || [],
            status: "available",
            qrPayload,
            location,
            currentLoanId: null,
            reservedForUserId: null,
            addedBy: req.uid,
            createdAt: now,
            updatedAt: now,
          };

          tx.set(copyRef, copyData);
          createdCopies.push(copyData);
        }

        tx.update(catalogRef, {
          totalCopies: (freshCatalog.data()?.totalCopies || 0) + qty,
          availableCount: (freshCatalog.data()?.availableCount || 0) + qty,
          updatedAt: now,
        });
      });

      res.status(201).json({
        isbn: cleanedIsbn,
        createdCount: createdCopies.length,
        copies: createdCopies,
      });
    } catch (error: any) {
      if (error?.message === "CATALOG_MISSING") {
        res.status(404).json({ error: "Catalog entry not found. Add the book first." });
        return;
      }
      console.error("Add copies error:", error);
      res.status(500).json({ error: "Failed to add copies" });
    }
  }
);

// Browse / search catalog
router.get("/books", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const sort = String(req.query.sort || "title_asc");
    const availability = String(req.query.availability || "").trim();
    const config = await getSystemConfig();
    const defaultPageSize = clampCatalogPageSize(config.catalogPageSize);
    const { page, pageSize } = parseListQuery(
      req.query as Record<string, unknown>,
      defaultPageSize
    );
    const isStaff = req.role === "librarian" || req.role === "admin";
    const catalogStatus = resolveCatalogStatusFilter(req.query as Record<string, unknown>, isStaff);

    if (q) {
      const isbnCandidate = normalizeIsbn(q);
      const byIsbn = await db.collection("catalog").doc(isbnCandidate).get();
      if (byIsbn.exists) {
        const data = byIsbn.data()!;
        if (!matchesCatalogStatus(data, catalogStatus)) {
          res.json(paginateArray([], page, pageSize));
          return;
        }
        const row = {
          ...data,
          isActive: data.isActive !== false,
          availability: getAvailabilityLabel(data),
          thumbnailUrl: resolveCoverThumbnail(data, req, isbnCandidate),
        };
        if (!matchesAvailabilityFilter(data, availability)) {
          res.json(paginateArray([], page, pageSize));
          return;
        }
        res.json(paginateArray([row], page, pageSize));
        return;
      }

      const tokens = q
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 10);

      if (tokens.length === 0) {
        res.json(paginateArray([], page, pageSize));
        return;
      }

      // Load a broad set, then substring-match so "mock" finds "Mockingbird"
      const snapshot = await db
        .collection("catalog")
        .orderBy("title")
        .limit(LIST_FETCH_CAP)
        .get();

      const results = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const isbnValue = String(data.isbn || doc.id);
          return {
            ...data,
            isActive: data.isActive !== false,
            availability: getAvailabilityLabel(data),
            thumbnailUrl: resolveCoverThumbnail(data, req, isbnValue),
          } as Record<string, unknown>;
        })
        .filter((row) => matchesCatalogStatus(row, catalogStatus))
        .filter((row) => matchesAvailabilityFilter(row, availability))
        .filter((row) =>
          matchesTextQuery(
            {
              title: String(row.title || ""),
              authors: Array.isArray(row.authors) ? row.authors.map(String) : [],
              isbn: String(row.isbn || ""),
              searchKeywords: Array.isArray(row.searchKeywords)
                ? row.searchKeywords.map(String)
                : [],
            },
            q
          )
        );

      res.json(paginateArray(sortCatalogResults(results, sort), page, pageSize));
      return;
    }

    const snapshot = await db
      .collection("catalog")
      .orderBy("title")
      .limit(LIST_FETCH_CAP)
      .get();

    const results = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const isbnValue = String(data.isbn || doc.id);
        return {
          ...data,
          isActive: data.isActive !== false,
          availability: getAvailabilityLabel(data),
          thumbnailUrl: resolveCoverThumbnail(data, req, isbnValue),
        };
      })
      .filter((row) => matchesCatalogStatus(row, catalogStatus))
      .filter((row) => matchesAvailabilityFilter(row, availability));

    res.json(paginateArray(sortCatalogResults(results, sort), page, pageSize));
  } catch (error) {
    console.error("Catalog search error:", error);
    res.status(500).json({ error: "Failed to search catalog" });
  }
});

// Staff: edit title, authors, description, categories, page count
router.patch(
  "/books/:isbn",
  authenticate,
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const isbn = normalizeIsbn(req.params.isbn as string);
      const catalogRef = db.collection("catalog").doc(isbn);
      const catalogDoc = await catalogRef.get();
      if (!catalogDoc.exists) {
        res.status(404).json({ error: "Book not found" });
        return;
      }

      const existing = catalogDoc.data()!;
      const body = req.body || {};
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (typeof body.title === "string" && body.title.trim()) {
        updates.title = body.title.trim();
      }
      if (Array.isArray(body.authors)) {
        updates.authors = body.authors.map((a: unknown) => String(a).trim()).filter(Boolean);
      } else if (typeof body.authors === "string") {
        updates.authors = body.authors
          .split(",")
          .map((a: string) => a.trim())
          .filter(Boolean);
      }
      if (typeof body.description === "string") {
        updates.description = body.description.trim();
      }
      if (Array.isArray(body.categories)) {
        updates.categories = body.categories.map((c: unknown) => String(c).trim()).filter(Boolean);
      } else if (typeof body.categories === "string") {
        updates.categories = body.categories
          .split(",")
          .map((c: string) => c.trim())
          .filter(Boolean);
      }
      if (body.pageCount !== undefined) {
        const n = Number(body.pageCount);
        if (Number.isFinite(n) && n >= 0) updates.pageCount = Math.round(n);
      }

      const nextTitle = String(updates.title ?? existing.title ?? "");
      const nextAuthors = (updates.authors as string[] | undefined) ??
        (Array.isArray(existing.authors) ? existing.authors.map(String) : []);
      const nextCategories = (updates.categories as string[] | undefined) ??
        (Array.isArray(existing.categories) ? existing.categories.map(String) : []);

      updates.searchKeywords = buildSearchKeywords({
        title: nextTitle,
        authors: nextAuthors,
        isbn,
        categories: nextCategories,
      });

      await catalogRef.update(updates);
      const fresh = await catalogRef.get();
      res.json({ success: true, book: { ...fresh.data(), isbn } });
    } catch (error) {
      console.error("Update book error:", error);
      res.status(500).json({ error: "Failed to update book details" });
    }
  }
);

// Set cover image URL manually (librarian/admin)
router.patch(
  "/books/:isbn/cover",
  authenticate,
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const isbn = normalizeIsbn(req.params.isbn as string);
      const thumbnailUrl = String(req.body.thumbnailUrl || "").trim();

      if (!thumbnailUrl) {
        res.status(400).json({ error: "thumbnailUrl is required" });
        return;
      }

      if (!/^https?:\/\//i.test(thumbnailUrl)) {
        res.status(400).json({ error: "thumbnailUrl must be an http(s) URL" });
        return;
      }

      const catalogRef = db.collection("catalog").doc(isbn);
      const catalogDoc = await catalogRef.get();
      if (!catalogDoc.exists) {
        res.status(404).json({ error: "Book not found" });
        return;
      }

      const now = new Date();
      await catalogRef.update({
        thumbnailUrl,
        coverImageSource: "manual",
        coverStoragePath: null,
        updatedAt: now,
      });

      res.json({
        success: true,
        isbn,
        thumbnailUrl,
        coverImageSource: "manual",
      });
    } catch (error) {
      console.error("Set cover URL error:", error);
      res.status(500).json({ error: "Failed to set cover image" });
    }
  }
);

// Upload cover image file (librarian/admin)
router.post(
  "/books/:isbn/cover",
  authenticate,
  requireRole("librarian", "admin"),
  (req: AuthRequest, res: Response, next) => {
    uploadCover.single("file")(req, res, (err: any) => {
      if (err) {
        res.status(400).json({ error: err.message || "Upload failed" });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      if (!isSupabaseConfigured()) {
        res.status(503).json({
          error:
            "Supabase Storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to api/.env, or set a cover URL instead.",
        });
        return;
      }

      if (!req.file?.buffer) {
        res.status(400).json({ error: "Image file is required (field name: file)" });
        return;
      }

      const isbn = normalizeIsbn(req.params.isbn as string);
      const catalogRef = db.collection("catalog").doc(isbn);
      const catalogDoc = await catalogRef.get();
      if (!catalogDoc.exists) {
        res.status(404).json({ error: "Book not found" });
        return;
      }

      const objectPath = coverObjectPathForIsbn(isbn);
      const uploaded = await uploadBookCover({
        objectPath,
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
      });

      const coverImageUrl = buildCoverImageUrl(req, isbn);
      const now = new Date();
      await catalogRef.update({
        thumbnailUrl: coverImageUrl,
        coverStoragePath: objectPath,
        coverImageSource: "manual",
        updatedAt: now,
      });

      res.json({
        success: true,
        isbn,
        thumbnailUrl: coverImageUrl,
        coverImageSource: "manual",
      });
    } catch (error: any) {
      console.error("Upload cover error:", error);
      res.status(500).json({ error: error?.message || "Failed to upload cover image" });
    }
  }
);

// Stream uploaded cover image (authenticated — private Supabase bucket)
router.get("/books/:isbn/cover-image", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const isbn = normalizeIsbn(req.params.isbn as string);
    const catalogDoc = await db.collection("catalog").doc(isbn).get();
    if (!catalogDoc.exists) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    const data = catalogDoc.data()!;
    const candidates = [
      String(data.coverStoragePath || ""),
      coverObjectPathForIsbn(isbn),
      `covers/${isbn}.png`,
      `covers/${isbn}.webp`,
    ].filter(Boolean);
    const uniquePaths = [...new Set(candidates)];

    let file: { buffer: Buffer; contentType: string } | null = null;
    let servedPath = "";
    for (const objectPath of uniquePaths) {
      try {
        file = await downloadBookCover(objectPath);
        servedPath = objectPath;
        break;
      } catch {
        // try next legacy path
      }
    }

    if (!file) {
      res.status(404).json({ error: "Cover image not found" });
      return;
    }

    res.setHeader("Content-Type", file.contentType || guessContentTypeFromPath(servedPath));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(file.buffer);
  } catch (error) {
    console.error("Cover image stream error:", error);
    res.status(404).json({ error: "Cover image not found" });
  }
});

// Soft-activate / soft-deactivate a catalog title (keeps loan/reservation history)
router.patch(
  "/books/:isbn/status",
  authenticate,
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const isbn = normalizeIsbn(req.params.isbn as string);
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        res.status(400).json({ error: "isActive must be a boolean" });
        return;
      }

      const catalogRef = db.collection("catalog").doc(isbn);
      const catalogDoc = await catalogRef.get();
      if (!catalogDoc.exists) {
        res.status(404).json({ error: "Book not found" });
        return;
      }

      const catalog = catalogDoc.data()!;
      const title = String(catalog.title || isbn);

      if (isActive === false) {
        const issuedCount = Number(catalog.issuedCount) || 0;
        if (issuedCount > 0) {
          res.status(409).json({
            error:
              "Cannot deactivate this title while a copy is on loan. Wait until all copies are returned.",
            code: "COPIES_ON_LOAN",
          });
          return;
        }

        const copiesSnap = await db
          .collection("bookCopies")
          .where("isbn", "==", isbn)
          .where("status", "==", "issued")
          .limit(1)
          .get();
        if (!copiesSnap.empty) {
          res.status(409).json({
            error:
              "Cannot deactivate this title while a copy is on loan. Wait until all copies are returned.",
            code: "COPIES_ON_LOAN",
          });
          return;
        }
      }

      const now = new Date();
      await catalogRef.update({ isActive, updatedAt: now });

      let cancelledReservations = 0;
      if (isActive === false) {
        cancelledReservations = await cancelReservationsForDeactivatedTitle({ isbn, title });
      }

      await db.collection("auditLog").add({
        action: isActive ? "catalog_activated" : "catalog_deactivated",
        actorId: req.uid,
        targetId: isbn,
        metadata: {
          title,
          cancelledReservations,
        },
        timestamp: now,
      });

      res.json({
        success: true,
        isbn,
        isActive,
        cancelledReservations,
        message: isActive
          ? "Book is active in the catalog again"
          : cancelledReservations > 0
            ? `Book deactivated. ${cancelledReservations} reservation(s) were cancelled and students were notified.`
            : "Book deactivated (hidden from students; history kept)",
      });
    } catch (error) {
      console.error("Catalog status error:", error);
      res.status(500).json({ error: "Failed to update book status" });
    }
  }
);

// Get a single catalog title with its copies
router.get("/books/:isbn", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const isbn = normalizeIsbn(req.params.isbn as string);
    const catalogDoc = await db.collection("catalog").doc(isbn).get();

    if (!catalogDoc.exists) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    const data = catalogDoc.data()!;
    const isStaff = req.role === "librarian" || req.role === "admin";
    if (data.isActive === false && !isStaff) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    const copiesSnap = await db
      .collection("bookCopies")
      .where("isbn", "==", isbn)
      .get();

    const copies = copiesSnap.docs.map((doc) => doc.data());

    // Copy rows are the source of truth. Derive counts from them so a drifted
    // counter can never make a returned book keep showing as issued/reserved.
    const liveCounts = countCopyStatuses(copies);

    let pendingReservationCount = 0;
    if (isStaff) {
      const reservationsSnap = await db
        .collection("reservations")
        .where("isbn", "==", isbn)
        .where("status", "in", ["waiting", "ready"])
        .get();
      pendingReservationCount = reservationsSnap.size;
    }

    // Self-heal stored counters in the background when they disagree.
    if (
      Number(data.availableCount || 0) !== liveCounts.availableCount ||
      Number(data.issuedCount || 0) !== liveCounts.issuedCount ||
      Number(data.reservedCount || 0) !== liveCounts.reservedCount ||
      Number(data.totalCopies || 0) !== liveCounts.totalCopies
    ) {
      console.warn(
        `[catalog] counter drift healed for ${isbn}:`,
        {
          stored: {
            availableCount: data.availableCount,
            issuedCount: data.issuedCount,
            reservedCount: data.reservedCount,
            totalCopies: data.totalCopies,
          },
          live: liveCounts,
        }
      );
      void catalogDoc.ref
        .update({ ...liveCounts, updatedAt: new Date() })
        .catch((error) => console.error("[catalog] counter heal failed:", error));
    }

    res.json({
      ...data,
      ...liveCounts,
      isActive: data.isActive !== false,
      availability: getAvailabilityLabel(liveCounts),
      thumbnailUrl: resolveCoverThumbnail(data, req, isbn),
      copies,
      ...(isStaff ? { pendingReservationCount } : {}),
    });
  } catch (error) {
    console.error("Get book error:", error);
    res.status(500).json({ error: "Failed to fetch book" });
  }
});

// Get a single physical copy by copyId (useful for QR scan later)
router.get("/copies/:copyId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const copyId = req.params.copyId as string;
    const copyDoc = await db.collection("bookCopies").doc(copyId).get();

    if (!copyDoc.exists) {
      res.status(404).json({ error: "Copy not found" });
      return;
    }

    res.json(copyDoc.data());
  } catch (error) {
    console.error("Get copy error:", error);
    res.status(500).json({ error: "Failed to fetch copy" });
  }
});

router.get("/books/:isbn/reviews", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const isbn = normalizeIsbn(req.params.isbn as string);
    const catalogSnap = await db.collection("catalog").doc(isbn).get();
    if (!catalogSnap.exists) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    const reviews = await listCatalogReviews(isbn);
    const published = reviews.filter((row: any) => row.confirmed === true);
    const summary = summarizeReviews(published);
    const mine = req.uid ? await getCatalogUserReview(isbn, req.uid) : null;

    res.json({
      summary,
      items: published.map((row: any) => ({
        reviewId: row.reviewId || row.userId,
        displayName: row.displayName || "Student",
        rating: row.rating,
        recommendScore: row.recommendScore ?? null,
        comment: row.comment || "",
        updatedAt: row.updatedAt,
        isMine: row.userId === req.uid,
      })),
      mine,
    });
  } catch (error) {
    console.error("List catalog reviews error:", error);
    res.status(500).json({ error: "Failed to list reviews" });
  }
});

router.put("/books/:isbn/reviews", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const isbn = normalizeIsbn(req.params.isbn as string);
    const catalogSnap = await db.collection("catalog").doc(isbn).get();
    if (!catalogSnap.exists) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be an integer 1-5" });
      return;
    }

    let recommendScore: number | null = null;
    if (req.body.recommendScore !== undefined && req.body.recommendScore !== null) {
      recommendScore = Number(req.body.recommendScore);
      if (!Number.isInteger(recommendScore) || recommendScore < 1 || recommendScore > 10) {
        res.status(400).json({ error: "recommendScore must be an integer 1-10" });
        return;
      }
    }

    const userSnap = await db.collection("users").doc(req.uid!).get();
    const displayName = String(userSnap.data()?.displayName || "Student");

    const saved = await upsertCatalogReview({
      isbn,
      userId: req.uid!,
      displayName,
      rating,
      recommendScore,
      comment: req.body.comment,
      confirm: true,
    });

    res.json(saved);
  } catch (error: any) {
    if (String(error?.message || "").includes("cannot be changed")) {
      res.status(409).json({ error: "You already reviewed this title" });
      return;
    }
    console.error("Upsert catalog review error:", error);
    res.status(500).json({ error: "Failed to save review" });
  }
});

export default router;

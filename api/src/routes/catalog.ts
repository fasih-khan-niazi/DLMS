import { Router, Response } from "express";
import { db } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import {
  buildSearchKeywords,
  fetchBookByIsbn,
  BookMetadata,
} from "../services/googleBooks";
import { createId } from "../utils/ids";
import {
  LIST_FETCH_CAP,
  paginateArray,
  parseListQuery,
  toMillis,
} from "../utils/pagination";

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
  if (!availability || availability === "all") return true;
  const label = getAvailabilityLabel({
    availableCount: Number(doc.availableCount) || 0,
    issuedCount: Number(doc.issuedCount) || 0,
    reservedCount: Number(doc.reservedCount) || 0,
  }).toLowerCase();
  return label === availability.toLowerCase();
}

function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "").toUpperCase();
}

function buildQrPayload(copyId: string, isbn: string): string {
  return `${copyId}_${isbn}`;
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

      const catalogData = {
        isbn: cleanedIsbn,
        title: finalTitle,
        authors: finalAuthors,
        publisher: publisher || metadata?.publisher || "",
        publishedDate: publishedDate || metadata?.publishedDate || "",
        description: description || metadata?.description || "",
        thumbnailUrl: thumbnailUrl || metadata?.thumbnailUrl || "",
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
    const { page, pageSize } = parseListQuery(req.query as Record<string, unknown>);
    const isStaff = req.role === "librarian" || req.role === "admin";
    const includeInactive =
      isStaff && String(req.query.includeInactive || "") === "1";

    if (q) {
      const isbnCandidate = normalizeIsbn(q);
      const byIsbn = await db.collection("catalog").doc(isbnCandidate).get();
      if (byIsbn.exists) {
        const data = byIsbn.data()!;
        if (!includeInactive && data.isActive === false) {
          res.json(paginateArray([], page, pageSize));
          return;
        }
        const row = {
          ...data,
          isActive: data.isActive !== false,
          availability: getAvailabilityLabel(data),
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

      const snapshot = await db
        .collection("catalog")
        .where("searchKeywords", "array-contains-any", tokens)
        .limit(LIST_FETCH_CAP)
        .get();

      const results = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            ...data,
            isActive: data.isActive !== false,
            availability: getAvailabilityLabel(data),
          };
        })
        .filter((row) => includeInactive || row.isActive !== false)
        .filter((row) => matchesAvailabilityFilter(row, availability));

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
        return {
          ...data,
          isActive: data.isActive !== false,
          availability: getAvailabilityLabel(data),
        };
      })
      .filter((row) => includeInactive || row.isActive !== false)
      .filter((row) => matchesAvailabilityFilter(row, availability));

    res.json(paginateArray(sortCatalogResults(results, sort), page, pageSize));
  } catch (error) {
    console.error("Catalog search error:", error);
    res.status(500).json({ error: "Failed to search catalog" });
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

      const now = new Date();
      await catalogRef.update({ isActive, updatedAt: now });

      await db.collection("auditLog").add({
        action: isActive ? "catalog_activated" : "catalog_deactivated",
        actorId: req.uid,
        targetId: isbn,
        metadata: { title: catalogDoc.data()?.title || "" },
        timestamp: now,
      });

      res.json({
        success: true,
        isbn,
        isActive,
        message: isActive
          ? "Book is active in the catalog again"
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

    res.json({
      ...data,
      isActive: data.isActive !== false,
      availability: getAvailabilityLabel(data),
      copies,
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

export default router;

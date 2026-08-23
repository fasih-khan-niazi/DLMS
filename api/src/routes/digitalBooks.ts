import { Router, Response } from "express";
import fs from "fs";
import { db } from "../config/firebase";
import { isSupabaseConfigured } from "../config/supabase";
import { digitalBookFilePath } from "../config/storage";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { uploadPdf } from "../middleware/uploadPdf";
import { createId } from "../utils/ids";
import { buildSearchKeywords } from "../services/googleBooks";
import { clampCatalogPageSize, getSystemConfig } from "../services/loans";
import {
  downloadDigitalBookPdf,
  removeDigitalBookPdf,
  uploadDigitalBookPdf,
} from "../services/digitalBookStorage";
import { uploadBookCover, downloadBookCover } from "../services/bookCoverStorage";
import {
  digitalCoverObjectPath,
  renderPdfFirstPageToJpeg,
} from "../services/pdfCover";
import {
  getUserReview,
  listDigitalBookReviews,
  summarizeReviews,
  upsertDigitalBookReview,
} from "../services/digitalBookReviews";
import {
  LIST_FETCH_CAP,
  paginateArray,
  parseListQuery,
  toMillis,
} from "../utils/pagination";
import { matchesTextQuery } from "../utils/textSearch";

const router = Router();

function sortDigitalBooks(items: Record<string, unknown>[], sort: string) {
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

function publicFileUrl(req: AuthRequest, digitalBookId: string) {
  const host = req.get("host") || "localhost:5000";
  const protocol = req.protocol || "http";
  return `${protocol}://${host}/api/digital-books/${digitalBookId}/file`;
}

function buildDigitalCoverImageUrl(req: AuthRequest, digitalBookId: string) {
  const host = req.get("host") || "localhost:5000";
  const protocol = req.protocol || "http";
  return `${protocol}://${host}/api/digital-books/${digitalBookId}/cover-image`;
}

function withCoverThumbnail(req: AuthRequest, row: Record<string, unknown>) {
  const digitalBookId = String(row.digitalBookId || "");
  // Always expose cover URL — endpoint lazy-generates from PDF page 1 if missing.
  return {
    ...row,
    thumbnailUrl: buildDigitalCoverImageUrl(req, digitalBookId),
  };
}

async function ensureDigitalCover(
  digitalBookId: string,
  data: Record<string, unknown>
): Promise<{ buffer: Buffer; contentType: string; path: string }> {
  const existingPath = String(data.coverStoragePath || "");
  if (existingPath) {
    try {
      const file = await downloadBookCover(existingPath);
      return { ...file, path: existingPath };
    } catch {
      // fall through and regenerate
    }
  }

  const coverPath = digitalCoverObjectPath(digitalBookId);
  try {
    const file = await downloadBookCover(coverPath);
    if (!existingPath) {
      await db.collection("digitalBooks").doc(digitalBookId).update({
        coverStoragePath: coverPath,
        updatedAt: new Date(),
      });
    }
    return { ...file, path: coverPath };
  } catch {
    // generate from PDF
  }

  const backend = String(data.storageBackend || "local");
  let pdfBuffer: Buffer;
  if (backend === "supabase") {
    const objectPath = String(data.storagePath || data.storedFileName || "");
    if (!objectPath) {
      throw new Error("PDF storage path missing");
    }
    pdfBuffer = await downloadDigitalBookPdf(objectPath);
  } else {
    const filePath = digitalBookFilePath(String(data.storedFileName || ""));
    if (!fs.existsSync(filePath)) {
      throw new Error("PDF file missing on server");
    }
    pdfBuffer = fs.readFileSync(filePath);
  }

  const coverBuffer = await renderPdfFirstPageToJpeg(pdfBuffer);
  await uploadBookCover({
    objectPath: coverPath,
    buffer: coverBuffer,
    contentType: "image/jpeg",
  });
  await db.collection("digitalBooks").doc(digitalBookId).update({
    coverStoragePath: coverPath,
    updatedAt: new Date(),
  });
  return { buffer: coverBuffer, contentType: "image/jpeg", path: coverPath };
}

// List published digital books (search optional)
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || "")
      .trim()
      .toLowerCase();
    const sort = String(req.query.sort || "title_asc");
    const shelfFilter = String(req.query.shelfFilter || "all");
    const config = await getSystemConfig();
    const defaultPageSize = clampCatalogPageSize(config.catalogPageSize);
    const { page, pageSize } = parseListQuery(
      req.query as Record<string, unknown>,
      defaultPageSize
    );

    let snap;
    if (q) {
      const tokens = q
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 10);
      if (tokens.length === 0) {
        res.json(paginateArray([], page, pageSize));
        return;
      }
      // Broad fetch + substring match ("mock" → "Mockingbird")
      snap = await db
        .collection("digitalBooks")
        .where("isPublished", "==", true)
        .limit(LIST_FETCH_CAP)
        .get();
    } else {
      snap = await db
        .collection("digitalBooks")
        .where("isPublished", "==", true)
        .limit(LIST_FETCH_CAP)
        .get();
    }

    let results: Record<string, unknown>[] = snap.docs.map((doc) => {
      const data = doc.data();
      return withCoverThumbnail(req, {
        ...data,
        digitalBookId: data.digitalBookId || doc.id,
        fileUrl: publicFileUrl(req, data.digitalBookId || doc.id),
      });
    });

    if (shelfFilter !== "all" && req.uid) {
      const shelfSnap = await db
        .collection("users")
        .doc(req.uid)
        .collection("bookshelf")
        .get();
      const shelfByBook = new Map(
        shelfSnap.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>])
      );

      results = results.filter((row) => {
        const id = String(row.digitalBookId || "");
        const shelf = shelfByBook.get(id);
        const progress = Number(shelf?.progress ?? -1);
        switch (shelfFilter) {
          case "saved":
            return !!shelf;
          case "reading":
            return progress > 0 && progress < 100;
          case "unread":
            return !shelf || progress <= 0;
          case "finished":
            return progress >= 100;
          default:
            return true;
        }
      });
    }

    if (q) {
      results = results.filter((row) =>
        matchesTextQuery(
          {
            title: String(row.title || ""),
            author: String(row.author || ""),
            searchKeywords: Array.isArray(row.searchKeywords)
              ? row.searchKeywords.map(String)
              : [],
          },
          q
        )
      );
    }

    res.json(paginateArray(sortDigitalBooks(results, sort), page, pageSize));
  } catch (error) {
    console.error("List digital books error:", error);
    res.status(500).json({ error: "Failed to list digital books" });
  }
});

// Bookshelf list MUST be before /:digitalBookId
router.get("/bookshelf/mine", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const snap = await db
      .collection("users")
      .doc(req.uid!)
      .collection("bookshelf")
      .get();

    const items = snap.docs.map((doc) => ({ digitalBookId: doc.id, ...doc.data() }));
    items.sort((a: any, b: any) => {
      const aTime = a.lastReadAt?.toMillis?.() || a.addedAt?.toMillis?.() || 0;
      const bTime = b.lastReadAt?.toMillis?.() || b.addedAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    res.json({ items });
  } catch (error) {
    console.error("List bookshelf error:", error);
    res.status(500).json({ error: "Failed to list bookshelf" });
  }
});

// Get one digital book
router.get("/:digitalBookId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const digitalBookId = req.params.digitalBookId as string;
    const snap = await db.collection("digitalBooks").doc(digitalBookId).get();
    if (!snap.exists) {
      res.status(404).json({ error: "Digital book not found" });
      return;
    }

    const data = snap.data()!;
    if (!data.isPublished && req.role !== "librarian" && req.role !== "admin") {
      res.status(404).json({ error: "Digital book not found" });
      return;
    }

    res.json({
      ...data,
      digitalBookId,
      fileUrl: publicFileUrl(req, digitalBookId),
      thumbnailUrl: buildDigitalCoverImageUrl(req, digitalBookId),
    });
  } catch (error) {
    console.error("Get digital book error:", error);
    res.status(500).json({ error: "Failed to fetch digital book" });
  }
});

// Stream/download PDF (authenticated) - proxies Supabase (or legacy local files)
router.get("/:digitalBookId/cover-image", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const digitalBookId = req.params.digitalBookId as string;
    const snap = await db.collection("digitalBooks").doc(digitalBookId).get();
    if (!snap.exists) {
      res.status(404).json({ error: "Digital book not found" });
      return;
    }

    const data = snap.data()!;
    if (!data.isPublished && req.role !== "librarian" && req.role !== "admin") {
      res.status(404).json({ error: "Digital book not found" });
      return;
    }

    const file = await ensureDigitalCover(digitalBookId, data);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(file.buffer);
  } catch (error) {
    console.error("Digital cover image error:", error);
    res.status(404).json({ error: "Cover image not found" });
  }
});

// Reviews MUST be before generic /:digitalBookId mutations that could conflict
router.get("/:digitalBookId/reviews", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const digitalBookId = req.params.digitalBookId as string;
    const bookSnap = await db.collection("digitalBooks").doc(digitalBookId).get();
    if (!bookSnap.exists || !bookSnap.data()?.isPublished) {
      res.status(404).json({ error: "Digital book not found" });
      return;
    }

    const reviews = await listDigitalBookReviews(digitalBookId);
    const summary = summarizeReviews(reviews);
    const mine = req.uid ? await getUserReview(digitalBookId, req.uid) : null;

    res.json({
      summary,
      items: reviews.map((row: any) => ({
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
    console.error("List digital reviews error:", error);
    res.status(500).json({ error: "Failed to list reviews" });
  }
});

router.put("/:digitalBookId/reviews", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const digitalBookId = req.params.digitalBookId as string;
    const bookSnap = await db.collection("digitalBooks").doc(digitalBookId).get();
    if (!bookSnap.exists || !bookSnap.data()?.isPublished) {
      res.status(404).json({ error: "Digital book not found" });
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

    const saved = await upsertDigitalBookReview({
      digitalBookId,
      userId: req.uid!,
      displayName,
      rating,
      recommendScore,
      comment: req.body.comment,
    });

    // Keep bookshelf rating in sync when present
    const shelfRef = db.collection("users").doc(req.uid!).collection("bookshelf").doc(digitalBookId);
    const shelfSnap = await shelfRef.get();
    if (shelfSnap.exists) {
      await shelfRef.update({ rating, updatedAt: new Date() });
    }

    res.json(saved);
  } catch (error) {
    console.error("Upsert digital review error:", error);
    res.status(500).json({ error: "Failed to save review" });
  }
});

router.get("/:digitalBookId/file", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const digitalBookId = req.params.digitalBookId as string;
    const snap = await db.collection("digitalBooks").doc(digitalBookId).get();
    if (!snap.exists) {
      res.status(404).json({ error: "Digital book not found" });
      return;
    }

    const data = snap.data()!;
    if (!data.isPublished && req.role !== "librarian" && req.role !== "admin") {
      res.status(404).json({ error: "Digital book not found" });
      return;
    }

    const filename = `${(data.title || "book").replace(/"/g, "")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    const backend = data.storageBackend || "local";

    if (backend === "supabase") {
      const objectPath = data.storagePath || data.storedFileName;
      if (!objectPath) {
        res.status(404).json({ error: "PDF storage path missing" });
        return;
      }
      const buffer = await downloadDigitalBookPdf(objectPath);
      res.send(buffer);
      return;
    }

    const filePath = digitalBookFilePath(data.storedFileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "PDF file missing on server" });
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("Stream digital book error:", error);
    res.status(500).json({ error: "Failed to stream PDF" });
  }
});

// Upload PDF (librarian/admin) - Supabase Storage
router.post(
  "/",
  authenticate,
  requireRole("librarian", "admin"),
  (req: AuthRequest, res: Response, next) => {
    uploadPdf.single("file")(req, res, (err: any) => {
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
            "Supabase Storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to api/.env (see docs/supabase.md).",
        });
        return;
      }

      if (!req.file?.buffer) {
        res.status(400).json({ error: "PDF file is required (field name: file)" });
        return;
      }

      const config = await getSystemConfig();
      const maxMb = Number(config.maxPdfSizeMb || 25);
      const maxBytes = maxMb * 1024 * 1024;
      if (req.file.size > maxBytes) {
        res.status(400).json({
          error: `PDF exceeds the configured limit of ${maxMb}MB`,
        });
        return;
      }

      const title = String(req.body.title || "").trim();
      const author = String(req.body.author || "").trim();
      const description = String(req.body.description || "").trim();

      if (!title) {
        res.status(400).json({ error: "title is required" });
        return;
      }

      const digitalBookId = createId("ebook");
      const safeBase = (req.file.originalname || "book")
        .replace(/\.pdf$/i, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 40);
      const storedFileName = `${digitalBookId}_${safeBase}.pdf`;
      const storagePath = `digital-books/${storedFileName}`;

      await uploadDigitalBookPdf({
        objectPath: storagePath,
        buffer: req.file.buffer,
        contentType: "application/pdf",
      });

      const now = new Date();
      const searchKeywords = buildSearchKeywords({
        title,
        authors: author ? [author] : [],
        isbn: digitalBookId,
      });

      const coverStoragePath = digitalCoverObjectPath(digitalBookId);
      const doc = {
        digitalBookId,
        title,
        author,
        description,
        storedFileName,
        storagePath,
        originalFileName: req.file.originalname,
        fileSizeBytes: req.file.size,
        mimeType: "application/pdf",
        isPublished: true,
        storageBackend: "supabase",
        // Path reserved; image is generated in background so upload returns quickly.
        coverStoragePath,
        searchKeywords,
        uploadedBy: req.uid,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection("digitalBooks").doc(digitalBookId).set(doc);

      // Non-blocking: first-page cover while client already sees the new title.
      const pdfBuffer = req.file.buffer;
      void (async () => {
        try {
          const coverBuffer = await renderPdfFirstPageToJpeg(pdfBuffer);
          await uploadBookCover({
            objectPath: coverStoragePath,
            buffer: coverBuffer,
            contentType: "image/jpeg",
          });
        } catch (coverError) {
          console.warn("Digital cover generation failed (book still uploaded):", coverError);
        }
      })();

      res.status(201).json({
        ...doc,
        fileUrl: publicFileUrl(req, digitalBookId),
        thumbnailUrl: buildDigitalCoverImageUrl(req, digitalBookId),
        message: "PDF uploaded to Supabase Storage",
      });
    } catch (error: any) {
      console.error("Upload digital book error:", error);
      res.status(500).json({
        error: error?.message || "Failed to upload digital book",
      });
    }
  }
);

// Unpublish (soft delete)
router.delete(
  "/:digitalBookId",
  authenticate,
  requireRole("librarian", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const digitalBookId = req.params.digitalBookId as string;
      const ref = db.collection("digitalBooks").doc(digitalBookId);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: "Digital book not found" });
        return;
      }

      const data = snap.data()!;
      await ref.update({ isPublished: false, updatedAt: new Date() });

      // Best-effort remove from Supabase (keep metadata for audit)
      if (data.storageBackend === "supabase") {
        const objectPath = data.storagePath || data.storedFileName;
        if (objectPath) {
          try {
            await removeDigitalBookPdf(objectPath);
          } catch (removeError) {
            console.error("Supabase remove after unpublish failed:", removeError);
          }
        }
      }

      res.json({ success: true, digitalBookId });
    } catch (error) {
      console.error("Unpublish digital book error:", error);
      res.status(500).json({ error: "Failed to unpublish digital book" });
    }
  }
);

// ---- Bookshelf mutations ----

router.post(
  "/:digitalBookId/bookshelf",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const digitalBookId = req.params.digitalBookId as string;
      const bookSnap = await db.collection("digitalBooks").doc(digitalBookId).get();
      if (!bookSnap.exists || !bookSnap.data()?.isPublished) {
        res.status(404).json({ error: "Digital book not found" });
        return;
      }

      const book = bookSnap.data()!;
      const ref = db
        .collection("users")
        .doc(req.uid!)
        .collection("bookshelf")
        .doc(digitalBookId);

      const existing = await ref.get();
      const now = new Date();

      if (existing.exists) {
        res.json({ ...existing.data(), digitalBookId, message: "Already on bookshelf" });
        return;
      }

      const item = {
        digitalBookId,
        title: book.title,
        author: book.author || "",
        progress: 0,
        rating: null,
        addedAt: now,
        lastReadAt: null,
        updatedAt: now,
      };

      await ref.set(item);
      res.status(201).json(item);
    } catch (error) {
      console.error("Add bookshelf error:", error);
      res.status(500).json({ error: "Failed to add to bookshelf" });
    }
  }
);

router.patch(
  "/:digitalBookId/bookshelf",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const digitalBookId = req.params.digitalBookId as string;
      const ref = db
        .collection("users")
        .doc(req.uid!)
        .collection("bookshelf")
        .doc(digitalBookId);

      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: "Book not on your bookshelf. Save it first." });
        return;
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (req.body.progress !== undefined) {
        const progress = Number(req.body.progress);
        if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
          res.status(400).json({ error: "progress must be 0-100" });
          return;
        }
        updates.progress = progress;
        updates.lastReadAt = new Date();
      }

      if (req.body.lastPage !== undefined) {
        const lastPage = Number(req.body.lastPage);
        if (!Number.isInteger(lastPage) || lastPage < 1) {
          res.status(400).json({ error: "lastPage must be a positive integer" });
          return;
        }
        updates.lastPage = lastPage;
        updates.lastReadAt = new Date();
      }

      if (req.body.totalPages !== undefined) {
        const totalPages = Number(req.body.totalPages);
        if (!Number.isInteger(totalPages) || totalPages < 1) {
          res.status(400).json({ error: "totalPages must be a positive integer" });
          return;
        }
        updates.totalPages = totalPages;
      }

      if (req.body.rating !== undefined && req.body.rating !== null) {
        const rating = Number(req.body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          res.status(400).json({ error: "rating must be an integer 1-5" });
          return;
        }
        updates.rating = rating;
      }

      if (req.body.rating === null) {
        updates.rating = null;
      }

      await ref.update(updates);
      const updated = await ref.get();
      res.json({ digitalBookId, ...updated.data() });
    } catch (error) {
      console.error("Update bookshelf error:", error);
      res.status(500).json({ error: "Failed to update bookshelf" });
    }
  }
);

router.delete(
  "/:digitalBookId/bookshelf",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const digitalBookId = req.params.digitalBookId as string;
      await db
        .collection("users")
        .doc(req.uid!)
        .collection("bookshelf")
        .doc(digitalBookId)
        .delete();
      res.json({ success: true, digitalBookId });
    } catch (error) {
      console.error("Remove bookshelf error:", error);
      res.status(500).json({ error: "Failed to remove from bookshelf" });
    }
  }
);

export default router;

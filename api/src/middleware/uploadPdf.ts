import multer from "multer";
import path from "path";
import { DIGITAL_BOOKS_DIR, ensureUploadDirs } from "../config/storage";
import { createId } from "../utils/ids";

ensureUploadDirs();

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs();
    cb(null, DIGITAL_BOOKS_DIR);
  },
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    cb(null, `${createId("pdf")}_${safeBase}.pdf`);
  },
});

export const uploadPdf = multer({
  storage,
  limits: { fileSize: MAX_PDF_BYTES },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";
    if (isPdfMime || isPdfExt) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF files are allowed"));
  },
});

import multer from "multer";
import path from "path";

/** Absolute ceiling; real limit comes from config.maxPdfSizeMb in the upload route. */
const ABSOLUTE_MAX_PDF_BYTES = 100 * 1024 * 1024;

export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ABSOLUTE_MAX_PDF_BYTES },
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

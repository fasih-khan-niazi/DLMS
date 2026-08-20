import multer from "multer";
import path from "path";

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25MB

export const uploadPdf = multer({
  storage: multer.memoryStorage(),
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

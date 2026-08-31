import multer from "multer";
import path from "path";

const MAX_COVER_BYTES = 5 * 1024 * 1024;

const allowedExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMime.has(file.mimetype) || allowedExt.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPEG, PNG, or WebP images are allowed"));
  },
});

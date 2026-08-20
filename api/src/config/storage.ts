import fs from "fs";
import path from "path";

export const UPLOADS_ROOT = path.resolve(__dirname, "../../uploads");
export const DIGITAL_BOOKS_DIR = path.join(UPLOADS_ROOT, "digital-books");

export function ensureUploadDirs() {
  fs.mkdirSync(DIGITAL_BOOKS_DIR, { recursive: true });
}

export function digitalBookFilePath(storedFileName: string) {
  return path.join(DIGITAL_BOOKS_DIR, storedFileName);
}

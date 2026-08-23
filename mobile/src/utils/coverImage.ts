import * as FileSystem from "expo-file-system/legacy";
import { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";

export function isApiCoverUrl(uri: string): boolean {
  return uri.includes("/api/catalog/books/") && uri.includes("/cover-image");
}

/** Force cover-image requests through the mobile API base URL (LAN IP vs localhost). */
export function normalizeCoverUrl(uri: string): string {
  if (!isApiCoverUrl(uri)) return uri;
  const match = uri.match(/\/api\/catalog\/books\/([^/?]+)\/cover-image/);
  if (!match) return uri;
  const isbn = decodeURIComponent(match[1]);
  return `${API_BASE_URL}/api/catalog/books/${encodeURIComponent(isbn)}/cover-image`;
}

function coverCachePath(isbn: string, revision: string | number): string {
  const safe = isbn.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${FileSystem.cacheDirectory}cover_${safe}_${revision}.img`;
}

export async function resolveCoverDisplayUri(
  uri: string,
  cacheKey?: string | number
): Promise<string | null> {
  if (!uri.trim()) return null;

  if (!isApiCoverUrl(uri)) {
    if (cacheKey !== undefined && cacheKey !== null) {
      return `${uri}${uri.includes("?") ? "&" : "?"}v=${cacheKey}`;
    }
    return uri;
  }

  const user = firebaseAuth.currentUser;
  if (!user) return null;

  const normalized = normalizeCoverUrl(uri);
  const isbnMatch = normalized.match(/\/books\/([^/?]+)\/cover-image/);
  const isbn = isbnMatch ? decodeURIComponent(isbnMatch[1]) : "book";
  const revision = cacheKey ?? Date.now();
  const dest = coverCachePath(isbn, revision);

  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    // ignore
  }

  const token = await user.getIdToken();
  const url =
    cacheKey !== undefined && cacheKey !== null
      ? `${normalized}?v=${cacheKey}`
      : normalized;

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status === 200) {
    return result.uri;
  }

  return null;
}

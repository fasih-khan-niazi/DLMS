import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";

const REVISION_PREFIX = "dlms.cover.rev.";

export function isApiCoverUrl(uri: string): boolean {
  return uri.includes("/api/catalog/books/") && uri.includes("/cover-image");
}

export function extractCoverIsbn(uri: string): string | null {
  const match = uri.match(/\/api\/catalog\/books\/([^/?]+)\/cover-image/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

/** Force cover-image requests through the mobile API base URL (LAN IP vs localhost). */
export function normalizeCoverUrl(uri: string): string {
  if (!isApiCoverUrl(uri)) return uri;
  const isbn = extractCoverIsbn(uri);
  if (!isbn) return uri;
  return `${API_BASE_URL}/api/catalog/books/${encodeURIComponent(isbn)}/cover-image`;
}

function stableCoverPath(isbn: string): string {
  const safe = isbn.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${FileSystem.cacheDirectory}cover_${safe}.img`;
}

/** Instant cache hit for list views — any on-disk file counts. */
export async function peekCoverCache(uri: string): Promise<string | null> {
  if (!uri.trim()) return null;
  if (!isApiCoverUrl(uri)) return uri;

  const isbn = extractCoverIsbn(normalizeCoverUrl(uri));
  if (!isbn) return null;

  const dest = stableCoverPath(isbn);
  const info = await FileSystem.getInfoAsync(dest);
  return info.exists ? dest : null;
}

export async function invalidateCoverCache(isbn: string): Promise<void> {
  const dest = stableCoverPath(isbn);
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.removeItem(`${REVISION_PREFIX}${isbn}`);
  } catch {
    // ignore
  }
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
  const isbn = extractCoverIsbn(normalized);
  if (!isbn) return null;

  const dest = stableCoverPath(isbn);
  const revision = cacheKey !== undefined && cacheKey !== null ? String(cacheKey) : null;

  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) {
    if (!revision) {
      return dest;
    }
    const stored = await AsyncStorage.getItem(`${REVISION_PREFIX}${isbn}`);
    if (stored === revision) {
      return dest;
    }
  }

  const token = await user.getIdToken();
  const url = revision ? `${normalized}?v=${revision}` : normalized;

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status !== 200) {
    return info.exists ? dest : null;
  }

  if (revision) {
    await AsyncStorage.setItem(`${REVISION_PREFIX}${isbn}`, revision);
  }

  return dest;
}

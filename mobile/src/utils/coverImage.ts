import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";

const REVISION_PREFIX = "dlms.cover.rev.";

export function isApiCoverUrl(uri: string): boolean {
  return uri.includes("/cover-image") && (uri.includes("/api/catalog/books/") || uri.includes("/api/digital-books/"));
}

export function extractCoverCacheKey(uri: string): string | null {
  const catalog = uri.match(/\/api\/catalog\/books\/([^/?]+)\/cover-image/);
  if (catalog) return `cat_${decodeURIComponent(catalog[1])}`;
  const digital = uri.match(/\/api\/digital-books\/([^/?]+)\/cover-image/);
  if (digital) return `dig_${decodeURIComponent(digital[1])}`;
  return null;
}

/** @deprecated use extractCoverCacheKey */
export function extractCoverIsbn(uri: string): string | null {
  return extractCoverCacheKey(uri);
}

/** Force cover-image requests through the mobile API base URL (LAN IP vs localhost). */
export function normalizeCoverUrl(uri: string): string {
  if (!isApiCoverUrl(uri)) return uri;
  const key = extractCoverCacheKey(uri);
  if (!key) return uri;

  if (key.startsWith("cat_")) {
    const isbn = key.slice(4);
    return `${API_BASE_URL}/api/catalog/books/${encodeURIComponent(isbn)}/cover-image`;
  }
  const id = key.slice(4);
  return `${API_BASE_URL}/api/digital-books/${encodeURIComponent(id)}/cover-image`;
}

function stableCoverPath(cacheKey: string): string {
  const safe = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${FileSystem.cacheDirectory}cover_${safe}.img`;
}

/** Instant cache hit for list views — any on-disk file counts. */
export async function peekCoverCache(uri: string): Promise<string | null> {
  if (!uri.trim()) return null;
  if (!isApiCoverUrl(uri)) return uri;

  const cacheKey = extractCoverCacheKey(normalizeCoverUrl(uri));
  if (!cacheKey) return null;

  const dest = stableCoverPath(cacheKey);
  const info = await FileSystem.getInfoAsync(dest);
  return info.exists ? dest : null;
}

export async function invalidateCoverCache(idOrIsbn: string): Promise<void> {
  const keys = [`cat_${idOrIsbn}`, `dig_${idOrIsbn}`];
  for (const cacheKey of keys) {
    const dest = stableCoverPath(cacheKey);
    try {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    } catch {
      // ignore
    }
    try {
      await AsyncStorage.removeItem(`${REVISION_PREFIX}${cacheKey}`);
    } catch {
      // ignore
    }
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
  const storageKey = extractCoverCacheKey(normalized);
  if (!storageKey) return null;

  const dest = stableCoverPath(storageKey);
  const revision = cacheKey !== undefined && cacheKey !== null ? String(cacheKey) : null;

  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) {
    if (!revision) {
      return dest;
    }
    const stored = await AsyncStorage.getItem(`${REVISION_PREFIX}${storageKey}`);
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
    await AsyncStorage.setItem(`${REVISION_PREFIX}${storageKey}`, revision);
  }

  return dest;
}

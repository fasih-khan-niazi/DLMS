import type { PaginatedResponse } from "../types/pagination";

const TTL_MS = 90 * 1000;

type CacheEntry<T> = {
  data: PaginatedResponse<T>;
  fetchedAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function digitalCacheKey(params: Record<string, string | number | undefined>): string {
  const normalized = Object.keys(params)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      const value = params[key];
      if (value !== undefined && value !== "") acc[key] = String(value);
      return acc;
    }, {});
  return JSON.stringify(normalized);
}

export function getDigitalCache<T>(key: string): PaginatedResponse<T> | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setDigitalCache<T>(key: string, data: PaginatedResponse<T>): void {
  store.set(key, { data, fetchedAt: Date.now() });
}

export function invalidateDigitalCache(): void {
  store.clear();
}

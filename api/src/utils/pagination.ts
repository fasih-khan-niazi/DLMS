export type PaginatedResponse<T> = {
  results: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;
const MAX_LEGACY_LIMIT = 100;

/** Max documents loaded from Firestore before in-memory filter/sort/page. */
export const LIST_FETCH_CAP = 500;

export function parseListQuery(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const hasLegacyLimit = query.limit !== undefined && query.limit !== "";
  const hasPageSize = query.pageSize !== undefined && query.pageSize !== "";

  let pageSize = DEFAULT_PAGE_SIZE;
  if (hasPageSize) {
    pageSize = Number(query.pageSize) || DEFAULT_PAGE_SIZE;
    pageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  } else if (hasLegacyLimit) {
    pageSize = Number(query.limit) || DEFAULT_PAGE_SIZE;
    pageSize = Math.min(Math.max(1, pageSize), MAX_LEGACY_LIMIT);
  }

  return { page, pageSize };
}

export function paginateArray<T>(
  items: T[],
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    results: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

export function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const fn = (value as { toMillis?: () => number }).toMillis;
    if (typeof fn === "function") return fn.call(value);
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

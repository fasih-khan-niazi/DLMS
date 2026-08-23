import api from "../config/api";

const TTL_MS = 10 * 60 * 1000;
const FALLBACK_PAGE_SIZE = 10;

let memory: { catalogPageSize: number; fetchedAt: number } | null = null;

export async function getCatalogPageSize(): Promise<number> {
  if (memory && Date.now() - memory.fetchedAt < TTL_MS) {
    return memory.catalogPageSize;
  }

  try {
    const response = await api.get<{ catalogPageSize: number }>("/api/config/app");
    const size = Number(response.data.catalogPageSize) || FALLBACK_PAGE_SIZE;
    memory = { catalogPageSize: size, fetchedAt: Date.now() };
    return size;
  } catch {
    return memory?.catalogPageSize ?? FALLBACK_PAGE_SIZE;
  }
}

export function invalidateAppConfigCache(): void {
  memory = null;
}

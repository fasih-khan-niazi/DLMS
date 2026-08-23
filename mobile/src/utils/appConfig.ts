import api from "../config/api";

const TTL_MS = 2 * 60 * 1000;
const FALLBACK_PAGE_SIZE = 10;
const FALLBACK_MAX_PDF_MB = 25;

type AppConfig = {
  catalogPageSize: number;
  maxPdfSizeMb: number;
  fetchedAt: number;
};

let memory: AppConfig | null = null;

export async function getAppConfig(force = false): Promise<{ catalogPageSize: number; maxPdfSizeMb: number }> {
  if (!force && memory && Date.now() - memory.fetchedAt < TTL_MS) {
    return {
      catalogPageSize: memory.catalogPageSize,
      maxPdfSizeMb: memory.maxPdfSizeMb,
    };
  }

  try {
    const response = await api.get<{ catalogPageSize: number; maxPdfSizeMb?: number }>(
      "/api/config/app"
    );
    const catalogPageSize = Number(response.data.catalogPageSize) || FALLBACK_PAGE_SIZE;
    const maxPdfSizeMb = Number(response.data.maxPdfSizeMb) || FALLBACK_MAX_PDF_MB;
    memory = { catalogPageSize, maxPdfSizeMb, fetchedAt: Date.now() };
    return { catalogPageSize, maxPdfSizeMb };
  } catch {
    return {
      catalogPageSize: memory?.catalogPageSize ?? FALLBACK_PAGE_SIZE,
      maxPdfSizeMb: memory?.maxPdfSizeMb ?? FALLBACK_MAX_PDF_MB,
    };
  }
}

export async function getCatalogPageSize(): Promise<number> {
  const config = await getAppConfig();
  return config.catalogPageSize;
}

export async function getMaxPdfSizeMb(): Promise<number> {
  const config = await getAppConfig();
  return config.maxPdfSizeMb;
}

export function invalidateAppConfigCache(): void {
  memory = null;
}

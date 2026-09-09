import api from "../config/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// app settings ka cache (page size, PDF limit, borrow gates)
const STORAGE_KEY = "dlms.app.config";
const TTL_MS = 10 * 60 * 1000;
const FALLBACK_PAGE_SIZE = 10;
const FALLBACK_MAX_PDF_MB = 25;

type AppConfig = {
  catalogPageSize: number;
  maxPdfSizeMb: number;
  allowInAppCopyBorrow: boolean;
  librariansCanBorrow: boolean;
  fetchedAt: number;
};

let memory: AppConfig | null = null;
let hydratePromise: Promise<AppConfig | null> | null = null;

async function readStoredConfig(): Promise<AppConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppConfig;
    if (!parsed?.fetchedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeStoredConfig(config: AppConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
  }
}

// disk se config memory mein load karo - app start pe
export async function hydrateAppConfig(): Promise<AppConfig | null> {
  if (memory) return memory;
  if (!hydratePromise) {
    hydratePromise = readStoredConfig().then((stored) => {
      if (stored) memory = stored;
      return stored;
    });
  }
  return hydratePromise;
}

export async function getAppConfig(force = false): Promise<{
  catalogPageSize: number;
  maxPdfSizeMb: number;
  allowInAppCopyBorrow: boolean;
  librariansCanBorrow: boolean;
}> {
  if (!force) {
    await hydrateAppConfig();
    if (memory && Date.now() - memory.fetchedAt < TTL_MS) {
      return {
        catalogPageSize: memory.catalogPageSize,
        maxPdfSizeMb: memory.maxPdfSizeMb,
        allowInAppCopyBorrow: memory.allowInAppCopyBorrow,
        librariansCanBorrow: memory.librariansCanBorrow,
      };
    }
  }

  try {
    const response = await api.get<{
      catalogPageSize: number;
      maxPdfSizeMb?: number;
      allowInAppCopyBorrow?: boolean;
      librariansCanBorrow?: boolean;
    }>("/api/config/app", {
      headers: { "Cache-Control": "no-cache" },
      params: { _t: Date.now() },
    });
    const catalogPageSize = Number(response.data.catalogPageSize) || FALLBACK_PAGE_SIZE;
    const maxPdfSizeMb = Number(response.data.maxPdfSizeMb) || FALLBACK_MAX_PDF_MB;
    const allowInAppCopyBorrow = response.data.allowInAppCopyBorrow === true;
    const librariansCanBorrow = response.data.librariansCanBorrow !== false;
    memory = {
      catalogPageSize,
      maxPdfSizeMb,
      allowInAppCopyBorrow,
      librariansCanBorrow,
      fetchedAt: Date.now(),
    };
    await writeStoredConfig(memory);
    return {
      catalogPageSize,
      maxPdfSizeMb,
      allowInAppCopyBorrow,
      librariansCanBorrow,
    };
  } catch {
    // offline: last known values use karo, defaults se pehle
    const fallback = memory ?? (await readStoredConfig());
    if (fallback) memory = fallback;

    return {
      catalogPageSize: fallback?.catalogPageSize ?? FALLBACK_PAGE_SIZE,
      maxPdfSizeMb: fallback?.maxPdfSizeMb ?? FALLBACK_MAX_PDF_MB,
      allowInAppCopyBorrow: fallback?.allowInAppCopyBorrow ?? false,
      librariansCanBorrow: fallback?.librariansCanBorrow ?? true,
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

export async function getAllowInAppCopyBorrow(force = false): Promise<boolean> {
  const config = await getAppConfig(force);
  return config.allowInAppCopyBorrow;
}

export async function getLibrariansCanBorrow(force = false): Promise<boolean> {
  const config = await getAppConfig(force);
  return config.librariansCanBorrow;
}

// cached PDF size - network ke bina
export function peekMaxPdfSizeMb(): number | null {
  return memory?.maxPdfSizeMb ?? null;
}

export function peekAllowInAppCopyBorrow(): boolean | null {
  return memory?.allowInAppCopyBorrow ?? null;
}

export function peekLibrariansCanBorrow(): boolean | null {
  return memory?.librariansCanBorrow ?? null;
}

// memory clear - disk cache rehti hai cold start ke liye
export function invalidateAppConfigCache(): void {
  memory = null;
  hydratePromise = null;
}

import AsyncStorage from "@react-native-async-storage/async-storage";

const PHYSICAL_CATALOG_VIEW_KEY = "dlms.catalog.viewMode";
const DIGITAL_CATALOG_VIEW_KEY = "dlms.digitalCatalog.viewMode";

export type ViewMode = "list" | "grid";

export async function getPhysicalCatalogViewMode(): Promise<ViewMode> {
  try {
    const saved = await AsyncStorage.getItem(PHYSICAL_CATALOG_VIEW_KEY);
    return saved === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export async function setPhysicalCatalogViewMode(mode: ViewMode): Promise<void> {
  try {
    await AsyncStorage.setItem(PHYSICAL_CATALOG_VIEW_KEY, mode);
  } catch {
    // ignore
  }
}

export async function getDigitalCatalogViewMode(): Promise<ViewMode> {
  try {
    const saved = await AsyncStorage.getItem(DIGITAL_CATALOG_VIEW_KEY);
    return saved === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export async function setDigitalCatalogViewMode(mode: ViewMode): Promise<void> {
  try {
    await AsyncStorage.setItem(DIGITAL_CATALOG_VIEW_KEY, mode);
  } catch {
    // ignore
  }
}

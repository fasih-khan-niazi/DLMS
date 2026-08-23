/** Catalog hub segment ids and labels (keep in sync across navigation params). */
export type CatalogTab = "physicalCopies" | "digitalCopies";

export const CATALOG_TABS = {
  physicalCopies: {
    id: "physicalCopies" as const,
    label: "Physical Copies",
  },
  digitalCopies: {
    id: "digitalCopies" as const,
    label: "Digital Copies",
  },
} as const;

export const DEFAULT_CATALOG_TAB: CatalogTab = "physicalCopies";

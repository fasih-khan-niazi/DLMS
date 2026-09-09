// Catalog hub ke physical / digital tabs
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

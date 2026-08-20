export type UserRole = "student" | "librarian" | "admin";

export type CopyStatus = "available" | "issued" | "reserved" | "damaged";

export type AvailabilityLabel = "Available" | "Issued" | "Reserved" | "Unavailable";

export const APP_NAME = "DLMS";

export const COPY_STATUSES: CopyStatus[] = [
  "available",
  "issued",
  "reserved",
  "damaged",
];

export function buildQrPayload(copyId: string, isbn: string): string {
  return `${copyId}_${isbn}`;
}

export function parseQrPayload(payload: string): { copyId: string; isbn: string } | null {
  const separator = payload.lastIndexOf("_");
  if (separator <= 0 || separator === payload.length - 1) {
    return null;
  }

  return {
    copyId: payload.slice(0, separator),
    isbn: payload.slice(separator + 1),
  };
}

export function getAvailabilityLabel(input: {
  availableCount: number;
  issuedCount: number;
  reservedCount: number;
}): AvailabilityLabel {
  if (input.availableCount > 0) return "Available";
  if (input.reservedCount > 0) return "Reserved";
  if (input.issuedCount > 0) return "Issued";
  return "Unavailable";
}

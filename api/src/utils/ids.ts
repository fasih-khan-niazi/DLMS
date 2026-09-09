import { randomBytes } from "crypto";

// Random ID banata hai - prefix_ + hex
export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

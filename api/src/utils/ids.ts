import { randomBytes } from "crypto";

export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

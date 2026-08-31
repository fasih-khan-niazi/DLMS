function copyTime(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const fn = (value as { toMillis?: () => number }).toMillis;
    if (typeof fn === "function") return fn.call(value);
  }
  return 0;
}

/** Stable Copy 1, Copy 2, … order for labels (createdAt, then copyId). */
export function sortCopies<T extends { copyId?: string; createdAt?: unknown }>(copies: T[]): T[] {
  return [...copies].sort((a, b) => {
    const at = copyTime(a.createdAt);
    const bt = copyTime(b.createdAt);
    if (at !== bt) return at - bt;
    return String(a.copyId || "").localeCompare(String(b.copyId || ""));
  });
}

export function copyNumberMap(
  copies: Array<{ copyId?: string; createdAt?: unknown }>
): Map<string, number> {
  const map = new Map<string, number>();
  sortCopies(copies).forEach((copy, index) => {
    if (copy.copyId) map.set(String(copy.copyId), index + 1);
  });
  return map;
}

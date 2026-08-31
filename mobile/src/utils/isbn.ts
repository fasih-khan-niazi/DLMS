export function looksLikeIsbn(value: string): boolean {
  const digits = value.replace(/[-\s]/g, "");
  return /^\d{10}(\d{3})?$/.test(digits) || /^\d{13}$/.test(digits);
}

export function formatIsbn(isbn: string): string {
  const clean = isbn.replace(/[^0-9X]/gi, "").toUpperCase();
  if (clean.length === 13) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 4)}-${clean.slice(4, 7)}-${clean.slice(7, 12)}-${clean.slice(12)}`;
  }
  if (clean.length === 10) {
    return `${clean.slice(0, 1)}-${clean.slice(1, 6)}-${clean.slice(6, 9)}-${clean.slice(9)}`;
  }
  return isbn;
}

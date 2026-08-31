/** Case-insensitive substring match across title, authors, ISBN, and keywords. */
export function matchesTextQuery(
  fields: {
    title?: string;
    authors?: string[];
    author?: string;
    isbn?: string;
    searchKeywords?: string[];
  },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    fields.title || "",
    ...(fields.authors || []),
    fields.author || "",
    fields.isbn || "",
    ...(fields.searchKeywords || []),
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes(q)) return true;

  const tokens = q
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

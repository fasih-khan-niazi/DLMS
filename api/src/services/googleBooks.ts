import axios from "axios";

export interface BookMetadata {
  isbn: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedDate: string;
  description: string;
  thumbnailUrl: string;
  categories: string[];
  source: "google_books" | "manual";
}

function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "").toUpperCase();
}

export async function fetchBookByIsbn(isbn: string): Promise<BookMetadata | null> {
  const cleanedIsbn = normalizeIsbn(isbn);
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_BOOKS_API_KEY is not configured");
  }

  const url = "https://www.googleapis.com/books/v1/volumes";
  const response = await axios.get(url, {
    params: {
      q: `isbn:${cleanedIsbn}`,
      key: apiKey,
    },
    timeout: 10000,
  });

  const item = response.data?.items?.[0];
  if (!item) {
    return null;
  }

  const info = item.volumeInfo || {};

  return {
    isbn: cleanedIsbn,
    title: info.title || "Untitled",
    authors: Array.isArray(info.authors) ? info.authors : [],
    publisher: info.publisher || "",
    publishedDate: info.publishedDate || "",
    description: info.description || "",
    thumbnailUrl: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "",
    categories: Array.isArray(info.categories) ? info.categories : [],
    source: "google_books",
  };
}

export function buildSearchKeywords(input: {
  title: string;
  authors: string[];
  isbn: string;
  categories?: string[];
}): string[] {
  const raw = [
    input.title,
    ...input.authors,
    input.isbn,
    ...(input.categories || []),
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const expanded = new Set<string>(raw);
  for (const word of raw) {
    // Prefixes so "mock" can hit "mockingbird" on keyword index too
    if (word.length >= 4) {
      for (let i = 3; i < word.length; i += 1) {
        expanded.add(word.slice(0, i));
      }
    }
  }

  return Array.from(expanded);
}

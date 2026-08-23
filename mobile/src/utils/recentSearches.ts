import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "dlms.recentSearches";
const MAX = 8;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function addRecentSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) return;
  const existing = await getRecentSearches();
  const next = [trimmed, ...existing.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX
  );
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

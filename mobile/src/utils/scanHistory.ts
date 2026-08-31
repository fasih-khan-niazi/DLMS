import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "dlms.scanHistory";
const MAX = 5;

export type ScanHistoryEntry = {
  title: string;
  copyLabel: string;
  mode: "borrow" | "return";
  at: number;
};

export async function getScanHistory(): Promise<ScanHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScanHistoryEntry[];
  } catch {
    return [];
  }
}

export async function pushScanHistory(entry: Omit<ScanHistoryEntry, "at">): Promise<void> {
  const current = await getScanHistory();
  const next: ScanHistoryEntry[] = [{ ...entry, at: Date.now() }, ...current].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

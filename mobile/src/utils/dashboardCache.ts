import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "dlms.dashboard";
const TTL_MS = 2 * 60 * 1000;

export type DashboardSnapshot = {
  activeLoans: number;
  overdueLoans: number;
  readyReservations: number;
  waitingReservations?: number;
  outstandingFines: number;
  nextDueLabel?: string;
  nextDueOverdue?: boolean;
  readyTitle?: string;
  continueReading: Array<{
    digitalBookId: string;
    title: string;
    author?: string;
    progress: number;
    lastPage?: number;
    totalPages?: number;
    thumbnailUrl?: string;
  }>;
  fetchedAt: number;
};

export async function getDashboardCache(): Promise<DashboardSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardSnapshot;
    if (!parsed.fetchedAt || Date.now() - parsed.fetchedAt > TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setDashboardCache(data: DashboardSnapshot): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

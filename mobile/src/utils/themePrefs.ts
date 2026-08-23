import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "dlms.theme.mode";

export type ThemeMode = "light" | "dark";

export async function getStoredThemeMode(): Promise<ThemeMode> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export async function setStoredThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}

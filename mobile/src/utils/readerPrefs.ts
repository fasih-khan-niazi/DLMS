import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReaderMode } from "./pdfViewerHtml";

const KEY = "dlms.reader.prefs";

export type ReaderPrefs = {
  readMode: ReaderMode;
  orientation: "portrait" | "landscape";
};

const DEFAULTS: ReaderPrefs = {
  readMode: "scroll",
  orientation: "portrait",
};

export async function getReaderPrefs(): Promise<ReaderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    return {
      readMode: parsed.readMode === "page" ? "page" : "scroll",
      orientation: parsed.orientation === "landscape" ? "landscape" : "portrait",
    };
  } catch {
    return DEFAULTS;
  }
}

export async function setReaderPrefs(prefs: ReaderPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}

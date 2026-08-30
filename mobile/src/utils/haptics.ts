import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoHaptics from "expo-haptics";

const KEY = "dlms.hapticsEnabled";

let enabled = true;
const listeners = new Set<(value: boolean) => void>();

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

export function getHapticsEnabled() {
  return enabled;
}

export function subscribeHaptics(listener: (value: boolean) => void) {
  listeners.add(listener);
  listener(enabled);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadHapticsPreference() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === "0") enabled = false;
    if (raw === "1") enabled = true;
  } catch {
    // keep default
  }
  listeners.forEach((fn) => fn(enabled));
  return enabled;
}

export async function setHapticsEnabled(next: boolean) {
  enabled = next;
  try {
    await AsyncStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // still apply in-memory
  }
  listeners.forEach((fn) => fn(enabled));
}

export async function impactAsync(style?: ExpoHaptics.ImpactFeedbackStyle) {
  if (!enabled) return;
  return ExpoHaptics.impactAsync(style ?? ExpoHaptics.ImpactFeedbackStyle.Light);
}

export async function selectionAsync() {
  if (!enabled) return;
  return ExpoHaptics.selectionAsync();
}

export async function notificationAsync(type: ExpoHaptics.NotificationFeedbackType) {
  if (!enabled) return;
  return ExpoHaptics.notificationAsync(type);
}

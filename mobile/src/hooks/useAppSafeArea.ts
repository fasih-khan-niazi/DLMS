import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Safe-area insets with an Android fallback.
 * On Expo SDK 57 / RN 0.86 edge-to-edge builds, insets.top can report 0
 * even though content draws under the status bar.
 */
export function useAppSafeArea() {
  const insets = useSafeAreaInsets();
  const androidTop = StatusBar.currentHeight ?? 0;
  const top =
    Platform.OS === "android" ? Math.max(insets.top, androidTop) : insets.top;

  return {
    top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };
}

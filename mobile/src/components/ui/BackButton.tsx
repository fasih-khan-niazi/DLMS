import React from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { PressableScale } from "./PressableScale";

type Props = {
  onPress: () => void;
  /** Use on dark overlays (e.g. scan camera). */
  light?: boolean;
  style?: ViewStyle;
  size?: number;
};

/** Shared icon-only back control. Use everywhere instead of "← Back" text. */
export function BackButton({ onPress, light = false, style, size = 24 }: Props) {
  const { colors } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={[styles.btn, style]}
    >
      <Ionicons
        name="chevron-back"
        size={size}
        color={light ? "#FFFFFF" : colors.navy}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});

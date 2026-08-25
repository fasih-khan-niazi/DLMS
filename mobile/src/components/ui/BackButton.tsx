import React from "react";
import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";

type Props = {
  onPress: () => void;
  /** Use on dark overlays (e.g. scan camera). */
  light?: boolean;
  style?: ViewStyle;
  size?: number;
};

/** Shared icon-only back control — use everywhere instead of "← Back" text. */
export function BackButton({ onPress, light = false, style, size = 24 }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [
        styles.btn,
        { opacity: pressed ? 0.65 : 1 },
        style,
      ]}
    >
      <Ionicons
        name="chevron-back"
        size={size}
        color={light ? "#FFFFFF" : colors.navy}
      />
    </Pressable>
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

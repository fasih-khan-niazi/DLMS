import React from "react";
import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import * as Haptics from "../../utils/haptics";
import { useTheme } from "../../theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected = false, onPress, style }: Props) {
  const { colors, radius, fontFamily, type, mode } = useTheme();
  const isDark = mode === "dark";
  const selectedBg = isDark ? colors.amber : colors.navy;
  const selectedText = isDark ? "#1A2834" : "#FFFFFF";
  const glow = isDark ? colors.amber : colors.navy;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? selectedBg : colors.white,
          borderColor: selected ? selectedBg : colors.border,
          borderRadius: radius.pill,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          shadowColor: glow,
          shadowOpacity: pressed ? 0.28 : 0,
          shadowRadius: pressed ? 8 : 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: pressed ? 4 : 0,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: selected ? selectedText : colors.navy,
          fontSize: type.small,
          fontFamily: fontFamily.bodySemiBold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
});

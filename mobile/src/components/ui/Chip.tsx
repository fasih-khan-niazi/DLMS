import React from "react";
import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { useTheme } from "../../theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected = false, onPress, style }: Props) {
  const { colors, radius, fontFamily, type } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? colors.navy : colors.white,
          borderColor: selected ? colors.navy : colors.border,
          borderRadius: radius.pill,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: selected ? colors.white : colors.navy,
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

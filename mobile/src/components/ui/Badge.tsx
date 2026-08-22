import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../../theme";

type Tone = "default" | "success" | "warning" | "danger" | "muted";

type Props = {
  label: string;
  tone?: Tone;
  style?: ViewStyle;
};

export function Badge({ label, tone = "default", style }: Props) {
  const { colors, radius, fontFamily, type } = useTheme();

  const tones: Record<Tone, { bg: string; fg: string }> = {
    default: { bg: colors.overlay, fg: colors.navy },
    success: { bg: "#E8F5EC", fg: colors.success },
    warning: { bg: "#FEF3C7", fg: colors.warning },
    danger: { bg: "#FEE4E2", fg: colors.danger },
    muted: { bg: colors.creamDark, fg: colors.muted },
  };
  const t = tones[tone];

  return (
    <View style={[styles.base, { backgroundColor: t.bg, borderRadius: radius.pill }, style]}>
      <Text style={{ color: t.fg, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
});

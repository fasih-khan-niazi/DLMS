import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "ghostOutline"
  | "danger"
  | "dangerSoft"
  | "successSoft"
  | "amber"
  | "softOutline";

type Props = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  textStyle?: TextStyle;
  style?: ViewStyle;
};

const OUTLINE_VARIANTS = new Set<Variant>(["softOutline", "ghostOutline", "ghost"]);

export function Button({
  title,
  variant = "primary",
  loading = false,
  fullWidth = true,
  disabled,
  textStyle,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const { colors, radius, fontFamily, type, mode } = useTheme();
  const isDisabled = disabled || loading;
  const isDark = mode === "dark";
  const isOutline = OUTLINE_VARIANTS.has(variant);

  const palette: Record<Variant, { bg: string; text: string; border?: string; glow?: string }> = {
    primary: isDark
      ? { bg: colors.amber, text: "#1A2834", glow: colors.amber }
      : { bg: colors.navy, text: "#FFFFFF", glow: colors.navy },
    secondary: isDark
      ? { bg: colors.creamDark, text: colors.navy, border: colors.navyDark, glow: colors.navy }
      : { bg: colors.white, text: colors.navy, border: colors.border, glow: colors.navy },
    ghost: { bg: "transparent", text: colors.navy },
    ghostOutline: isDark
      ? { bg: "transparent", text: colors.muted, border: colors.border, glow: colors.amber }
      : { bg: "transparent", text: colors.navy, border: colors.border, glow: colors.navy },
    danger: { bg: colors.danger, text: "#FFFFFF", glow: colors.danger },
    dangerSoft: isDark
      ? { bg: "#3A2424", text: colors.danger, border: "#5C3030", glow: colors.danger }
      : { bg: "#FEE4E2", text: colors.danger, border: "#FECACA", glow: colors.danger },
    successSoft: isDark
      ? { bg: "#1F3A2A", text: colors.success, border: "#2F5A40", glow: colors.success }
      : { bg: "#E8F5EC", text: colors.success, border: "#BBF7D0", glow: colors.success },
    amber: { bg: colors.amber, text: isDark ? "#1A2834" : colors.navy, glow: colors.amber },
    softOutline: isDark
      ? { bg: "transparent", text: colors.amber, border: "rgba(232, 168, 56, 0.65)", glow: colors.amber }
      : { bg: "transparent", text: colors.navy, border: colors.amber, glow: colors.amber },
  };
  const p = palette[variant];

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      onPressIn={(event) => {
        if (!isDisabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPressIn?.(event);
      }}
      onPressOut={onPressOut}
      style={({ pressed }) => {
        const active = pressed && !isDisabled;
        return [
          {
            backgroundColor: p.bg,
            borderRadius: radius.md,
            borderColor: p.border || "transparent",
            borderWidth: p.border ? 1.5 : 0,
            opacity: isDisabled ? 0.65 : active ? 0.88 : 1,
            alignSelf: fullWidth ? "stretch" : "flex-start",
            paddingVertical: 16,
            paddingHorizontal: 20,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 52,
            transform: [{ scale: active ? 0.97 : 1 }],
            // Outline buttons: no resting halo (that looked like a nested box).
            // Filled buttons: soft glow only while pressed.
            shadowColor: p.glow || p.bg,
            shadowOpacity: isOutline ? 0 : active ? 0.32 : 0,
            shadowRadius: isOutline ? 0 : active ? 12 : 0,
            shadowOffset: { width: 0, height: 0 },
            elevation: isOutline ? 0 : active ? 6 : 0,
          },
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={p.text} />
      ) : (
        <Text
          style={[
            {
              color: p.text,
              fontSize: type.body,
              fontFamily: fontFamily.bodyBold,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

import React, { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  ActivityIndicator,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerSoft" | "successSoft" | "amber";

type Props = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  textStyle?: TextStyle;
  style?: ViewStyle;
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  fullWidth = true,
  disabled,
  textStyle,
  style,
  ...rest
}: Props) {
  const { colors, radius, fontFamily, type, mode } = useTheme();
  const isDisabled = disabled || loading;
  const isDark = mode === "dark";

  const palette: Record<Variant, { bg: string; text: string; border?: string }> = {
    primary: isDark
      ? { bg: colors.amber, text: "#1A2834" }
      : { bg: colors.navy, text: "#FFFFFF" },
    secondary: { bg: colors.white, text: colors.navy, border: colors.border },
    ghost: { bg: "transparent", text: colors.navy },
    danger: { bg: colors.danger, text: "#FFFFFF" },
    dangerSoft: isDark
      ? { bg: "#3A2424", text: colors.danger, border: "#5C3030" }
      : { bg: "#FEE4E2", text: colors.danger, border: "#FECACA" },
    successSoft: isDark
      ? { bg: "#1F3A2A", text: colors.success, border: "#2F5A40" }
      : { bg: "#E8F5EC", text: colors.success, border: "#BBF7D0" },
    amber: { bg: colors.amber, text: isDark ? "#1A2834" : colors.navy },
  };
  const p = palette[variant];

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: p.bg,
          borderRadius: radius.md,
          borderColor: p.border || "transparent",
          borderWidth: p.border ? 1 : 0,
          opacity: isDisabled ? 0.65 : pressed ? 0.88 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
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

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
});

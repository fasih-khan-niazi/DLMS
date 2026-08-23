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

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerSoft" | "amber";

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
  const { colors, radius, fontFamily, type } = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<Variant, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.navy, text: colors.white },
    secondary: { bg: colors.white, text: colors.navy, border: colors.border },
    ghost: { bg: "transparent", text: colors.navy },
    danger: { bg: colors.danger, text: colors.white },
    dangerSoft: { bg: "#FEE4E2", text: colors.danger, border: "#FECACA" },
    amber: { bg: colors.amber, text: colors.navy },
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

import React, { type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "../../utils/haptics";
import { useTheme } from "../../theme";

type Props = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: "light" | "selection" | "none";
  /** Opacity dip only — no glow, no haptic. Use on dense menu rows. */
  quiet?: boolean;
};

/** Shared tap: light haptic, slight scale, theme-aware glow. Use on cards and chips. */
export function PressableScale({
  children,
  style,
  disabled,
  onPressIn,
  haptic = "light",
  quiet = false,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const hapticKind = quiet ? "none" : haptic;

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled) {
          if (hapticKind === "selection") {
            void Haptics.selectionAsync().catch(() => {});
          } else if (hapticKind === "light") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
        onPressIn?.(event);
      }}
      style={({ pressed }) => {
        const active = pressed && !disabled;
        return [
          {
            opacity: disabled ? 0.65 : active ? (quiet ? 0.55 : 0.9) : 1,
            transform: [{ scale: active && !quiet ? 0.98 : 1 }],
            shadowColor: colors.navy,
            shadowOpacity: quiet || !active ? 0 : 0.18,
            shadowRadius: quiet || !active ? 0 : 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: quiet || !active ? 0 : 3,
          },
          style,
        ];
      }}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

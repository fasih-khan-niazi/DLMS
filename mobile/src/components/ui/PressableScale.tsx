import React, { type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";

type Props = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: "light" | "selection";
};

/** Shared tap: light haptic, slight scale, theme-aware glow. Use on cards and chips. */
export function PressableScale({
  children,
  style,
  disabled,
  onPressIn,
  haptic = "light",
  ...rest
}: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled) {
          if (haptic === "selection") {
            void Haptics.selectionAsync().catch(() => {});
          } else {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
        onPressIn?.(event);
      }}
      style={({ pressed }) => {
        const active = pressed && !disabled;
        return [
          {
            opacity: disabled ? 0.65 : active ? 0.9 : 1,
            transform: [{ scale: active ? 0.98 : 1 }],
            shadowColor: colors.navy,
            shadowOpacity: active ? 0.18 : 0,
            shadowRadius: active ? 8 : 0,
            shadowOffset: { width: 0, height: 0 },
            elevation: active ? 3 : 0,
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

import React, { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useTheme } from "../../theme";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
};

export function Card({ children, style, padded = true }: Props) {
  const { colors, radius, shadows, space } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.white,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: padded ? space.md : 0,
        },
        shadows.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

import React, { useState } from "react";
import { Image, StyleSheet, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";

type Props = {
  uri?: string | null;
  width?: number;
  height?: number;
  style?: ViewStyle;
};

export function BookCover({ uri, width = 72, height = 108, style }: Props) {
  const { colors, radius } = useTheme();
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;

  return (
    <View
      style={[
        styles.frame,
        {
          width,
          height,
          borderRadius: radius.sm,
          backgroundColor: colors.bookPlaceholderBg,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width, height, borderRadius: radius.sm }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name="book-outline" size={Math.min(width, height) * 0.38} color={colors.bookPlaceholderIcon} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
});

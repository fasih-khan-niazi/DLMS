import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";

type Props = {
  uri?: string | null;
  width?: number;
  height?: number;
  style?: ViewStyle;
  /** Bumps when the cover changes so cached images reload. */
  cacheKey?: string | number;
};

export function BookCover({ uri, width = 72, height = 108, style, cacheKey }: Props) {
  const { colors, radius } = useTheme();
  const [failed, setFailed] = useState(false);
  const displayUri =
    uri && cacheKey !== undefined && cacheKey !== null
      ? `${uri}${uri.includes("?") ? "&" : "?"}v=${cacheKey}`
      : uri;
  const showImage = !!displayUri && !failed;

  useEffect(() => {
    setFailed(false);
  }, [uri, cacheKey]);

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
          source={{ uri: displayUri }}
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

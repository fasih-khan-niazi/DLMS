import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isApiCoverUrl, peekCoverCache, resolveCoverDisplayUri } from "../../utils/coverImage";
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
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    if (!uri) {
      setDisplayUri(null);
      setLoading(false);
      return;
    }

    void (async () => {
      if (isApiCoverUrl(uri)) {
        const instant = await peekCoverCache(uri);
        if (!cancelled && instant) {
          setDisplayUri(instant);
          setLoading(false);
        } else if (!cancelled) {
          setLoading(true);
        }
      } else {
        const busted =
          cacheKey !== undefined && cacheKey !== null
            ? `${uri}${uri.includes("?") ? "&" : "?"}v=${cacheKey}`
            : uri;
        if (!cancelled) {
          setDisplayUri(busted);
          setLoading(false);
        }
        return;
      }

      const resolved = await resolveCoverDisplayUri(uri, cacheKey);
      if (cancelled) return;
      setDisplayUri(resolved);
      setFailed(!resolved);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [uri, cacheKey]);

  const showImage = !!displayUri && !failed;
  // Prefer branded placeholder over a spinner so catalog stays calm while covers fetch.
  const showSpinner = false;

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
      {showSpinner ? (
        <ActivityIndicator size="small" color={colors.navy} />
      ) : showImage ? (
        <Image
          source={{ uri: displayUri }}
          style={{ width, height, borderRadius: radius.sm }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons
          name="book-outline"
          size={Math.min(width, height) * 0.38}
          color={colors.bookPlaceholderIcon}
        />
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

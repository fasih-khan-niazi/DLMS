import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "../theme";

type Props = {
  height?: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
  borderRadius?: number;
};

export function Skeleton({
  height = 16,
  width = "100%",
  style,
  borderRadius,
}: Props) {
  const { colors, radius, mode } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;
  const isDark = mode === "dark";

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: isDark ? 0.75 : 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: isDark ? 0.3 : 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, isDark]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: isDark ? colors.border : colors.creamDark,
          height,
          width,
          borderRadius: borderRadius ?? radius.md,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const { colors, radius } = useTheme();
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.row,
            {
              backgroundColor: colors.white,
              borderColor: colors.border,
              borderRadius: radius.lg,
            },
          ]}
        >
          <Skeleton height={18} width="72%" />
          <Skeleton height={12} width="48%" style={{ marginTop: 10 }} />
          <Skeleton height={12} width="36%" style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

/** Matches physical / digital book detail layout while loading. */
export function BookDetailSkeleton() {
  const { colors, radius } = useTheme();
  return (
    <View style={styles.bookDetail}>
      <Skeleton height={28} width={40} borderRadius={20} style={{ marginBottom: 16 }} />
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Skeleton height={220} width={150} borderRadius={12} />
      </View>
      <Skeleton height={26} width="78%" style={{ alignSelf: "center" }} />
      <Skeleton height={14} width="42%" style={{ alignSelf: "center", marginTop: 10 }} />
      <Skeleton height={12} width="28%" style={{ alignSelf: "center", marginTop: 8 }} />
      <Skeleton height={52} width="100%" style={{ marginTop: 20 }} />
      <Skeleton height={52} width="100%" style={{ marginTop: 10 }} />
      <View
        style={[
          styles.row,
          {
            backgroundColor: colors.white,
            borderColor: colors.border,
            borderRadius: radius.lg,
            marginTop: 20,
          },
        ]}
      >
        <Skeleton height={14} width="30%" />
        <Skeleton height={72} width="100%" style={{ marginTop: 12 }} />
      </View>
      <View
        style={[
          styles.row,
          {
            backgroundColor: colors.white,
            borderColor: colors.border,
            borderRadius: radius.lg,
            marginTop: 12,
          },
        ]}
      >
        <Skeleton height={14} width="40%" />
        <Skeleton height={96} width="100%" style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    marginTop: 8,
  },
  row: {
    padding: 16,
    borderWidth: 1,
  },
  bookDetail: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
});

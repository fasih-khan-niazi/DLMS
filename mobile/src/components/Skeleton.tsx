import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radius } from "../theme";

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
  borderRadius = radius.md,
}: Props) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { height, width, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
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
      <View style={[styles.row, { marginTop: 20 }]}>
        <Skeleton height={14} width="30%" />
        <Skeleton height={72} width="100%" style={{ marginTop: 12 }} />
      </View>
      <View style={[styles.row, { marginTop: 12 }]}>
        <Skeleton height={14} width="40%" />
        <Skeleton height={96} width="100%" style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.creamDark,
  },
  list: {
    gap: 12,
    marginTop: 8,
  },
  row: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookDetail: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
});

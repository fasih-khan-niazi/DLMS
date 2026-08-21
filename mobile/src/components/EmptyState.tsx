import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, radius, space, type } from "../theme";

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
    textAlign: "center",
  },
  message: {
    marginTop: space.sm,
    fontSize: type.small,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  btn: {
    marginTop: space.md,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
  },
  btnText: {
    color: colors.white,
    fontWeight: "700",
  },
});

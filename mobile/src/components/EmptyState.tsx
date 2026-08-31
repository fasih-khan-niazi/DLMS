import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "./ui/Button";
import { useTheme } from "../theme";

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  const { colors, fontFamily, space, type } = useTheme();

  return (
    <View style={[styles.wrap, { paddingVertical: space.xxl, paddingHorizontal: space.lg }]}>
      <Text
        style={{
          fontFamily: fontFamily.bodyBold,
          fontSize: type.body,
          color: colors.navy,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: space.sm,
          fontFamily: fontFamily.body,
          fontSize: type.small,
          color: colors.muted,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          style={{ marginTop: space.md, alignSelf: "stretch" }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
});

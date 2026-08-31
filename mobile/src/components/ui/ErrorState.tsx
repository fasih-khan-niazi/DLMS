import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../theme";
import { Button } from "./Button";

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  message = "Check your connection and try again.",
  onRetry,
}: Props) {
  const { colors, fontFamily, type, space } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text
        style={{
          fontFamily: fontFamily.bodyBold,
          fontSize: type.titleSm,
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
          fontSize: type.body,
          color: colors.muted,
          textAlign: "center",
          lineHeight: 22,
        }}
      >
        {message}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: space.lg, width: "100%" }}>
          <Button title="Try again" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 24,
    alignItems: "center",
  },
});

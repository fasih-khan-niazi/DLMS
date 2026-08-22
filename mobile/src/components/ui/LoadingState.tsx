import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../theme";

type Props = {
  message?: string;
};

export function LoadingState({ message = "Loading..." }: Props) {
  const { colors, fontFamily, type, space } = useTheme();

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.navy} />
      <Text
        style={{
          marginTop: space.md,
          color: colors.muted,
          fontFamily: fontFamily.body,
          fontSize: type.body,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});

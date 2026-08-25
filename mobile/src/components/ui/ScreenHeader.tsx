import React, { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../theme";
import { BackButton } from "./BackButton";

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: Props) {
  const { colors, fontFamily, type, space } = useTheme();

  return (
    <View style={[styles.row, { marginBottom: space.md }]}>
      {onBack ? (
        <BackButton onPress={onBack} style={styles.back} />
      ) : (
        <View style={styles.backSpacer} />
      )}
      <View style={styles.center}>
        <Text
          style={{
            fontFamily: fontFamily.display,
            fontSize: type.titleSm,
            color: colors.navy,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: 2,
              fontFamily: fontFamily.body,
              fontSize: type.small,
              color: colors.muted,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  back: {
    width: 36,
    marginLeft: -6,
  },
  backSpacer: {
    width: 36,
  },
  center: {
    flex: 1,
  },
  right: {
    minWidth: 36,
    alignItems: "flex-end",
  },
});

import React from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../../theme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, ...rest }: Props) {
  const { colors, radius, space, fontFamily, type } = useTheme();

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text
          style={{
            fontFamily: fontFamily.bodySemiBold,
            fontSize: type.small,
            color: colors.navy,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[
          {
            backgroundColor: colors.white,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: 14,
            fontSize: type.body,
            fontFamily: fontFamily.body,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            color: colors.text,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={{ color: colors.danger, fontSize: type.caption, marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
});

import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../../theme";

type Props = TextInputProps & {
  onSubmit?: () => void;
};

export function SearchInput({ onSubmit, style, ...rest }: Props) {
  const { colors, radius, space, fontFamily, type } = useTheme();

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.white,
          borderRadius: radius.md,
          borderColor: colors.border,
          paddingHorizontal: space.sm,
        },
      ]}
    >
      <Ionicons name="search" size={20} color={colors.muted} />
      <TextInput
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={[
          {
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: space.sm,
            fontSize: type.body,
            fontFamily: fontFamily.body,
            color: colors.text,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
});

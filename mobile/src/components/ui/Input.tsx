import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  /** Shows an eye toggle and manages secure entry when true. */
  passwordToggle?: boolean;
};

export function Input({ label, error, style, passwordToggle, secureTextEntry, ...rest }: Props) {
  const { colors, radius, space, fontFamily, type } = useTheme();
  const [hidden, setHidden] = useState(true);
  const isSecure = passwordToggle ? hidden : !!secureTextEntry;

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
      <View style={{ position: "relative" }}>
        <TextInput
          placeholderTextColor={colors.muted}
          secureTextEntry={isSecure}
          style={[
            {
              backgroundColor: colors.white,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              paddingVertical: 14,
              paddingRight: passwordToggle ? 48 : space.md,
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
        {passwordToggle ? (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            hitSlop={10}
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            style={styles.eye}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={22}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
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
  eye: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});

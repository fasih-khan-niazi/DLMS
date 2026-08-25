import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { Card } from "./Card";

type Props = {
  brandLine: string;
  panelTitle: string;
  panelHint?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Shared auth shell: navy hero + cream card */
export function AuthLayout({
  brandLine,
  panelTitle,
  panelHint,
  children,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, fontFamily, type, space, radius } = useTheme();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.navy }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + space.xl,
            paddingBottom: insets.bottom + space.xl + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.hero}>
          <Text
            style={{
              fontFamily: fontFamily.display,
              fontSize: type.brand,
              color: colors.white,
              letterSpacing: 0.5,
            }}
          >
            DLMS
          </Text>
          <View
            style={{
              marginTop: space.sm,
              width: 36,
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.amber,
            }}
          />
          <Text
            style={{
              marginTop: space.md,
              fontFamily: fontFamily.body,
              fontSize: type.subtitle,
              color: colors.heroText,
              lineHeight: 22,
            }}
          >
            {brandLine}
          </Text>
        </View>

        <Card
          style={{
            backgroundColor: colors.cream,
            borderRadius: radius.lg,
            borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.display,
              fontSize: type.titleSm,
              color: colors.navy,
            }}
          >
            {panelTitle}
          </Text>
          {panelHint ? (
            <Text
              style={{
                marginTop: 4,
                marginBottom: space.md,
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
                lineHeight: 20,
              }}
            >
              {panelHint}
            </Text>
          ) : (
            <View style={{ height: space.sm }} />
          )}
          {children}
        </Card>

        {footer ? <View style={{ marginTop: space.md }}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthLink({
  label,
  onPress,
  onDark = false,
}: {
  label: string;
  onPress: () => void;
  /** Use on navy auth background (footer links). */
  onDark?: boolean;
}) {
  const { colors, fontFamily, type, space } = useTheme();

  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ marginTop: space.md }}>
      <Text
        style={{
          textAlign: "center",
          color: onDark ? "#F8F7F4" : colors.navy,
          fontFamily: fontFamily.bodySemiBold,
          fontSize: type.small,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  hero: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
});

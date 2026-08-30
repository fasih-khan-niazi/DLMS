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
  const { colors, fontFamily, type, space, radius, mode } = useTheme();
  const isDark = mode === "dark";
  const heroBg = isDark ? colors.creamDark : "#2E4A62";
  const cardBg = isDark ? colors.cream : colors.cream;
  const cardTitleColor = isDark ? colors.navy : "#2E4A62";
  const heroTextColor = isDark ? "rgba(255, 255, 255, 0.78)" : colors.heroText;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: heroBg }]}
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
              color: "#FFFFFF",
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
              color: heroTextColor,
              lineHeight: 22,
            }}
          >
            {brandLine}
          </Text>
        </View>

        <Card
          style={{
            backgroundColor: cardBg,
            borderRadius: radius.lg,
            borderColor: isDark ? colors.border : "rgba(255,255,255,0.12)",
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.display,
              fontSize: type.titleSm,
              color: cardTitleColor,
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
  const { colors, fontFamily, type, space, mode } = useTheme();
  const isDark = mode === "dark";

  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ marginTop: space.md }}>
      <Text
        style={{
          textAlign: "center",
          color: onDark ? (isDark ? colors.navy : "#F8F7F4") : colors.navy,
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

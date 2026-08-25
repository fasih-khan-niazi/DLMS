import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  keyboard?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({
  children,
  scroll = false,
  keyboard = false,
  style,
  contentStyle,
  refreshing = false,
  onRefresh,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const padding = {
    paddingTop: insets.top + 12,
    paddingBottom: insets.bottom + 16,
    paddingHorizontal: 20,
  };

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padding, contentStyle]}>{children}</View>
  );

  const content = (
    <View style={[styles.fill, { backgroundColor: colors.cream }, style]}>{body}</View>
  );

  if (keyboard) {
    return (
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./ui/Button";
import { useTheme } from "../theme";

export type AppModalVariant = "success" | "error" | "info";

type Props = {
  visible: boolean;
  variant?: AppModalVariant;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
};

const ICONS: Record<AppModalVariant, { name: keyof typeof Ionicons.glyphMap; colorKey: "success" | "danger" | "navy" }> = {
  success: { name: "checkmark-circle", colorKey: "success" },
  error: { name: "close-circle", colorKey: "danger" },
  info: { name: "information-circle", colorKey: "navy" },
};

export function AppModal({
  visible,
  variant = "info",
  title,
  message,
  confirmLabel = "Done",
  cancelLabel = "Cancel",
  onClose,
  onConfirm,
  onCancel,
}: Props) {
  const { colors, fontFamily, space, type, radius } = useTheme();
  const icon = ICONS[variant];
  const iconColor = colors[icon.colorKey];
  const showSecondary = !!(onConfirm || onCancel);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.cream, borderRadius: radius.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={icon.name} size={56} color={iconColor} />
          </View>
          <Text
            style={{
              fontFamily: fontFamily.display,
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
              fontSize: type.small,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            {message}
          </Text>
          <Button
            title={confirmLabel}
            onPress={onConfirm ?? onClose}
            style={{ marginTop: space.lg }}
          />
          {showSecondary ? (
            <Button
              title={cancelLabel}
              variant="ghost"
              onPress={onCancel ?? onClose}
              style={{ marginTop: space.sm }}
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(46, 74, 98, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    padding: 24,
    alignItems: "center",
  },
  iconWrap: {
    marginBottom: 12,
  },
});

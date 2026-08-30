import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "../utils/haptics";
import { Button } from "./ui/Button";
import { useTheme } from "../theme";

export type AppModalVariant = "success" | "error" | "info" | "danger";

type Props = {
  visible: boolean;
  variant?: AppModalVariant;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Primary CTA style. Prefer dangerSoft for destructive confirms. */
  confirmVariant?: "primary" | "danger" | "dangerSoft" | "secondary" | "softOutline";
  /** Secondary/cancel button style when cancelLabel is shown. */
  cancelVariant?: "ghost" | "secondary" | "softOutline";
  /** center = outcome/confirm dialog; sheet = bottom sheet for actions. */
  presentation?: "center" | "sheet";
  confirmLoading?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
};

const ICONS: Record<
  AppModalVariant,
  { name: keyof typeof Ionicons.glyphMap; colorKey: "success" | "danger" | "navy" | "warning" }
> = {
  success: { name: "checkmark-circle", colorKey: "success" },
  error: { name: "close-circle", colorKey: "danger" },
  info: { name: "information-circle", colorKey: "navy" },
  danger: { name: "warning", colorKey: "danger" },
};

export function AppModal({
  visible,
  variant = "info",
  title,
  message,
  confirmLabel = "Done",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  cancelVariant = "softOutline",
  presentation = "center",
  confirmLoading = false,
  onClose,
  onConfirm,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, fontFamily, space, type, radius } = useTheme();
  const icon = ICONS[variant];
  const iconColor = colors[icon.colorKey];
  const showCancel = typeof onCancel === "function";
  const isSheet = presentation === "sheet";
  const [locked, setLocked] = React.useState(false);

  React.useEffect(() => {
    if (!visible) setLocked(false);
  }, [visible]);

  const busy = locked || confirmLoading;

  const handleConfirm = () => {
    if (busy) return;
    if (onConfirm) {
      setLocked(true);
      onConfirm();
      return;
    }
    onClose();
  };

  const onBackdropPress = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    });
  };

  const panelStyle: ViewStyle = isSheet
    ? {
        backgroundColor: colors.cream,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: Math.max(insets.bottom, 16) + 12,
        alignItems: "center",
      }
    : {
        backgroundColor: colors.cream,
        borderRadius: radius.lg,
        padding: 24,
        alignItems: "center",
      };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isSheet ? "slide" : "fade"}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isSheet ? styles.backdropSheet : styles.backdropCenter]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress} />
        <View style={panelStyle}>
          {isSheet ? <View style={[styles.handle, { backgroundColor: colors.border }]} /> : null}

          <View style={styles.iconWrap}>
            <Ionicons name={icon.name} size={isSheet ? 44 : 56} color={iconColor} />
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
            variant={confirmVariant}
            onPress={handleConfirm}
            loading={busy}
            disabled={busy}
            style={{ marginTop: space.lg }}
          />
          {showCancel ? (
            <Button
              title={cancelLabel}
              variant={cancelVariant}
              onPress={busy ? undefined : onCancel ?? onClose}
              disabled={busy}
              style={{ marginTop: space.sm }}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(46, 74, 98, 0.45)",
  },
  backdropCenter: {
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  backdropSheet: {
    justifyContent: "flex-end",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    alignSelf: "center",
  },
  iconWrap: {
    marginBottom: 12,
  },
});

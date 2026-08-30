import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "../utils/haptics";
import { Button } from "./ui/Button";
import { AppModal } from "./AppModal";
import { exportCopyQrLabelPdf, formatAuthors, qrImageUrl } from "../utils/qrLabelPdf";
import { useTheme } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  authors?: string[];
  isbn: string;
  copyLabel: string;
  qrPayload: string;
};

export function CopyQrModal({
  visible,
  onClose,
  title,
  authors,
  isbn,
  copyLabel,
  qrPayload,
}: Props) {
  const { colors, fontFamily, space, type, radius } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const authorLine = formatAuthors(authors);

  const savePdf = async () => {
    setExporting(true);
    try {
      await exportCopyQrLabelPdf({ title, authors, isbn, copyLabel, qrPayload });
    } catch (error: any) {
      setExportError(error.message || "Could not create PDF");
    } finally {
      setExporting(false);
    }
  };

  const onBackdropPress = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    });
  };

  return (
    <>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cream,
              borderRadius: radius.lg,
            },
          ]}
        >
          <View style={styles.header}>
            <Text
              style={{
                flex: 1,
                fontFamily: fontFamily.display,
                fontSize: type.body,
                color: colors.navy,
              }}
            >
              {copyLabel} label
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <View
            style={[
              styles.qrWrap,
              {
                backgroundColor: colors.white,
                borderRadius: radius.md,
                borderColor: colors.border,
              },
            ]}
          >
            <Image
              source={{ uri: qrImageUrl(qrPayload, 200) }}
              style={{ width: 148, height: 148 }}
            />
          </View>

          <Text
            numberOfLines={2}
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: type.small,
              color: colors.navy,
              textAlign: "center",
              marginTop: space.sm,
            }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              marginTop: 2,
              fontFamily: fontFamily.body,
              fontSize: type.caption,
              color: colors.muted,
              textAlign: "center",
            }}
          >
            {authorLine}
          </Text>
          <Text
            style={{
              marginTop: space.xs,
              fontFamily: fontFamily.bodySemiBold,
              fontSize: type.caption,
              color: colors.navy,
              textAlign: "center",
            }}
          >
            {copyLabel} · ISBN {isbn}
          </Text>

          {exporting ? (
            <ActivityIndicator color={colors.navy} style={{ marginTop: space.md }} />
          ) : (
            <Button
              title="Save as PDF"
              variant="amber"
              onPress={savePdf}
              style={{ marginTop: space.md }}
            />
          )}
        </View>
      </View>
    </Modal>
    <AppModal
      visible={!!exportError}
      variant="error"
      title="Export failed"
      message={exportError}
      confirmLabel="OK"
      onClose={() => setExportError("")}
    />
    </>
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
    padding: 16,
    maxWidth: 320,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  qrWrap: {
    alignSelf: "center",
    padding: 10,
    borderWidth: 1,
  },
});

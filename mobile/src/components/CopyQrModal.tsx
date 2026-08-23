import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./ui/Button";
import { exportCopyQrLabelPdf, qrImageUrl } from "../utils/qrLabelPdf";
import { useTheme } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  isbn: string;
  copyLabel: string;
  qrPayload: string;
};

export function CopyQrModal({
  visible,
  onClose,
  title,
  isbn,
  copyLabel,
  qrPayload,
}: Props) {
  const { colors, fontFamily, space, type, radius } = useTheme();
  const [exporting, setExporting] = useState(false);

  const savePdf = async () => {
    setExporting(true);
    try {
      await exportCopyQrLabelPdf({ title, isbn, copyLabel, qrPayload });
    } catch (error: any) {
      Alert.alert("Export failed", error.message || "Could not create PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.cream,
              borderRadius: radius.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text
              style={{
                flex: 1,
                fontFamily: fontFamily.display,
                fontSize: type.titleSm,
                color: colors.navy,
              }}
            >
              {copyLabel} label
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          <Text
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: type.body,
              color: colors.navy,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontFamily: fontFamily.body,
              fontSize: type.small,
              color: colors.muted,
              textAlign: "center",
            }}
          >
            ISBN {isbn}
          </Text>

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
              source={{ uri: qrImageUrl(qrPayload, 280) }}
              style={{ width: 220, height: 220 }}
            />
          </View>

          <Text
            style={{
              fontFamily: fontFamily.body,
              fontSize: type.caption,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            This QR is permanent for this physical copy. It stays the same even if the title is
            deactivated.
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
    paddingHorizontal: 24,
  },
  card: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  qrWrap: {
    marginTop: 16,
    marginBottom: 12,
    alignSelf: "center",
    padding: 16,
    borderWidth: 1,
  },
});

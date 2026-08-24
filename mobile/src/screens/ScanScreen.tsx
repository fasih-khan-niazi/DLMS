import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { ScanResultSheet, type ScanResult } from "../components/ScanResultSheet";
import { Button } from "../components/ui";
import { useProfile } from "../context/ProfileContext";
import { useTheme } from "../theme";
import {
  getScanHistory,
  pushScanHistory,
  type ScanHistoryEntry,
} from "../utils/scanHistory";

type Mode = "borrow" | "return";

function friendlyScanError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("reserved for another")) {
    return "This copy is held for another reader in the reservation queue. Please choose a different available copy, or another title.";
  }
  if (
    lower.includes("qr") ||
    lower.includes("copyid") ||
    lower.includes("qrpayload") ||
    lower.includes("valid library") ||
    lower.includes("required")
  ) {
    return "That doesn't look like a library book label. Hold the camera steady, make sure the QR is clear, and try again.";
  }
  return message;
}

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

function parseQrPayload(data: string): { copyId?: string; isbn?: string } {
  const idx = data.lastIndexOf("_");
  if (idx <= 0) return {};
  return { copyId: data.slice(0, idx), isbn: data.slice(idx + 1) };
}

async function resolveCopyLabel(copyId: string, isbn: string): Promise<string> {
  try {
    const { data } = await api.get(`/api/catalog/books/${encodeURIComponent(isbn)}`);
    const idx = (data.copies || []).findIndex((c: { copyId: string }) => c.copyId === copyId);
    if (idx >= 0) return `Copy ${idx + 1}`;
  } catch {
    // ignore
  }
  return "Copy";
}

export default function ScanScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { colors, fontFamily, space, type, radius } = useTheme();
  const { isStaff } = useProfile();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>("borrow");
  const [torchOn, setTorchOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [lastPayload, setLastPayload] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!isStaff) return;
    setHistory(await getScanHistory());
  }, [isStaff]);

  useEffect(() => {
    if (!isFocused) {
      setTorchOn(false);
      setScanned(false);
    }
  }, [isFocused]);

  useEffect(() => {
    if (isFocused) void loadHistory();
  }, [isFocused, loadHistory]);

  const resetScan = () => {
    setScanned(false);
    setBusy(false);
    setLastPayload(null);
  };

  const runScan = async (data: string, force = false) => {
    if (!force && (busy || scanned)) return;
    setScanned(true);
    setBusy(true);
    setLastPayload(data);

    const parsed = parseQrPayload(data);
    const endpoint = mode === "borrow" ? "/api/loans/borrow" : "/api/loans/return";

    try {
      const response = await api.post(endpoint, { qrPayload: data });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const title = response.data.title || "Book";
      setResult({
        kind: "success",
        title,
        message: response.data.message || "Done",
        dueDate: response.data.dueDate,
        mode,
      });

      if (isStaff && parsed.copyId && parsed.isbn) {
        const copyLabel = await resolveCopyLabel(parsed.copyId, parsed.isbn);
        await pushScanHistory({ title, copyLabel, mode });
        await loadHistory();
      }
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({
        kind: "error",
        message: friendlyScanError(error.response?.data?.error || "Scan action failed"),
        mode,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleBarcode = ({ data }: { data: string }) => {
    void runScan(data);
  };

  const dismissResult = () => {
    setResult(null);
    resetScan();
  };

  const retryScan = () => {
    setResult(null);
    if (lastPayload) {
      void runScan(lastPayload, true);
      return;
    }
    resetScan();
  };

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.cream }]}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.cream, padding: 24 }]}>
        <Text
          style={{
            textAlign: "center",
            fontFamily: fontFamily.body,
            color: colors.muted,
            marginBottom: space.md,
            lineHeight: 22,
          }}
        >
          Camera permission is required to scan book QR codes.
        </Text>
        <Button title="Grant permission" onPress={requestPermission} />
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: space.md }}>
          <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.navy }]}>
      {isFocused ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          mute
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleBarcode}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.navy }]} />
      )}

      <View style={[styles.frameOverlay, StyleSheet.absoluteFillObject]} pointerEvents="none">
        <View style={styles.dimTop} />
        <View style={styles.frameRow}>
          <View style={styles.dimSide} />
          <View style={[styles.frame, { borderColor: colors.amber }]}>
            <View style={[styles.corner, styles.cornerTL, { borderColor: colors.amber }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: colors.amber }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: colors.amber }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: colors.amber }]} />
          </View>
          <View style={styles.dimSide} />
        </View>
        <View style={styles.dimBottom} />
      </View>

      <View style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.white} />
        </Pressable>
        <Text style={{ fontFamily: fontFamily.display, fontSize: type.titleSm, color: colors.white }}>
          Scan
        </Text>
        <Pressable onPress={() => setTorchOn((v) => !v)} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name={torchOn ? "flashlight" : "flashlight-outline"} size={24} color={colors.white} />
        </Pressable>
      </View>

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.modeRow, { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.md }]}>
          {(["borrow", "return"] as Mode[]).map((item) => {
            const active = mode === item;
            return (
              <Pressable
                key={item}
                onPress={() => setMode(item)}
                style={[
                  styles.modeBtn,
                  { borderRadius: radius.sm },
                  active && { backgroundColor: colors.amber },
                ]}
              >
                <Text
                  style={{
                    fontFamily: fontFamily.bodyBold,
                    fontSize: type.small,
                    color: active ? colors.navy : colors.white,
                    textTransform: "capitalize",
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={{
            marginTop: space.md,
            textAlign: "center",
            fontFamily: fontFamily.body,
            fontSize: type.small,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 20,
          }}
        >
          Align the QR code inside the frame to {mode} a physical copy.
        </Text>

        {busy ? (
          <View style={styles.processingRow}>
            <ActivityIndicator color={colors.amber} />
            <Text
              style={{
                marginLeft: 8,
                fontFamily: fontFamily.bodySemiBold,
                color: colors.white,
              }}
            >
              Processing...
            </Text>
          </View>
        ) : null}

        {isStaff && history.length > 0 ? (
          <View
            style={[
              styles.historyPanel,
              {
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: radius.md,
                marginTop: space.md,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: fontFamily.bodyBold,
                fontSize: type.caption,
                color: colors.white,
                marginBottom: 6,
              }}
            >
              Recent scans
            </Text>
            {history.map((item) => (
              <Text
                key={`${item.at}-${item.title}`}
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: type.caption,
                  color: "rgba(255,255,255,0.8)",
                  marginTop: 2,
                }}
              >
                {item.title} · {item.copyLabel} ({item.mode})
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <ScanResultSheet
        result={result}
        onDismiss={dismissResult}
        onRetry={result?.kind === "error" ? retryScan : undefined}
      />
    </View>
  );
}

const FRAME_SIZE = 260;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  topControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    zIndex: 2,
  },
  modeRow: {
    flexDirection: "row",
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  historyPanel: {
    padding: 12,
  },
  frameOverlay: {
    justifyContent: "center",
    zIndex: 1,
  },
  dimTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  dimBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  frameRow: { flexDirection: "row", height: FRAME_SIZE },
  dimSide: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderWidth: 4,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
});

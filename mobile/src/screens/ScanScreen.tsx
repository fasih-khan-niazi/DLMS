import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
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
import { dismissScanCoach, isScanCoachDismissed } from "../utils/onboarding";
import { invalidateCatalogCache } from "../utils/catalogCache";
import { invalidateDigitalCache } from "../utils/digitalCache";
import { extractApiError, runSideEffect } from "../utils/apiError";
import { getAppConfig, peekLibrariansCanBorrow } from "../utils/appConfig";

type Mode = "borrow" | "return";

/**
 * The scan overlay always sits on a live camera feed, so its colours are fixed
 * rather than themed. Theme tokens invert in dark mode (`colors.white` becomes
 * a dark navy), which would make these controls disappear over the camera.
 */
const ON_CAMERA_TEXT = "#FFFFFF";
const ON_CAMERA_TEXT_DIM = "rgba(255,255,255,0.85)";
const ON_CAMERA_BACKDROP = "#141F28";
const ON_AMBER_TEXT = "#1A2834";

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
  const { isStaff, profile, refresh } = useProfile();
  const [permission, requestPermission] = useCameraPermissions();
  const initialReturnOnly =
    profile?.role === "librarian" && peekLibrariansCanBorrow() === false;
  const [returnOnly, setReturnOnly] = useState(initialReturnOnly);
  const [mode, setMode] = useState<Mode>(initialReturnOnly ? "return" : "borrow");
  const [torchOn, setTorchOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [lastPayload, setLastPayload] = useState<string | null>(null);
  const [showScanCoach, setShowScanCoach] = useState(false);

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

  useEffect(() => {
    if (!isFocused) return;
    void (async () => {
      const config = await getAppConfig(true);
      const librarianBlocked =
        profile?.role === "librarian" && config.librariansCanBorrow === false;
      setReturnOnly(librarianBlocked);
      if (librarianBlocked) setMode("return");
    })();
  }, [isFocused, profile?.role]);

  useEffect(() => {
    if (isFocused) {
      void isScanCoachDismissed().then((dismissed) => setShowScanCoach(!dismissed));
    }
  }, [isFocused]);

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

    let response: any;
    try {
      response = await api.post(endpoint, { qrPayload: data });
    } catch (error: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setResult({
        kind: "error",
        message: friendlyScanError(extractApiError(error, "Scan action failed")),
        mode,
      });
      setBusy(false);
      return;
    }

    // Past this point the server has committed the loan change. Nothing below is
    // allowed to surface as a scan failure.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const title = response.data?.title || "Book";
    const isLibrarianReturnBlocked =
      profile?.role === "librarian" && (returnOnly || !peekLibrariansCanBorrow());
    const loansBeforeReturn = Number(profile?.activeBorrowCount) || 0;
    const isLastReturnForLibrarian =
      mode === "return" && isLibrarianReturnBlocked && loansBeforeReturn <= 1;

    setResult({
      kind: "success",
      title,
      message: response.data?.message || "Done",
      dueDate: response.data?.dueDate,
      mode,
      isLastReturnForLibrarian,
    });
    setBusy(false);

    // Refresh derived state in the background so counts are current everywhere.
    runSideEffect(() => {
      invalidateCatalogCache();
      invalidateDigitalCache();
    });
    void refresh().catch(() => {});

    if (isStaff && parsed.copyId && parsed.isbn) {
      try {
        const copyLabel = await resolveCopyLabel(parsed.copyId, parsed.isbn);
        await pushScanHistory({ title, copyLabel, mode });
        await loadHistory();
      } catch {
        // scan history is cosmetic; never block or fail the scan result
      }
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
    <View style={[styles.container, { backgroundColor: ON_CAMERA_BACKDROP }]}>
      <StatusBar style="light" />
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
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: ON_CAMERA_BACKDROP }]} />
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
          <Ionicons name="chevron-back" size={28} color={ON_CAMERA_TEXT} />
        </Pressable>
        <Text
          style={{ fontFamily: fontFamily.display, fontSize: type.titleSm, color: ON_CAMERA_TEXT }}
        >
          Scan
        </Text>
        <Pressable onPress={() => setTorchOn((v) => !v)} hitSlop={12} style={styles.iconBtn}>
          <Ionicons
            name={torchOn ? "flashlight" : "flashlight-outline"}
            size={24}
            color={ON_CAMERA_TEXT}
          />
        </Pressable>
      </View>

      {showScanCoach ? (
        <View
          style={{
            position: "absolute",
            top: insets.top + 56,
            left: 16,
            right: 16,
            zIndex: 3,
            backgroundColor: colors.cream,
            borderRadius: radius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.bodySemiBold,
              fontSize: type.small,
              color: colors.navy,
            }}
          >
            Tip: use Borrow / Return below the camera frame, then scan the shelf QR inside the brackets.
          </Text>
          <Pressable
            onPress={() => {
              void dismissScanCoach();
              setShowScanCoach(false);
            }}
            style={{ marginTop: 8, alignSelf: "flex-end" }}
          >
            <Text
              style={{
                fontFamily: fontFamily.bodyBold,
                fontSize: type.small,
                color: colors.amber,
              }}
            >
              Got it
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        {returnOnly ? (
          <View
            style={[
              styles.modeRow,
              {
                backgroundColor: "rgba(255,255,255,0.12)",
                borderRadius: radius.md,
                justifyContent: "center",
                paddingVertical: 12,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: fontFamily.bodyBold,
                fontSize: type.small,
                color: colors.amber,
                textAlign: "center",
              }}
            >
              Return only · librarian borrowing is disabled
            </Text>
          </View>
        ) : (
          <View style={[styles.modeRow, { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.md }]}>
            {(["borrow", "return"] as Mode[]).map((item) => {
              const active = mode === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setMode(item);
                  }}
                  style={({ pressed }) => [
                    styles.modeBtn,
                    { borderRadius: radius.sm },
                    active && { backgroundColor: colors.amber },
                    pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.small,
                      color: active ? ON_AMBER_TEXT : ON_CAMERA_TEXT,
                      textTransform: "capitalize",
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text
          style={{
            marginTop: space.md,
            textAlign: "center",
            fontFamily: fontFamily.body,
            fontSize: type.small,
            color: ON_CAMERA_TEXT_DIM,
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
                color: ON_CAMERA_TEXT,
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
                color: ON_CAMERA_TEXT,
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
        onGoHome={() => {
          dismissResult();
          navigation.navigate("Home");
        }}
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

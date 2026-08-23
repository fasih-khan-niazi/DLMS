import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";
import { ReadingProgressTracker } from "../utils/readingProgress";
import { buildPdfViewerHtml, type ReaderMode } from "../utils/pdfViewerHtml";
import { getReaderPrefs, setReaderPrefs, type ReaderPrefs } from "../utils/readerPrefs";
import { Button, Chip } from "../components/ui";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<
    {
      params: {
        digitalBookId: string;
        title?: string;
        initialPage?: number;
        initialProgress?: number;
        totalPages?: number;
        onBookshelf?: boolean;
      };
    },
    "params"
  >;
};

const SAVE_INTERVAL_MS = 15000;

async function applyOrientation(lock: ReaderPrefs["orientation"]) {
  if (lock === "landscape") {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  } else {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }
}

export default function PdfReaderScreen({ navigation, route }: Props) {
  const {
    digitalBookId,
    title = "Book",
    initialPage = 1,
    initialProgress = 0,
    totalPages: seedTotal,
    onBookshelf = false,
  } = route.params;
  const { colors, fontFamily, space, type, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);

  const trackerRef = useRef(
    new ReadingProgressTracker({
      lastPage: initialPage,
      totalPages: seedTotal,
      progress: initialProgress,
    })
  );
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLabel, setLoadingLabel] = useState("Opening book…");
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [pageLabel, setPageLabel] = useState("");
  const [prefs, setPrefs] = useState<ReaderPrefs>({ readMode: "scroll", orientation: "portrait" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftPrefs, setDraftPrefs] = useState<ReaderPrefs>(prefs);

  const saveProgress = useCallback(async () => {
    if (!onBookshelf) return;
    trackerRef.current.onPause();
    const snap = trackerRef.current.getSnapshot();
    try {
      await api.patch(`/api/digital-books/${digitalBookId}/bookshelf`, {
        progress: snap.progress,
        lastPage: snap.lastPage,
        totalPages: snap.totalPages,
      });
    } catch {
      // best effort
    }
  }, [digitalBookId, onBookshelf]);

  const pushSettingsToWeb = useCallback((next: ReaderPrefs) => {
    const js = `window.applyReaderSettings(${JSON.stringify({
      mode: next.readMode,
      rerender: true,
    })}); true;`;
    webRef.current?.injectJavaScript(js);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const savedPrefs = await getReaderPrefs();
        if (cancelled) return;
        setPrefs(savedPrefs);
        setDraftPrefs(savedPrefs);
        await applyOrientation(savedPrefs.orientation);

        const user = firebaseAuth.currentUser;
        if (!user) throw new Error("Not signed in");

        setLoadingLabel("Connecting to library…");
        const token = await user.getIdToken();
        const pdfUrl = `${API_BASE_URL}/api/digital-books/${digitalBookId}/file`;

        if (cancelled) return;
        setHtml(
          buildPdfViewerHtml({
            pdfUrl,
            authToken: token,
            startPage: initialPage,
            readMode: savedPrefs.readMode,
          })
        );
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Could not load PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    saveTimerRef.current = setInterval(() => {
      void saveProgress();
    }, SAVE_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      void saveProgress();
      void ScreenOrientation.unlockAsync();
    };
  }, [digitalBookId, initialPage, saveProgress]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "page" || data.type === "ready") {
        trackerRef.current.onPageChange(Number(data.page) || 1, Number(data.total) || 1);
        setPageLabel(`${data.page} / ${data.total}`);
      }
      if (data.type === "error") {
        setError(data.message || "Reader error");
      }
    } catch {
      // ignore
    }
  };

  const applySettings = async () => {
    setSettingsOpen(false);
    setPrefs(draftPrefs);
    await setReaderPrefs(draftPrefs);
    await applyOrientation(draftPrefs.orientation);
    pushSettingsToWeb(draftPrefs);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.navy }]}>
        <ActivityIndicator color={colors.amber} size="large" />
        <Text style={{ marginTop: space.md, color: colors.white, fontFamily: fontFamily.body }}>
          {loadingLabel}
        </Text>
      </View>
    );
  }

  if (error || !html) {
    return (
      <View style={[styles.center, { backgroundColor: colors.cream }]}>
        <Text
          style={{
            color: colors.danger,
            fontFamily: fontFamily.bodyBold,
            textAlign: "center",
            paddingHorizontal: 12,
          }}
        >
          {error || "Could not open this PDF"}
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: space.md }}>
          <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const topPad = Math.max(insets.top, Platform.OS === "ios" ? 12 : 8);

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.cream,
            paddingTop: topPad + 10,
            paddingBottom: 16,
            minHeight: topPad + 72,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="close" size={26} color={colors.navy} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: type.body,
              color: colors.navy,
              lineHeight: 22,
            }}
          >
            {title}
          </Text>
        </View>
        <View style={styles.rightWrap}>
          {pageLabel ? (
            <Text
              style={{
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.caption,
                color: colors.muted,
                textAlign: "right",
              }}
            >
              {pageLabel}
            </Text>
          ) : null}
          <Pressable onPress={() => setSettingsOpen(true)} hitSlop={10} style={{ marginTop: 4 }}>
            <Ionicons name="settings-outline" size={22} color={colors.navy} />
          </Pressable>
        </View>
      </View>

      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: "#1a2a38" }}
      />

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.cream, borderRadius: radius.lg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontFamily: fontFamily.display, fontSize: type.titleSm, color: colors.navy }}>
              Reader settings
            </Text>

            <Text
              style={{
                marginTop: space.md,
                marginBottom: space.sm,
                fontFamily: fontFamily.bodyBold,
                fontSize: type.small,
                color: colors.navy,
              }}
            >
              Reading layout
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                label="Vertical scroll"
                selected={draftPrefs.readMode === "scroll"}
                onPress={() => setDraftPrefs((p) => ({ ...p, readMode: "scroll" }))}
              />
              <Chip
                label="Page by page"
                selected={draftPrefs.readMode === "page"}
                onPress={() => setDraftPrefs((p) => ({ ...p, readMode: "page" as ReaderMode }))}
              />
            </View>

            <Text
              style={{
                marginTop: space.md,
                marginBottom: space.sm,
                fontFamily: fontFamily.bodyBold,
                fontSize: type.small,
                color: colors.navy,
              }}
            >
              Screen orientation
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                label="Portrait"
                selected={draftPrefs.orientation === "portrait"}
                onPress={() => setDraftPrefs((p) => ({ ...p, orientation: "portrait" }))}
              />
              <Chip
                label="Landscape"
                selected={draftPrefs.orientation === "landscape"}
                onPress={() => setDraftPrefs((p) => ({ ...p, orientation: "landscape" }))}
              />
            </View>

            <Button title="Apply" onPress={() => void applySettings()} style={{ marginTop: space.lg }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  rightWrap: {
    width: 72,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(46, 74, 98, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    padding: 20,
    paddingBottom: 32,
  },
});

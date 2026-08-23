import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Modal,
  useWindowDimensions,
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
const ZOOM_PILLS = [50, 75, 100, 110, 125, 150, 175, 200];

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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const webRef = useRef<WebView>(null);
  const tabParent = navigation.getParent();

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
  const [zoomPercent, setZoomPercent] = useState(100);
  const [prefs, setPrefs] = useState<ReaderPrefs>({ readMode: "scroll", orientation: "portrait" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftPrefs, setDraftPrefs] = useState<ReaderPrefs>(prefs);
  const [draftZoom, setDraftZoom] = useState(100);

  const setTabBarHidden = useCallback(
    (hidden: boolean) => {
      tabParent?.setOptions({
        tabBarStyle: hidden
          ? { display: "none" }
          : {
              backgroundColor: colors.white,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: 56 + Math.max(insets.bottom, 8),
              paddingTop: 6,
              paddingBottom: Math.max(insets.bottom, 8),
              elevation: 8,
            },
      });
    },
    [tabParent, colors.white, colors.border, insets.bottom]
  );

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

  const injectSettings = useCallback(
    (opts: { mode?: ReaderMode; zoomPercent?: number; resetZoom?: boolean; rerender?: boolean }) => {
      webRef.current?.injectJavaScript(
        `window.applyReaderSettings(${JSON.stringify(opts)}); true;`
      );
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const savedPrefs = await getReaderPrefs();
        if (cancelled) return;
        // Enforce XOR: landscape only with scroll
        if (savedPrefs.orientation === "landscape" && savedPrefs.readMode === "page") {
          savedPrefs.readMode = "scroll";
        }
        setPrefs(savedPrefs);
        setDraftPrefs(savedPrefs);
        setDraftZoom(100);
        setZoomPercent(100);
        await applyOrientation(savedPrefs.orientation);
        setTabBarHidden(savedPrefs.orientation === "landscape");

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
            zoomPercent: 100,
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
      setTabBarHidden(false);
    };
  }, [digitalBookId, initialPage, saveProgress, setTabBarHidden]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "page" || data.type === "ready") {
        trackerRef.current.onPageChange(Number(data.page) || 1, Number(data.total) || 1);
        setPageLabel(`${data.page} / ${data.total}`);
      }
      if (data.type === "zoom") {
        setZoomPercent(Number(data.percent) || 100);
        setDraftZoom(Number(data.percent) || 100);
      }
      if (data.type === "error") {
        setError(data.message || "Reader error");
      }
    } catch {
      // ignore
    }
  };

  const applySettings = async () => {
    let next = { ...draftPrefs };
    // Mutual exclusion
    if (next.orientation === "landscape") next.readMode = "scroll";
    if (next.readMode === "page") next.orientation = "portrait";

    setSettingsOpen(false);
    setPrefs(next);
    await setReaderPrefs(next);
    await applyOrientation(next.orientation);
    setTabBarHidden(next.orientation === "landscape");
    setZoomPercent(draftZoom);
    injectSettings({
      mode: next.readMode,
      zoomPercent: draftZoom,
      rerender: true,
    });
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

  const topPad = insets.top + (isLandscape ? 8 : 10);
  const barPadY = isLandscape ? 8 : 10;
  const landscapeDraft = draftPrefs.orientation === "landscape";
  const pageModeDraft = draftPrefs.readMode === "page";

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.cream,
            paddingTop: topPad,
            paddingBottom: barPadY,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtnCompact}>
          <Ionicons name="close" size={24} color={colors.navy} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text
            numberOfLines={isLandscape ? 1 : 2}
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: isLandscape ? type.small : type.body,
              color: colors.navy,
              lineHeight: isLandscape ? 18 : 22,
            }}
          >
            {title}
          </Text>
        </View>
        <View style={styles.rightCluster}>
          {pageLabel ? (
            <Text
              style={{
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.caption,
                color: colors.muted,
                marginRight: 10,
              }}
            >
              {pageLabel}
            </Text>
          ) : null}
          <Pressable
            onPress={() => {
              setDraftPrefs(prefs);
              setDraftZoom(zoomPercent);
              setSettingsOpen(true);
            }}
            hitSlop={10}
            style={styles.iconBtnCompact}
          >
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
        nestedScrollEnabled
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: "#1a2a38" }}
      />

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable
          style={[
            styles.modalBackdrop,
            isLandscape && { justifyContent: "center", paddingHorizontal: 16 },
          ]}
          onPress={() => setSettingsOpen(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.cream,
                borderRadius: radius.lg,
                width: isLandscape ? Math.min(windowWidth - 32, 760) : undefined,
                alignSelf: isLandscape ? "center" : undefined,
                maxWidth: "100%",
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontFamily: fontFamily.display, fontSize: type.titleSm, color: colors.navy }}>
                Reader settings
              </Text>
              <Pressable onPress={() => setSettingsOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <View style={isLandscape ? styles.landscapeRow : undefined}>
              <View style={isLandscape ? { flex: 1, marginRight: 12 } : undefined}>
                <Text style={labelStyle(fontFamily, type, colors, 0)}>Reading layout</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Chip
                    label="Vertical scroll"
                    selected={draftPrefs.readMode === "scroll"}
                    onPress={() => setDraftPrefs((p) => ({ ...p, readMode: "scroll" }))}
                  />
                  <View style={{ opacity: landscapeDraft ? 0.4 : 1 }}>
                    <Chip
                      label="Page by page"
                      selected={draftPrefs.readMode === "page"}
                      onPress={() => {
                        if (landscapeDraft) return;
                        setDraftPrefs((p) => ({ ...p, readMode: "page", orientation: "portrait" }));
                      }}
                    />
                  </View>
                </View>

                <Text style={labelStyle(fontFamily, type, colors, 10)}>Screen orientation</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Chip
                    label="Portrait"
                    selected={draftPrefs.orientation === "portrait"}
                    onPress={() => setDraftPrefs((p) => ({ ...p, orientation: "portrait" }))}
                  />
                  <View style={{ opacity: pageModeDraft ? 0.4 : 1 }}>
                    <Chip
                      label="Landscape"
                      selected={draftPrefs.orientation === "landscape"}
                      onPress={() => {
                        if (pageModeDraft) return;
                        setDraftPrefs((p) => ({
                          ...p,
                          orientation: "landscape",
                          readMode: "scroll",
                        }));
                      }}
                    />
                  </View>
                </View>
                {landscapeDraft || pageModeDraft ? (
                  <Text
                    style={{
                      marginTop: 6,
                      fontFamily: fontFamily.body,
                      fontSize: type.caption,
                      color: colors.muted,
                      lineHeight: 16,
                    }}
                  >
                    {landscapeDraft
                      ? "Page by page is only available in portrait."
                      : "Landscape is only available with vertical scroll."}
                  </Text>
                ) : null}
              </View>

              <View style={isLandscape ? { flex: 1.2 } : { marginTop: 10 }}>
                <Text style={labelStyle(fontFamily, type, colors, 0)}>Zoom</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {ZOOM_PILLS.map((z) => (
                    <Chip
                      key={z}
                      label={`${z}%`}
                      selected={draftZoom === z}
                      onPress={() => setDraftZoom(z)}
                    />
                  ))}
                </View>
                <Pressable onPress={() => setDraftZoom(100)} style={{ marginTop: 8 }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodySemiBold,
                      fontSize: type.small,
                      color: colors.amberDark,
                    }}
                  >
                    Reset zoom to 100%
                  </Text>
                </Pressable>
              </View>
            </View>

            <Button title="Apply" onPress={() => void applySettings()} style={{ marginTop: 12 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function labelStyle(fontFamily: any, type: any, colors: any, marginTop: number) {
  return {
    marginTop,
    marginBottom: 6,
    fontFamily: fontFamily.bodyBold,
    fontSize: type.small,
    color: colors.navy,
  };
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
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  iconBtnCompact: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  rightCluster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(46, 74, 98, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    padding: 14,
    paddingBottom: 16,
  },
  landscapeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
});

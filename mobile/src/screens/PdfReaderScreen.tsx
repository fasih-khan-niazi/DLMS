import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";
import { ReadingProgressTracker } from "../utils/readingProgress";
import { buildPdfViewerHtml } from "../utils/pdfViewerHtml";
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
      };
    },
    "params"
  >;
};

const SAVE_INTERVAL_MS = 15000;

export default function PdfReaderScreen({ navigation, route }: Props) {
  const { digitalBookId, title = "Book", initialPage = 1, totalPages: seedTotal } = route.params;
  const { colors, fontFamily, space, type } = useTheme();
  const insets = useSafeAreaInsets();

  const trackerRef = useRef(
    new ReadingProgressTracker({
      lastPage: initialPage,
      totalPages: seedTotal,
    })
  );
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLabel, setLoadingLabel] = useState("Opening book…");
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [pageLabel, setPageLabel] = useState("");

  const ensureBookshelf = useCallback(async () => {
    try {
      await api.post(`/api/digital-books/${digitalBookId}/bookshelf`);
    } catch {
      // already saved
    }
  }, [digitalBookId]);

  const saveProgress = useCallback(async () => {
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
  }, [digitalBookId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await ensureBookshelf();
        if (cancelled) return;

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
    };
  }, [digitalBookId, initialPage, ensureBookshelf, saveProgress]);

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
            paddingTop: topPad + 8,
            paddingBottom: 14,
            minHeight: topPad + 64,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.topSide}>
          <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>← Close</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text
            numberOfLines={2}
            style={{
              textAlign: "center",
              fontFamily: fontFamily.bodyBold,
              fontSize: type.body,
              color: colors.navy,
              lineHeight: 22,
            }}
          >
            {title}
          </Text>
          {pageLabel ? (
            <Text
              style={{
                marginTop: 4,
                textAlign: "center",
                fontFamily: fontFamily.body,
                fontSize: type.caption,
                color: colors.muted,
              }}
            >
              Page {pageLabel}
            </Text>
          ) : null}
        </View>
        <View style={styles.topSide} />
      </View>
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: "#1a2a38" }}
      />
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  topSide: {
    width: 72,
  },
  topCenter: {
    flex: 1,
    justifyContent: "center",
  },
});

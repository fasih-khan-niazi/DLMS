import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import api from "../config/api";
import { downloadDigitalPdf } from "../utils/digitalPdf";
import { ReadingProgressTracker } from "../utils/readingProgress";
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

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
const SAVE_INTERVAL_MS = 15000;

function buildViewerHtml(fileUri: string, startPage: number): string {
  const safeUri = fileUri.replace(/'/g, "%27");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<script src="${PDFJS}/pdf.min.js"></script>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #1a2a38; font-family: system-ui, sans-serif; }
  #viewer { padding: 12px 12px 88px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  canvas { max-width: 100%; height: auto !important; border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,.35); background: #fff; }
  .bar {
    position: fixed; left: 0; right: 0; bottom: 0;
    background: #F8F7F4; border-top: 1px solid #E5E7EB;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  button {
    background: #2E4A62; color: #fff; border: none; border-radius: 10px;
    padding: 10px 16px; font-size: 15px; font-weight: 600;
  }
  button:disabled { opacity: 0.45; }
  #pageInfo { color: #2E4A62; font-weight: 600; font-size: 14px; flex: 1; text-align: center; }
  #status { color: #6B7280; font-size: 12px; text-align: center; padding: 8px; }
</style>
</head>
<body>
<div id="status">Loading…</div>
<div id="viewer"></div>
<div class="bar">
  <button id="prev" disabled>Prev</button>
  <div id="pageInfo">—</div>
  <button id="next" disabled>Next</button>
</div>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS}/pdf.worker.min.js";
  const fileUri = '${safeUri}';
  const startPage = ${Math.max(1, startPage)};
  let pdfDoc = null;
  let pageNum = startPage;
  let totalPages = 0;
  let rendering = false;

  function post(type, extra) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
    }
  }

  function updateControls() {
    document.getElementById('prev').disabled = pageNum <= 1;
    document.getElementById('next').disabled = pageNum >= totalPages;
    document.getElementById('pageInfo').textContent = pageNum + ' / ' + totalPages;
  }

  async function renderPage(num) {
    if (!pdfDoc || rendering) return;
    rendering = true;
    pageNum = num;
    updateControls();
    post('page', { page: pageNum, total: totalPages });
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    document.getElementById('viewer').innerHTML = '';
    document.getElementById('viewer').appendChild(canvas);
    await page.render({ canvasContext: ctx, viewport }).promise;
    document.getElementById('status').textContent = '';
    rendering = false;
  }

  document.getElementById('prev').onclick = () => { if (pageNum > 1) renderPage(pageNum - 1); };
  document.getElementById('next').onclick = () => { if (pageNum < totalPages) renderPage(pageNum + 1); };

  pdfjsLib.getDocument(fileUri).promise.then(async (pdf) => {
    pdfDoc = pdf;
    totalPages = pdf.numPages;
    pageNum = Math.min(Math.max(startPage, 1), totalPages);
    updateControls();
    post('ready', { total: totalPages, page: pageNum });
    await renderPage(pageNum);
  }).catch((err) => {
    document.getElementById('status').textContent = 'Could not open PDF.';
    post('error', { message: String(err) });
  });
</script>
</body>
</html>`;
}

export default function PdfReaderScreen({ navigation, route }: Props) {
  const { digitalBookId, title = "Book", initialPage = 1, totalPages: seedTotal } = route.params;
  const { colors, fontFamily, space, type } = useTheme();

  const trackerRef = useRef(
    new ReadingProgressTracker({
      lastPage: initialPage,
      totalPages: seedTotal,
    })
  );
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(true);
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
        const uri = await downloadDigitalPdf(digitalBookId, title);
        if (cancelled) return;
        setHtml(buildViewerHtml(uri, initialPage));
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
  }, [digitalBookId, title, initialPage, ensureBookshelf, saveProgress]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "page" || data.type === "ready") {
        trackerRef.current.onPageChange(Number(data.page) || 1, Number(data.total) || 1);
        setPageLabel(`Page ${data.page} of ${data.total}`);
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
          Preparing reader…
        </Text>
      </View>
    );
  }

  if (error || !html) {
    return (
      <View style={[styles.center, { backgroundColor: colors.cream }]}>
        <Text style={{ color: colors.danger, fontFamily: fontFamily.bodyBold, textAlign: "center" }}>
          {error || "Could not open this PDF"}
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: space.md }}>
          <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <View style={[styles.topBar, { backgroundColor: colors.cream, paddingTop: 48 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>← Close</Text>
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginHorizontal: space.sm,
            textAlign: "center",
            fontFamily: fontFamily.bodySemiBold,
            fontSize: type.small,
            color: colors.navy,
          }}
        >
          {title}
        </Text>
        <Text style={{ fontFamily: fontFamily.body, fontSize: type.caption, color: colors.muted }}>
          {pageLabel}
        </Text>
      </View>
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
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
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
});

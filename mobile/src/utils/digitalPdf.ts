import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { firebaseAuth } from "../config/firebase";
import { API_BASE_URL } from "../config/api";

function pdfCachePath(digitalBookId: string, title: string): string {
  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "book";
  return `${FileSystem.cacheDirectory}${safeName}_${digitalBookId}.pdf`;
}

export async function getCachedPdfUri(
  digitalBookId: string,
  title = "book"
): Promise<string | null> {
  const dest = pdfCachePath(digitalBookId, title);
  const info = await FileSystem.getInfoAsync(dest);
  return info.exists ? dest : null;
}

export async function downloadDigitalPdf(
  digitalBookId: string,
  title = "book",
  onProgress?: (progress: number) => void
): Promise<string> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }

  const dest = pdfCachePath(digitalBookId, title);
  const cached = await getCachedPdfUri(digitalBookId, title);
  if (cached) {
    const info = await FileSystem.getInfoAsync(cached);
    if (info.exists && "size" in info && Number(info.size) > 0) {
      onProgress?.(1);
      return cached;
    }
    try {
      await FileSystem.deleteAsync(cached, { idempotent: true });
    } catch {
      // ignore
    }
  }

  const token = await user.getIdToken();
  const url = `${API_BASE_URL}/api/digital-books/${digitalBookId}/file`;

  if (onProgress) {
    const download = FileSystem.createDownloadResumable(
      url,
      dest,
      { headers: { Authorization: `Bearer ${token}` } },
      (progress) => {
        const total = progress.totalBytesExpectedToWrite || 1;
        onProgress(Math.min(progress.totalBytesWritten / total, 1));
      }
    );
    const result = await download.downloadAsync();
    if (!result || result.status !== 200) {
      throw new Error("Failed to download PDF");
    }
    return result.uri;
  }

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status !== 200) {
    throw new Error("Failed to download PDF");
  }

  return result.uri;
}

export async function openOrSharePdf(localUri: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(localUri, {
    mimeType: "application/pdf",
    dialogTitle: "Open PDF",
    UTI: "com.adobe.pdf",
  });
}

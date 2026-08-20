import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { firebaseAuth } from "../config/firebase";
import { API_BASE_URL } from "../config/api";

export async function downloadDigitalPdf(
  digitalBookId: string,
  title = "book"
): Promise<string> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }

  const token = await user.getIdToken();
  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "book";
  const dest = `${FileSystem.cacheDirectory}${safeName}_${digitalBookId}.pdf`;

  const result = await FileSystem.downloadAsync(
    `${API_BASE_URL}/api/digital-books/${digitalBookId}/file`,
    dest,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

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

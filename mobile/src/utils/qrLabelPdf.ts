import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

function qrImageUrl(payload: string, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAuthors(authors?: string[]) {
  const list = (authors || []).map((a) => a.trim()).filter(Boolean);
  if (list.length === 0) return "Unknown author";
  return list.join(", ");
}

export async function exportCopyQrLabelPdf(input: {
  title: string;
  authors?: string[];
  isbn: string;
  copyLabel: string;
  qrPayload: string;
}) {
  const authorLine = formatAuthors(input.authors);
  const qrUrl = qrImageUrl(input.qrPayload, 400);
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: Arial, sans-serif;
        text-align: center;
        padding: 24px;
        color: #2E4A62;
      }
      img {
        width: 220px;
        height: 220px;
        margin-bottom: 12px;
      }
      .below-qr-title {
        font-size: 16px;
        font-weight: 700;
        margin: 0 0 4px;
        line-height: 1.3;
      }
      .below-qr-author {
        font-size: 13px;
        color: #4B5563;
        margin: 0 0 12px;
        line-height: 1.3;
      }
      .copy {
        font-size: 15px;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .isbn {
        font-size: 11px;
        color: #6B7280;
      }
    </style>
  </head>
  <body>
    <img src="${qrUrl}" alt="QR code" />
    <div class="below-qr-title">${escapeHtml(input.title)}</div>
    <div class="below-qr-author">${escapeHtml(authorLine)}</div>
    <div class="copy">${escapeHtml(input.copyLabel)}</div>
    <div class="isbn">ISBN ${escapeHtml(input.isbn)}</div>
  </body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `${input.copyLabel} label`,
    UTI: "com.adobe.pdf",
  });

  return uri;
}

export { qrImageUrl, formatAuthors };

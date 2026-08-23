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

export async function exportCopyQrLabelPdf(input: {
  title: string;
  isbn: string;
  copyLabel: string;
  qrPayload: string;
}) {
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
      h1 {
        font-size: 18px;
        margin: 0 0 8px;
      }
      .meta {
        font-size: 12px;
        color: #6B7280;
        margin-bottom: 16px;
      }
      img {
        width: 220px;
        height: 220px;
      }
      .copy {
        margin-top: 16px;
        font-size: 16px;
        font-weight: 700;
      }
      .payload {
        margin-top: 10px;
        font-size: 10px;
        color: #9CA3AF;
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(input.title)}</h1>
    <div class="meta">ISBN ${escapeHtml(input.isbn)}</div>
    <img src="${qrUrl}" alt="QR code" />
    <div class="copy">${escapeHtml(input.copyLabel)}</div>
    <div class="payload">${escapeHtml(input.qrPayload)}</div>
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

export { qrImageUrl };

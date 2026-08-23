import { createCanvas } from "@napi-rs/canvas";

/** Render the first page of a PDF buffer to a JPEG thumbnail. */
export async function renderPdfFirstPageToJpeg(pdfBuffer: Buffer): Promise<Buffer> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.4 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;

  return canvas.toBuffer("image/jpeg");
}

export function digitalCoverObjectPath(digitalBookId: string): string {
  return `covers/digital/${digitalBookId}.jpg`;
}

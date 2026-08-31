import { digitalBooksBucket, getSupabase } from "../config/supabase";

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 365 * 10; // 10 years

export function coverObjectPathForIsbn(isbn: string): string {
  return `covers/${isbn}.jpg`;
}

export async function uploadBookCover(input: {
  objectPath: string;
  buffer: Buffer;
  contentType?: string;
}) {
  const supabase = getSupabase();
  const bucket = digitalBooksBucket();

  const { data, error } = await supabase.storage.from(bucket).upload(input.objectPath, input.buffer, {
    contentType: input.contentType || "image/jpeg",
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, SIGNED_URL_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    throw new Error(`Supabase signed URL failed: ${signError?.message || "unknown"}`);
  }

  return { bucket, path: data.path, signedUrl: signed.signedUrl };
}

export async function downloadBookCover(objectPath: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const supabase = getSupabase();
  const bucket = digitalBooksBucket();

  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) {
    throw new Error(`Supabase download failed: ${error?.message || "file missing"}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const contentType = data.type || "image/jpeg";
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

export function guessContentTypeFromPath(objectPath: string): string {
  const lower = objectPath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

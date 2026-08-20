import { digitalBooksBucket, getSupabase } from "../config/supabase";

export async function uploadDigitalBookPdf(input: {
  objectPath: string;
  buffer: Buffer;
  contentType?: string;
}) {
  const supabase = getSupabase();
  const bucket = digitalBooksBucket();

  const { data, error } = await supabase.storage.from(bucket).upload(input.objectPath, input.buffer, {
    contentType: input.contentType || "application/pdf",
    upsert: false,
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return { bucket, path: data.path };
}

export async function downloadDigitalBookPdf(objectPath: string): Promise<Buffer> {
  const supabase = getSupabase();
  const bucket = digitalBooksBucket();

  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) {
    throw new Error(`Supabase download failed: ${error?.message || "file missing"}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function removeDigitalBookPdf(objectPath: string): Promise<void> {
  const supabase = getSupabase();
  const bucket = digitalBooksBucket();

  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
}

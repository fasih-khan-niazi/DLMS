import { digitalBooksBucket, getSupabase } from "../config/supabase";

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

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { bucket, path: data.path, publicUrl: publicData.publicUrl };
}

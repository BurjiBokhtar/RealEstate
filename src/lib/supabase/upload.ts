import { createClient } from "./client";

export async function uploadMedia(file: File, folder: string): Promise<string | null> {
  const supabase = createClient();
  const path = `${folder}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("crm-media").upload(path, file, {
    upsert: true,
  });
  if (error) return null;
  const { data } = supabase.storage.from("crm-media").getPublicUrl(path);
  return data.publicUrl;
}

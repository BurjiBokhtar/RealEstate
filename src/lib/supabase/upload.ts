import { createClient } from "./client";

// Client-side checks are just fast, friendly UX -- the actual enforcement
// is the crm-media bucket's own file_size_limit/allowed_mime_types
// (supabase/019_security_hardening.sql), since a client-side check alone
// can't stop a direct API call from uploading anything.
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export type UploadResult =
  | { url: string; error: null }
  | { url: null; error: "type" | "size" | string };

export async function uploadMedia(file: File, folder: string): Promise<UploadResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { url: null, error: "type" };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { url: null, error: "size" };
  }

  // The original filename is attacker-controlled input -- used unsanitized
  // in a storage path before, so a crafted name (e.g. containing "../" or
  // matching another upload's exact generated path) could write outside the
  // intended folder or silently overwrite an unrelated file (upsert: true).
  // Keep only a safe character set and cap the length.
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100) || "file";
  const path = `${folder}/${Date.now()}-${safeName}`;

  const supabase = createClient();
  const { error } = await supabase.storage.from("crm-media").upload(path, file, {
    upsert: true,
  });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from("crm-media").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

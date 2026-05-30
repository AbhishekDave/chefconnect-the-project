import { supabase } from "./supabaseClient";

const BUCKET = "cheftoman";

export async function uploadProofImage(
  anonymousSessionToken: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = crypto.randomUUID();
  const path = `proofs/${anonymousSessionToken}/${id}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

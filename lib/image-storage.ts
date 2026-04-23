import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeneratedImage } from '@/lib/image-gen';

const BUCKET = 'plan-images';

/**
 * Upload a generated image to the plan-images bucket and return the
 * public URL. Paths are keyed by userId so RLS covers write access.
 * Example path: "<uid>/meal/<planId>/3.jpg"
 */
export async function uploadPlanImage(
  supabase: SupabaseClient,
  userId: string,
  relativePath: string,
  image: GeneratedImage,
): Promise<string> {
  const path = `${userId}/${relativePath}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, image.bytes, {
      contentType: image.mimeType,
      upsert: true,
      cacheControl: '31536000',
    });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Best-effort cleanup of images under a user's folder for a specific
 * plan. Used by the plan-delete paths so we don't leak objects.
 * Swallows errors — storage is not authoritative for plan existence.
 */
export async function deletePlanImages(
  supabase: SupabaseClient,
  userId: string,
  prefix: string,
): Promise<void> {
  const folder = `${userId}/${prefix}`;
  const { data: entries } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 100 });
  if (!entries?.length) return;
  const paths = entries.map((e) => `${folder}/${e.name}`);
  await supabase.storage.from(BUCKET).remove(paths);
}

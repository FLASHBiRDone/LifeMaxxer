-- Storage bucket for AI-generated plan images (meal dishes + workout
-- scenes from Nano Banana 2). Public reads so the <img> tag can load
-- without signed URLs. Writes are scoped per-user-folder via RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'plan-images',
  'plan-images',
  true,
  5242880, -- 5 MB ceiling per object
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- INSERT policy — upload only into your own user folder
drop policy if exists plan_images_auth_insert on storage.objects;
create policy plan_images_auth_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plan-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE policy — upsert paths in your own folder
drop policy if exists plan_images_auth_update on storage.objects;
create policy plan_images_auth_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'plan-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'plan-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE policy — remove your own images (used when plans are deleted)
drop policy if exists plan_images_auth_delete on storage.objects;
create policy plan_images_auth_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'plan-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT is not required — bucket is public. Leaving it explicit for
-- clarity in case we switch to private later.
drop policy if exists plan_images_public_read on storage.objects;
create policy plan_images_public_read on storage.objects
  for select
  using (bucket_id = 'plan-images');

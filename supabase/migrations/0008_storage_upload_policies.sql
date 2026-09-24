-- Let admins upload images from the admin (products, home page, about us).
-- Fixes "new row violates row-level security policy" on image upload.
-- Everyone can view the images (the webshop shows them), only admins write.
-- Run once in the Supabase SQL Editor. Safe to run again.

-- Make sure the buckets exist and are public.
insert into storage.buckets (id, name, public)
values ('product-images',  'product-images',  true),
       ('hero-images',     'hero-images',     true),
       ('category-images', 'category-images', true),
       ('om-oss-images',   'om-oss-images',   true)
on conflict (id) do update set public = true;

drop policy if exists "prolux_images_public_read"  on storage.objects;
drop policy if exists "prolux_images_admin_insert" on storage.objects;
drop policy if exists "prolux_images_admin_update" on storage.objects;
drop policy if exists "prolux_images_admin_delete" on storage.objects;

create policy "prolux_images_public_read" on storage.objects
  for select using (
    bucket_id in ('product-images', 'hero-images', 'category-images', 'om-oss-images'));

create policy "prolux_images_admin_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('product-images', 'hero-images', 'category-images', 'om-oss-images')
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "prolux_images_admin_update" on storage.objects
  for update to authenticated using (
    bucket_id in ('product-images', 'hero-images', 'category-images', 'om-oss-images')
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "prolux_images_admin_delete" on storage.objects
  for delete to authenticated using (
    bucket_id in ('product-images', 'hero-images', 'category-images', 'om-oss-images')
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- =============================================================================
-- MIGRATION 008: STORAGE UPLOAD & WRITE POLICIES
-- Description: Adds secure INSERT, UPDATE, and DELETE RLS policies for storage buckets.
-- Scope:
--   - user-avatars: Restricted to authenticated user owning the file folder ({user_id}/...)
--   - store-banners, store-logos: Restricted to authenticated merchants owning a store
--   - product-images: Restricted to authenticated merchants owning a store
-- =============================================================================

-- 1. USER AVATARS WRITE POLICIES (Scoped to owner user ID folder)
CREATE POLICY "Authenticated Users Upload Own Avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated Users Update Own Avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated Users Delete Own Avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. STORE MEDIA WRITE POLICIES (Banners & Logos — Scoped to authenticated merchants)
CREATE POLICY "Merchants Upload Store Banners" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-banners' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Update Store Banners" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-banners' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Delete Store Banners" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-banners' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Upload Store Logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-logos' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Update Store Logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-logos' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Delete Store Logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-logos' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

-- 3. PRODUCT IMAGES WRITE POLICIES (Scoped to authenticated merchants)
CREATE POLICY "Merchants Upload Product Images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Update Product Images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Delete Product Images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

-- =============================================================================
-- MIGRATION 006: STORAGE BUCKETS & POLICIES
-- Description: Creates the 4 required storage buckets and public read access policies.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('product-images', 'product-images', true),
  ('store-banners', 'store-banners', true),
  ('store-logos', 'store-logos', true),
  ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access policies for media buckets
CREATE POLICY "Public Read Product Images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Public Read Store Banners" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-banners');

CREATE POLICY "Public Read Store Logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-logos');

CREATE POLICY "Public Read User Avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-avatars');

-- ============================================================================
-- Multi-Tenant Phase F: agency-branding Storage bucket + RLS
-- ============================================================================
-- The agency-branding bucket holds partner logos + favicons. Bucket itself
-- is created via Management API (POST /storage/buckets). This migration sets
-- the RLS on storage.objects so partners can write to their own folder
-- (path prefixed with their agency_id) and the public can read.
-- ============================================================================

-- ─────────── public read for the bucket ───────────
DROP POLICY IF EXISTS "agency_branding_public_read" ON storage.objects;
CREATE POLICY "agency_branding_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'agency-branding');

-- ─────────── agency_owner writes only to their own agency_id folder ───────────
DROP POLICY IF EXISTS "agency_owner_uploads_own_branding" ON storage.objects;
CREATE POLICY "agency_owner_uploads_own_branding" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'agency-branding'
    AND (storage.foldername(name))[1]::uuid = public.current_user_agency_id()
  );

DROP POLICY IF EXISTS "agency_owner_updates_own_branding" ON storage.objects;
CREATE POLICY "agency_owner_updates_own_branding" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'agency-branding'
    AND (storage.foldername(name))[1]::uuid = public.current_user_agency_id()
  );

DROP POLICY IF EXISTS "agency_owner_deletes_own_branding" ON storage.objects;
CREATE POLICY "agency_owner_deletes_own_branding" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'agency-branding'
    AND (storage.foldername(name))[1]::uuid = public.current_user_agency_id()
  );

-- Admins can manage anything in the bucket (override)
DROP POLICY IF EXISTS "admin_full_access_agency_branding" ON storage.objects;
CREATE POLICY "admin_full_access_agency_branding" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'agency-branding' AND public.current_user_role() = 'admin');

-- ============================================================================
-- Public agency lookup RPC functions
-- ============================================================================
-- Frontend needs to look up agency branding BEFORE the user is logged in
-- (so the login page can already be whitelabel-branded). RLS on `agencies`
-- blocks anon SELECT — so we expose minimal non-sensitive fields via two
-- SECURITY DEFINER functions granted to anon + authenticated.
-- ============================================================================

-- ─────────── get_agency_branding(hostname) ───────────
-- Resolves a hostname to an agency's branding-relevant fields.
-- Strategy:
--   - 'platform.openpenguin.de' or 'localhost' → empty (platform-admin view)
--   - '{slug}.openpenguin.de' → lookup by slug
--   - any other hostname → lookup by custom_domain
-- Returns only branding-safe fields (no Stripe IDs, no internal status flags).

CREATE OR REPLACE FUNCTION public.get_agency_branding(p_hostname text)
RETURNS TABLE (
  id uuid,
  slug text,
  display_name text,
  brand_color text,
  logo_url text,
  favicon_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_domain text := 'openpenguin.de';
  v_subdomain text;
BEGIN
  -- platform-admin host or localhost: no agency
  IF p_hostname IS NULL
    OR p_hostname = 'platform.' || v_base_domain
    OR p_hostname = 'localhost'
    OR p_hostname ~ '^127\.0\.0\.1'
  THEN
    RETURN;
  END IF;

  -- Subdomain of openpenguin.de
  IF p_hostname LIKE '%.' || v_base_domain THEN
    v_subdomain := split_part(p_hostname, '.', 1);
    RETURN QUERY
      SELECT a.id, a.slug, a.display_name, a.brand_color, a.logo_url, a.favicon_url
      FROM public.agencies a
      WHERE a.slug = v_subdomain
        AND a.status = 'active'
      LIMIT 1;
    RETURN;
  END IF;

  -- Custom domain
  RETURN QUERY
    SELECT a.id, a.slug, a.display_name, a.brand_color, a.logo_url, a.favicon_url
    FROM public.agencies a
    WHERE a.custom_domain = p_hostname
      AND a.status = 'active'
    LIMIT 1;
END $$;

GRANT EXECUTE ON FUNCTION public.get_agency_branding(text) TO anon, authenticated;

-- ─────────── check_slug_availability(slug) ───────────
-- Returns true if slug is free + meets the format + isn't a reserved word.

CREATE OR REPLACE FUNCTION public.check_slug_availability(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_slug ~ '^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$'
    AND p_slug NOT IN (
      'www', 'platform', 'admin', 'api', 'auth', 'mail', 'app',
      'support', 'help', 'status', 'docs', 'blog', 'about',
      'contact', 'login', 'signup', 'dashboard', 'onboarding',
      'account', 'settings', 'agency', 'reset-password',
      'reset', 'invite', 'webhook', 'webhooks', 'cdn', 'static'
    )
    AND NOT EXISTS (SELECT 1 FROM public.agencies WHERE slug = p_slug)
$$;

GRANT EXECUTE ON FUNCTION public.check_slug_availability(text) TO anon, authenticated;

-- ============================================================================
-- DONE. Verify by running:
--   SELECT * FROM public.get_agency_branding('platform.openpenguin.de'); -- empty
--   SELECT public.check_slug_availability('stephan'); -- true (assuming free)
--   SELECT public.check_slug_availability('admin'); -- false (reserved)
-- ============================================================================

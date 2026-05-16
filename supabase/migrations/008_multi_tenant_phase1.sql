-- ============================================================================
-- Multi-Tenant Agency Tier — Phase 1 schema
-- ============================================================================
-- Adds `agencies` table, `agency_id` columns on customer-scoped tables, the
-- `agency_owner` role, helper function, and RLS policies for agency owners.
--
-- IMPORTANT: ALTER TYPE ADD VALUE cannot be used in the same transaction
-- as statements that reference the new value. This file is split into three
-- chunks (A, B, C) that must be applied as separate transactions.
-- The deployment script applies them in order. If running manually, run each
-- chunk via a separate statement / API call.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- CHUNK A: enum value addition (must be its own transaction)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'agency_owner';

-- ════════════════════════════════════════════════════════════════════════════
-- CHUNK B: schema additions (agencies table + columns + helper)
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────── agencies table ───────────
CREATE TABLE IF NOT EXISTS public.agencies (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  slug                        text NOT NULL UNIQUE
                              CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$'),
  display_name                text NOT NULL,
  brand_color                 text NOT NULL DEFAULT '#66A4FF',
  logo_url                    text,
  favicon_url                 text,
  custom_domain               text UNIQUE,
  custom_domain_status        text NOT NULL DEFAULT 'none'
                              CHECK (custom_domain_status IN ('none','pending_dns','verified','failed')),
  custom_domain_verified_at   timestamptz,
  stripe_connect_account_id   text UNIQUE,
  stripe_connect_status       text NOT NULL DEFAULT 'none'
                              CHECK (stripe_connect_status IN ('none','pending','active','disconnected')),
  max_customers               integer NOT NULL DEFAULT 50,
  status                      text NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','suspended','deleted')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agencies_owner_user_id_idx ON public.agencies (owner_user_id);
CREATE INDEX IF NOT EXISTS agencies_slug_idx ON public.agencies (slug);
CREATE INDEX IF NOT EXISTS agencies_custom_domain_idx ON public.agencies (custom_domain) WHERE custom_domain IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_agencies ON public.agencies;
CREATE TRIGGER set_updated_at_agencies BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────── agency_id on existing tables ───────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS profiles_agency_id_idx ON public.profiles (agency_id);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS customers_agency_id_idx ON public.customers (agency_id);

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS pricing_plans_agency_id_idx ON public.pricing_plans (agency_id);

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS integrations_agency_id_idx ON public.integrations (agency_id);

ALTER TABLE public.customer_invitations
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS customer_invitations_agency_id_idx ON public.customer_invitations (agency_id);

ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS intended_agency_slug text;

-- ─────────── helper function ───────────
CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- CHUNK C: RLS policies (need the enum value + helper function from chunks A+B)
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────── RLS on agencies itself ───────────
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_agencies" ON public.agencies;
CREATE POLICY "admin_full_access_agencies" ON public.agencies
  FOR ALL USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "agency_owner_reads_own_agency" ON public.agencies;
CREATE POLICY "agency_owner_reads_own_agency" ON public.agencies
  FOR SELECT USING (id = public.current_user_agency_id());

DROP POLICY IF EXISTS "agency_owner_updates_own_agency" ON public.agencies;
CREATE POLICY "agency_owner_updates_own_agency" ON public.agencies
  FOR UPDATE USING (id = public.current_user_agency_id());

-- ─────────── customers: add agency_owner policy ───────────
DROP POLICY IF EXISTS "agency_owner_full_access_own_customers" ON public.customers;
CREATE POLICY "agency_owner_full_access_own_customers" ON public.customers
  FOR ALL USING (agency_id = public.current_user_agency_id());

-- ─────────── pricing_plans: add agency_owner policy ───────────
DROP POLICY IF EXISTS "agency_owner_full_access_own_pricing_plans" ON public.pricing_plans;
CREATE POLICY "agency_owner_full_access_own_pricing_plans" ON public.pricing_plans
  FOR ALL USING (agency_id = public.current_user_agency_id());

-- ─────────── integrations: add agency_owner policy ───────────
DROP POLICY IF EXISTS "agency_owner_full_access_own_integrations" ON public.integrations;
CREATE POLICY "agency_owner_full_access_own_integrations" ON public.integrations
  FOR ALL USING (agency_id = public.current_user_agency_id());

-- ─────────── customer_invitations: add agency_owner policy ───────────
DROP POLICY IF EXISTS "agency_owner_full_access_own_invitations" ON public.customer_invitations;
CREATE POLICY "agency_owner_full_access_own_invitations" ON public.customer_invitations
  FOR ALL USING (agency_id = public.current_user_agency_id());

-- ─────────── voice_agents: transitive via customer.agency_id ───────────
DROP POLICY IF EXISTS "agency_owner_full_access_own_voice_agents" ON public.voice_agents;
CREATE POLICY "agency_owner_full_access_own_voice_agents" ON public.voice_agents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = voice_agents.customer_id
        AND c.agency_id = public.current_user_agency_id()
    )
  );

-- ─────────── calls: transitive ───────────
DROP POLICY IF EXISTS "agency_owner_full_access_own_calls" ON public.calls;
CREATE POLICY "agency_owner_full_access_own_calls" ON public.calls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = calls.customer_id
        AND c.agency_id = public.current_user_agency_id()
    )
  );

-- ─────────── customer_subscriptions: transitive ───────────
DROP POLICY IF EXISTS "agency_owner_full_access_own_customer_subscriptions" ON public.customer_subscriptions;
CREATE POLICY "agency_owner_full_access_own_customer_subscriptions" ON public.customer_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_subscriptions.customer_id
        AND c.agency_id = public.current_user_agency_id()
    )
  );

-- ─────────── customer_permissions: transitive ───────────
DROP POLICY IF EXISTS "agency_owner_full_access_own_customer_permissions" ON public.customer_permissions;
CREATE POLICY "agency_owner_full_access_own_customer_permissions" ON public.customer_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_permissions.customer_id
        AND c.agency_id = public.current_user_agency_id()
    )
  );

-- ─────────── access_requests: agency_owner does NOT see these — admin only ───────────
-- (No new policy — admin keeps full access; partners don't see other signup requests)

-- ============================================================================
-- DONE. Verify by checking:
--   SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.user_role'::regtype;
--   → should include 'admin', 'customer_owner', 'agency_owner'
--   SELECT count(*) FROM agencies; → 0 expected at first
--   SELECT relname, count(*) FROM pg_policies p
--     JOIN pg_class c ON c.relname = p.tablename
--     WHERE c.relnamespace = 'public'::regnamespace
--       AND p.policyname ILIKE 'agency_%'
--     GROUP BY relname;
-- ============================================================================

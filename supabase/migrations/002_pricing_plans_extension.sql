-- ============================================================================
-- AleksaAI App — Pricing Plans Extension (Step 6)
-- ============================================================================
-- Adds 'one_time' to pricing_plan_type enum.
-- Adds billing_interval column for flat / hybrid plans (month / year / one_time).
-- Adjusts type-consistency check constraint to cover new combinations.
-- ============================================================================

-- 1. Extend the enum
alter type public.pricing_plan_type add value if not exists 'one_time';

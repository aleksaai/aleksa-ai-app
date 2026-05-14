-- ============================================================================
-- AleksaAI App — Pricing Plans Billing Interval (Step 6)
-- ============================================================================
-- Run AFTER 002 has been committed (ALTER TYPE ADD VALUE must complete before
-- the new value can be used in CHECK constraints).
-- ============================================================================

-- 1. Add billing_interval column (default month for backward compat)
alter table public.pricing_plans
  add column if not exists billing_interval text not null default 'month'
  check (billing_interval in ('month', 'year', 'one_time'));

-- 2. Drop old constraint + add new one that covers one_time
alter table public.pricing_plans drop constraint if exists pricing_plans_type_consistency;

alter table public.pricing_plans add constraint pricing_plans_type_consistency check (
  (type = 'per_minute' and flat_amount_cents is null and per_minute_overage_cents is not null and billing_interval in ('month', 'year'))
  or (type = 'flat' and flat_amount_cents is not null and per_minute_overage_cents is null and billing_interval in ('month', 'year'))
  or (type = 'hybrid' and flat_amount_cents is not null and included_minutes is not null and per_minute_overage_cents is not null and billing_interval in ('month', 'year'))
  or (type = 'one_time' and flat_amount_cents is not null and per_minute_overage_cents is null and billing_interval = 'one_time')
);

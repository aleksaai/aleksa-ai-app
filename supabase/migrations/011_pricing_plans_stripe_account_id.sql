-- Track which Stripe (Connected) Account a pricing plan's Product+Price live on.
-- NULL = platform account (Aleksa's master). Otherwise = agency.stripe_connect_account_id.
-- Needed because agency-created plans must live on the partner's connected account,
-- not the platform account — otherwise Aleksa would receive their subscription revenue.

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS stripe_account_id text;

COMMENT ON COLUMN public.pricing_plans.stripe_account_id IS
  'Stripe Connect Connected Account ID (acct_...) the product+price live on. NULL = platform account.';

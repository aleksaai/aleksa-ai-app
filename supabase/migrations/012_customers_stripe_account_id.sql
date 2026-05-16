-- Track which Stripe (Connected) Account each customer lives on.
-- NULL = platform account (Aleksa's master). Otherwise = agency.stripe_connect_account_id.
-- Needed for SetupIntent + Subscription creation: a partner's customer must
-- have their Stripe Customer object on the partner's connected account,
-- otherwise the partner can't bill them.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS stripe_account_id text;

COMMENT ON COLUMN public.customers.stripe_account_id IS
  'Stripe Connect Connected Account ID the customer lives on. NULL = platform account.';

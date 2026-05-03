-- ============================================================================
-- AleksaAI App — Initial Schema (MVP)
-- ============================================================================
-- Run this in: Supabase Dashboard (puimwizupgkdvxpanlhy) → SQL Editor → New query
-- Paste this entire file → Click "Run"
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1. customers
-- ────────────────────────────────────────────────────────────────────────
create table public.customers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  contact_email      text not null,
  stripe_customer_id text unique,
  has_payment_method boolean not null default false,
  branding           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index customers_stripe_customer_id_idx on public.customers (stripe_customer_id);

-- ────────────────────────────────────────────────────────────────────────
-- 2. profiles (FK to auth.users — Supabase auth)
-- ────────────────────────────────────────────────────────────────────────
create type public.user_role as enum ('admin', 'customer_owner');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'customer_owner',
  customer_id uuid references public.customers(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_customer_id_idx on public.profiles (customer_id);

-- Trigger: auto-create profile on new auth.user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'customer_owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────────
-- 3. pricing_plans
-- ────────────────────────────────────────────────────────────────────────
create type public.pricing_plan_type as enum ('per_minute', 'flat', 'hybrid');

create table public.pricing_plans (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  type                     public.pricing_plan_type not null,
  flat_amount_cents        integer,
  included_minutes         integer,
  per_minute_overage_cents integer,
  currency                 text not null default 'EUR',
  stripe_product_id        text,
  stripe_flat_price_id     text,
  stripe_metered_price_id  text,
  archived                 boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- ensure correct fields are set per type
  constraint pricing_plans_type_consistency check (
    (type = 'per_minute' and flat_amount_cents is null and per_minute_overage_cents is not null)
    or (type = 'flat' and flat_amount_cents is not null and per_minute_overage_cents is null)
    or (type = 'hybrid' and flat_amount_cents is not null and included_minutes is not null and per_minute_overage_cents is not null)
  )
);

-- ────────────────────────────────────────────────────────────────────────
-- 4. voice_agents
-- ────────────────────────────────────────────────────────────────────────
create table public.voice_agents (
  id                          uuid primary key default gen_random_uuid(),
  customer_id                 uuid not null references public.customers(id) on delete cascade,
  elevenlabs_agent_id         text not null unique,
  elevenlabs_phone_number_id  text,
  display_name                text,
  pricing_plan_id             uuid references public.pricing_plans(id) on delete set null,
  active                      boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index voice_agents_customer_id_idx on public.voice_agents (customer_id);
create index voice_agents_pricing_plan_id_idx on public.voice_agents (pricing_plan_id);

-- ────────────────────────────────────────────────────────────────────────
-- 5. customer_subscriptions
-- ────────────────────────────────────────────────────────────────────────
create type public.subscription_status as enum ('active', 'past_due', 'canceled', 'trialing', 'incomplete');

create table public.customer_subscriptions (
  id                          uuid primary key default gen_random_uuid(),
  customer_id                 uuid not null references public.customers(id) on delete cascade,
  voice_agent_id              uuid not null references public.voice_agents(id) on delete cascade,
  pricing_plan_id             uuid not null references public.pricing_plans(id),
  stripe_subscription_id      text unique,
  stripe_subscription_item_id text,  -- the metered item id (for usage_record posts)
  status                      public.subscription_status not null default 'incomplete',
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index customer_subscriptions_customer_id_idx on public.customer_subscriptions (customer_id);
create index customer_subscriptions_voice_agent_id_idx on public.customer_subscriptions (voice_agent_id);
create index customer_subscriptions_status_idx on public.customer_subscriptions (status);

-- ────────────────────────────────────────────────────────────────────────
-- 6. calls (the heart — billing source of truth)
-- ────────────────────────────────────────────────────────────────────────
create table public.calls (
  id                         uuid primary key default gen_random_uuid(),
  voice_agent_id             uuid not null references public.voice_agents(id) on delete restrict,
  customer_id                uuid not null references public.customers(id) on delete restrict,
  elevenlabs_conversation_id text not null unique,  -- IDEMPOTENCY KEY
  started_at                 timestamptz not null,
  duration_secs              integer not null check (duration_secs >= 0),
  elevenlabs_cost_cents      integer,  -- our cost (for margin tracking)
  termination_reason         text,
  raw_payload                jsonb,
  reported_to_stripe_at      timestamptz,
  created_at                 timestamptz not null default now()
);

create index calls_voice_agent_id_idx on public.calls (voice_agent_id);
create index calls_customer_id_idx on public.calls (customer_id);
create index calls_reported_to_stripe_at_idx on public.calls (reported_to_stripe_at) where reported_to_stripe_at is null;
create index calls_started_at_idx on public.calls (started_at desc);

-- ────────────────────────────────────────────────────────────────────────
-- 7. customer_invitations
-- ────────────────────────────────────────────────────────────────────────
create table public.customer_invitations (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  email       text not null,
  token       text not null unique,
  used_at     timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index customer_invitations_token_idx on public.customer_invitations (token);
create index customer_invitations_email_idx on public.customer_invitations (email);

-- ────────────────────────────────────────────────────────────────────────
-- updated_at auto-update trigger (reusable)
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_customers before update on public.customers
  for each row execute function public.set_updated_at();
create trigger set_updated_at_profiles before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at_pricing_plans before update on public.pricing_plans
  for each row execute function public.set_updated_at();
create trigger set_updated_at_voice_agents before update on public.voice_agents
  for each row execute function public.set_updated_at();
create trigger set_updated_at_customer_subscriptions before update on public.customer_subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Pattern: 'admin' role sees/modifies everything.
--          'customer_owner' role sees/modifies only their own customer's data.
--          Service-role-key (used by Edge Functions) bypasses RLS.
-- ============================================================================

-- Helper function to check current user role (avoid recursive RLS on profiles)
create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_customer_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select customer_id from public.profiles where id = auth.uid();
$$;

-- ── profiles ──
alter table public.profiles enable row level security;

create policy "users_read_own_profile" on public.profiles
  for select using (auth.uid() = id);

create policy "admin_full_access_profiles" on public.profiles
  for all using (public.current_user_role() = 'admin');

-- ── customers ──
alter table public.customers enable row level security;

create policy "admin_full_access_customers" on public.customers
  for all using (public.current_user_role() = 'admin');

create policy "owner_read_own_customer" on public.customers
  for select using (id = public.current_user_customer_id());

-- ── voice_agents ──
alter table public.voice_agents enable row level security;

create policy "admin_full_access_voice_agents" on public.voice_agents
  for all using (public.current_user_role() = 'admin');

create policy "owner_read_own_voice_agents" on public.voice_agents
  for select using (customer_id = public.current_user_customer_id());

-- ── pricing_plans ──
alter table public.pricing_plans enable row level security;

create policy "admin_full_access_pricing_plans" on public.pricing_plans
  for all using (public.current_user_role() = 'admin');

create policy "owner_read_pricing_plans" on public.pricing_plans
  for select using (
    exists (
      select 1 from public.voice_agents va
      where va.pricing_plan_id = pricing_plans.id
      and va.customer_id = public.current_user_customer_id()
    )
  );

-- ── customer_subscriptions ──
alter table public.customer_subscriptions enable row level security;

create policy "admin_full_access_customer_subscriptions" on public.customer_subscriptions
  for all using (public.current_user_role() = 'admin');

create policy "owner_read_own_customer_subscriptions" on public.customer_subscriptions
  for select using (customer_id = public.current_user_customer_id());

-- ── calls ──
alter table public.calls enable row level security;

create policy "admin_full_access_calls" on public.calls
  for all using (public.current_user_role() = 'admin');

create policy "owner_read_own_calls" on public.calls
  for select using (customer_id = public.current_user_customer_id());

-- ── customer_invitations ──
alter table public.customer_invitations enable row level security;

create policy "admin_full_access_customer_invitations" on public.customer_invitations
  for all using (public.current_user_role() = 'admin');

-- (no customer_owner read access — invitations are admin-only)

-- ============================================================================
-- DONE. Verify by running:
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- (all 7 tables should have rowsecurity = true)
-- ============================================================================

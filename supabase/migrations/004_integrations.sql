-- ============================================================================
-- AleksaAI App — Integrations Layer (Architecture Refactor 2026-05-14)
-- ============================================================================
-- Introduces "Integrations" — reusable provider account connections (ElevenLabs,
-- RetellAI, Vapi, OpenAI). Voice-Agents reference an integration instead of
-- hardcoding the provider API key.
-- ============================================================================

create type public.integration_platform as enum ('elevenlabs', 'retellai', 'vapi', 'openai');
create type public.integration_region as enum ('us', 'eu');

create table public.integrations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  platform        public.integration_platform not null,
  api_key         text not null,
  region          public.integration_region,  -- only meaningful for elevenlabs
  vapi_public_key text,                       -- only for vapi
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index integrations_platform_idx on public.integrations (platform);

create trigger set_updated_at_integrations before update on public.integrations
  for each row execute function public.set_updated_at();

alter table public.integrations enable row level security;

create policy "admin_full_access_integrations" on public.integrations
  for all using (public.current_user_role() = 'admin');

-- ============================================================================
-- AleksaAI App — voice_agents Refactor to Integrations (2026-05-14)
-- ============================================================================
-- voice_agents drops the hardcoded `elevenlabs_agent_id` / `elevenlabs_phone_number_id`
-- columns and gains `integration_id` + `platform_agent_id` + `platform_phone_number_id`
-- so the same row works for any provider.
--
-- Pre-condition: voice_agents + customer_subscriptions + calls all empty
-- (verified before running this migration).
-- ============================================================================

-- 1. Safety net: drop dependent data (should already be empty)
delete from public.calls;
delete from public.customer_subscriptions;
delete from public.voice_agents;

-- 2. Drop old columns + unique constraint on elevenlabs_agent_id
alter table public.voice_agents
  drop constraint if exists voice_agents_elevenlabs_agent_id_key;

alter table public.voice_agents
  drop column elevenlabs_agent_id,
  drop column elevenlabs_phone_number_id;

-- 3. Add new columns
alter table public.voice_agents
  add column integration_id           uuid references public.integrations(id) on delete restrict,
  add column platform_agent_id        text,
  add column platform_phone_number_id text;

-- 4. Constraints: integration_id + platform_agent_id are required + unique together
alter table public.voice_agents
  alter column integration_id set not null,
  alter column platform_agent_id set not null;

alter table public.voice_agents
  add constraint voice_agents_integration_platform_agent_unique
  unique (integration_id, platform_agent_id);

create index voice_agents_integration_id_idx on public.voice_agents (integration_id);

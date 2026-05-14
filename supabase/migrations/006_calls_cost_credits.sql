-- ============================================================================
-- AleksaAI App — calls.elevenlabs_cost_cents → elevenlabs_cost_credits
-- ============================================================================
-- ElevenLabs sends `metadata.cost` as Credits (their internal unit), NOT cents.
-- Renaming the column to make that explicit + correcting the only existing row.
-- ============================================================================

alter table public.calls rename column elevenlabs_cost_cents to elevenlabs_cost_credits;

-- The one existing test row was inserted with cost*100 — divide back.
update public.calls
set elevenlabs_cost_credits = elevenlabs_cost_credits / 100
where elevenlabs_cost_credits is not null;

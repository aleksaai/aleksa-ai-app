# AleksaAI App

Whitelabel customer portal + billing platform for ElevenLabs voice-agent reseller business.

**Status:** 🔵 Spec done, MVP build starting
**Live:** `app.aleksa.ai` (planned)
**Stack:** React + Vite + TS + Tailwind + Supabase + Stripe Tiered Metered Billing + ElevenLabs

## Quick start

```bash
pnpm install
cp .env.example .env.local  # fill in real values
pnpm dev
```

## Docs

- [`SPEC.md`](./SPEC.md) — what this is, data model, edge functions, acceptance criteria
- [`BUILD-PLAN.md`](./BUILD-PLAN.md) — numbered execution steps (MVP)
- [`HANDOFF.md`](./HANDOFF.md) — current state, what's next
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code project context

## Architecture (high-level)

```
ElevenLabs post_call_webhook
   └→ webhook-elevenlabs (Edge Function)
       └→ Supabase: insert into calls (idempotent)

Daily Cron (02:00 UTC)
   └→ cron-stripe-usage
       └→ Aggregate calls.duration_secs since last_reported
       └→ POST usage_records to Stripe Subscription Item
       └→ Mark calls as reported

Stripe (monthly)
   └→ Auto-Invoice + Auto-Charge customer card
   └→ Stripe Webhook → webhook-stripe → update DB status
```

## Auth model

- `admin` (Aleksa) — full access via RLS bypass
- `customer_owner` (his clients) — RLS-scoped to their own customer_id

## License

Private. Owned by Spalevic Consulting Kft.

# HANDOFF.md — AleksaAI App

> Cross-session + cross-device onboarding. Read this when picking up work. Update at end of each session.

## Last update

**2026-05-14** — Marcus (full documentation pass after V2 Call-Detail shipped; everything below reflects the live state)

## Current state

🟢 **MVP + V1.5 + V2 partial LIVE on `app.aleksa.ai`** — ChatDash-replaceable, Customer Self-Service operational, Call-Detail with Transcript + Audio working.

### Recent end-to-end verifications (all on prod)

- ✅ Magic-Link login (Admin + Customer)
- ✅ Customer onboarding (B2C + B2B with VAT-ID + DE Reverse-Charge)
- ✅ Voice-Agent assignment from ElevenLabs API → Subscription start
- ✅ Real call from `+49 2271 481 2988` (Translator-DE-HU agent) → row in `calls` table
- ✅ Daily-Cron `cron-stripe-usage` triggered manually → 2 min pushed to Stripe → Subscription Item shows usage
- ✅ Permission-gated Customer-Selfservice for Prompt + Voice + KB
- ✅ Call-Detail page with Transcript bubbles + Audio playback (proxied)

## What lives where

| Resource | URL/Location |
|---|---|
| Production | https://app.aleksa.ai |
| GitHub | https://github.com/aleksaai/aleksa-ai-app |
| Supabase (separate account `aleksa@spalevic-consulting.de`) | https://supabase.com/dashboard/project/puimwizupgkdvxpanlhy |
| Stripe (Account 1 `acct_1RlQZ6JH4KmjuYHx`, **TEST mode**) | https://dashboard.stripe.com/test/dashboard |
| ElevenLabs Workspace Webhooks | https://elevenlabs.io/app/conversational-ai/settings → Webhooks |
| Netlify Build | (Aleksa's netlify dashboard) |
| Resend (verified domain `projekt.aleksa.ai`) | https://resend.com/domains |
| Local repo | `~/Desktop/Projects/aleksa-ai-app/` |

## Deployed Edge Functions (22)

All under `https://puimwizupgkdvxpanlhy.supabase.co/functions/v1/<slug>`. See `ARCHITECTURE.md` for signatures.

| Slug | Latest |
|---|---|
| accept-invitation | v1 |
| admin-assign-pricing | v2 |
| admin-create-customer | v4 |
| admin-create-integration | v1 |
| admin-create-kb-doc | v2 |
| admin-create-pricing-plan | v2 |
| admin-create-voice-agent | v2 |
| admin-get-agent-config | v3 |
| admin-get-call-audio | v1 |
| admin-get-call-detail | v1 |
| admin-list-kb-docs | v2 |
| admin-list-platform-agents | v1 |
| admin-list-voices | v2 |
| admin-update-agent-config | v2 |
| admin-update-agent-kb | v2 |
| cron-stripe-usage | v1 |
| customer-billing-portal | v1 |
| link-invitation | v1 |
| setup-intent | v1 |
| update-customer-business | v1 |
| webhook-elevenlabs | v3/v4 (current state v4) |
| webhook-stripe | v4 |

## Decisions on record

- **Naming:** `aleksa-ai-app` (repo) + `app.aleksa.ai` (subdomain)
- **Supabase:** separate account `aleksa@spalevic-consulting.de`, project `puimwizupgkdvxpanlhy`
- **Stripe Account:** Account 1 (`acct_1RlQZ6JH4KmjuYHx`, HU base) — Stripe Tax enabled. All subscriptions/products tagged with `metadata.source = 'aleksa-ai-app'` for Lisa's bookkeeping
- **Stripe API Version pin:** `2024-12-18.acacia` — keeps legacy metered prices + usage_records flow working (post-Basil API requires Meters)
- **ElevenLabs EU region:** stored in `integrations.region` per Aleksa's pick, but backend always uses US base URL until Enterprise upgrade (frontend label is honest about user's choice though)
- **Lokales Node nicht installiert:** alle Frontend-Builds via Netlify (auto-deploy on git push). Marcus testet via Chrome-MCP
- **API keys** in `integrations.api_key`: plaintext, RLS-locked to admin-only. Move to Supabase Vault when budget allows
- **One-time pricing:** stored in `customer_subscriptions` for record-keeping (status='active', stripe_subscription_id = invoice_id)
- **Permissions:** default all FALSE per customer. Admin opens features manually
- **`ELEVENLABS_WEBHOOK_SECRET`** (singular, was originally named with `_HMAC_` infix — function accepts both names for back-compat)

## What's next

See `ROADMAP.md` § "Next Up" — top 3:
1. **Abrechnungen-Tab** with Produkte + Abos sub-tabs (~1.5h)
2. **RetellAI Support** end-to-end (~2h)
3. **Whitelabel V2** with subdomains + per-customer branding (~2-3h)

Plus: when Aleksa is ready → **Live-Mode switch + VV-Cars migration** with 1 week of ChatDash overlap.

## Open Aleksa items (pending real-world testing)

- Walk through `TESTING.md` end-to-end and report any issues
- Verify Stripe Tax actually produces 0% Reverse-Charge invoices for B2B (would need to trigger an end-of-period invoice in Test Mode manually)
- Decide if ElevenLabs Enterprise EU upgrade is worth it (currently `region: 'eu'` is cosmetic-only)

## Risks / WIP / Blockers

- **None blocking the MVP.** Production-ready for soft-launch with one careful customer.
- **Tech-debt list** in `ROADMAP.md` § "Architectural Tech-Debt" — none critical, all postponable

## How a new Claude Code session picks up

1. `cd ~/Desktop/Projects/aleksa-ai-app && git pull`
2. Claude Code auto-loads `CLAUDE.md`
3. Read `HANDOFF.md` (this file) for current state
4. Read `ARCHITECTURE.md` only if extending backend
5. Read `ROADMAP.md` to pick the next thing
6. If acting as Marcus: invoke `/marcus` slash command — that triggers Marcus persona loading from claude-team

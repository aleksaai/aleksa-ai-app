# HANDOFF.md — OpenPenguin Voice

> Cross-session + cross-device onboarding. Read this when picking up work. Update at end of each session.

## Last update

**2026-05-16** — Marcus (major rebrand to OpenPenguin Voice + new domain + new auth/signup flow + interim platform_member separation)

## Current state

🟢 **MVP + V1.5 + V2 LIVE on `platform.openpeng.de`** — voice-agent platform fully functional. Self-service signup-request flow operational. Magic-link, email+password, Google OAuth all work. Community-member onboarding in production (no Stripe step).

### What was done this session (2026-05-16)

- **Rebrand:** AleksaAI → **OpenPenguin Voice** across UI, page title, email templates
- **Domain:** `app.aleksa.ai` → **`platform.openpeng.de`** (Supabase Site URL + APP_URL secret updated)
- **Login:** Magic-link-only → **Email + Passwort + Google OAuth + Passwort-Reset** (`/reset-password`)
- **Signup-request flow:** Public `/signup` page → `access_requests` table → admin reviews on `/admin/requests` → approval triggers Magic-Link directly to `/onboarding` (one-click, no `/invite/:token` intermediate)
- **Onboarding:** dropped Stripe SetupIntent step — community members don't pay us. Now just: linking → password → done
- **Account page:** `/account` (in sidebar/topbar) — user can link/unlink Google, change password
- **Customer-kind separation:** new `customers.customer_kind` column (`voice_customer` | `platform_member`). Community members tagged as `platform_member`, hidden from admin overview, no Stripe customer created
- **Logo + favicon:** swapped to cute cartoon penguin (`public/logo-color.png` + `public/favicon.png`) on transparent — no more blue gradient box wrapper
- **TS build fix:** removed unused `useNavigate` from Account.tsx (noUnusedLocals strict)

### Recent end-to-end verifications (all on prod)

- ✅ Magic-Link login (Admin + Customer)
- ✅ Customer onboarding (B2C + B2B with VAT-ID + DE Reverse-Charge) — _still works for legacy voice_customer paying clients_
- ✅ Voice-Agent assignment from ElevenLabs API → Subscription start
- ✅ Real call from `+49 2271 481 2988` (Translator-DE-HU agent) → row in `calls` table
- ✅ Daily-Cron `cron-stripe-usage` triggered manually → 2 min pushed to Stripe → Subscription Item shows usage
- ✅ Permission-gated Customer-Selfservice for Prompt + Voice + KB
- ✅ Call-Detail page with Transcript bubbles + Audio playback (proxied)

### New flow verified this session

- ✅ Public `/signup` → access_request row created
- ✅ Admin `/admin/requests` → approve → magic-link email goes out via Resend
- ✅ Magic-link click → `/onboarding` → password setup → `/dashboard`
- ⚠️ Community-member-as-platform-member: needs end-to-end test with a fresh signup after the session's last fix landed

## What lives where

| Resource | URL/Location |
|---|---|
| **Production** | **https://platform.openpeng.de** |
| Legacy domain (in Auth allow-list for back-compat, Netlify-Alias removed) | https://app.aleksa.ai → currently shows "Site not found" |
| GitHub | https://github.com/aleksaai/aleksa-ai-app |
| Supabase (separate account `aleksa@spalevic-consulting.de`) | https://supabase.com/dashboard/project/puimwizupgkdvxpanlhy |
| Stripe (Account 1 `acct_1RlQZ6JH4KmjuYHx`, **TEST mode**) | https://dashboard.stripe.com/test/dashboard |
| ElevenLabs Workspace Webhooks | https://elevenlabs.io/app/conversational-ai/settings → Webhooks |
| Netlify Build | (Aleksa's netlify dashboard, site connected to `platform.openpeng.de`) |
| Resend (verified domain `projekt.aleksa.ai`) | https://resend.com/domains |
| Local repo | `~/Desktop/Projects/aleksa-ai-app/` |

## Auth + URL configuration (updated this session)

- **Supabase Auth Site URL:** `https://platform.openpeng.de`
- **Supabase Auth URI allow-list:** `https://platform.openpeng.de/**, https://app.aleksa.ai/**` (legacy still allowed for any old magic-links in inboxes)
- **Edge Function `APP_URL` secret:** `https://platform.openpeng.de`
- **Google OAuth Client (re-used from claude-team's "Claude Agents" GCP project):**
  - Client ID: `769424457308-j6mlrac2jbcnggvv9vla8l2slohvblpg.apps.googleusercontent.com`
  - Required redirect URI in GCP Console: `https://puimwizupgkdvxpanlhy.supabase.co/auth/v1/callback`
  - Required JS origin in GCP Console: `https://platform.openpeng.de`
  - Configured in **aleksa-ai-app** Supabase Auth → Providers → Google

## Deployed Edge Functions (24 — added 1, updated 5 this session)

All under `https://puimwizupgkdvxpanlhy.supabase.co/functions/v1/<slug>`.

| Slug | Latest | Notes |
|---|---|---|
| accept-invitation | v1 | legacy /invite/:token flow, still works |
| admin-assign-pricing | v2 | |
| **admin-create-customer** | **latest (this session)** | now accepts `kind` param + skips Stripe for `platform_member` + uses `auth.admin.generateLink` for direct magic-link |
| admin-create-integration | v1 | |
| admin-create-kb-doc | v2 | |
| admin-create-pricing-plan | v2 | |
| admin-create-voice-agent | v2 | |
| **admin-get-agent-config** | v5 (Retell-aware) | dispatches by platform |
| admin-get-call-audio | v1 | |
| admin-get-call-detail | v1 | |
| **admin-get-voice** | **v2 (new — also Retell-aware)** | created this session for "add voice by ID" feature |
| admin-list-kb-docs | v2 | |
| admin-list-platform-agents | v1 | |
| **admin-list-voices** | v3 (Retell-aware) | |
| **admin-update-agent-config** | v4 (Retell-aware, language/tts_model/llm/language_presets) | |
| admin-update-agent-kb | v2 | |
| cron-stripe-usage | v1 | |
| customer-billing-portal | v1 | |
| link-invitation | v1 | |
| setup-intent | v1 | no longer called by Onboarding (community members), keep for future paying-tier |
| update-customer-business | v1 | |
| webhook-elevenlabs | v4 | |
| webhook-stripe | v4 | |

**Not yet built:** `webhook-retellai` (would persist Retell call data into `calls` table, mirroring webhook-elevenlabs).

## Decisions on record (this session adds at top)

### New (this session)

- **Product name:** **OpenPenguin Voice** — sub-brand under the OpenPenguin community (openpeng.de)
- **Primary domain:** `platform.openpeng.de` (subdomain of openpeng.de). Future product subdomains pattern: `voice.openpeng.de`, `chat.openpeng.de`, `mail.openpeng.de`
- **Whitelabel target users:** members of Aleksa's KI-Schule / OpenPenguin community (initially 10-20 people, community perk, not paid SaaS)
- **Whitelabel future subdomains:** members pick their own slug (e.g. `stephan.openpeng.de`, `kihelden.openpeng.de`). Custom domains (`app.kihelden.de`) come in a later phase via Netlify domain aliases (Free plan supports ~50, Pro $20/mo needed for wildcard or more)
- **BYO Everything for agencies:** each whitelabel member brings their own Stripe (via Connect), ElevenLabs API key, Retell key, etc. They pay nothing to Aleksa
- **Auth providers active:** email+password (primary), Google OAuth (additional, can be linked from `/account`), Magic-Link (used for invitation flow only)
- **Signup:** invite-only. Public `/signup` is a request form. Aleksa manually approves on `/admin/requests`. Approval sends one-click magic-link → `/onboarding` → password → dashboard
- **Customer-kind separation (interim):** `customers.customer_kind` = `voice_customer` | `platform_member`. Hides community members from admin overview without requiring full multi-tenant refactor

### Legacy (from prior sessions, still active)

- **Repo + Supabase project:** `aleksa-ai-app` GitHub, Supabase project `puimwizupgkdvxpanlhy` (separate Supabase account `aleksa@spalevic-consulting.de`)
- **Stripe Account:** Account 1 (`acct_1RlQZ6JH4KmjuYHx`, HU base) — Stripe Tax enabled. All subscriptions/products tagged with `metadata.source = 'aleksa-ai-app'` for Lisa's bookkeeping
- **Stripe API Version pin:** `2024-12-18.acacia`
- **Lokales Node nicht installiert:** alle Frontend-Builds via Netlify (auto-deploy on git push). Marcus testet ohne lokalen Preview-Server. Frontend-Verifikation läuft via Netlify-Deploy auf `platform.openpeng.de`
- **API keys** in `integrations.api_key`: plaintext, RLS-locked to admin-only. Move to Supabase Vault when budget allows

## What's next (see ROADMAP.md for the prioritized list)

### Immediate (next 1-2 sessions)

1. **Clean up legacy customer rows mistakenly created as voice_customer** — if Aleksa has test-approved community members from BEFORE the customer_kind separation, they're still tagged `voice_customer` and visible in `/admin`. Quick SQL fix: UPDATE customers SET customer_kind='platform_member' WHERE contact_email IN (SELECT email FROM access_requests WHERE status='approved')
2. **End-to-end test the new signup-approval-onboarding flow** with a fresh email
3. **Decide on app.aleksa.ai legacy domain** — either re-add as Netlify alias for back-compat or fully retire (kill the DNS)

### Multi-Tenant Agency Tier (Phase 1, ~1 week of focused work)

The proper fix for the customer_kind interim hack. Specs partly drafted in this session's conversation:

- **DB:** new `agencies` table (id, owner_user_id, slug, display_name, custom_domain, custom_domain_status, brand_color, dashboard_logo_url, login_logo_url, favicon_url, website_title, loading_icon, max_customers, status). All existing tables (customers, voice_agents, pricing_plans, integrations) get `agency_id` column. RLS gets refactored.
- **Profile.role:** extend enum: `platform_admin` | `agency_owner` | `customer_owner`
- **Tenant-Detection:** frontend reads `window.location.hostname` → loads agency config via `slug` (subdomain) or `custom_domain` (Custom-Domain match)
- **Branding-Engine:** `--accent-*` CSS-Vars are already prepared. Each agency overrides on load
- **Agency-Onboarding-Wizard:** slug + brand-color + logo + (optional) custom-domain
- **Agency-Dashboard:** ChatDash-inspired with `Home`, `Clients`, `Agents`, `Settings → Agency / Whitelabel / Integrations / Subscription`
- **Custom-Domain-Flow:** member enters domain → backend instructs CNAME → "Verifizieren" button checks DNS → Netlify API adds alias → SSL auto-provisions
- **Stripe Connect for agency-owned billing:** members connect their own Stripe; their customers pay them directly
- **Platform-Admin UI:** new `/platform-admin/*` for Aleksa to see ALL agencies + override

### Smaller items

- **webhook-retellai** — for Retell-AI integrations to actually populate the `calls` table (analytics + transcripts)
- **Admin AgentDetail (`/admin/agents/:id`)** — still ElevenLabs-only labels. Customer-AgentDetail already platform-aware. Bring admin to parity
- **Email-template polish** — currently approval email is functional but plain. Could match the OpenPenguin Voice branding better
- **Retell Knowledge Base** — currently Wissensbasis tab hidden for Retell agents

## Open Aleksa items

- Test the full signup → approval → onboarding flow with a fresh test email after the latest commit
- Decide whether to re-add `app.aleksa.ai` as a Netlify domain alias (for any leftover magic-links in inboxes)
- Decide on the next major direction: ship Multi-Tenant Agency Tier OR stabilize what's there + onboard 1-2 community members manually first

## Risks / WIP / Blockers

- **None blocking.** Platform is functional for community-member onboarding via the manual-approval path.
- **Multi-tenant RLS bugs are catastrophic** — when we build Phase 1, the access-isolation tests are non-negotiable (Agency A must NEVER see Agency B's data)

## How a new Claude Code session picks up

1. `cd ~/Desktop/Projects/aleksa-ai-app && git pull`
2. Claude Code auto-loads `CLAUDE.md`
3. Read this `HANDOFF.md` for current state
4. Read `ARCHITECTURE.md` only if extending backend
5. Read `ROADMAP.md` to pick the next thing
6. If acting as Marcus: invoke `/marcus` slash command — that triggers Marcus persona loading from claude-team
7. **If working on Multi-Tenant Phase 1:** also read the "Multi-Tenant Agency Tier" plan in this file's "What's next" section

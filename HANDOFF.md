# HANDOFF.md — OpenPenguin Voice

> Cross-session + cross-device onboarding. Read this when picking up work. Update at end of each session.

## Last update

**2026-05-16** — Marcus (Multi-Tenant Phase 1b shipped: Stripe Connect Standard flow, Platform-admin override UI, Partner-side voice-agent CRUD with own integrations. Phase 1 build is now feature-complete; only Vault-secret prereqs + Aleksa-side DNS-wildcard remain before partners can be live-onboarded.)

## Multi-Tenant Phase 1b — what landed (2026-05-16, V5)

Built on top of Phase 1a's foundation (agencies table, tenant detection, onboarding wizard, whitelabel editor, custom-domain verification).

### Phase J — Platform-admin override UI

`/platform-admin/agencies` lists every agency Aleksa has approved, with per-row customer-count + voice-agent-count + 30-day call-count. Click-through to `/platform-admin/agencies/:id` shows full agency record + customer list + action buttons:

- **Suspendieren** / **Reaktivieren** — flips `agencies.status`. When suspended, `get_agency_branding` RPC returns null so the subdomain stops resolving with branding (login still works on `platform.openpenguin.de`).
- **Stripe trennen** — clears `stripe_connect_account_id` + `stripe_connect_status='disconnected'` (note: doesn't call Stripe's revoke endpoint — that happens from the partner side via `stripe-connect-disconnect` Edge Function).
- **Custom-Domain manuell verifizieren** — flips status to `'verified'` when DNS hasn't propagated yet but Aleksa knows the partner has set the CNAME.

No new Edge Functions needed; admin RLS bypass covers everything.

### Phase G — Stripe Connect Standard flow

Three new Edge Functions:
- **`stripe-connect-start`** — reads `STRIPE_CONNECT_CLIENT_ID` from Postgres Vault, builds Stripe OAuth URL with `state = base64({aid, origin, n})`, returns to frontend.
- **`stripe-connect-callback`** — exchanges OAuth code → `stripe_user_id`, verifies state matches caller's agency_id, persists on agency.
- **`stripe-connect-disconnect`** — calls Stripe `/oauth/deauthorize` (graceful if Vault missing), clears local fields.

Frontend page `/agency/settings/stripe-callback` bounces partner back to their tenant origin after success. PaymentsTab in AgencySettings shows Connect/Disconnect buttons + status pill.

### Phase E voll — Partner voice-agent CRUD

Three new Edge Functions:
- **`agency-create-integration`** — partner adds their own ElevenLabs/Retell/Vapi/OpenAI API key. agency_id auto-set.
- **`agency-list-platform-agents`** — fetches platform agents from ElevenLabs/Retell API for a given (partner-owned or platform-default) integration.
- **`agency-create-voice-agent`** — assigns a platform agent to a partner's customer with full agency_id verification on both customer and integration.

Frontend:
- `/agency/integrations` page — manage own provider accounts.
- Voice-agent assignment dialog inline in `/agency/customers/:id`.
- `Integrationen` nav item in AgencyShell.

### Build verification

Full local build chain runs clean:
- `npx tsc --noEmit` — 0 errors (caught + fixed unused `ColorField` helper that would have killed Netlify).
- `npm run build` — 1.45s, 200kB gzipped, no warnings beyond the routine Vite chunk-size hint.
- Local preview snapshot shows OpenPenguin login rendering correctly with brand assets.

### What still needs your input (Aleksa, in your time)

| Action | Where | Effect |
|---|---|---|
| **Put `STRIPE_CONNECT_CLIENT_ID` in Vault** | Supabase Dashboard → Database → Vault → New Secret. Name: `STRIPE_CONNECT_CLIENT_ID`, value: `ca_…` from Stripe Dashboard → Connect → Onboarding-Einstellungen | Without this, "Mit Stripe verbinden" button returns a clear "vault_missing" error. Everything else works. |
| **Register Stripe OAuth redirect URI** | Stripe Dashboard → Connect → Onboarding-Einstellungen → Redirect URIs → add `https://platform.openpenguin.de/agency/settings/stripe-callback` | Required by Stripe to allow the OAuth flow. |
| **Put `NETLIFY_API_TOKEN` + `NETLIFY_SITE_ID` in Vault** | Same pattern. Token from https://app.netlify.com/user/applications, site_id from your Netlify site settings | Enables custom-domain auto-alias-add via `verify-custom-domain`. Without these, DNS verification still works; you just add the Netlify alias manually. |
| **Wildcard DNS `*.openpenguin.de` → Netlify** | Your DNS provider (Cloudflare/etc.) | Without it, partner subdomains don't resolve. Until then, partner can use `https://platform.openpenguin.de/agency` and the tenant-detection falls back to default brand. |

### Quick end-to-end flow you can test right now

1. `https://platform.openpenguin.de/admin/requests` — should see Lisa-Patricia-test-signups or you trigger a new one.
2. Click "Genehmigen & Einladen" on a pending request → check your inbox for the magic-link from `noreply@admin.openpenguin.de`.
3. Click the link → land on `/agency-onboarding?request_id=…`.
4. Pick slug like `test-partner` → next → display name + brand color → confirm.
5. (Wildcard DNS missing) Redirect to `https://test-partner.openpenguin.de/agency` will 404 unless you set the wildcard — but `https://platform.openpenguin.de/agency` shows the same dashboard via the brand fallback.
6. At the dashboard: Kunden → "+ Neuer Kunde". Integrationen → add a test ElevenLabs key. Customer detail → "+ Zuweisen" → pick agent. Settings → Whitelabel → change brand color → page reloads with new palette.
7. `/platform-admin/agencies` (from your admin account) → should see your test partner with stats.

### Total deployed Edge Functions on `puimwizupgkdvxpanlhy` (after Phase 1b)

30 functions live. New in Phase 1 + 1b:
- `admin-approve-as-agency`
- `agency-finalize-onboarding`
- `agency-create-customer`
- `agency-create-integration`
- `agency-create-voice-agent`
- `agency-list-platform-agents`
- `verify-custom-domain`
- `stripe-connect-start`
- `stripe-connect-callback`
- `stripe-connect-disconnect`

### Migrations applied this session (cumulative)

- `008_multi_tenant_phase1.sql` — agencies table, agency_id columns, RLS rewrites
- `009_public_agency_lookup.sql` — public `get_agency_branding` + `check_slug_availability` RPCs
- `010_agency_branding_storage.sql` — Storage RLS for the `agency-branding` bucket

---



## Multi-Tenant Phase 1 — what's live (2026-05-16, V4)

End-to-end partner-onboarding flow is functional:

1. Public `/signup` → access_request stored
2. Aleksa @ `/admin/requests` → "Genehmigen & Einladen" → calls `admin-approve-as-agency` Edge Function → partner gets branded email from `noreply@admin.openpenguin.de` with one-click magic-link → `/agency-onboarding?request_id=…`
3. Partner runs 3-step wizard: pick slug (live-availability checked via `check_slug_availability` RPC) → pick display name + brand color → confirm → `agency-finalize-onboarding` Edge Function creates agency, upgrades profile to `agency_owner`, redirects partner to `https://{slug}.openpenguin.de/agency`
4. Partner dashboard at `/agency`: stats overview + nav to Customers / Agents / Settings
5. Partner creates customers via `/agency/customers/new` → `agency-create-customer` Edge Function → customer with `agency_id` set + invitation email
6. Partner whitelabels at `/agency/settings` (Whitelabel tab): edit `display_name`, `brand_color`, upload logo to `agency-branding` Storage bucket — RLS-scoped to own folder. Page reload applies new palette via `TenantProvider`.
7. Partner sets custom domain at `/agency/settings` (Domain tab): enters `app.kihelden.de`, gets CNAME instruction, clicks "Verifizieren" → `verify-custom-domain` Edge Function does DNS lookup via Cloudflare DoH → status flips to `verified`. Netlify-alias-add hooks in if `NETLIFY_API_TOKEN` + `NETLIFY_SITE_ID` are in Vault.

### What's NOT done in Phase 1 (deferred to Phase 1b)

- **Stripe Connect** — partners can't yet collect their own customer payments. Aleksa handles billing manually. ~2-3h next-session work.
- **Platform-admin override UI** — Aleksa can't yet impersonate agencies via UI. He still has DB access + admin RLS bypass. ~1h next-session work.
- **Partner-side voice-agent CRUD** — list is read-only, partner can't yet assign agents to customers from `/agency`. Aleksa handles via existing `/admin/agents` flow (RLS now permits him to touch any agency's customers). ~1-2h next-session work.
- **Auto-provisioning Netlify subdomain wildcard** — `*.openpenguin.de` DNS must be wildcard-pointed at Netlify; until then new subdomains don't resolve. Aleksa one-time DNS setup needed.

### Vault secrets needed (Phase 1b prereqs)

- `NETLIFY_API_TOKEN` (PAT from https://app.netlify.com/user/applications) — for custom-domain auto-alias-add
- `NETLIFY_SITE_ID` (Netlify site ID for the openpenguin.de site) — same
- `STRIPE_CONNECT_CLIENT_ID` (from Stripe Connect settings, format `ca_…`) — for Phase G

Pattern: drop them in Supabase Dashboard → Vault. Marcus' Edge Functions read via `vault.decrypted_secrets` (Phase H already uses this pattern).

### New Edge Functions deployed this session

| Slug | Purpose |
|---|---|
| `admin-approve-as-agency` | Approve access_request + send agency-onboarding magic-link |
| `agency-finalize-onboarding` | Wizard final step: create agency row + upgrade profile |
| `agency-create-customer` | Partner creates customer under their agency |
| `verify-custom-domain` | DNS lookup + Netlify-alias add (graceful degradation if Netlify secrets missing) |

### New migrations applied

| File | What |
|---|---|
| `008_multi_tenant_phase1.sql` | agencies table, agency_id columns, agency_owner enum, RLS rewrites |
| `009_public_agency_lookup.sql` | Public SECURITY DEFINER RPCs `get_agency_branding(hostname)` + `check_slug_availability(slug)` |
| `010_agency_branding_storage.sql` | Storage RLS on agency-branding bucket (partner writes own folder, public reads) |

### Quick verification path (Aleksa)

1. Open `https://platform.openpenguin.de/admin/requests` — should see existing access_requests.
2. If there's no pending request: send a test signup from `/signup` with a real email you control.
3. Click "Genehmigen & Einladen" → should see "Eingeladen" pill on the row + an email arriving from `noreply@admin.openpenguin.de`.
4. Click the magic-link in email → land on `/agency-onboarding?request_id=…`.
5. Pick slug like `test-partner` → next → pick display name + color → confirm → page redirects to `https://test-partner.openpenguin.de/agency`.
6. ⚠️ The redirect target depends on wildcard DNS `*.openpenguin.de` being live at Netlify. If you haven't set up the wildcard, subdomain won't resolve — for now use `https://platform.openpenguin.de/agency` directly to test the dashboard.

---



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

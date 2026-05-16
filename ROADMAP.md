# ROADMAP.md — What's Next

> Tracks what's NOT yet built. Update when features ship.

## ✅ Shipped (chronological)

### MVP "ChatDash kündbar"
1. ✅ Vite scaffold + Magic Link Auth + Supabase setup
2. ✅ DB schema (7 → 8 tables with RLS)
3. ✅ Stripe Tax + Webhook + Customer Portal config
4. ✅ admin-create-customer Edge Function + Customer-CRUD UI
5. ✅ webhook-stripe Edge Function
6. ✅ Onboarding-Flow with Paywall + Stripe Setup-Intent
7. ✅ Pricing-Plans CRUD with 3 modes (hybrid, per_minute, one_time)
8. ✅ Voice-Agent + Subscription assignment
9. ✅ ElevenLabs Webhook (call tracking)
10. ✅ Daily Cron für Stripe Usage Reporting

### V1.5 "Vision Layer"
11. ✅ Integrations-Layer (ElevenLabs/RetellAI/Vapi/OpenAI Provider Accounts with US/EU region)
12. ✅ Voice-Agent auto-fetched from Provider API (no manual ID entry)
13. ✅ Agenten-Tab im Admin (alle Agents across customers)
14. ✅ Agent-Detail with Prompt + Voice + Knowledge Base editor (live-sync to ElevenLabs)
15. ✅ B2C/B2B Toggle + EU VAT ID for Reverse-Charge tax handling
16. ✅ Customer Dashboard with live stats per agent
17. ✅ Stripe Customer Portal integration
18. ✅ Admin "View as Customer" mode

### V2 "Self-Service + Call Inspection"
19. ✅ Customer Permissions System (5 toggles)
20. ✅ Customer-Selfservice for Agent Config (Prompt/Voice/KB)
21. ✅ Call-Detail Page with Transcript + Audio (permission-gated)
22. ✅ Audio Proxy Edge Function (keeps API key server-side)

### Documentation
23. ✅ CLAUDE.md — project context
24. ✅ ARCHITECTURE.md — technical deep-dive
25. ✅ SPEC.md — original spec + V1.5/V2 done-markers
26. ✅ TESTING.md — end-to-end test plan
27. ✅ HANDOFF.md — current state
28. ✅ ROADMAP.md — this file

### V4 "Multi-Tenant Agency Tier (Phase 1 full)" (2026-05-16)

Partners-Onboarding ist End-to-End live. Aleksa kann jetzt Community-Member als richtige Whitelabel-Partner approven; sie kriegen einen eigenen Account, eigene Subdomain ({slug}.openpenguin.de), optional eigene Custom-Domain, eigenes Branding, eigene Stripe-Verbindung, eigene Voice-Agents pro Kunde.

39. ✅ DB: `agencies` table + `agency_id` columns on customers/profiles/pricing_plans/integrations/customer_invitations; `agency_owner` role in user_role enum; helper `current_user_agency_id()`; full RLS rewrite for agency-scoped tables
40. ✅ Frontend tenant-detection (`useTenant`): hostname-based agency lookup via public `get_agency_branding` RPC + dynamic CSS-var palette injection from `brand_color`
41. ✅ Agency-owner dashboard: `/agency` (stats), `/agency/customers`, `/agency/agents`, `/agency/integrations`, `/agency/settings`
42. ✅ Onboarding wizard `/agency-onboarding`: slug picker (live availability check) → display name + brand color → finalize. `admin-approve-as-agency` + `agency-finalize-onboarding` Edge Functions.
43. ✅ Partner customer creation (`/agency/customers/new` + `agency-create-customer` Edge Function with `max_customers` enforcement + partner-branded Resend email)
44. ✅ Whitelabel editor in `/agency/settings`: editable display_name, brand_color (color-picker + hex), logo upload via Supabase Storage `agency-branding` bucket
45. ✅ Custom domain verification flow: partner enters domain → CNAME instruction → `verify-custom-domain` Edge Function does DNS lookup via Cloudflare DoH + (optional) Netlify-alias-add via Netlify API
46. ✅ Stripe Connect Standard flow: `stripe-connect-start` (Vault-backed CLIENT_ID), `stripe-connect-callback` (state-verified token exchange), `stripe-connect-disconnect`; PaymentsTab with Connect/Disconnect; bounce page at `/agency/settings/stripe-callback`
47. ✅ Partner voice-agent CRUD: `/agency/integrations` page (own ElevenLabs/Retell keys via `agency-create-integration`), inline AssignVoiceAgentForm in customer detail (`agency-list-platform-agents` + `agency-create-voice-agent`)
48. ✅ Platform-admin override UI: `/platform-admin/agencies` list + detail with suspend/reactivate, force-disconnect Stripe, manual custom-domain verify

### V5 "Phase 1c Hardening — Multi-Tenant End-to-End Bug-Sweep" (2026-05-16 spät)

39. ✅ Customer-Invite routing: `agency-create-customer` `redirectTo` jetzt auf `{tenantUrl}/onboarding?...` (Partner-Subdomain oder Custom-Domain), Email-HTML mit `agency.brand_color` + `agency.logo_url`
40. ✅ Auth `uri_allow_list` erweitert: `https://*.openpenguin.de/**` + `https://start.ki-hochschule.de/**`
41. ✅ `verify-custom-domain` Auto-add custom-domain zur Auth Allowlist (neues Secret `MGMT_API_PAT`)
42. ✅ **Stripe Connect Live-Mode aktiviert**: Live Client ID + Live API Keys + Live Webhook konfiguriert, `APP_URL` Secret korrigiert (`openpeng.de` → `openpenguin.de`)
43. ✅ `stripe-connect-start` mit `always_prompt=true` → kein Auto-Connect mit cached Stripe-Session
44. ✅ **Neuer Google OAuth Client** im separaten Cloud-Project `openpenguin` (External, Basic-Scopes) statt Internal-Lisa-Client → Partner können sich einloggen
45. ✅ **Partner-Übersicht (`/agency`) komplett umgebaut**: mirror `Admin.tsx` — Search + Kunden-Cards + "Neuer Kunde", keine Stats/Whitelabel-Box/Stripe-Box
46. ✅ Sidebar-Cleanup: "Kunden" raus (Übersicht IST Kunden), "Voice-Agents" → "Agenten", **"Pricing" rein**
47. ✅ **`agency-create-pricing-plan` Edge Function** + Page `AgencyPricing.tsx`: Stripe-Product/Prices auf Connected Account (via `Stripe-Account` Header), Migration 011 (`pricing_plans.stripe_account_id`)
48. ✅ **Whitelabel-Branding überall**: AuthShell + CustomerShell ziehen Logo+Name aus `useTenant()`, CustomerShell-Header zeigt Partner-Brand statt Customer-Name, Favicon-Fallback auf `logo_url`
49. ✅ **Customer Payment Setup auf Connected Account**: `agency-create-customer` legt Stripe-Customer auf Partner-Konto an, `setup-intent` agency-aware, neue `confirm-setup-intent` Edge Function (Connected Account Webhook-Substitute), Migration 012 (`customers.stripe_account_id`)
50. ✅ **PaymentSetupForm.tsx** mit Stripe Elements + `stripeAccount` param; `Onboarding.tsx` mit neuer `payment` phase (conditional)
51. ✅ Platform-Admin Overview-Pages scope auf Master-Only: `.is('agency_id', null)` in Admin/AgentsList/Integrations/PricingPlans

### V3 "OpenPenguin Voice Rebrand + Community-Member Onboarding" (2026-05-16)

29. ✅ Rebrand AleksaAI → **OpenPenguin Voice** (UI, page title, email templates)
30. ✅ Domain migration `app.aleksa.ai` → `platform.openpeng.de` (Supabase Auth + Edge Function APP_URL)
31. ✅ Login: Magic-Link-only → **Email+Password + Google OAuth + Forgot-Password** (`/reset-password`)
32. ✅ Public access-request flow: `/signup` page → `access_requests` table → `/admin/requests` review → approval triggers one-click magic-link → `/onboarding`
33. ✅ Onboarding password-step (replaces magic-link-only setup)
34. ✅ `/account` page — link/unlink Google identity, change password
35. ✅ `customers.customer_kind` separation (`voice_customer` | `platform_member`) — community members hidden from admin overview, no Stripe customer created
36. ✅ Cartoon-penguin logo + favicon (OpenPenguin Voice brand mark)
37. ✅ One-click magic-link in approval email (admin-create-customer now uses `supabase.auth.admin.generateLink({type:'invite'})` with direct redirect to `/onboarding?invitation_token=...`)
38. ✅ Onboarding drops Stripe SetupIntent step for community members (they don't pay)

---

## 🔜 Next Up (priorities for upcoming sessions)

### Multi-Tenant Phase 1c (smaller follow-ups, post Phase 1b)

- **Cross-subdomain auth (regressed in fbfd852)** — partner currently sees a login page after wizard finalizes on the new subdomain. Two viable approaches:
  - Cloudflare for SaaS Custom Hostnames API (gratis up to 100, then $0.10/hostname/month — also handles Custom-Domain partner sites with auto-SSL)
  - Edge Function that mints a short-lived signed JWT on the source subdomain + `/auth/handoff?token=...` consumer on the destination. No vendor dependency, but needs careful HMAC verification + replay protection.
- **Supabase invite flow redirectTo workaround** — currently rescued in three places (HomeRedirect / AgencyOnboarding / Onboarding) via `user.user_metadata.access_request_id`. Long-term: either watch for a Supabase fix OR fully migrate from invite flow to a custom flow that doesn't rely on Supabase's redirect plumbing.
- **Per-connected-account billing logic** — webhook-stripe extension to route Connected-Account events (event.account = acct_…) to the correct agency; partner-side subscription creation on their Stripe; pricing_plans-per-agency
- **Per-agency email templates** — Resend domain per agency (each partner verifies their own sender), partner-branded Welcome/Magic-Link emails
- **Per-agency analytics** — call cost margin tracking with partner-currency conversion, drill-down by agency
- **Partner-side voice-agent editing** — Prompt/Voice/KB tabs in `/agency/agents/:id` (currently Aleksa-handled via existing `/admin/agents/:id`)
- **Agency Pricing-Plans UI** — partner creates own plans + assigns them to customer voice-agents
- **Storage bucket creation via Management API** — current pattern is SQL INSERT into `storage.buckets` (POST /storage/buckets returns 404). Document the SQL approach in ARCHITECTURE.md if it stays the workaround.

### Multi-Tenant Agency Tier — Phase 1 (~1 week, the big one) [SUPERSEDED — see V4 above]

The proper architectural fix for the current `customer_kind=platform_member` workaround.

**DB schema:**
- New `agencies` table: `id, owner_user_id, slug, display_name, custom_domain, custom_domain_status, brand_color, dashboard_logo_url, login_logo_url, favicon_url, website_title, loading_icon, max_customers, status, created_at, updated_at`
- All existing customer-scoped tables (`customers`, `voice_agents`, `pricing_plans`, `integrations`) get an `agency_id` column. NULL = belongs to Aleksa directly (legacy voice_customer)
- `profiles.role` enum extended: `platform_admin` | `agency_owner` | `customer_owner`. `profiles.agency_id` added for agency_owner rows
- RLS-policies rewritten: every query scoped by `agency_id = current_user_agency_id()` (or platform_admin bypass)

**Tenant detection:**
- Frontend hook reads `window.location.hostname` on mount
- `platform.openpeng.de` → platform-admin view (Aleksa)
- `stephan.openpeng.de` → load agency where `slug='stephan'`, apply branding, show their dashboard
- `app.kihelden.de` (custom domain) → lookup `agencies.custom_domain` match

**Agency-Onboarding-Wizard:**
- After `/signup` → admin approval → user gets magic-link
- New Onboarding flow: chooses slug (e.g. `stephan` → `stephan.openpeng.de`), brand color, logo upload, optional custom domain
- Netlify API call to add the chosen subdomain as a domain-alias to the site (so SSL provisions)

**Agency-Dashboard (ChatDash-inspired):**
- Sidebar: Home / Clients / Agents / Settings → Agency, Whitelabel, Integrations, Subscription
- Member can: add their own ElevenLabs/Retell keys, add their own Stripe Connect, add their own customers, manage agents
- Strict tenant isolation — Aleksa NEVER sees agency-owner data via UI (only via platform-admin override later)

**Custom domain flow:**
- Member enters `app.kihelden.de` → backend instructs CNAME setup → "Verifizieren" button checks DNS → Netlify API adds alias → SSL auto-provisions
- Netlify Free supports ~50 domain aliases; if scale grows, switch to Cloudflare-for-SaaS or Caddy reverse proxy
- ToS-Note: Reselling-Hosting requires paid Netlify Pro ($20/mo). For free community-perk model (0-10 members) Free tier is gray-zone OK; upgrade once monetized

**Stripe Connect for agencies:**
- Members OAuth-connect their own Stripe Account
- Their customers pay them directly (Stripe Connect Standard model, agency keeps 100%, Aleksa charges no platform fee)

**Migration of existing platform_member rows:** one-time SQL — for each customer with kind='platform_member', create an `agencies` row, set their profile.role='agency_owner', profile.agency_id, then DELETE the obsolete customers row

### Smaller items (any session)

- **webhook-retellai** Edge Function — Retell's post-call signature scheme, mirrors webhook-elevenlabs. Without this, Retell-agents have no calls in the `calls` table → analytics blank for Retell users
- **Admin `/admin/agents/:id` Retell support** — Customer-AgentDetail is already platform-aware; admin AgentDetail still ElevenLabs-only labels
- **Retell Knowledge Base** — currently Wissensbasis tab hidden for Retell. Retell has its own KB-API; implement parallel branch
- **Email template polish** — Resend invite-email currently functional but plain. Add OpenPenguin Voice logo + better layout
- **Clean up legacy app.aleksa.ai domain** — decide: re-add as Netlify alias for backward compat, OR retire and let DNS expire
- **Cleanup of community members already created as voice_customer** — if Aleksa approved any community signups before 2026-05-16, they're still in `/admin` customer list. SQL: `UPDATE customers SET customer_kind='platform_member' WHERE contact_email IN (SELECT email FROM access_requests WHERE status='approved')`

### "Abrechnungen-Tab" (~1.5h) (legacy plan from V2 era)

### "Abrechnungen-Tab" (~1.5h)
Replace flat "Pricing-Pakete" tab with two sub-tabs:
- **Produkte** = current pricing-plans page (rename)
- **Abos** = NEW: list of all customer_subscriptions across customers, with status + plan + customer + agent + Stripe-link. "+ Neues Abo" form: pick customer → pick agent (must be assigned to customer) → pick plan → submit (replaces current per-customer-detail flow)
- Bonus: **Calls** sub-tab — flat list of all calls across customers (Admin only) for ops review

### RetellAI Support (~2h)
Backend foundation is ready (Integrations Layer accepts platform=retellai). Needs:
- Implement `listRetellAiAgents` in `admin-list-platform-agents` (uses `GET https://api.retellai.com/list-agents`)
- Implement Retell branch in `admin-get-agent-config` / `admin-update-agent-config` (different API shape than ElevenLabs)
- Build `webhook-retellai` Edge Function (Retell's post-call webhook signature scheme)
- Update voice picker (Retell voices vs ElevenLabs voices)
- Update Frontend dropdown logic to handle Retell quirks (no phone number_id, different agent_id format)

### Whitelabel V2 (~2-3h)
- Per-customer subdomain (`vv-cars.app.aleksa.ai`) → Netlify wildcard cert + routing config
- Customer-branding section in admin: logo upload (Supabase Storage) + primary color picker → persisted in `customers.branding` jsonb
- Frontend: read branding on login → swap logo + CSS variable for accent color
- Optional Custom Domain (`portal.vv-cars.de`) via CNAME + DNS verification flow

### Calls Analytics (~1h)
- Admin dashboard widget: total minutes / calls / revenue this period across all customers
- Per-customer drill-down: rolling 30-day chart of minutes
- Cost margin tracking: ElevenLabs Credits ↔ EUR conversion (per workspace tier) vs. Stripe revenue

### Live-Mode Switch (one-off, when ready)
Plan-Doc TBD. Major items:
- Switch Stripe Secret + Publishable + Webhook keys to live versions
- Re-register ElevenLabs Webhook URL on production Stripe (signing secret changes)
- DNS test: confirm `app.aleksa.ai` SSL valid
- ChatDash overlap-period plan (1 week parallel)
- Document the migration in `MIGRATION.md`

---

## 🔭 Future Ideas (not on near-term roadmap)

| Idea | Why later |
|---|---|
| **Stripe Meters API migration** | Pinning `2024-12-18.acacia` works for now. Migrate when Stripe deprecates the old usage_records API. Will rework Step 9 to send `meter_events` instead of `usage_records` |
| **Vapi & OpenAI integration parity** | Lower-priority providers; Aleksa primarily ElevenLabs/RetellAI |
| **Multi-Admin support** | Currently only Aleksa is admin. Add team/seat model when business grows |
| **Customer-to-Customer agent sharing** | Currently each agent belongs to exactly one customer. Some advanced use cases (white-label resellers?) would need many-to-many |
| **iOS/Android mobile dashboard** | Web-responsive is enough for V2; mobile-native is a year-out concern |
| **Public API for customers** | When customers want to programmatically integrate (e.g. CRM sync). Not requested yet |
| **Tools editor in agent UI** | ElevenLabs PATCH API can't modify tools (only rebuild). Would need a rebuild-via-`create_agent_full` flow + phone-reassign dance. Marcus' `knowledge.md` has the pattern |
| **Knowledge Base file upload (PDF, docs)** | Currently only text-based KB. ElevenLabs supports file uploads via `/v1/convai/knowledge-base/file` — implement when needed |
| **Real-time call dashboard** | Live call indicator + listen-in feature. Requires ElevenLabs WebRTC integration |
| **Reseller mode** (Aleksa's customers reselling to their own customers) | Wait until first customer asks for it |

---

## Architectural Tech-Debt

| Item | Severity | Effort |
|---|---|---|
| 6 Edge Functions called `admin-*` but actually accept customer_owner — rename to `agent-*` / `kb-*` etc. | Low (cosmetic) | ~30 min |
| ElevenLabs EU base URL switch hardcoded as `return 'https://api.elevenlabs.io'` in 9 places | Medium (when Enterprise upgrade) | ~30 min |
| Stripe Webhook handler logs `setup_intent.succeeded` failures only to console — no DB persistence | Low | ~15 min — add an `event_log` table |
| `customer_subscriptions.stripe_subscription_id` overloaded for one_time (stores invoice_id) | Medium (works, but confusing) | ~1h — add separate `stripe_invoice_id` column |
| No retry on transient Stripe API errors in cron | Medium | ~30 min — wrap stripeForm in retry-with-backoff |
| API keys stored plaintext in `integrations.api_key` | High (medium-term) | ~3h — use Supabase Vault + decrypt server-side. RLS already locks them to admin-only reads but defense-in-depth is worth it |
| `pg_cron` SQL has CRON_SECRET hardcoded; rotating the secret means updating both Supabase Secret AND cron schedule | Low | document in MIGRATION.md when first rotation happens |
| Same `display_name` field used for both human-facing display + invitation-email fallback — could diverge | Low | won't fix until it breaks |

---

## Test-Pause Checklist (Before Live Migration)

Before flipping to Stripe Live keys + onboarding the first real customer:

- [ ] Walk through every section of `TESTING.md`
- [ ] One end-to-end test from customer-invite to first Stripe-charged invoice
- [ ] Verify Stripe Tax: 0% MwSt invoice for valid EU B2B VAT
- [ ] Verify Reverse-Charge wording on Stripe-generated invoice PDF
- [ ] Verify cron actually ran 02:00 UTC last night (check `cron.job_run_details`)
- [ ] Verify Resend domain `projekt.aleksa.ai` still active + email arrives
- [ ] Backup Supabase DB before migration (Supabase Dashboard → Database → Backups)
- [ ] Plan: VV-Cars migration with 1 week of parallel ChatDash overlap

Once everything green: switch to Live mode, migrate VV-Cars, ChatDash cancellation 1 week later.

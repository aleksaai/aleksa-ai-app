# AleksaAI App — Claude Code Project Context

> Auto-loaded by every Claude Code session in this directory. Single source of truth for "what is this?" and "how do I work on it?". Keep up to date.

## What this is

**Whitelabel platform for Aleksa's ElevenLabs voice-agent reseller business.** Replaces ChatDash (~106€/m). Aleksa onboards customers, each customer gets a branded portal where:

- Customer hinterlegt Karte (Stripe Setup-Intent)
- Aleksa weist ihm Voice-Agents + Pricing-Pakete zu
- Voice-Agent ruft Customer-Calls über ElevenLabs ab
- Daily Cron pusht aufgelaufene Minuten an Stripe → Customer wird automatisch abgerechnet
- Customer kann (mit Permission) Prompts/Voice/Knowledge-Base selbst editieren

**Live:** `app.aleksa.ai`
**GitHub:** [`aleksaai/aleksa-ai-app`](https://github.com/aleksaai/aleksa-ai-app)
**Local Path:** `~/Desktop/Projects/aleksa-ai-app/`
**Supabase Project:** `puimwizupgkdvxpanlhy` (separate Account `aleksa@spalevic-consulting.de`, NICHT claude-team's)
**Stripe Account:** Account 1 (`acct_1RlQZ6JH4KmjuYHx`, HU, EUR, Stripe Tax aktiv)
**Status:** MVP + V1.5 (Customer-Selfservice) + V2 partial (Call-Detail mit Transkript + Audio) live

## Stack

| Layer | Tool |
|---|---|
| Frontend | React 18 + Vite 5 + TS + Tailwind 3 + Motion 11 + React Router 6 |
| Auth/DB/Cron | Supabase (`puimwizupgkdvxpanlhy`) — Auth, Postgres, RLS, pg_cron, pg_net |
| Backend | Supabase Edge Functions (Deno) — 22 Functions |
| Payments | Stripe Account 1 — Tiered Metered Billing + Stripe Tax (Reverse-Charge for EU B2B) |
| Hosting | Netlify (`app.aleksa.ai`) — Build with `.env.production` (public VITE_* vars committed) |
| Email | Resend — Domain `projekt.aleksa.ai` verified |
| Voice | ElevenLabs Conversational AI (live-sync prompts/voice/KB; RetellAI + Vapi planned in V2.1) |

## How to run locally

⚠️ **Aleksas MacBook hat kein Node installiert.** Lokales `npm run dev` ist nicht möglich. Alle Frontend-Tests laufen via Netlify (auto-deploy on git push, ~90s). Marcus verifiziert via Chrome-MCP-Tool. Siehe Marcus' `knowledge.md` § "Node-loses Development auf Aleksas MacBook".

Auf Macs MIT Node: `npm install && npm run dev` reicht.

## Where secrets live

| Where | What |
|---|---|
| `.env.local` (gitignored, local-dev only) | `SUPABASE_PERSONAL_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc. |
| `.env.production` (committed) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — both public by design |
| Netlify Build Env | `NODE_VERSION=22` (set in `netlify.toml`) |
| Supabase Secrets (`puimwizupgkdvxpanlhy`) | `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `ELEVENLABS_WEBHOOK_SECRET`, `APP_URL`, `CRON_SECRET` |

🚨 **Never commit** `.env.local`, Service Role Keys, or Personal Access Tokens.

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React on Netlify @ app.aleksa.ai)                    │
│  ├─ Admin (Aleksa)                                              │
│  │   ├─ /admin — Kunden                                         │
│  │   ├─ /admin/agents — Agenten (all Voice-Agents)              │
│  │   ├─ /admin/agents/:id — Agent-Edit (Prompt/Voice/KB)        │
│  │   ├─ /admin/integrations — Provider-Accounts                 │
│  │   ├─ /admin/pricing-plans — 3 Modi (hybrid/per_min/once)     │
│  │   ├─ /admin/customers/:id — Customer-Detail + Permissions    │
│  │   ├─ /admin/customers/:id/view — Customer-Preview-Mode       │
│  │   └─ /admin/calls/:id — Call-Detail (always full access)     │
│  └─ Customer-Owner                                              │
│      ├─ /dashboard — Stats per Agent + Stripe Portal            │
│      ├─ /dashboard/agents/:id — Agent-Edit (permission-gated)   │
│      └─ /dashboard/calls/:id — Call-Detail (permission-gated)   │
└────────────────┬────────────────────────────────────────────────┘
                 │ Auth (Supabase Magic Link)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase (puimwizupgkdvxpanlhy)                                │
│  ├─ Postgres (8 tables, RLS-protected)                          │
│  ├─ Auth (auth.users) + handle_new_user trigger                 │
│  ├─ pg_cron (daily 02:00 UTC stripe-usage-reporting)            │
│  └─ Edge Functions (22) — see ARCHITECTURE.md                   │
└────────┬──────────────────┬──────────────────┬─────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
   ┌─────────┐       ┌─────────────┐    ┌─────────────┐
   │ Stripe  │       │ ElevenLabs  │    │   Resend    │
   │ Tax+    │       │ Convai API  │    │ Email API   │
   │ Metered │       │ + Webhooks  │    │ (Domain     │
   │ Billing │       │ + KB        │    │ projekt.    │
   │ Account1│       │             │    │ aleksa.ai)  │
   └─────────┘       └─────────────┘    └─────────────┘
```

For detailed flow diagrams + DB schema + every Edge Function signature, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Auth & Permissions

Two roles in `profiles.role`:
- **`admin`** — Aleksa, full access via RLS
- **`customer_owner`** — clients, scoped via `profiles.customer_id` → matches `customers.id`

Customer-Owner features are gated by `customer_permissions` table (5 toggles, admin-controlled):
- `can_view_calls`, `can_view_transcripts`, `can_view_audio`
- `can_edit_agent_config`, `can_edit_kb`

Default all FALSE; admin opens features per customer in `/admin/customers/:id`.

## Project structure

```
aleksa-ai-app/
├── src/
│   ├── pages/         # 11 page components
│   │   ├── Login.tsx
│   │   ├── Admin.tsx               # /admin
│   │   ├── AgentsList.tsx          # /admin/agents
│   │   ├── AgentDetail.tsx         # /admin/agents/:id (admin edit)
│   │   ├── Integrations.tsx        # /admin/integrations
│   │   ├── PricingPlans.tsx        # /admin/pricing-plans
│   │   ├── CustomerDetail.tsx      # /admin/customers/:id
│   │   ├── CustomerPreview.tsx     # /admin/customers/:id/view (wraps Dashboard)
│   │   ├── Dashboard.tsx           # /dashboard (customer)
│   │   ├── CustomerAgentDetail.tsx # /dashboard/agents/:id (customer edit, permission-gated)
│   │   ├── CallDetail.tsx          # /dashboard/calls/:id + /admin/calls/:id
│   │   ├── Onboarding.tsx          # /onboarding (Paywall + B2B/B2C + AddressElement)
│   │   └── Invite.tsx              # /invite/:token
│   ├── components/    # Modal dialogs + reusable components
│   │   ├── NewCustomerDialog.tsx
│   │   ├── NewIntegrationDialog.tsx
│   │   ├── NewPricingPlanDialog.tsx
│   │   ├── AddVoiceAgentDialog.tsx    # uses admin-list-platform-agents
│   │   ├── AssignPricingDialog.tsx
│   │   └── RequireAuth.tsx
│   ├── lib/
│   │   ├── supabase.ts             # client
│   │   ├── auth.tsx                # AuthProvider + useAuth
│   │   ├── api.ts                  # ALL Edge Function wrappers (typed)
│   │   └── billing.ts              # cost-projection helpers
│   ├── types/
│   │   └── db.ts                   # all DB types (Customer, VoiceAgent, etc.)
│   ├── App.tsx                     # routes
│   ├── main.tsx                    # entry
│   └── index.css                   # Tailwind + shared component classes
├── supabase/
│   ├── migrations/                 # 7 migrations (001-007)
│   └── functions/                  # 22 Edge Functions
├── public/                         # static assets
├── netlify.toml                    # Netlify build + redirects + headers
├── package.json
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
├── CLAUDE.md                       # this file
├── ARCHITECTURE.md                 # tech deep-dive
├── SPEC.md                         # original spec + V1.5/V2 done-markers
├── HANDOFF.md                      # current state, next steps
├── BUILD-PLAN.md                   # historical: original MVP steps 1-10
├── TESTING.md                      # test plan for Aleksa
├── ROADMAP.md                      # what's coming next
├── README.md
├── .env.example                    # template
├── .env.local                      # gitignored, real secrets
└── .env.production                 # public VITE_* vars (committed)
```

## Key workflows

### Adding a new customer (manual ChatDash-replacement)

1. Aleksa @ `/admin/customers/new` → fills name + email
2. Edge `admin-create-customer`: creates Stripe Customer + DB row + invitation token (7-day) + Resend email
3. Customer clicks invite link → Magic Link via Supabase Auth
4. Customer onboards: B2C/B2B toggle, AddressElement, PaymentElement → Stripe Customer gets address + tax_id + default_payment_method
5. Aleksa @ `/admin/customers/:id`: adds Voice-Agent (from ElevenLabs dropdown) + assigns Pricing-Plan
6. Edge `admin-assign-pricing`: creates Stripe Subscription (hybrid/per_minute) or one-time Invoice
7. ElevenLabs Workspace Webhook fires `webhook-elevenlabs` after each call → row in `calls`
8. Daily 02:00 UTC: pg_cron triggers `cron-stripe-usage` → pushes Stripe usage_records
9. End of period: Stripe auto-invoices + charges saved card

### Customer self-service for Agent Config

1. Admin opens `/admin/customers/:id` → "Kundenzugriff" section → toggles `can_edit_agent_config` + `can_edit_kb` ON
2. Customer @ `/dashboard` sees "Agent konfigurieren →" button on agent card
3. Click → `/dashboard/agents/:id` with tabs: Übersicht | Prompt | Stimme | Wissensdatenbank (filtered by permissions)
4. Edits Prompt → Save → Edge `admin-update-agent-config` PATCHes ElevenLabs → live in next call

### Permission system

`customer_permissions` (one row per customer, auto-created via trigger):
- `can_view_calls` → see calls log in Dashboard
- `can_view_transcripts` → see transcript in Call-Detail
- `can_view_audio` → audio player in Call-Detail
- `can_edit_agent_config` → edit prompt/voice
- `can_edit_kb` → manage knowledge base

Every Edge Function with customer-facing access checks ownership + permission server-side. Admins bypass all checks.

## Cross-project references

- **claude-team** (`~/Desktop/Claude Team/`) — contains Marcus' agent definitions + `STATUS.md` + `knowledge.md`. Do NOT modify aleksa-ai-app from claude-team or vice versa.
- **aleksa-ai-website** (`~/Desktop/Projects/aleksa-ai/` if cloned) — marketing site at `aleksa.ai`. Separate repo, separate Netlify-site.

## How to extend

| Task | Where |
|---|---|
| New Edge Function | `supabase/functions/<slug>/index.ts` + register wrapper in `src/lib/api.ts` |
| Deploy Edge Function | via Supabase Management API (curl multipart with `verify_jwt` flag) — see `ARCHITECTURE.md` § "Edge Function Deploy Pattern" |
| New page | `src/pages/<Name>.tsx` + route in `App.tsx` + nav link in top-nav |
| New DB column/table | `supabase/migrations/00X_*.sql` + execute via Management API `/database/query` endpoint |
| New Stripe Webhook event | switch case in `webhook-stripe/index.ts` |
| New ElevenLabs API call | extract `integration.api_key` server-side, never on client. Pin region to `https://api.elevenlabs.io` (EU base is Enterprise-only) |

## Marcus' role

When Aleksa types `/marcus` in this repo, Claude Code loads Marcus' persona + reads `HANDOFF.md` + this file. Marcus' write-allowlist is enforced inside the AI-Office backend but inside Claude Code Marcus has full Edit/Write access.

## Status

See [`HANDOFF.md`](./HANDOFF.md) for current state + open items.

# AleksaAI App — Project Context for Claude Code

> Auto-loaded by every Claude Code session in this directory. Keep updated.

## What this is

Whitelabel-Plattform die Aleksas ElevenLabs-Voice-Agent-Reseller-Business hostet. Ersetzt ChatDash (~106€/m). Aleksa baut + verkauft Voice Agents an Kunden (Hauptkanal: Thomas Luderer / Fresh Puls Solutions). Diese Plattform ist das Customer-Portal + Billing-Backend.

**Brand-Hierarchie:**
- `aleksa.ai` = Marketing-Site (Repo `aleksaai/aleksa-ai`, separate codebase)
- `app.aleksa.ai` = diese App (dieses Repo)

## Stack

- **Frontend:** React + Vite + TS + Tailwind + Motion
- **UI sourcing:** 21st Dev Magic (`magic_component_inspiration`) für Bausteine
- **Auth/DB/Cron:** Supabase Project `puimwizupgkdvxpanlhy` (separat von claude-team `znltfcxpngtztiwbcamm`)
- **Backend:** Supabase Edge Functions (Deno)
- **Payments:** Stripe Account 1 (`acct_1RlQZ6JH4KmjuYHx`), Tiered Metered Billing + Tax aktiv. **Wichtig:** Alle Stripe-Customers + Subscriptions die hier erstellt werden, kriegen Metadata `{"source": "aleksa-ai-app"}` damit Lisa sie in der monatlichen Buchhaltung von KI-Schule/Tech-Support-Charges trennen kann
- **Email:** Resend (sender `noreply@projekt.aleksa.ai`, Domain bereits verifiziert)
- **Voice:** ElevenLabs Conversational AI via existing `elevenlabs-bridge` Edge Function (in claude-team Supabase, cross-project call)

## How to run locally

```bash
# Install
pnpm install

# Dev server
pnpm dev    # frontend on http://localhost:5173

# Edge Functions (testing)
supabase functions serve --env-file .env.local
```

## Where secrets live

- **Local development:** `.env.local` (gitignored)
- **Frontend production:** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` als Netlify Env Vars
- **Edge Functions production:** Supabase Secrets (`supabase secrets set ...`)

**Welche Keys wo:**

| Key | Local `.env.local` | Netlify Env | Supabase Secret |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✓ | ✓ | — |
| `VITE_SUPABASE_ANON_KEY` (public) | ✓ | ✓ | — |
| `SUPABASE_SERVICE_ROLE_KEY` (sensitive!) | ✓ | — | ✓ |
| `STRIPE_SECRET_KEY` | ✓ | — | ✓ |
| `STRIPE_WEBHOOK_SECRET` | ✓ | — | ✓ |
| `ELEVENLABS_WEBHOOK_HMAC_SECRET` | ✓ | — | ✓ |
| `RESEND_API_KEY` | ✓ | — | ✓ |

**🚨 NIEMALS committen:** `.env`, `.env.local`. `.env.example` ist OK (Template ohne Werte).

## Project structure (target)

```
aleksa-ai-app/
├── src/
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Admin.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Onboarding.tsx
│   │   └── InviteAccept.tsx
│   ├── components/
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── stripe.ts
│   │   └── auth.tsx
│   └── types/
│       └── db.ts (generated via supabase gen types)
├── supabase/
│   ├── migrations/         # SQL migrations
│   └── functions/          # Edge Functions (Deno)
│       ├── webhook-elevenlabs/
│       ├── webhook-stripe/
│       ├── cron-stripe-usage/
│       ├── admin-create-customer/
│       ├── accept-invitation/
│       ├── setup-intent/
│       ├── admin-create-pricing-plan/
│       └── admin-assign-pricing/
├── SPEC.md
├── BUILD-PLAN.md           # numbered MVP execution steps
├── HANDOFF.md              # cross-session state
├── CLAUDE.md               # this file
├── README.md
├── .env.example
├── .gitignore
└── package.json
```

## Key workflows

- **Marcus is the planner.** When Aleksa types `/marcus` here, Marcus picks up `HANDOFF.md` + `SPEC.md` + `BUILD-PLAN.md` and resumes.
- **Build-Plan execution:** Claude Code goes through `BUILD-PLAN.md` step by step, marks each as ✅ when acceptance is met, updates `HANDOFF.md` at session end.

## Cross-project references

- **claude-team** (`~/Desktop/Claude Team/`) — agent definitions, this app references the existing `elevenlabs-bridge` Edge Function from claude-team's Supabase project (`znltfcxpngtztiwbcamm`). Do NOT modify claude-team from this codebase.
- **Marketing site** (`~/Desktop/Projects/aleksa-ai-website/` if cloned) — separate repo, separate Netlify-Site, separate domain (`aleksa.ai`).

## Status

See `HANDOFF.md` for current state.

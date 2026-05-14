# HANDOFF.md — AleksaAI App

> Cross-session + cross-device onboarding. Read this when picking up work. Update at end of each session.

## Last update

**2026-05-13** — Marcus (DB-Migration jetzt LIVE über Management API, awaiting Aleksa: Netlify + Stripe Test Keys)

## Current state

🟡 **Step 1 Code + Step 2 DB komplett. Awaiting Aleksa: Netlify-Connect + Stripe Test-Keys**

**Nicht versuchen:** lokales `npm run dev` oder `preview_start`. Auf Aleksas MacBook (User `aleksaspalevic`) ist Node NICHT installiert — Frontend wird ausschließlich über Netlify gebaut + getestet. Siehe Marcus knowledge.md "Node-loses Development auf Aleksas MacBook".

### Phase 1 ✅
- Spec approved + Build-Plan geschrieben
- Repo erstellt mit allen Standard-Files
- GitHub-Repo `aleksaai/aleksa-ai-app` aktiviert
- Stripe Tax in Account 1 aktiviert (Aleksa's Entscheidung — Voice-Agent-Customers laufen über Account 1, getaggt mit `metadata: source=aleksa-ai-app` für Lisa-Filterung)
- Stripe Customer Portal konfiguriert
- Resend API Key in neuem Supabase als Secret gespeichert

### Step 1 — done so far
- ✅ `package.json` mit allen MVP-Dependencies (React 18, Vite 5, Tailwind 3, Supabase, Stripe, Motion, React Router)
- ✅ Vite + TS + Tailwind config files
- ✅ `index.html` + `src/main.tsx` mit `BrowserRouter` + `AuthProvider` Wrapper
- ✅ `src/lib/supabase.ts` — Supabase client init
- ✅ `src/lib/auth.tsx` — `AuthProvider` Context, lädt `profiles`-Row wenn user logged in
- ✅ `src/components/RequireAuth.tsx` — Route-Wrapper mit optional `requireRole`
- ✅ `src/pages/Login.tsx` — Magic-Link-Form mit Motion-Animationen
- ✅ `src/pages/Admin.tsx` + `src/pages/Dashboard.tsx` — Placeholder-Pages
- ✅ `src/App.tsx` — Routes mit role-based redirect (`/` → Login OR `/admin` OR `/dashboard`)
- ✅ Tailwind theme mit `brand` color palette (#66A4FF) + Inter font
- ✅ Shared component classes in `index.css` (`.btn-primary`, `.input`, `.card`)

### Step 1 — done (alles Code-mässig, ohne lokales Preview)
- ✅ Code geschrieben + zu GitHub gepusht (3 Commits auf main)
- Build wird auf Netlify passieren, nicht lokal

### Step 2 ✅ DB done (2026-05-13)
- Migration ausgeführt via Supabase Management API (POST /v1/projects/{ref}/database/query)
- 7 Tabellen sichtbar mit RLS: `customers`, `profiles`, `voice_agents`, `pricing_plans`, `customer_subscriptions`, `calls`, `customer_invitations`
- `handle_new_user` Trigger live (auto-creates profiles row on signup, role='customer_owner')
- `set_updated_at` Trigger auf 5 Tabellen
- Helper-Functions: `current_user_role()`, `current_user_customer_id()`
- Aleksa hat Personal Access Token generiert (gespeichert in `.env.local` als `SUPABASE_PERSONAL_ACCESS_TOKEN`, scoped nur auf dieses Projekt) — damit kann Marcus ab jetzt alles in Supabase selbst machen, keine Aleksa-Klicks mehr nötig

### Post-Login: Aleksa zu admin promoten (1 SQL-Aufruf, macht Marcus selbst sobald Aleksa erst-eingeloggt ist)
Marcus führt aus sobald `auth.users` einen Eintrag für `info@aleksa.ai` hat:
```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'info@aleksa.ai');
```

## What's next (Aleksa pending, parallel)

1. **Netlify connecten** (5 Klicks):
   - Add new site → Import from GitHub → `aleksaai/aleksa-ai-app`
   - Build: `npm run build` / Publish: `dist`
   - Env vars: `NODE_VERSION=22`, `VITE_SUPABASE_URL=https://puimwizupgkdvxpanlhy.supabase.co`, `VITE_SUPABASE_ANON_KEY=<anon key>`
   - URL an Marcus melden
2. **Stripe Test-Keys** holen (Stripe Account 1 → Test-Mode toggle → API keys → `sk_test_...` + `pk_test_...`) und an Marcus
3. **Marcus parallel:** deployt Edge Functions (`accept-invitation`, `admin-create-customer`, `setup-intent`, `webhook-stripe`, später `webhook-elevenlabs` + `cron-stripe-usage`)
4. **Magic-Link-Test:** sobald Netlify-URL live → Marcus öffnet via Chrome-Tool → Aleksa testet Login
5. Step 3-10: Stripe-Webhook, Customer-CRUD, Pricing-Plans, Voice-Agent-Zuordnung, ElevenLabs-Webhook, Usage-Cron, VV-Cars-Migration

## Decisions made

- **Naming:** `aleksa-ai-app` (Repo) + `app.aleksa.ai` (Subdomain). Brand bleibt "AleksaAI"
- **Supabase:** separates Projekt unter `aleksa@spalevic-consulting.de` Account, NICHT claude-team's Supabase
- **Stripe Account 1** (`acct_1RlQZ6JH4KmjuYHx`) — Aleksas Wahl; Voice-Agent-Subscriptions kriegen `metadata: source=aleksa-ai-app` für Lisa
- **GitHub Token:** im Browser auf "All repositories" gesetzt (oder zumindest aleksa-ai-app hinzugefügt) — Push klappt
- **Resend Key:** als Secret im neuen Supabase hinterlegt
- **Stripe Tax aktiviert** + Customer Portal konfiguriert
- **Lokales Node:** NICHT installiert auf MacBook. Build-Pattern via Netlify-Cloud, kein lokales `npm run dev`
- **Stripe Tax:** AN
- **Stripe Pricing-Modell:** Tiered Metered Billing
- **Customer-Selfservice am Voice Agent:** kommt in V1
- **Subdomain pro Customer:** kommt in V2

## Open questions

— keine offenen Fragen aktuell. Alle Discovery-Punkte sind in SPEC.md geklärt.

## Risks / WIP / Blockers

- **Aleksa-Block für Frontend-Test:** Netlify-Connect ist Voraussetzung für Magic-Link-Test. Ohne Netlify keine sichtbare App
- **Aleksa-Block für Stripe-Functions:** Stripe Test-Keys nötig bevor `webhook-stripe`, `setup-intent`, `admin-create-customer` deployed werden können (alle rufen Stripe API)
- **ChatDash-Migration (Step 10):** braucht ruhiges Wartungsfenster — VV-Cars/Vierroth muss informiert werden bevor wir den ElevenLabs-Webhook umschalten

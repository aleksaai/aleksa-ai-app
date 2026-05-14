# HANDOFF.md — AleksaAI App

> Cross-session + cross-device onboarding. Read this when picking up work. Update at end of each session.

## Last update

**2026-05-14** — Marcus (Step 1 + 2 LIVE & verifiziert via Chrome-Tool, Step 3 Stripe-Setup teilweise done, awaiting Aleksa: Magic-Link-Klick + Stripe Webhook Signing Secret)

## Current state

🟢 **Step 1+2 LIVE auf app.aleksa.ai. Step 3 in progress. Step 4 Edge Function deployed.**

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

### Step 1+2 LIVE-VERIFIKATION (2026-05-14)
- Aleksa hat Netlify mit GitHub-Repo connected, Domain direkt auf `app.aleksa.ai` gesetzt (statt erst zu Step 10 wie ursprünglich geplant — schneller, OK)
- Erster Build failed wegen fehlenden VITE_* Env Vars in Netlify Dashboard
- **Fix:** committed `.env.production` mit den public Vite-Vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — beide sind by design public) + `netlify.toml` für NODE_VERSION + SPA-Redirects + Security-Headers
- Re-Deploy hat funktioniert
- Marcus via Chrome-MCP verifiziert: `https://app.aleksa.ai/` lädt sauber, keine Console-Errors, Login-Form rendert, Magic-Link-Submit funktioniert (Success-State "Magic-Link gesendet ✓")
- Supabase Auth `site_url` + `uri_allow_list` auf `https://app.aleksa.ai` gesetzt + OTP-Expiry auf 24h hochgesetzt (Default 1h zu kurz)
- `APP_URL` Supabase Secret gesetzt für Edge Functions (Invite-Links zeigen jetzt auf app.aleksa.ai statt localhost)

### Step 3 — Stripe ✅ teilweise (2026-05-14)
- Aleksa hat Stripe Tax in Account 1 (`acct_1RlQZ6JH4KmjuYHx`, HU, EUR) aktiviert (Head Office Budapest)
- Stripe Test-Keys (`sk_test_...`, `pk_test_...`) als Supabase Secrets gesetzt
- Customer Portal konfiguriert
- ⏳ **Aleksa offen:** Stripe Webhook Endpoint anlegen (`https://dashboard.stripe.com/test/webhooks` → Add destination → URL `https://puimwizupgkdvxpanlhy.supabase.co/functions/v1/webhook-stripe` → all events) → Signing Secret (`whsec_...`) an Marcus schicken
- **Wichtig:** Voice-Agent-Customer-Subscriptions kriegen automatisch `metadata.source = "aleksa-ai-app"` für Lisa-Filterung (KI-Schule + Voice-Agent-Customers laufen beide über Account 1)

### Step 4 — admin-create-customer Edge Function ✅ deployed (2026-05-14)
- Flow: verify admin → create Stripe Customer mit `metadata.source=aleksa-ai-app` → insert customers row → generate invitation token (7-day expiry) → send Resend email → return `invite_link` als Fallback falls Email fail
- v1 ACTIVE, smoke-tested: OPTIONS=200, POST ohne Auth=401 unauthorized
- Source: `supabase/functions/admin-create-customer/index.ts`

### Post-Login: Aleksa zu admin promoten
Sobald Aleksa eingeloggt ist via Magic Link, Marcus führt aus (1 SQL via Management API):
```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'info@aleksa.ai');
```

### Post-Login: Aleksa zu admin promoten (1 SQL-Aufruf, macht Marcus selbst sobald Aleksa erst-eingeloggt ist)
Marcus führt aus sobald `auth.users` einen Eintrag für `info@aleksa.ai` hat:
```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'info@aleksa.ai');
```

## What's next

1. **Aleksa:** Magic-Link in info@aleksa.ai-Inbox klicken → redirected zu app.aleksa.ai/admin → sieht Welcome-Page mit `role: customer_owner`
2. **Marcus:** sobald `auth.users` Row da ist → SQL-Update zum admin → Aleksa reloaded → sieht Admin-Page
3. **Aleksa parallel:** Stripe Webhook anlegen (`https://dashboard.stripe.com/test/webhooks` → Add destination → URL siehe oben → Signing Secret kopieren)
4. **Marcus:** sobald `whsec_...` da ist → deploye `webhook-stripe` Edge Function (Step 5)
5. **Step 5+:** Customer-CRUD UI im Admin-Panel bauen (Form für neuen Customer + Aufruf der `admin-create-customer` Function), Onboarding-Flow mit Paywall, Pricing-Plans, Voice-Agent-Zuordnung, ElevenLabs-Webhook, Usage-Cron, VV-Cars-Migration

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

# HANDOFF.md — AleksaAI App

> Cross-session + cross-device onboarding. Read this when picking up work. Update at end of each session.

## Last update

**2026-05-03** — Marcus (Step 1 in progress: Scaffold + Auth-Shell written, awaiting `npm install` + Magic-Link-Test)

## Current state

🟡 **Step 1: Scaffold geschrieben, awaiting Aleksa's `npm install` + first preview**

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

### Step 1 — pending
- ⏳ Aleksa: `npm install` im Terminal (`cd ~/Desktop/Projects/aleksa-ai-app && npm install`)
- ⏳ Marcus: `preview_start` → verify Login page rendert sauber
- ⏳ Aleksa: Magic-Link-Test mit `info@aleksa.ai`, prüft dass Login-Mail ankommt + Klick-zum-Admin funktioniert

## What's next

1. **Aleksa:** `cd ~/Desktop/Projects/aleksa-ai-app && npm install` (~1 Min)
2. **Marcus:** Preview starten + Verifikation
3. **Aleksa:** Magic-Link-Test
4. Wenn ✅ → Step 2 (Database Schema + RLS)

## Decisions made

- **Naming:** `aleksa-ai-app` (Repo) + `app.aleksa.ai` (Subdomain). Brand bleibt "AleksaAI"
- **Supabase:** separates Projekt unter `aleksa@spalevic-consulting.de` Account, NICHT claude-team's Supabase
- **Stripe Account 1** (`acct_1RlQZ6JH4KmjuYHx`) — Aleksas Wahl; Voice-Agent-Subscriptions kriegen `metadata: source=aleksa-ai-app` für Lisa
- **Stripe Tax:** AN
- **Stripe Pricing-Modell:** Tiered Metered Billing
- **Customer-Selfservice am Voice Agent:** kommt in V1
- **Subdomain pro Customer:** kommt in V2

## Decisions made

- **Naming:** `aleksa-ai-app` (Repo) + `app.aleksa.ai` (Subdomain). Brand bleibt "AleksaAI"
- **Supabase:** separate Projekt unter `aleksa@spalevic-consulting.de` Account, NICHT claude-team's Supabase. Sauberer Trust-Boundary für Customer-Daten
- **Stripe Tax:** AN (0.5% extra pro Tx, spart EU-B2B-Reverse-Charge-Compliance-Aufwand)
- **Stripe Pricing-Modell:** Tiered Metered Billing (eine Subscription mit flat + metered Components)
- **Customer-Selfservice am Voice Agent:** kommt in V1, NICHT im MVP
- **Subdomain pro Customer:** kommt in V2, NICHT im MVP

## Open questions

— keine offenen Fragen aktuell. Alle Discovery-Punkte sind in SPEC.md geklärt.

## Risks / WIP / Blockers

- Aleksa muss noch Stripe Tax aktivieren (Step 3 im Build-Plan blockiert sonst)
- Aleksa muss GitHub-Repo `aleksaai/aleksa-ai-app` anlegen vor Push
- ChatDash-Migrations-Cutover (Step 10) braucht ein ruhiges Wartungsfenster — VV-Cars/Vierroth muss informiert werden bevor wir den ElevenLabs-Webhook umschalten

// AgencyShell — sidebar layout for agency-owner pages (mirrors AppShell pattern).
// Title/logo come from the agency record via useTenant when available, or fall back
// to the user's own agency (loaded via auth profile.agency_id) when accessed via
// platform.openpenguin.de directly.

import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../lib/auth'
import { useTenant } from '../lib/tenant'

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

const navItems: NavItem[] = [
  {
    to: '/agency',
    label: 'Übersicht',
    end: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    to: '/agency/customers',
    label: 'Kunden',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/agency/agents',
    label: 'Voice-Agents',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
        <path d="M5 22v-2a7 7 0 0 1 14 0v2" />
      </svg>
    ),
  },
  {
    to: '/agency/integrations',
    label: 'Integrationen',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 7V2m6 5V2M5 13a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-3z" />
      </svg>
    ),
  },
  {
    to: '/agency/settings',
    label: 'Einstellungen',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

export function AgencyShell({
  children,
  pageTitle,
  pageEyebrow,
  pageAction,
  backTo,
  backLabel,
}: {
  children: ReactNode
  pageTitle?: ReactNode
  pageEyebrow?: string
  pageAction?: ReactNode
  backTo?: string
  backLabel?: string
}) {
  const { user, signOut } = useAuth()
  const { agency } = useTenant()
  const [mobileOpen, setMobileOpen] = useState(false)

  const brandName = agency?.display_name ?? 'OpenPenguin Voice'
  const brandLogo = agency?.logo_url ?? '/logo-color.png'

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
        <div className="absolute inset-0 grid-pattern" />
      </div>

      {/* Mobile top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3 lg:hidden">
        <Link to="/agency" className="flex items-center gap-2">
          <Logo src={brandLogo} alt={brandName} />
          <span className="text-base font-semibold tracking-tight">{brandName}</span>
        </Link>
        <button
          aria-label="Menü"
          onClick={() => setMobileOpen((v) => !v)}
          className="btn-ghost h-9 w-9 p-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      <div className="relative z-10 flex">
        {/* SIDEBAR */}
        <aside className="sticky top-4 my-4 ml-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col rounded-3xl glass lg:flex">
          <div className="px-6 py-7">
            <Link to="/agency" className="flex items-center gap-2.5">
              <Logo src={brandLogo} alt={brandName} />
              <div className="flex flex-col leading-none">
                <span className="text-base font-semibold tracking-tight text-ink">{brandName}</span>
                <span
                  className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] opacity-80"
                  style={{ color: 'var(--accent-700)' }}
                >
                  Partner
                </span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                <span className="text-current opacity-80">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="m-3 rounded-2xl bg-white/40 p-4 backdrop-blur-md">
            <p className="truncate text-xs font-medium text-ink-soft">{user?.email}</p>
            <div className="mt-2 flex items-center gap-3 text-xs font-medium">
              <Link
                to="/account"
                className="text-ink-muted transition-colors hover:opacity-100 hover:[color:var(--accent-700)]"
              >
                Konto
              </Link>
              <span className="text-ink-dim">·</span>
              <button
                onClick={signOut}
                className="text-ink-muted transition-colors hover:opacity-100 hover:[color:var(--accent-700)]"
              >
                Abmelden
              </button>
            </div>
          </div>
        </aside>

        {/* MOBILE DRAWER */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 24, stiffness: 240 }}
                className="fixed inset-y-4 left-4 z-40 flex w-64 flex-col rounded-3xl glass lg:hidden"
              >
                <div className="px-6 py-6">
                  <Link to="/agency" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
                    <Logo src={brandLogo} alt={brandName} />
                    <span className="text-base font-semibold tracking-tight">{brandName}</span>
                  </Link>
                </div>
                <nav className="flex-1 space-y-1 px-3">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                    >
                      <span className="opacity-80">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </nav>
                <div className="m-3 rounded-2xl bg-white/40 p-4">
                  <p className="truncate text-xs font-medium text-ink-soft">{user?.email}</p>
                  <button
                    onClick={signOut}
                    className="mt-2 text-xs font-medium text-ink-muted hover:opacity-100 hover:[color:var(--accent-700)]"
                  >
                    Abmelden →
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* MAIN */}
        <main className="relative flex-1 px-4 pb-12 pt-2 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-6xl">
            {backTo && (
              <Link
                to={backTo}
                className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:opacity-100 hover:[color:var(--accent-700)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                {backLabel ?? 'Zurück'}
              </Link>
            )}

            {(pageTitle || pageAction || pageEyebrow) && (
              <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  {pageEyebrow && <p className="eyebrow mb-2">{pageEyebrow}</p>}
                  {pageTitle && <h1 className="heading-display">{pageTitle}</h1>}
                </div>
                {pageAction && <div className="flex shrink-0 items-center gap-2">{pageAction}</div>}
              </header>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}

function Logo({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="h-11 w-11 shrink-0 object-contain" />
}

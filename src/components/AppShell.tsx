import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../lib/auth'

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

const navItems: NavItem[] = [
  {
    to: '/admin',
    label: 'Übersicht',
    end: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 13h7V4H4v9zm0 7h7v-5H4v5zm9 0h7v-9h-7v9zm0-16v5h7V4h-7z" />
      </svg>
    ),
  },
  {
    to: '/admin/agents',
    label: 'Agenten',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
        <path d="M5 22v-2a7 7 0 0 1 14 0v2" />
      </svg>
    ),
  },
  {
    to: '/admin/integrations',
    label: 'Integrationen',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 7V2m6 5V2M5 13a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-3z" />
      </svg>
    ),
  },
  {
    to: '/admin/pricing-plans',
    label: 'Pricing',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <circle cx="7" cy="7" r="1.5" />
      </svg>
    ),
  },
]

export function AppShell({
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
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* Ambient background — glow orbs + grid */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
        <div className="absolute inset-0 grid-pattern" />
      </div>

      {/* Mobile top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3 lg:hidden">
        <Link to="/admin" className="flex items-center gap-2">
          <Logo />
          <span className="text-base font-semibold tracking-tight">AleksaAI</span>
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
        {/* ============ SIDEBAR ============ */}
        <aside className="sticky top-4 my-4 ml-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col rounded-3xl glass lg:flex">
          <div className="px-6 py-7">
            <Link to="/admin" className="flex items-center gap-2.5">
              <Logo />
              <div className="flex flex-col leading-none">
                <span className="text-base font-semibold tracking-tight text-ink">AleksaAI</span>
                <span
                  className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] opacity-80"
                  style={{ color: 'var(--accent-700)' }}
                >
                  Admin
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
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : ''}`
                }
              >
                <span className="text-current opacity-80">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="m-3 rounded-2xl bg-white/40 p-4 backdrop-blur-md">
            <p className="truncate text-xs font-medium text-ink-soft">{user?.email}</p>
            <button
              onClick={signOut}
              className="mt-2 text-xs font-medium text-ink-muted transition-colors hover:opacity-100 hover:[color:var(--accent-700)]"
            >
              Abmelden →
            </button>
          </div>
        </aside>

        {/* ============ MOBILE DRAWER ============ */}
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
                  <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
                    <Logo />
                    <span className="text-base font-semibold tracking-tight">AleksaAI</span>
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

        {/* ============ MAIN ============ */}
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

function Logo() {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
      style={{
        background:
          'linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 50%, var(--accent-600) 100%)',
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.5) inset, 0 6px 18px -6px rgba(var(--accent-shadow-rgb),0.55)',
      }}
    >
      <img src="/logo-white.png" alt="AleksaAI" className="h-[115%] w-[115%] object-contain" />
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../lib/auth'

export type AgentSection = {
  key: string
  label: string
  icon: ReactNode
}

export function AgentShell({
  children,
  sections,
  activeKey,
  onChangeSection,
  pageTitle,
  pageAction,
  backTo,
  backLabel,
  customerName,
  adminPreview,
  onExitPreview,
  lastUpdated,
}: {
  children: ReactNode
  sections: AgentSection[]
  activeKey: string
  onChangeSection: (key: string) => void
  pageTitle?: ReactNode
  pageAction?: ReactNode
  backTo: string
  backLabel: string
  customerName?: string
  adminPreview?: boolean
  onExitPreview?: () => void
  lastUpdated?: string
}) {
  const { user, signOut } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* Ambient */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
        <div className="absolute inset-0 grid-pattern" />
      </div>

      {/* Mobile top bar */}
      <div className="relative z-20 flex items-center justify-between gap-2 px-4 py-3 lg:hidden">
        <Link to={adminPreview ? '#' : '/dashboard'} className="flex items-center gap-2">
          <Logo />
          <span className="truncate text-base font-semibold tracking-tight">
            {customerName ?? 'AleksaAI'}
          </span>
        </Link>
        <button
          aria-label="Menü"
          onClick={() => setMobileNavOpen((v) => !v)}
          className="btn-ghost h-9 w-9 p-0"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      <div className="relative z-10 flex">
        {/* SIDEBAR */}
        <aside className="sticky top-4 my-4 ml-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col rounded-3xl glass lg:flex">
          <div className="px-6 py-6">
            <Link to={adminPreview ? '#' : '/dashboard'} className="flex items-center gap-2.5">
              <Logo />
              <div className="flex min-w-0 flex-col leading-none">
                <span className="truncate text-base font-semibold tracking-tight text-ink">
                  {customerName ?? 'AleksaAI'}
                </span>
                {adminPreview && (
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700">
                    Admin-Preview
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Back link */}
          <div className="px-4 pb-3">
            {adminPreview && onExitPreview ? (
              <button
                onClick={onExitPreview}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-white/50 hover:text-ink"
              >
                <ChevronLeft /> {backLabel}
              </button>
            ) : (
              <Link
                to={backTo}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-white/50 hover:text-ink"
              >
                <ChevronLeft /> {backLabel}
              </Link>
            )}
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => onChangeSection(s.key)}
                className={`nav-link w-full ${activeKey === s.key ? 'nav-link-active' : ''}`}
              >
                <span className="opacity-80">{s.icon}</span>
                <span>{s.label}</span>
              </button>
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

        {/* MOBILE DRAWER */}
        <AnimatePresence>
          {mobileNavOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileNavOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 24, stiffness: 240 }}
                className="fixed inset-y-4 left-4 z-40 flex w-72 flex-col rounded-3xl glass lg:hidden"
              >
                <div className="px-6 py-5">
                  <Link
                    to={adminPreview ? '#' : '/dashboard'}
                    onClick={() => setMobileNavOpen(false)}
                    className="flex items-center gap-2.5"
                  >
                    <Logo />
                    <span className="truncate text-base font-semibold tracking-tight">
                      {customerName ?? 'AleksaAI'}
                    </span>
                  </Link>
                </div>
                <div className="px-4 pb-3">
                  {adminPreview && onExitPreview ? (
                    <button
                      onClick={() => {
                        setMobileNavOpen(false)
                        onExitPreview()
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-muted hover:bg-white/50"
                    >
                      <ChevronLeft /> {backLabel}
                    </button>
                  ) : (
                    <Link
                      to={backTo}
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-muted hover:bg-white/50"
                    >
                      <ChevronLeft /> {backLabel}
                    </Link>
                  )}
                </div>
                <nav className="flex-1 space-y-1 px-3">
                  {sections.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        setMobileNavOpen(false)
                        onChangeSection(s.key)
                      }}
                      className={`nav-link w-full ${activeKey === s.key ? 'nav-link-active' : ''}`}
                    >
                      <span className="opacity-80">{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </nav>
                <div className="m-3 rounded-2xl bg-white/40 p-4">
                  <p className="truncate text-xs font-medium text-ink-soft">{user?.email}</p>
                  <button onClick={signOut} className="mt-2 text-xs font-medium text-ink-muted hover:[color:var(--accent-700)]">
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
            {(pageTitle || pageAction || lastUpdated) && (
              <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>{pageTitle && <h1 className="heading-display">{pageTitle}</h1>}</div>
                <div className="flex shrink-0 items-center gap-3">
                  {pageAction}
                  {lastUpdated && (
                    <span className="text-xs text-ink-muted">
                      Aktualisiert {lastUpdated}
                    </span>
                  )}
                </div>
              </header>
            )}

            <motion.div
              key={activeKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
    <img src="/logo-color.png" alt="AleksaAI" className="h-11 w-11 shrink-0 object-contain" />
  )
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

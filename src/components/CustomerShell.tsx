import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'

export function CustomerShell({
  children,
  pageTitle,
  pageEyebrow,
  pageAction,
  backTo,
  backLabel,
  customerName,
  adminPreview,
  onExitPreview,
}: {
  children: ReactNode
  pageTitle?: ReactNode
  pageEyebrow?: string
  pageAction?: ReactNode
  backTo?: string
  backLabel?: string
  customerName?: string
  adminPreview?: boolean
  onExitPreview?: () => void
}) {
  const { user, signOut } = useAuth()

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
        <div className="absolute inset-0 grid-pattern" />
      </div>

      {/* Floating top bar */}
      <div className="relative z-10 px-4 pt-4 lg:px-6 lg:pt-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl glass px-4 py-3 lg:px-6">
          <Link to={adminPreview ? '#' : '/dashboard'} className="flex items-center gap-2.5">
            <Logo />
            <div className="flex flex-col leading-none">
              <span className="text-base font-semibold tracking-tight text-ink">
                {customerName ?? 'AleksaAI'}
              </span>
              {adminPreview && (
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700">
                  Admin-Preview
                </span>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {!adminPreview && user?.email && (
              <span className="hidden truncate text-xs font-medium text-ink-muted sm:inline">
                {user.email}
              </span>
            )}
            {adminPreview ? (
              <button onClick={onExitPreview} className="btn-ghost text-sm">
                ← Zurück zum Admin
              </button>
            ) : (
              <button onClick={signOut} className="btn-ghost text-sm">
                Abmelden
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="relative z-10 px-4 pb-12 pt-6 lg:px-6 lg:pt-10">
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
  )
}

function Logo() {
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-xl"
      style={{
        background:
          'linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 50%, var(--accent-600) 100%)',
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.5) inset, 0 6px 18px -6px rgba(var(--accent-shadow-rgb),0.55)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  )
}

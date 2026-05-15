import { type ReactNode } from 'react'
import { motion } from 'motion/react'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
        <div className="absolute inset-0 grid-pattern" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo above card */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl"
            style={{
              background:
                'linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 50%, var(--accent-600) 100%)',
              boxShadow:
                '0 1px 0 0 rgba(255,255,255,0.5) inset, 0 12px 32px -8px rgba(var(--accent-shadow-rgb),0.55)',
            }}
          >
            <img src="/logo-white.png" alt="AleksaAI" className="h-[85%] w-[85%] object-contain" />
          </div>
          <p className="text-sm font-semibold tracking-tight text-ink">AleksaAI</p>
        </div>

        <div className="glass-card-lg p-7">{children}</div>
      </motion.div>
    </div>
  )
}

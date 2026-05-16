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
          <img src="/logo-color.png" alt="OpenPeng Voice" className="mb-3 h-20 w-20 object-contain" />
          <p className="text-sm font-semibold tracking-tight text-ink">OpenPeng Voice</p>
        </div>

        <div className="glass-card-lg p-7">{children}</div>
      </motion.div>
    </div>
  )
}

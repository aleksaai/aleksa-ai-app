import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env')
}

// ── Cross-subdomain session storage ──────────────────────────────────────
//
// Default supabase-js stores the auth token in localStorage, which is
// per-origin. That breaks the Multi-Tenant Phase 1 flow:
//   1. Partner clicks magic-link → lands on platform.openpenguin.de
//   2. Wizard completes → redirect to https://{slug}.openpenguin.de/agency
//   3. localStorage on the new subdomain is empty → "not authenticated"
//      → user is forced through a fresh login that they have no password for.
//
// Fix: when the hostname is *.openpenguin.de (any subdomain of the platform
// domain), store the session in a cookie scoped to `.openpenguin.de` so it's
// readable from every subdomain. For other hostnames (localhost in dev, plus
// any partner's custom domain like app.kihelden.de) fall back to the default
// localStorage — these tenants don't need cross-subdomain sharing.

const PLATFORM_BASE_DOMAIN = 'openpenguin.de'

function isPlatformSubdomain(hostname: string): boolean {
  return hostname === PLATFORM_BASE_DOMAIN || hostname.endsWith('.' + PLATFORM_BASE_DOMAIN)
}

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function makeCookieStorage(domain: string): StorageLike {
  // 30-day persistence so partners don't get logged out mid-week
  const MAX_AGE = 60 * 60 * 24 * 30

  // Cookies have a 4KB-per-cookie limit and Supabase tokens can be larger
  // than that. We chunk into _0, _1, _2 cookies and reassemble on read.
  const CHUNK_SIZE = 3500

  const getCookie = (name: string): string | null => {
    const cookies = document.cookie.split('; ')
    for (const c of cookies) {
      const eq = c.indexOf('=')
      if (eq > -1 && c.substring(0, eq) === name) {
        return decodeURIComponent(c.substring(eq + 1))
      }
    }
    return null
  }
  const setCookie = (name: string, value: string) => {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; domain=${domain}; secure; samesite=lax; max-age=${MAX_AGE}`
  }
  const deleteCookie = (name: string) => {
    document.cookie = `${name}=; path=/; domain=${domain}; max-age=0`
  }

  return {
    getItem: (key) => {
      // Try the un-chunked cookie first (small values)
      const single = getCookie(key)
      if (single !== null) return single
      // Reassemble chunks
      const head = getCookie(`${key}_0`)
      if (head === null) return null
      const chunks = [head]
      let i = 1
      while (true) {
        const c = getCookie(`${key}_${i}`)
        if (c === null) break
        chunks.push(c)
        i += 1
      }
      return chunks.join('')
    },
    setItem: (key, value) => {
      // Clear any prior chunks
      let i = 0
      while (getCookie(`${key}_${i}`) !== null) {
        deleteCookie(`${key}_${i}`)
        i += 1
      }
      deleteCookie(key)
      if (value.length <= CHUNK_SIZE) {
        setCookie(key, value)
      } else {
        for (let n = 0; n * CHUNK_SIZE < value.length; n += 1) {
          setCookie(`${key}_${n}`, value.substring(n * CHUNK_SIZE, (n + 1) * CHUNK_SIZE))
        }
      }
    },
    removeItem: (key) => {
      deleteCookie(key)
      let i = 0
      while (getCookie(`${key}_${i}`) !== null) {
        deleteCookie(`${key}_${i}`)
        i += 1
      }
    },
  }
}

let authStorage: StorageLike | undefined
if (typeof window !== 'undefined' && isPlatformSubdomain(window.location.hostname)) {
  authStorage = makeCookieStorage('.' + PLATFORM_BASE_DOMAIN)
}
// authStorage stays undefined for localhost + custom-domain tenants → supabase-js
// falls back to its default localStorage adapter (per-origin, which is fine
// because those origins don't need cross-subdomain sharing).

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    ...(authStorage && { storage: authStorage }),
    // storageKey must be the same across all *.openpenguin.de subdomains so
    // each one reads the same cookies. Default supabase-js storageKey is
    // tied to the project URL, which is the same everywhere anyway — but we
    // pin it explicitly so a future Supabase URL change doesn't silently
    // invalidate every partner's session.
    storageKey: 'openpenguin-voice-auth',
  },
})

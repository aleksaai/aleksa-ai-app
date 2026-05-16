import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env')
}

// Default localStorage adapter. Cross-subdomain session sharing
// (chunked-cookie storage scoped to .openpenguin.de) was attempted in commit
// 14bce20 but turned out to be fragile in practice — every account got
// locked out. Reverted here. Partners will see a fresh login on their tenant
// subdomain after the onboarding wizard redirect; that's an acceptable
// trade-off versus the auth being broken across the board. Phase 1c will
// revisit with a properly engineered cross-subdomain story (Cloudflare for
// SaaS or a serverless cookie endpoint).
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

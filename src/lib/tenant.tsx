// Tenant detection + whitelabel branding injection.
//
// On mount, looks up the current hostname against `agencies` via the public
// `get_agency_branding` RPC (which is anon-callable). If we land on a custom
// domain or an agency subdomain, we:
//   - cache the agency in context
//   - inject CSS variables to swap the accent colour palette
//   - swap <title> and favicon
//
// `platform.openpenguin.de` (and localhost) returns no agency — that's the
// platform-admin view, branded with the OpenPenguin defaults.
//
// Default brand colour (#65A4FF) is the OpenPenguin sky-blue; partners may
// override it. We derive a 7-shade palette via HSL manipulation so all
// derived CSS variables (-200..-800 + RGB triplets) stay in lockstep.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { AgencyBranding } from '../types/db'

type TenantContextValue = {
  agency: AgencyBranding | null
  loading: boolean
  /** True when we're on platform.openpenguin.de or localhost (no agency, default brand). */
  isPlatform: boolean
}

const TenantContext = createContext<TenantContextValue>({
  agency: null,
  loading: true,
  isPlatform: true,
})

// ─── Colour utilities ──────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  if (clean.length !== 3 && clean.length !== 6) return null
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const num = parseInt(full, 16)
  if (Number.isNaN(num)) return null
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break
    case gn: h = ((bn - rn) / d + 2); break
    default: h = ((rn - gn) / d + 4); break
  }
  return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** Derive a 7-shade palette (-200..-800) from a single hex anchor that lives at -400. */
export function deriveBrandPalette(anchorHex: string): Record<string, string> {
  const rgb = hexToRgb(anchorHex)
  if (!rgb) return {}
  const [h, s, l] = rgbToHsl(...rgb)
  const shadeOffsets: [string, number][] = [
    ['200', 0.30],
    ['300', 0.18],
    ['400', 0.0],
    ['500', -0.08],
    ['600', -0.18],
    ['700', -0.28],
    ['800', -0.40],
  ]
  const palette: Record<string, string> = {}
  for (const [shade, deltaL] of shadeOffsets) {
    const newL = Math.max(0.08, Math.min(0.95, l + deltaL))
    const [r, g, b] = hslToRgb(h, s, newL)
    palette[`--accent-${shade}`] = rgbToHex(r, g, b)
    if (shade === '400' || shade === '500') {
      palette[`--accent-${shade}-rgb`] = `${r}, ${g}, ${b}`
    }
    if (shade === '600') {
      palette['--accent-shadow-rgb'] = `${r}, ${g}, ${b}`
    }
  }
  return palette
}

function applyPaletteToRoot(palette: Record<string, string>) {
  const root = document.documentElement
  for (const [key, val] of Object.entries(palette)) {
    root.style.setProperty(key, val)
  }
}

function applyDefaultBrandingArtifacts() {
  document.title = 'OpenPenguin Voice'
  const favicon = document.querySelector('link[rel="icon"]')
  if (favicon instanceof HTMLLinkElement) favicon.href = '/favicon.png'
}

// ─── Provider ─────────────────────────────────────────────────────────

export function TenantProvider({ children }: { children: ReactNode }) {
  const [agency, setAgency] = useState<AgencyBranding | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const hostname = window.location.hostname

    const load = async () => {
      const { data, error } = await supabase.rpc('get_agency_branding', {
        p_hostname: hostname,
      })
      if (cancelled) return
      if (error) {
        console.warn('[tenant] get_agency_branding failed:', error.message)
        setAgency(null)
        applyDefaultBrandingArtifacts()
        setLoading(false)
        return
      }
      const row = Array.isArray(data) && data.length > 0 ? (data[0] as AgencyBranding) : null
      setAgency(row)
      if (row) {
        applyPaletteToRoot(deriveBrandPalette(row.brand_color))
        document.title = row.display_name
        // Favicon: explicit favicon_url wins, otherwise fall back to logo_url
        // (partners only upload a logo — we reuse it for the browser tab).
        const iconHref = row.favicon_url ?? row.logo_url
        if (iconHref) {
          const favicon = document.querySelector('link[rel="icon"]')
          if (favicon instanceof HTMLLinkElement) favicon.href = iconHref
        }
      } else {
        applyDefaultBrandingArtifacts()
      }
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [])

  const value = useMemo<TenantContextValue>(
    () => ({ agency, loading, isPlatform: agency === null }),
    [agency, loading],
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export const useTenant = () => useContext(TenantContext)

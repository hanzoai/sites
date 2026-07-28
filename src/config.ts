/**
 * Everything this app needs to know, derived from ONE input: the hostname.
 *
 *   erp.hanzo.ai     → site erp,  brand hanzo, api.hanzo.ai,     hanzo.id
 *   help.lux.network → site help, brand lux,   api.lux.network,  lux.id
 *
 * Two orthogonal resolutions, deliberately kept apart: the FIRST label picks the
 * SITE (which module), the registered domain picks the BRAND (which identity and
 * which API origin). That is why erp.zoo.ngo is a sentence and not a special case.
 *
 * `@hanzo/brand` owns the host→brand table — this file must never grow a second
 * copy of it. Env vars exist only to point a local build at a local cloud.
 */
// `BRANDS`, not `getBrand`: despite the name, `getBrand` takes a HOST and runs it
// through `brandFromHost`, so `getBrand('lux')` matches no suffix and silently
// returns the DEFAULT (Hanzo) brand. Keying the registry directly is the only
// correct way to go from a resolved brand id to its record.
import { BRANDS, brandFromHost, DEFAULT_BRAND, type BrandId } from '@hanzo/brand/registry'

import { siteFromHost, type Site } from './sites'

/** IAM issuer per brand. The brand registry carries `domain`, not the id host. */
const IAM_HOST: Record<string, string> = {
  hanzo: 'https://hanzo.id',
  lux: 'https://lux.id',
  zoo: 'https://zoolabs.id',
}

/**
 * Read statically. Next inlines `process.env.NEXT_PUBLIC_*` into the browser
 * bundle only for a LITERAL member expression — a computed `process.env[key]`
 * is left alone and silently reads `undefined` in the browser, so a dynamic
 * helper would make every override look like it was never set.
 */
export interface Overrides {
  apiUrl?: string
  iamUrl?: string
  iamClientId?: string
  iamOrg?: string
  defaultHost?: string
}

const ENV: Overrides = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  iamUrl: process.env.NEXT_PUBLIC_IAM_URL,
  iamClientId: process.env.NEXT_PUBLIC_IAM_CLIENT_ID,
  iamOrg: process.env.NEXT_PUBLIC_IAM_ORG,
  defaultHost: process.env.NEXT_PUBLIC_DEFAULT_HOST,
}

const pick = (o: Overrides, k: keyof Overrides): string => (o[k] ?? '').trim()

export interface SiteConfig {
  /** null when the host names no site — the app renders a chooser, never a guess. */
  site: Site | null
  brand: BrandId
  brandName: string
  /** `/v1/framework` root the DocType engine answers on. */
  frameworkUrl: string
  iamUrl: string
  iamClientId: string
  iamOrg: string
}

/**
 * Resolve the whole configuration from a host.
 *
 * The API origin is `api.<the brand's own domain>` by construction, so a
 * white-label host never reaches Hanzo's API — the same code, a different brand,
 * a different backend. NEXT_PUBLIC_API_URL overrides it for local runs.
 */
export function configFor(host: string | null | undefined, overrides: Overrides = ENV): SiteConfig {
  const brandId = brandFromHost(String(host ?? '')) ?? DEFAULT_BRAND
  const brand = BRANDS[brandId]
  const apiOrigin = pick(overrides, 'apiUrl') || `https://api.${brand.domain}`
  return {
    site: siteFromHost(host),
    brand: brandId,
    brandName: brand.name,
    frameworkUrl: `${apiOrigin.replace(/\/+$/, '')}/v1/framework`,
    iamUrl: pick(overrides, 'iamUrl') || IAM_HOST[brandId] || `https://${brand.domain}`,
    // The canonical public IAM client for a brand's first-party surfaces. The four
    // site hosts are redirect URIs ON that client — a per-host client would be four
    // registrations of one application.
    iamClientId: pick(overrides, 'iamClientId') || `${brandId}-app`,
    iamOrg: pick(overrides, 'iamOrg') || brandId,
  }
}

/** The browser's own config. On the server, before a request, there is no host. */
export function currentConfig(): SiteConfig {
  return configFor(typeof window === 'undefined' ? pick(ENV, 'defaultHost') : window.location.host)
}

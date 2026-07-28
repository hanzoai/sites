import { describe, expect, it } from 'vitest'

import { SITES, SITE_IDS, siteFromHost } from './sites'
import { configFor } from './config'

describe('siteFromHost — the first DNS label names the site', () => {
  it('resolves the four production hosts', () => {
    expect(siteFromHost('erp.hanzo.ai')?.id).toBe('erp')
    expect(siteFromHost('crm.hanzo.ai')?.id).toBe('crm')
    expect(siteFromHost('cms.hanzo.ai')?.id).toBe('cms')
    expect(siteFromHost('help.hanzo.ai')?.id).toBe('help')
  })

  it('resolves white-label hosts by the SAME rule', () => {
    expect(siteFromHost('erp.lux.network')?.id).toBe('erp')
    expect(siteFromHost('help.zoo.ngo')?.id).toBe('help')
  })

  it('resolves the local *.localhost hosts, port and case included', () => {
    expect(siteFromHost('cms.localhost:3100')?.id).toBe('cms')
    expect(siteFromHost('ERP.localhost:3100')?.id).toBe('erp')
  })

  it('refuses to guess: an apex or unknown label is null, never a default site', () => {
    expect(siteFromHost('hanzo.ai')).toBeNull()
    expect(siteFromHost('www.hanzo.ai')).toBeNull()
    expect(siteFromHost('localhost:3100')).toBeNull()
    expect(siteFromHost('')).toBeNull()
    expect(siteFromHost(null)).toBeNull()
  })

  it('every site declares a module — an empty module would render an empty screen', () => {
    for (const id of SITE_IDS) expect(SITES[id].module.length).toBeGreaterThan(0)
  })
})

// `configFor` reads its overrides from an argument, defaulted to the NEXT_PUBLIC_*
// env. Passing `{}` asserts the pure host→config derivation, so a developer's
// `.env.local` (which points the app at a local cloud) cannot silently rewrite what
// these tests claim production does.
describe('configFor — site and brand are resolved independently', () => {
  it('sends a white-label host to ITS OWN brand api + issuer, never Hanzo’s', () => {
    const lux = configFor('erp.lux.network', {})
    expect(lux.site?.id).toBe('erp')
    expect(lux.brand).toBe('lux')
    expect(lux.frameworkUrl).toBe('https://api.lux.network/v1/framework')
    expect(lux.iamUrl).toBe('https://lux.id')
    expect(lux.iamClientId).toBe('lux-app')
  })

  it('resolves the Hanzo hosts', () => {
    const c = configFor('help.hanzo.ai', {})
    expect(c.brand).toBe('hanzo')
    expect(c.frameworkUrl).toBe('https://api.hanzo.ai/v1/framework')
    expect(c.iamUrl).toBe('https://hanzo.id')
  })

  it('a site-less host still resolves a brand, so the chooser is branded', () => {
    const c = configFor('hanzo.ai', {})
    expect(c.site).toBeNull()
    expect(c.brand).toBe('hanzo')
  })

  it('an override points a local build at a local cloud without touching the rule', () => {
    const local = configFor('cms.localhost:3100', { apiUrl: 'http://127.0.0.1:8299', iamUrl: 'http://127.0.0.1:9299' })
    expect(local.site?.id).toBe('cms')
    expect(local.frameworkUrl).toBe('http://127.0.0.1:8299/v1/framework')
    expect(local.iamUrl).toBe('http://127.0.0.1:9299')
  })
})

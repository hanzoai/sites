'use client'

/**
 * The ONE route. Four hosts, three depths, one file:
 *
 *   /                        the module's collections
 *   /:doctype                that collection's records
 *   /:doctype/:name          one record (`new` opens the create form)
 *
 * The site comes from the hostname, so it is resolved in the browser — which is
 * also why the server render is identical for all four hosts and one build ships
 * everywhere.
 */
import { useEffect, useState } from 'react'
import { use } from 'react'

import { currentConfig } from '../../src/config'
import { Site, SiteChooser } from '../../src/Site'

export default function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = use(params)
  // The host is a browser fact. Render nothing on the server rather than a
  // guessed site that would flash the wrong product.
  const [host, setHost] = useState<string | null>(null)
  useEffect(() => setHost(window.location.host), [])
  if (!host) return null

  const cfg = currentConfig()
  if (!cfg.site) return <SiteChooser brand={cfg.brand} brandName={cfg.brandName} />
  return <Site site={cfg.site} brand={cfg.brand} brandName={cfg.brandName} path={path} />
}

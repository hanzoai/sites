/**
 * THE MAP. One app, four hosts — this is the whole difference between them.
 *
 * erp.<brand>  crm.<brand>  cms.<brand>  help.<brand> are not four apps. They
 * are one app whose `module` is fixed by the first DNS label, because the thing
 * behind all four is the same DocType engine (cloud clients/framework) and an
 * "app lane" there is nothing more than a module tag over the DocType registry.
 * So the site is a VALUE, resolved from the host, and everything downstream —
 * nav, copy, which collections exist — follows from it.
 *
 * No I/O, no React: `siteFromHost` is a pure function over a string, which is
 * what makes the host→site rule testable instead of a deployment guess.
 */

export type SiteId = 'erp' | 'crm' | 'cms' | 'help'

export interface Site {
  /** The DNS label AND the id. `erp.hanzo.ai` → `erp`. */
  id: SiteId
  /** The framework module tag its DocTypes carry (cloud `framework.RegisterModule`). */
  module: string
  /** Product name, shown next to the brand wordmark. */
  label: string
  /** One line under the title. */
  tagline: string
  /** First-run copy for an org that has not installed this lane's fixtures yet. */
  setup: { description: string; bullets: string[] }
}

/**
 * `module` is not always the id — it is whatever the lane REGISTERED in cloud, and
 * guessing would give an empty screen. Measured against `GET /v1/framework/modules`:
 * cms, erp, help, kb, marketing are registered; `crm` is declared here because the
 * CRM lane's DocTypes are being written, and until they land the shell says so
 * honestly rather than inventing collections.
 */
export const SITES: Record<SiteId, Site> = {
  erp: {
    id: 'erp',
    module: 'erp',
    label: 'ERP',
    tagline: 'Items, customers, orders, invoices and the ledgers they post to.',
    setup: {
      description:
        'ERP is the business model itself — items, warehouses, customers, suppliers, sales and purchase orders, invoices, stock entries and the journal — as DocTypes on the Hanzo Framework, per organization.',
      bullets: [
        'Installs the ERP masters, transactions and ledgers into your organization',
        'Transactions are submittable: draft → submitted → cancelled, with posting hooks',
        'The general ledger and stock ledger are append-only, never edited by hand',
      ],
    },
  },
  crm: {
    id: 'crm',
    module: 'crm',
    label: 'CRM',
    tagline: 'Companies, people, pipeline — the relationships behind the revenue.',
    setup: {
      description:
        'CRM is companies, contacts, opportunities and the activity against them, as DocTypes on the Hanzo Framework, per organization.',
      bullets: [
        'Installs the CRM collections into your organization',
        'Every record is a framework document — permissioned, versioned, per-org',
        'Links between records are real relations, not copied text',
      ],
    },
  },
  cms: {
    id: 'cms',
    module: 'cms',
    label: 'Content',
    tagline: 'Pages, posts, articles and media — structured content, not a page builder.',
    setup: {
      description:
        'Content is a set of collections — Pages, Posts, Articles, Media and Navigation — as DocTypes on the Hanzo Framework, per organization.',
      bullets: [
        'Installs the default collections into your organization',
        'Content is documents on the framework — versioned, permissioned, per-org',
        'Publish and unpublish are a status flip, not a separate system',
      ],
    },
  },
  help: {
    id: 'help',
    module: 'help',
    label: 'Help Center',
    tagline: 'Tickets, categories, responses and the knowledge base behind them.',
    setup: {
      description:
        'The Help Center is tickets, their categories and responses, plus the knowledge-base articles that deflect them — as DocTypes on the Hanzo Framework, per organization.',
      bullets: [
        'Installs the helpdesk collections into your organization',
        'A ticket is a document; a response is a linked child, not an email blob',
        'Articles share the same engine, so search and permissions are one system',
      ],
    },
  },
}

export const SITE_IDS = Object.keys(SITES) as SiteId[]

const isSiteId = (s: string): s is SiteId => Object.prototype.hasOwnProperty.call(SITES, s)

/**
 * The host→site rule: the FIRST DNS label names the site.
 *
 *   erp.hanzo.ai         → erp      (production)
 *   help.lux.network     → help     (white-label — the brand is resolved separately)
 *   crm.localhost:3100   → crm      (local: *.localhost is loopback in every browser,
 *                                    so local development exercises the REAL rule)
 *
 * Anything else — an apex domain, an unknown label — is `null`, and the caller
 * shows a chooser rather than silently defaulting to one of the four.
 */
export function siteFromHost(host: string | null | undefined): Site | null {
  const label = String(host ?? '')
    .trim()
    .toLowerCase()
    .split(':')[0]
    .split('.')[0]
  return isSiteId(label) ? SITES[label] : null
}

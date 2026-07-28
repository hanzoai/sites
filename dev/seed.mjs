/**
 * Seed the local org so the four shells have something real to render.
 *
 * Everything here goes through the SAME public surface the app uses
 * (/v1/framework/*) with the SAME bearer — no back door, no direct database
 * write. Two kinds of work:
 *
 *   1. `install` the lanes cloud already registers (cms, erp, help). Their
 *      DocTypes come from the Go fixtures; this only asks for them.
 *   2. `define` the CRM DocTypes. cloud main registers NO crm module yet (the
 *      CRM lane is being written), so they are created here through the engine's
 *      own DocType API — which is precisely the point: a lane is DATA, and the
 *      shell needed zero code to render a module the binary has never heard of.
 *
 * Then a handful of records per collection, so a screenshot shows a table and
 * not an empty state.
 */
const API = process.env.API || 'http://127.0.0.1:8299'
const IAM = process.env.IAM || 'http://127.0.0.1:9299'

const token = await fetch(`${IAM}/v1/iam/oauth/token`, { method: 'POST' })
  .then((r) => r.json())
  .then((j) => j.access_token)

const call = async (method, path, body) => {
  const res = await fetch(`${API}/v1/framework/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? null : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? null : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null }
}

const say = (label, r) => console.log(`${r.ok ? 'ok  ' : `${r.status} `} ${label}${r.ok ? '' : ` — ${JSON.stringify(r.body)}`}`)

// ── 1. the lanes cloud registers ────────────────────────────────────────────
for (const m of ['cms', 'erp', 'help']) say(`install ${m}`, await call('POST', `modules/${m}/install`))

// ── 2. CRM, defined through the engine ──────────────────────────────────────
const PERMS = [
  { role: 'System Manager', read: true, write: true, create: true, delete: true },
  { role: 'Crm User', read: true, write: true, create: true },
]
const CRM = [
  {
    name: 'crm-company',
    module: 'crm',
    autoname: 'field:company_name',
    titleField: 'company_name',
    permissions: PERMS,
    fields: [
      { fieldname: 'company_name', fieldtype: 'Data', label: 'Company', reqd: true, inListView: true },
      { fieldname: 'domain', fieldtype: 'Data', label: 'Domain', inListView: true },
      { fieldname: 'industry', fieldtype: 'Data', label: 'Industry', inListView: true },
      { fieldname: 'employees', fieldtype: 'Int', label: 'Employees' },
      { fieldname: 'annual_revenue', fieldtype: 'Currency', label: 'Annual revenue' },
      { fieldname: 'notes', fieldtype: 'Text', label: 'Notes' },
    ],
  },
  {
    name: 'crm-contact',
    module: 'crm',
    autoname: 'field:full_name',
    titleField: 'full_name',
    permissions: PERMS,
    fields: [
      { fieldname: 'full_name', fieldtype: 'Data', label: 'Name', reqd: true, inListView: true },
      { fieldname: 'email', fieldtype: 'Data', label: 'Email', reqd: true, inListView: true },
      { fieldname: 'phone', fieldtype: 'Data', label: 'Phone' },
      { fieldname: 'job_title', fieldtype: 'Data', label: 'Title', inListView: true },
      { fieldname: 'company', fieldtype: 'Link', label: 'Company', options: 'crm-company', inListView: true },
    ],
  },
  {
    name: 'crm-deal',
    module: 'crm',
    autoname: 'crm-deal-.#####',
    titleField: 'deal_name',
    permissions: PERMS,
    fields: [
      { fieldname: 'deal_name', fieldtype: 'Data', label: 'Deal', reqd: true, inListView: true },
      { fieldname: 'company', fieldtype: 'Link', label: 'Company', options: 'crm-company', inListView: true },
      { fieldname: 'contact', fieldtype: 'Link', label: 'Contact', options: 'crm-contact' },
      { fieldname: 'stage', fieldtype: 'Select', label: 'Stage', options: 'Lead\nQualified\nProposal\nNegotiation\nWon\nLost', default: 'Lead', inListView: true },
      { fieldname: 'amount', fieldtype: 'Currency', label: 'Amount', inListView: true },
      { fieldname: 'close_date', fieldtype: 'Date', label: 'Expected close', inListView: true },
      { fieldname: 'owner_agent', fieldtype: 'Data', label: 'Owner' },
    ],
  },
]
for (const dt of CRM) {
  let r = await call('POST', 'doctypes', dt)
  // Re-running the seed after editing a definition must converge, not 409.
  if (r.status === 409) r = await call('PUT', `doctypes/${encodeURIComponent(dt.name)}`, dt)
  say(`define ${dt.name}`, r)
}

// ── 3. records ──────────────────────────────────────────────────────────────
const rows = {
  'crm-company': [
    { company_name: 'Northwind Robotics', domain: 'northwind.example', industry: 'Industrial automation', employees: 340, annual_revenue: 48000000, notes: 'Renewal owner is procurement, not engineering.' },
    { company_name: 'Kestrel Health', domain: 'kestrelhealth.example', industry: 'Healthcare', employees: 1200, annual_revenue: 210000000, notes: 'HIPAA review required before pilot.' },
    { company_name: 'Meridian Freight', domain: 'meridianfreight.example', industry: 'Logistics', employees: 85, annual_revenue: 12500000, notes: '' },
  ],
  'crm-contact': [
    { full_name: 'Dana Okafor', email: 'dana@northwind.example', phone: '+1 415 555 0142', job_title: 'VP Engineering', company: 'Northwind Robotics' },
    { full_name: 'Ilya Marchetti', email: 'ilya@kestrelhealth.example', phone: '+1 212 555 0197', job_title: 'Head of Platform', company: 'Kestrel Health' },
    { full_name: 'Sam Adeyemi', email: 'sam@meridianfreight.example', phone: '+1 312 555 0166', job_title: 'COO', company: 'Meridian Freight' },
  ],
  'crm-deal': [
    { deal_name: 'Northwind — fleet telemetry', company: 'Northwind Robotics', contact: 'Dana Okafor', stage: 'Proposal', amount: 180000, close_date: '2026-09-30', owner_agent: 'z' },
    { deal_name: 'Kestrel — clinical pilot', company: 'Kestrel Health', contact: 'Ilya Marchetti', stage: 'Qualified', amount: 95000, close_date: '2026-10-15', owner_agent: 'z' },
    { deal_name: 'Meridian — routing rollout', company: 'Meridian Freight', contact: 'Sam Adeyemi', stage: 'Negotiation', amount: 42000, close_date: '2026-08-21', owner_agent: 'z' },
    { deal_name: 'Northwind — expansion', company: 'Northwind Robotics', stage: 'Lead', amount: 60000, close_date: '2026-12-01', owner_agent: 'z' },
  ],
  'erp-item': [
    { item_code: 'AX-100', item_name: 'Axial servo drive', item_group: 'Drives', stock_uom: 'Nos', standard_rate: 1250, is_stock_item: true, description: '3-phase servo drive, 400V, 5.5kW.' },
    { item_code: 'BR-220', item_name: 'Bearing housing', item_group: 'Mechanical', stock_uom: 'Nos', standard_rate: 88.5, is_stock_item: true, description: 'Cast iron, 220mm bore.' },
    { item_code: 'CT-045', item_name: 'Controller board', item_group: 'Electronics', stock_uom: 'Nos', standard_rate: 640, is_stock_item: true, description: 'Motion controller, 8-axis.' },
    { item_code: 'SV-001', item_name: 'Commissioning service', item_group: 'Services', stock_uom: 'Hour', standard_rate: 190, is_stock_item: false, description: 'On-site commissioning, per hour.' },
  ],
  'erp-customer': [
    { customer_name: 'Northwind Robotics', customer_group: 'Enterprise', email: 'ap@northwind.example', phone: '+1 415 555 0142', territory: 'North America' },
    { customer_name: 'Kestrel Health', customer_group: 'Enterprise', email: 'ap@kestrelhealth.example', phone: '+1 212 555 0197', territory: 'North America' },
    { customer_name: 'Meridian Freight', customer_group: 'Mid-market', email: 'billing@meridianfreight.example', phone: '+1 312 555 0166', territory: 'North America' },
  ],
  'erp-warehouse': [
    { warehouse_name: 'Oakland Main', is_group: false },
    { warehouse_name: 'Reno Overflow', is_group: false },
  ],
  'hd-category': [
    { category_name: 'Billing', description: 'Invoices, plans, payment methods.' },
    { category_name: 'Deployment', description: 'Builds, releases and rollbacks.' },
    { category_name: 'Access', description: 'Sign-in, organizations and roles.' },
  ],
  'hd-ticket': [
    { subject: 'Invoice 4471 shows the wrong tax rate', description: 'The October invoice applied 8.5% instead of the 6% we are registered for.', status: 'Open', priority: 'High', customer: 'Kestrel Health', source: 'Email' },
    { subject: 'Deploy stuck in "building" for 40 minutes', description: 'Build 2f1c9 has not progressed. No logs after the install step.', status: 'Pending', priority: 'Urgent', customer: 'Northwind Robotics', source: 'Web' },
    { subject: 'Add a second admin to our organization', description: 'Sam should be able to manage members and billing.', status: 'Resolved', priority: 'Low', customer: 'Meridian Freight', source: 'Web', resolution: 'Invited sam@ as an org admin; confirmed access.' },
    { subject: 'SSO metadata URL returns 404', description: 'Our IdP cannot fetch the metadata document.', status: 'Open', priority: 'Medium', customer: 'Kestrel Health', source: 'Email' },
  ],
  'hd-article': [
    { title: 'Rotating an API key without downtime', slug: 'rotate-api-key', category: 'Access', status: 'Published', body: 'Mint the new key first, deploy it, then revoke the old one. Keys are independent, so the two overlap safely.' },
    { title: 'What a build actually does', slug: 'what-a-build-does', category: 'Deployment', status: 'Published', body: 'A build resolves your dependencies, produces an image, and records the digest. A deploy points an environment at a digest.' },
  ],
  Page: [
    { title: 'Platform', slug: 'platform', status: 'Published', excerpt: 'One engine, every business app.', tags: 'product' },
    { title: 'Pricing', slug: 'pricing', status: 'Published', excerpt: 'Pay for what you run.', tags: 'product' },
    { title: 'Security posture', slug: 'security', status: 'Draft', excerpt: 'How tenancy, keys and audit work.', tags: 'trust' },
  ],
  Post: [
    { title: 'The DocType engine, in one page', slug: 'doctype-engine', status: 'Published', excerpt: 'Why four products can be one app.' },
    { title: 'Shipping a lane without shipping UI', slug: 'lane-without-ui', status: 'Draft', excerpt: 'A lane is data. The renderer is already there.' },
  ],
  Author: [{ name: 'Z', email: 'z@hanzo.ai' }],
}

/**
 * Re-running must converge. A field-named DocType 409s a duplicate on its own,
 * but a SERIES-named one (crm-deal-.#####) mints a fresh name every call and
 * would quietly double the rows — so existing titles are read first and skipped.
 */
for (const [doctype, records] of Object.entries(rows)) {
  const existing = new Set(
    ((await call('GET', doctype)).body?.data ?? []).map((d) => String(d[Object.keys(records[0])[0]] ?? '')),
  )
  for (const rec of records) {
    const title = String(Object.values(rec)[0])
    if (existing.has(title)) {
      say(`${doctype} ← ${title}`, { ok: true })
      continue
    }
    const r = await call('POST', doctype, rec)
    say(`${doctype} ← ${title}`, r.status === 409 ? { ...r, ok: true } : r)
  }
}

console.log('\nseeded.')

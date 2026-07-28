/**
 * The proof: drive all four hosts in a real browser, at a phone and at a desktop,
 * and photograph what a signed-in user actually sees.
 *
 * It uses the app's OWN sign-in button, which runs the app's OWN PKCE flow
 * against the local issuer — no seeded token, no mocked network. If auth were
 * broken these would land on the sign-in card and the collection assertions
 * would fail, which is the point of asserting on content rather than on a
 * screenshot alone.
 *
 * Mobile is the bar, so every viewport also asserts the page does not scroll
 * sideways at 390px.
 */
import { test, expect, type Page } from '@playwright/test'

const PORT = process.env.PORT ?? '3100'
const VIEWPORTS = [
  { tag: 'mobile', width: 390, height: 844 },
  { tag: 'desktop', width: 1440, height: 900 },
] as const

/** Each host, a collection it owns, and a REAL record that must be on screen. */
const HOSTS = [
  { site: 'erp', collection: 'erp-item', record: 'AX-100' },
  { site: 'crm', collection: 'crm-deal', record: 'Northwind — fleet telemetry' },
  { site: 'cms', collection: 'Page', record: 'platform' },
  { site: 'help', collection: 'hd-ticket', record: 'Invoice 4471 shows the wrong tax rate' },
] as const

const url = (site: string, path = '') => `http://${site}.localhost:${PORT}${path}`

/**
 * Sign in through the app's own button; the local issuer needs no interaction.
 *
 * The callback lands with `location.replace`, so the run must WAIT for that final
 * navigation to settle — screenshotting or navigating into an in-flight replace
 * fails with an opaque protocol error rather than a useful one. The signed-in
 * user's name appearing in the header is the settled signal: it can only render
 * after the token exchange AND the userinfo round-trip have both landed.
 */
async function signIn(page: Page, site: string) {
  await page.goto(url(site), { waitUntil: 'domcontentloaded' })
  const button = page.getByText('Sign in', { exact: true }).first()
  await button.waitFor({ state: 'visible', timeout: 30_000 })
  await button.click()
  await page.waitForURL(new RegExp(`^http://${site}\\.localhost:${PORT}/(\\?|$)`), { timeout: 30_000 })
  await page.waitForLoadState('load')
  await expect(page.getByText('z', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
}

async function noHorizontalScroll(page: Page) {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflows, 'the page must not scroll sideways').toBe(false)
}

for (const vp of VIEWPORTS) {
  for (const { site, collection, record } of HOSTS) {
    test(`${site} · ${vp.tag}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await signIn(page, site)

      // 1. the module home — the lane's collections, from the engine's registry
      await expect(page.getByText(collection, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
      if (vp.tag === 'mobile') await noHorizontalScroll(page)
      await page.screenshot({ path: `shots/${site}-collections-${vp.tag}.png`, fullPage: false })

      // 2. one collection's records
      await page.goto(url(site, `/${encodeURIComponent(collection)}`), { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(collection, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
      // Waiting for a REAL row is what stops a screenshot from catching the
      // loading state — a collection with Link fields resolves its pickers first.
      await expect(page.getByText(record, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
      if (vp.tag === 'mobile') await noHorizontalScroll(page)
      await page.screenshot({ path: `shots/${site}-records-${vp.tag}.png`, fullPage: false })
    })
  }
}

test('one record, read then edit — the generic form', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'crm')
  // A record URL is addressable — bookmarked, shared, deep-linked — so entering
  // one directly is a real path, not a shortcut past the UI. (A cell CLICK in the
  // list starts an inline edit; opening is its own affordance.)
  await page.goto(url('crm', '/crm-company/Northwind%20Robotics'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Edit', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Northwind Robotics').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Industrial automation').first()).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: 'shots/crm-detail-desktop.png' })

  await page.getByText('Edit', { exact: true }).first().click()
  await expect(page.getByText('Save', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: 'shots/crm-form-desktop.png' })
})

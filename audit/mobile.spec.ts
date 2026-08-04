/**
 * VERIFY 1 — mobile first, adversarially.
 *
 * Three viewports x four modules x four screens (collections / records / detail /
 * edit form). Every screen is photographed AND measured: horizontal overflow with
 * the offending boxes named, every tap target's real px size, clipped text,
 * console errors. No HTTP status is treated as evidence of anything.
 *
 * The record is opened by CLICKING it first — the real user path. If the click
 * does not navigate (it does not, above the phone breakpoint) that is RECORDED and
 * the run falls back to the record URL, so the later screens are still judged
 * rather than lost behind the earlier defect.
 */
import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { overflow, tapTargets, clipped } from './probe'

const PORT = process.env.PORT ?? '3100'
const SHOTS = 'audit-shots'
const OUT: Record<string, any> = {}

mkdirSync(SHOTS, { recursive: true })

const VIEWPORTS = [
  { tag: 'mobile', width: 390, height: 844 },
  { tag: 'tablet', width: 768, height: 1024 },
  { tag: 'desktop', width: 1440, height: 900 },
] as const

/** Each host: a collection, the title a HUMAN sees, and the record's real key. */
const HOSTS = [
  { site: 'erp', collection: 'erp-item', record: 'Axial servo drive', key: 'AX-100' },
  { site: 'crm', collection: 'crm-deal', record: 'Northwind — fleet telemetry', key: 'crm-deal-00001' },
  { site: 'cms', collection: 'Page', record: 'Security posture', key: 'security' },
  { site: 'help', collection: 'hd-ticket', record: 'Invoice 4471 shows the wrong tax rate', key: 'hd-tkt-00001' },
] as const

const url = (site: string, path = '') => `http://${site}.localhost:${PORT}${path}`

async function signIn(page: Page, site: string) {
  await page.goto(url(site), { waitUntil: 'domcontentloaded' })
  const button = page.getByText('Sign in', { exact: true }).first()
  await button.waitFor({ state: 'visible', timeout: 60_000 })
  await button.click()
  await page.waitForURL(new RegExp(`^http://${site}\\.localhost:${PORT}/(\\?|$)`), { timeout: 60_000 })
  await page.waitForLoadState('load')
  await expect(page.getByText('z', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
}

async function measure(page: Page, key: string, vw: number) {
  const ov = await overflow(page)
  const tt = await tapTargets(page)
  const cl = await clipped(page)
  OUT[key] = {
    viewportWidth: vw,
    overflows: ov.overflows,
    doc: `${ov.docScrollWidth}/${ov.docClientWidth}`,
    offenders: ov.offenders,
    targets: tt.length,
    undersized: tt.filter((t) => t.h < 44 || t.w < 44),
    clippedText: cl,
  }
}

test.afterAll(() => {
  writeFileSync(`${SHOTS}/measurements.json`, JSON.stringify(OUT, null, 2))
})

for (const vp of VIEWPORTS) {
  for (const h of HOSTS) {
    test(`${h.site} · ${vp.tag} (${vp.width}x${vp.height})`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
      page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)))
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await signIn(page, h.site)

      // 1 — collections
      await expect(page.getByText(h.collection, { exact: false }).first()).toBeVisible({ timeout: 60_000 })
      await page.screenshot({ path: `${SHOTS}/${h.site}-1collections-${vp.tag}.png` })
      await measure(page, `${h.site}/${vp.tag}/collections`, vp.width)

      // 2 — records
      const listUrl = url(h.site, `/${encodeURIComponent(h.collection)}`)
      await page.goto(listUrl, { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(h.record, { exact: false }).first()).toBeVisible({ timeout: 60_000 })
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${SHOTS}/${h.site}-2records-${vp.tag}.png` })
      await measure(page, `${h.site}/${vp.tag}/records`, vp.width)
      await page.screenshot({ path: `${SHOTS}/${h.site}-2records-${vp.tag}-full.png`, fullPage: true })

      // 3 — open the record BY CLICKING IT (the real path), and record whether that works
      await page.getByText(h.record, { exact: false }).first().click()
      await page.waitForTimeout(1500)
      const opened = page.url() !== listUrl
      OUT[`${h.site}/${vp.tag}/clickOpensRecord`] = opened
      if (!opened) {
        await page.screenshot({ path: `${SHOTS}/${h.site}-2records-${vp.tag}-afterclick.png` })
        await page.goto(url(h.site, `/${encodeURIComponent(h.collection)}/${encodeURIComponent(h.key)}`), {
          waitUntil: 'domcontentloaded',
        })
      }
      await expect(page.getByText('Edit', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${SHOTS}/${h.site}-3detail-${vp.tag}.png` })
      await measure(page, `${h.site}/${vp.tag}/detail`, vp.width)
      await page.screenshot({ path: `${SHOTS}/${h.site}-3detail-${vp.tag}-full.png`, fullPage: true })

      // 4 — the edit form (the one-handed test)
      await page.getByText('Edit', { exact: true }).first().click()
      await expect(page.getByText('Save', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SHOTS}/${h.site}-4form-${vp.tag}.png` })
      await measure(page, `${h.site}/${vp.tag}/form`, vp.width)
      await page.screenshot({ path: `${SHOTS}/${h.site}-4form-${vp.tag}-full.png`, fullPage: true })

      OUT[`${h.site}/${vp.tag}/consoleErrors`] = errors
    })
  }
}

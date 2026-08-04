/** The cases a happy-path screenshot run never reaches. */
import { test, expect, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { overflow, tapTargets } from './probe'

const PORT = process.env.PORT ?? '3100'
const url = (site: string, p = '') => `http://${site}.localhost:${PORT}${p}`
const OUT: any = {}

async function signIn(page: Page, site: string) {
  await page.goto(url(site), { waitUntil: 'domcontentloaded' })
  const b = page.getByText('Sign in', { exact: true }).first()
  await b.waitFor({ state: 'visible', timeout: 60_000 })
  await b.click()
  await page.waitForURL(new RegExp(`^http://${site}\\.localhost:${PORT}/(\\?|$)`), { timeout: 60_000 })
  await expect(page.getByText('z', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
}

test('phone LANDSCAPE 844x390', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await signIn(page, 'help')
  await page.goto(url('help', '/hd-ticket'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Kestrel Health').first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(800)
  const ov = await overflow(page)
  const m = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="doctype-table"]')
    let hidden = 0
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'hidden' && el.clientWidth > 400)
        hidden = Math.max(hidden, el.scrollWidth - el.clientWidth)
    })
    return { isTable: !!t, hiddenPx: hidden }
  })
  OUT.landscapePhone = { ...m, pageOverflows: ov.overflows }
  await page.screenshot({ path: 'audit-shots/edge-landscape-phone.png' })
  console.log('LANDSCAPE PHONE', JSON.stringify(OUT.landscapePhone))
})

test('CMS Media collection on a phone (no uploader wired)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'cms')
  await page.goto(url('cms', '/Media'), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  OUT.media = await page.evaluate(() => ({
    text: (document.body.innerText || '').slice(0, 400),
    hasUpload: /upload|drop|choose file/i.test(document.body.innerText || ''),
  }))
  await page.screenshot({ path: 'audit-shots/edge-cms-media-mobile.png', fullPage: true })
  console.log('MEDIA', JSON.stringify(OUT.media))
})

test('crowded action row: a submittable ERP doc on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'erp')
  // create a draft sales order so Submit / Cancel / Delete / Edit all appear
  await page.goto(url('erp', '/erp-sales'), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'audit-shots/edge-erp-sales-empty-mobile.png', fullPage: true })
  OUT.erpSalesEmpty = (await page.evaluate(() => document.body.innerText)).slice(0, 300)

  // the NEW-record form on a phone
  await page.goto(url('erp', '/erp-sales/new'), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const ov = await overflow(page)
  const tt = await tapTargets(page)
  OUT.newForm = {
    overflows: ov.overflows,
    text: (await page.evaluate(() => document.body.innerText)).slice(0, 300),
    smallTargets: tt.filter((t) => (t.h < 44 || t.w < 44) && t.tag !== 'span' && t.tag !== 'path' && t.tag !== 'svg'),
  }
  await page.screenshot({ path: 'audit-shots/edge-erp-new-form-mobile.png', fullPage: true })
  console.log('NEW FORM', JSON.stringify(OUT.newForm, null, 1))
})

test('long breadcrumb in the phone header', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await signIn(page, 'erp')
  await page.goto(url('erp', '/erp-journal-account'), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  OUT.longCrumb = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const crumbs = Array.from(document.querySelectorAll('span,div'))
      .filter((e) => e.children.length === 0 && /erp-journal-account|ERP|Hanzo/.test(e.textContent || ''))
      .map((e) => {
        const r = e.getBoundingClientRect()
        return { t: (e.textContent || '').trim(), left: Math.round(r.left), right: Math.round(r.right), truncated: e.scrollWidth > e.clientWidth + 1 }
      })
    const appsBtn = Array.from(document.querySelectorAll('button')).map((b) => Math.round(b.getBoundingClientRect().left))
    return { vw, crumbs, buttonLefts: appsBtn }
  })
  await page.screenshot({ path: 'audit-shots/edge-long-crumb-360.png', clip: { x: 0, y: 0, width: 360, height: 60 } })
  console.log('LONG CRUMB', JSON.stringify(OUT.longCrumb))
})

test('the Board view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'crm')
  await page.goto(url('crm', '/crm-deal'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Northwind — fleet telemetry').first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(700)
  await page.getByText('Board', { exact: true }).first().click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'audit-shots/edge-board-desktop.png' })
  const before = page.url()
  await page.getByText('Northwind — fleet telemetry').first().click().catch(() => {})
  await page.waitForTimeout(1200)
  OUT.board = { opensRecord: page.url() !== before, url: page.url() }
  await page.screenshot({ path: 'audit-shots/edge-board-after-click.png' })
  console.log('BOARD', JSON.stringify(OUT.board))
})

test.afterAll(() => writeFileSync('audit-shots/edges.json', JSON.stringify(OUT, null, 2)))

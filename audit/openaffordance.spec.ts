/**
 * Can a DESKTOP user open a record at all?
 *
 * On a phone the card is the affordance and clicking it navigates. On a desktop
 * the table replaces the cards and `onOpen` is handed to `RecordsView` — but is it
 * reachable with a mouse? Each attempt starts from a FRESH list (a click that
 * opens an inline editor destroys the text node, so attempts cannot be chained).
 */
import { test, expect, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'

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

async function freshList(page: Page) {
  await page.goto(url('erp', '/erp-item'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Axial servo drive').first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(700)
}

test('desktop: is there ANY way to open a record from the table', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'erp')
  const list = url('erp', '/erp-item')

  const attempt = async (name: string, fn: () => Promise<void>) => {
    await freshList(page)
    try {
      await fn()
    } catch (e) {
      OUT[name] = { error: String(e).slice(0, 120) }
      return
    }
    await page.waitForTimeout(1300)
    OUT[name] = { url: page.url(), navigated: page.url() !== list }
    await page.screenshot({ path: `audit-shots/probe-desktop-${name}.png` })
  }

  await attempt('click-title-cell', async () => {
    await page.getByText('Axial servo drive').first().click()
  })
  await attempt('dblclick-title-cell', async () => {
    await page.getByText('Axial servo drive').first().dblclick()
  })
  await attempt('click-primary-key-cell', async () => {
    await page.getByText('AX-100').first().click()
  })
  await attempt('click-row-far-right-blank', async () => {
    const row = page.getByText('AX-100').first()
    const box = (await row.boundingBox())!
    await page.mouse.click(1300, box.y + box.height / 2)
  })
  await attempt('hover-row-then-look', async () => {
    await page.getByText('AX-100').first().hover()
    await page.waitForTimeout(600)
    OUT.hoverRevealed = await page.evaluate(() => {
      const out: any[] = []
      document.querySelectorAll('button,[role="button"],a').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return
        out.push({ tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top) })
      })
      return out
    })
  })

  await freshList(page)
  OUT.tableClickables = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="doctype-table"]') || document.body
    const out: any[] = []
    t.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      if (!(el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button' || cs.cursor === 'pointer')) return
      out.push({ tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), cursor: cs.cursor, text: (el.textContent || '').trim().slice(0, 34), w: Math.round(r.width), h: Math.round(r.height) })
    })
    return out.slice(0, 40)
  })

  writeFileSync('audit-shots/open-affordance.json', JSON.stringify(OUT, null, 2))
  console.log(JSON.stringify(OUT, null, 2))
})

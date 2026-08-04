/** The width band where the table is chosen but does not fit — and what it costs. */
import { test, expect, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const PORT = process.env.PORT ?? '3100'
const url = (site: string, p = '') => `http://${site}.localhost:${PORT}${p}`
const OUT: any[] = []

async function signIn(page: Page, site: string) {
  await page.goto(url(site), { waitUntil: 'domcontentloaded' })
  const b = page.getByText('Sign in', { exact: true }).first()
  await b.waitFor({ state: 'visible', timeout: 60_000 })
  await b.click()
  await page.waitForURL(new RegExp(`^http://${site}\\.localhost:${PORT}/(\\?|$)`), { timeout: 60_000 })
  await expect(page.getByText('z', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
}

const WIDTHS = [740, 752, 768, 800, 820, 900, 1024, 1100, 1180, 1280, 1440]

test('width sweep: hd-ticket (11 fields) and erp-invoice', async ({ page }) => {
  await signIn(page, 'help')
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto(url('help', '/hd-ticket'), { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Kestrel Health').first()).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(700)
    const m = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="doctype-table"]')
      let clip: any = null
      document.querySelectorAll('*').forEach((el) => {
        const cs = getComputedStyle(el)
        if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX === 'hidden' && el.clientWidth > 400) {
          if (!clip || el.clientWidth > clip.clientW) clip = { clientW: el.clientWidth, scrollW: el.scrollWidth, hiddenPx: el.scrollWidth - el.clientWidth }
        }
      })
      // how many cells have their own text truncated
      let truncated = 0
      document.querySelectorAll('span').forEach((el) => {
        if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'hidden') truncated++
      })
      return { isTable: !!t, clip, truncatedCells: truncated }
    })
    OUT.push({ width: w, layout: m.isTable ? 'TABLE' : 'cards', hiddenPx: m.clip?.hiddenPx ?? 0, box: m.clip ? `${m.clip.scrollW}px in ${m.clip.clientW}px` : '—', truncatedCells: m.truncatedCells })
    await page.screenshot({ path: `audit-shots/sweep-help-${w}.png` })
  }
  console.table(OUT)
  writeFileSync('audit-shots/sweep.json', JSON.stringify(OUT, null, 2))
})

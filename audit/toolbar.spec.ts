/** The phone toolbar: does the search box fit inside the page gutter? */
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

for (const w of [360, 390, 430]) {
  test(`phone toolbar at ${w}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 844 })
    await signIn(page, 'cms')
    await page.goto(url('cms', '/Page'), { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Security posture').first()).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(900)
    OUT[w] = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const inp = document.querySelector('input') as HTMLElement | null
      // walk up from the input to find its bordered wrapper
      const boxes: any[] = []
      let el: HTMLElement | null = inp
      for (let i = 0; el && i < 5; i++, el = el.parentElement) {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        boxes.push({
          up: i,
          tag: el.tagName.toLowerCase(),
          left: Math.round(r.left),
          right: Math.round(r.right),
          w: Math.round(r.width),
          borderR: cs.borderRightWidth,
          overRightEdge: r.right > vw,
        })
      }
      // the card gutter, for comparison
      const card = Array.from(document.querySelectorAll('*')).find(
        (e) => (e.textContent || '').startsWith('Security posture') && e.getBoundingClientRect().width > 200,
      )
      const cr = card?.getBoundingClientRect()
      return {
        vw,
        inputChain: boxes,
        cardLeft: cr ? Math.round(cr.left) : null,
        cardRight: cr ? Math.round(cr.right) : null,
      }
    })
    await page.screenshot({ path: `audit-shots/toolbar-${w}.png`, clip: { x: 0, y: 50, width: w, height: 180 } })
    console.log(w, JSON.stringify(OUT[w]))
  })
}

test.afterAll(() => writeFileSync('audit-shots/toolbar.json', JSON.stringify(OUT, null, 2)))

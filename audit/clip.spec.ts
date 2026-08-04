/**
 * At 768 the table wins the layout decision but does not fit. Is the clipped
 * column reachable by ANY means — page scroll, container scroll, wheel, drag?
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

for (const [tag, w, h] of [
  ['768', 768, 1024],
  ['820-ipad-air', 820, 1180],
  ['744-ipad-mini', 744, 1133],
  ['722-just-over-TABLE_MIN', 722, 1000],
  ['718-just-under-TABLE_MIN', 718, 1000],
] as const) {
  test(`help ticket table at ${tag}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await signIn(page, 'help')
    await page.goto(url('help', '/hd-ticket'), { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Kestrel Health').first()).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(900)

    const m = await page.evaluate(() => {
      const table = document.querySelector('[data-testid="doctype-table"]')
      // every scrollable ancestor/descendant in the records area
      const scrollers: any[] = []
      document.querySelectorAll('*').forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 1) {
          const cs = getComputedStyle(el)
          scrollers.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute('class') || '').slice(0, 60),
            overflowX: cs.overflowX,
            clientW: el.clientWidth,
            scrollW: el.scrollWidth,
            canScroll: cs.overflowX === 'auto' || cs.overflowX === 'scroll',
          })
        }
      })
      // is the last header fully painted?
      const heads = Array.from(document.querySelectorAll('*')).filter(
        (e) => e.children.length === 0 && /^(SUBJECT|STATUS|PRIORITY|CUSTOMER|SOURCE)$/i.test((e.textContent || '').trim()),
      )
      const vw = document.documentElement.clientWidth
      return {
        layoutIsTable: !!table,
        tableClientW: table?.clientWidth ?? 0,
        docScrollW: document.documentElement.scrollWidth,
        docClientW: vw,
        scrollers: scrollers.slice(0, 10),
        headers: heads.map((e) => {
          const r = e.getBoundingClientRect()
          return { text: (e.textContent || '').trim(), right: Math.round(r.right), cutOff: r.right > vw, ownClip: e.scrollWidth > e.clientWidth + 1 }
        }),
      }
    })

    // try to scroll it sideways by every means a user has
    await page.mouse.move(w / 2, 300)
    await page.mouse.wheel(600, 0)
    await page.waitForTimeout(500)
    const afterWheel = await page.evaluate(() => ({
      docScrollLeft: document.documentElement.scrollLeft,
      maxChildScrollLeft: Math.max(0, ...Array.from(document.querySelectorAll('*')).map((e) => e.scrollLeft)),
    }))

    OUT[tag] = { ...m, afterWheel }
    await page.screenshot({ path: `audit-shots/clip-${tag}.png` })
    console.log(tag, JSON.stringify({ table: m.layoutIsTable, tableW: m.tableClientW, headers: m.headers, scrollers: m.scrollers, afterWheel }))
  })
}

test.afterAll(() => writeFileSync('audit-shots/clip.json', JSON.stringify(OUT, null, 2)))

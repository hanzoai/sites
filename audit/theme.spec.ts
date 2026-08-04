/**
 * `AppHeader` renders a `ThemeToggle` in the account menu unless `theme={null}`.
 * Shell.tsx passes no `theme`, so the control should be there. Is it — and does it
 * do anything, given the app hardcodes `t_dark` on <html> and `background:#000`
 * in globals.css?
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

const snap = (page: Page) =>
  page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    htmlColorScheme: getComputedStyle(document.documentElement).colorScheme,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    // the app shell's own background, one level in
    shellBg: (() => {
      const el = document.querySelector('body > div, body > #__next > div')
      return el ? getComputedStyle(el).backgroundColor : null
    })(),
    localStorageTheme: Object.keys(localStorage)
      .filter((k) => /theme/i.test(k))
      .map((k) => `${k}=${localStorage.getItem(k)}`),
  }))

test('the theme toggle: present? functional?', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'erp')
  await page.goto(url('erp', '/erp-item'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Axial servo drive').first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(800)

  OUT.before = await snap(page)
  await page.screenshot({ path: 'audit-shots/theme-1-before.png' })

  // open the account menu (aria-label="Account")
  await page.locator('[aria-label="Account"]').first().click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'audit-shots/theme-2-account-menu.png' })
  OUT.menuText = await page.evaluate(() => document.body.innerText.slice(0, 500))
  OUT.menuControls = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button,[role="button"],[role="switch"],[role="menuitem"]'))
      .map((e) => {
        const r = e.getBoundingClientRect()
        return { t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28), role: e.getAttribute('role'), w: Math.round(r.width), h: Math.round(r.height) }
      })
      .filter((x) => x.w > 0),
  )
  console.log('MENU TEXT →', JSON.stringify(OUT.menuText))
  console.log('MENU CONTROLS →', JSON.stringify(OUT.menuControls))

  // click the ACTUAL toggle button the header renders
  const light = page.locator('[aria-label="Switch to light theme"]').first()
  OUT.toggleFound = (await light.count()) > 0
  if (OUT.toggleFound) {
    await light.click()
    await page.waitForTimeout(1500)
    OUT.afterToggle = await snap(page)
    OUT.toggleLabelAfter = await page
      .locator('[aria-label^="Switch to"]')
      .first()
      .getAttribute('aria-label')
      .catch(() => null)
    await page.screenshot({ path: 'audit-shots/theme-3-after-toggle.png' })
    console.log('AFTER TOGGLE →', JSON.stringify(OUT.afterToggle), 'label now:', OUT.toggleLabelAfter)
    // click it a second time on a fresh page load, to rule out a menu-close race
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    OUT.afterToggleReload = await snap(page)
    await page.screenshot({ path: 'audit-shots/theme-3b-after-toggle-reload.png' })
    console.log('AFTER TOGGLE + RELOAD →', JSON.stringify(OUT.afterToggleReload))
  }

  // and force the OS preference to light, reload, and see
  await page.emulateMedia({ colorScheme: 'light' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  OUT.afterOsLight = await snap(page)
  await page.screenshot({ path: 'audit-shots/theme-4-os-light.png' })
  console.log('OS LIGHT →', JSON.stringify(OUT.afterOsLight))
})

test.afterAll(() => writeFileSync('audit-shots/theme.json', JSON.stringify(OUT, null, 2)))

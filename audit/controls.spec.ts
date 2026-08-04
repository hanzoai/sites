/**
 * The three things a screenshot alone will not tell you:
 *   1. tap-target size of the OUTERMOST pressables (not every inherited-cursor span)
 *   2. whether the design system's light theme is reachable at all
 *   3. whether keyboard focus is visible
 */
import { test, expect, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { focusAfterTabs } from './probe'

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

/** Only the OUTERMOST element that a finger can press — a child that merely
 *  inherits `cursor:pointer` is not a separate target. */
async function outerTargets(page: Page) {
  return page.evaluate(() => {
    const isTarget = (el: Element) => {
      const cs = getComputedStyle(el)
      return (
        el.tagName === 'BUTTON' ||
        el.tagName === 'A' ||
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.getAttribute('role') === 'button' ||
        el.getAttribute('role') === 'checkbox' ||
        el.getAttribute('role') === 'switch' ||
        cs.cursor === 'pointer'
      )
    }
    const out: any[] = []
    document.querySelectorAll('*').forEach((el) => {
      if (!isTarget(el)) return
      if (el.parentElement && isTarget(el.parentElement)) return // not outermost
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return
      out.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        w: Math.round(r.width),
        h: Math.round(r.height),
        y: Math.round(r.top),
      })
    })
    return out
  })
}

const SCREENS = [
  { site: 'erp', path: '', name: 'collections' },
  { site: 'erp', path: '/erp-item', name: 'records' },
  { site: 'erp', path: '/erp-item/AX-100', name: 'detail' },
  { site: 'crm', path: '/crm-deal', name: 'records' },
  { site: 'crm', path: '/crm-deal/crm-deal-00001', name: 'detail' },
  { site: 'cms', path: '/Page/security', name: 'detail' },
  { site: 'help', path: '/hd-ticket/hd-tkt-00001', name: 'detail' },
]

test('mobile 390: outermost tap targets under 44px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'erp')
  for (const s of SCREENS) {
    await page.goto(url(s.site, s.path), { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2200)
    const t = await outerTargets(page)
    OUT[`${s.site}${s.path || '/'} (${s.name})`] = {
      total: t.length,
      under44: t.filter((x) => x.h < 44 || x.w < 44),
    }
  }
  // and the EDIT FORM, where the small controls live
  await page.goto(url('erp', '/erp-item/AX-100'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Edit', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  await page.getByText('Edit', { exact: true }).first().click()
  await expect(page.getByText('Save', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(900)
  const f = await outerTargets(page)
  OUT['erp edit FORM'] = { total: f.length, under44: f.filter((x) => x.h < 44 || x.w < 44) }
  await page.screenshot({ path: 'audit-shots/probe-mobile-erp-form.png', fullPage: true })
  console.log(JSON.stringify(OUT, null, 2))
})

test('light theme: is it reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, 'erp')
  await page.goto(url('erp', '/erp-item'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Axial servo drive').first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(900)
  const theme = await page.evaluate(() => {
    const bodyBg = getComputedStyle(document.body).backgroundColor
    const htmlCls = document.documentElement.className
    const colorScheme = getComputedStyle(document.documentElement).colorScheme
    // any control that says "theme"/"appearance"/"dark"/"light"
    const toggles: string[] = []
    document.querySelectorAll('button,[role="button"],a').forEach((el) => {
      const t = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).toLowerCase()
      if (/theme|appearance|dark|light|mode/.test(t)) toggles.push(t.trim().slice(0, 40))
    })
    return { bodyBg, htmlCls, colorScheme, toggles, prefersLight: matchMedia('(prefers-color-scheme: light)').matches }
  })
  OUT.lightTheme = theme
  await page.screenshot({ path: 'audit-shots/probe-light-mode-mobile.png' })
  console.log('LIGHT THEME →', JSON.stringify(theme))

  // Open the account menu — a toggle would live there if anywhere.
  await page.getByRole('button', { name: /account/i }).first().click().catch(() => {})
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'audit-shots/probe-account-menu-mobile.png' })
  OUT.accountMenuItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button,[role="button"],[role="menuitem"],a'))
      .map((e) => (e.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 30),
  )
  console.log('ACCOUNT MENU →', JSON.stringify(OUT.accountMenuItems))
})

test('keyboard: is focus visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'erp')
  await page.goto(url('erp', '/erp-item'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Axial servo drive').first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(900)
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur?.())
  const trail = await focusAfterTabs(page, 10)
  OUT.focusTrail = trail
  console.log('FOCUS TRAIL →', JSON.stringify(trail, null, 2))
  // photograph the ring after a few tabs
  await page.screenshot({ path: 'audit-shots/probe-focus-desktop.png' })

  // mobile card list — can a keyboard user reach a record at all?
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url('erp', '/erp-item'), { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Axial servo drive').first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(900)
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur?.())
  OUT.focusTrailMobile = await focusAfterTabs(page, 10)
  await page.screenshot({ path: 'audit-shots/probe-focus-mobile.png' })
  console.log('FOCUS TRAIL MOBILE →', JSON.stringify(OUT.focusTrailMobile, null, 2))
})

test.afterAll(() => writeFileSync('audit-shots/controls.json', JSON.stringify(OUT, null, 2)))

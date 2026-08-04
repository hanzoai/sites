/**
 * Does the shell actually PAINT? Not "is it 200" — what colour is it, did the
 * design tokens resolve, did the gui components mount, and did anything throw.
 *
 * The sibling `shots.spec.ts` proves the SIGNED-IN product against a local cloud
 * and issuer. This one needs no backend at all, which is the point: it guards the
 * failure those cannot see — a token the components name but nobody defines, so
 * borders and surfaces paint transparent while every request still returns 200.
 */
import { test, expect } from '@playwright/test'

const PORT = process.env.PORT ?? '3100'
const BASE = `http://localhost:${PORT}`

test('site chooser renders on the 8.x stack with tokens resolved', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await expect(page.getByText('Hanzo apps')).toBeVisible({ timeout: 15_000 })

  // All four lanes, from the registry — not a hardcoded list in the view.
  for (const label of ['ERP', 'CRM', 'Content', 'Help Center']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
  }

  const probe = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    const de = document.documentElement
    return {
      classes: de.className,
      background: cs.getPropertyValue('--background').trim(),
      border: cs.getPropertyValue('--border').trim(),
      color12: cs.getPropertyValue('--color12').trim(),
      mono: cs.getPropertyValue('--font-geist-mono').trim(),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyFont: getComputedStyle(document.body).fontFamily,
      mark: document.querySelectorAll('svg').length,
      overflows: de.scrollWidth > de.clientWidth + 1,
    }
  })
  console.log('PROBE', JSON.stringify(probe, null, 2))

  // The tokens the components name must be DEFINED, and dark-valued.
  expect(probe.classes).toContain('dark')
  expect(probe.background).not.toBe('')
  expect(probe.border).not.toBe('')
  expect(probe.mono).toContain('Geist Mono')
  // `--border` has no other source than the token sheet — gui's runtime injection
  // supplies the colour SCALE (`--color12`, and `--background` in hsla), the sheet
  // supplies the semantic tokens. Its dark value is what proves both landed.
  expect(probe.border).toContain('oklch')
  // Dark, whichever sheet won the name: 8% lightness, not white.
  expect(probe.bodyBg).toBe('rgb(20, 20, 20)')
  expect(probe.bodyFont).toContain('Geist')
  expect(probe.mark).toBeGreaterThan(0)
  expect(probe.overflows).toBe(false)

  await page.screenshot({ path: 'audit-shots/converge-desktop.png', fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  const narrow = await page.evaluate(() => {
    const de = document.documentElement
    return { overflows: de.scrollWidth > de.clientWidth + 1, w: de.scrollWidth, cw: de.clientWidth }
  })
  console.log('MOBILE', JSON.stringify(narrow))
  expect(narrow.overflows).toBe(false)
  await page.screenshot({ path: 'audit-shots/converge-mobile.png', fullPage: true })

  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([])
})

/**
 * A named host, signed out. No backend is reachable and none is needed: the site
 * is resolved from the hostname alone, so this is the one path that proves the
 * host→site rule end to end in a browser rather than in a unit test.
 */
test('a site host resolves its product and offers the door, not an error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`http://erp.localhost:${PORT}/`, { waitUntil: 'networkidle' })

  // The product name in the header comes from the host, not from a route.
  await expect(page.getByText('ERP', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Sign in to Hanzo ERP')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' }).first()).toBeVisible()

  const de = await page.evaluate(() => ({
    overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }))
  expect(de.overflows).toBe(false)
  await page.screenshot({ path: 'audit-shots/converge-erp-signedout.png', fullPage: true })
  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([])
})

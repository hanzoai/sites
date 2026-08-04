/**
 * Measurement primitives, run inside the page. Adversarial: they look at the
 * real box model, not at HTTP status codes.
 */
import type { Page } from '@playwright/test'

export interface Overflow {
  docScrollWidth: number
  docClientWidth: number
  bodyScrollWidth: number
  overflows: boolean
  offenders: { tag: string; cls: string; text: string; left: number; right: number; w: number }[]
}

/** Anything whose painted box crosses the right edge of the viewport. */
export async function overflow(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const de = document.documentElement
    const vw = de.clientWidth
    const offenders: any[] = []
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue
      if (r.right > vw + 1 || r.left < -1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute('class') || '').slice(0, 90),
          text: (el.textContent || '').trim().slice(0, 60),
          left: Math.round(r.left),
          right: Math.round(r.right),
          w: Math.round(r.width),
        })
      }
    }
    // Keep only the outermost few — a deep offender drags all its ancestors in.
    return {
      docScrollWidth: de.scrollWidth,
      docClientWidth: de.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflows: de.scrollWidth > de.clientWidth + 1,
      offenders: offenders.slice(0, 12),
    }
  })
}

export interface Target {
  tag: string
  role: string | null
  label: string
  w: number
  h: number
  x: number
  y: number
}

/**
 * Every element a finger can hit. Tamagui renders pressables as <div role=button>
 * or bare <div onclick>, so a `button, a` query alone would under-report badly;
 * this also takes anything with a pointer cursor + a press handler.
 */
export async function tapTargets(page: Page): Promise<Target[]> {
  return page.evaluate(() => {
    const sel =
      'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [tabindex]:not([tabindex="-1"])'
    const seen = new Set<Element>()
    const out: any[] = []
    const push = (el: Element) => {
      if (seen.has(el)) return
      seen.add(el)
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return
      // Skip things scrolled far out of view vertically — they are still real
      // targets, so keep them, but note position.
      out.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 44),
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.left),
        y: Math.round(r.top),
      })
    }
    document.querySelectorAll(sel).forEach(push)
    // pointer-cursor divs that are not inside another target
    document.querySelectorAll('div,span').forEach((el) => {
      const cs = getComputedStyle(el)
      if (cs.cursor !== 'pointer') return
      if (el.closest('button,a[href],[role="button"]')) return
      push(el)
    })
    return out
  })
}

/** Text that is visually cut off by its own box. */
export async function clipped(page: Page) {
  return page.evaluate(() => {
    const out: any[] = []
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (el.children.length > 0) continue // leaf text only
      const t = (el.textContent || '').trim()
      if (!t) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      const hidden = cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis'
      if (hidden && el.scrollWidth > el.clientWidth + 1) {
        out.push({ text: t.slice(0, 60), clientW: el.clientWidth, scrollW: el.scrollWidth })
      }
    }
    return out.slice(0, 15)
  })
}

/** What the focus ring actually looks like after N tabs. */
export async function focusAfterTabs(page: Page, n: number) {
  const trail: any[] = []
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    trail.push(
      await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return { el: 'BODY (focus lost)' }
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return {
          el: el.tagName.toLowerCase() + (el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''),
          label: (el.textContent || '').trim().slice(0, 34),
          outlineStyle: cs.outlineStyle,
          outlineWidth: cs.outlineWidth,
          outlineColor: cs.outlineColor,
          boxShadow: cs.boxShadow.slice(0, 60),
          visible: r.width > 0 && r.height > 0,
          h: Math.round(r.height),
        }
      }),
    )
  }
  return trail
}

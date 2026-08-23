import type { ReactNode } from 'react'

// The Hanzo tokens, first: `@hanzo/ui`'s components name `--background`,
// `--border`, `--color2`, `--color12` and the family variables, and this is
// where they are defined. Without it those surfaces paint transparent. It leads
// so this app's own rules below can still win.
import '@hanzo/ui/theme.css'
// Zen, second, because it must outrank the face the sheet above still names.
// This one file is the whole typeface: the @font-face pair and the two role
// tokens that resolve to them, with the woff2 shipped beside it — so nothing is
// fetched from a host we do not control.
import '@hanzo/design/tokens/fonts.css'
import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Hanzo Apps',
  description: 'ERP, CRM, Content and Help Center on the Hanzo Framework.',
}

/**
 * The server render is byte-identical for every host on purpose: the site and
 * brand are resolved in the browser from `window.location`, so one build serves
 * erp/crm/cms/help across every brand with no per-host bundle.
 *
 * Two theme vocabularies, one state: `t_dark` is what gui's runtime reads, `dark`
 * is what the token sheet keys its dark set on. Both are set on the server so the
 * first paint is already dark — NextThemeProvider only reaches the DOM after
 * hydration, and without `dark` up front the tokens resolve light for that frame.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark t_dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

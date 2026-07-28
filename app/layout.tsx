import type { ReactNode } from 'react'

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
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="t_dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

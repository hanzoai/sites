'use client'

/**
 * Providers: the ONE Hanzo scale (`@hanzo/ui/gui-config` — shared with the
 * console so the two products cannot drift), the theme, the field registry, and
 * the session.
 */
import type { ReactNode } from 'react'
import { GuiProvider } from '@hanzo/gui'
import { NextThemeProvider, useRootTheme } from '@hanzogui/next-theme'
import { registerDefaultFields } from '@hanzo/data'
import { HostProvider } from '@hanzo/ui/product'
import guiConfig from '@hanzo/ui/gui-config'

import { SessionProvider, iam } from '../src/session'

// @hanzo/data fills its field-INPUT registry by an import SIDE EFFECT, but ships
// `"sideEffects": false` — so a production build tree-shakes the registration away
// and every form renders labels with no inputs. An explicit CALL is a used binding
// the bundler cannot drop. (Same fix, same reason, as the console.)
registerDefaultFields()

function Themed({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useRootTheme({ fallback: 'dark' })
  return (
    <NextThemeProvider defaultTheme="dark" onChangeTheme={(n: string) => setTheme(n === 'light' ? 'light' : 'dark')}>
      <GuiProvider config={guiConfig} defaultTheme={theme || 'dark'}>
        {children}
      </GuiProvider>
    </NextThemeProvider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Themed>
      {/* @hanzo/ui/product never imports auth or a router; its honest-state cards
          get this app's one re-auth effect from here. */}
      <HostProvider actions={{ signIn: () => void iam().signinRedirect() }}>
        <SessionProvider>{children}</SessionProvider>
      </HostProvider>
    </Themed>
  )
}

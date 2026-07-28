'use client'

/**
 * The session. There is ONE credential path here and it is the console's: the
 * `@hanzo/iam` browser SDK driving a PKCE authorize redirect against the brand's
 * IAM (hanzo.id / lux.id / …). No password form, no confidential client, no
 * second cookie — IAM owns every credential step and hands back an access token
 * the SDK keeps in `sessionStorage`.
 *
 * That token is the ONLY thing this app presents to the API. cloud's identity
 * middleware validates it (signature + issuer + expiry) and derives the org from
 * the token's own membership claim, so tenancy is decided server-side and this
 * app never sees, sends, or chooses an org.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { IAM, type IAMConfig } from '@hanzo/iam/browser'

import { currentConfig } from './config'

export const CALLBACK_PATH = '/auth/callback'
/** Where the user was when the session lapsed, so re-auth returns them there. */
const RETURN_KEY = 'hanzo.sites.returnTo'

/** SSR has no sessionStorage; the SDK constructor touches it, so hand it a stub. */
function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  } as Storage
}

export function iamConfig(): IAMConfig {
  const c = currentConfig()
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return {
    serverUrl: c.iamUrl,
    clientId: c.iamClientId,
    appName: c.iamClientId,
    organization: c.iamOrg,
    redirectUri: `${origin}${CALLBACK_PATH}`,
    storage: typeof window === 'undefined' ? memoryStorage() : window.sessionStorage,
  }
}

let singleton: IAM | null = null
export function iam(): IAM {
  if (!singleton) singleton = new IAM(iamConfig())
  return singleton
}

/** The bearer, read synchronously — the framework transport calls this per request. */
export function accessToken(): string | null {
  try {
    return iam().getAccessToken()
  } catch {
    return null
  }
}

export interface SessionUser {
  id: string
  name: string
  email?: string
}

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

interface SessionValue {
  status: SessionStatus
  user: SessionUser | null
  signIn: () => void
  signOut: () => void
}

const Ctx = createContext<SessionValue>({ status: 'loading', user: null, signIn: () => {}, signOut: () => {} })

export const useSession = (): SessionValue => useContext(Ctx)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)

  const signIn = useCallback(() => {
    try {
      sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search)
    } catch {
      /* a blocked storage must not block signing in */
    }
    void iam().signinRedirect()
  }, [])

  const signOut = useCallback(() => {
    try {
      iam().clearTokens()
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!accessToken()) {
        if (!cancelled) setStatus('anonymous')
        return
      }
      try {
        const u = (await iam().getUserInfo()) as Record<string, unknown> | null
        if (cancelled) return
        if (!u) {
          setStatus('anonymous')
          return
        }
        setUser({
          id: String(u.sub ?? u.id ?? u.name ?? ''),
          name: String(u.name ?? u.preferred_username ?? u.email ?? 'Signed in'),
          email: typeof u.email === 'string' ? u.email : undefined,
        })
        setStatus('authenticated')
      } catch {
        // A token the IdP no longer honours is not a session. Say anonymous and
        // offer sign-in; never render a half-authenticated shell.
        if (!cancelled) setStatus('anonymous')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Consume the stashed pre-sign-in location (once). */
export function takeReturnTo(): string {
  try {
    const v = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return v && v.startsWith('/') && !v.startsWith('//') ? v : '/'
  } catch {
    return '/'
  }
}

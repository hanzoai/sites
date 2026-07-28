/**
 * This app's binding to the DocType engine.
 *
 * THE HOST OWNS TRANSPORT — `@hanzo/ui/framework` builds paths relative to the
 * framework root and never picks an origin or a credential, which is exactly the
 * seam the four sites need: they call this host's brand API directly with the IAM
 * bearer, where the console maps the same paths onto its own proxy. So the client
 * is shared and only this file is ours.
 *
 * That is the entire data layer. There is no per-collection code here, because
 * there is no per-collection code anywhere.
 */
import { createFrameworkClient, type FrameworkClient, type FrameworkTransport } from '@hanzo/ui/framework'

import { currentConfig } from './config'
import { accessToken } from './session'

/** An HTTP failure carrying the status, so an honest-state card can tell 401 from 403. */
export class FrameworkHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'FrameworkHttpError'
  }
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/**
 * The bearer transport: the caller's IAM access token on the Authorization
 * header, straight to the brand's API origin. No cookie, no BFF, no second
 * credential path — the engine resolves the org from the token's own claim.
 */
export function bearerTransport(baseUrl: string, token: () => string | null): FrameworkTransport {
  const base = baseUrl.replace(/\/+$/, '')

  async function req(method: string, path: string, body?: unknown): Promise<unknown> {
    const tok = token()
    const res = await fetch(`${base}/${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? null : { 'Content-Type': 'application/json' }),
        ...(tok ? { Authorization: `Bearer ${tok}` } : null),
      },
      ...(body === undefined ? null : { body: JSON.stringify(body) }),
    })
    const text = await res.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    if (!res.ok) {
      const o = asRecord(payload)
      const said = [o.error, o.msg, o.message].find((v) => typeof v === 'string' && v.trim() !== '')
      throw new FrameworkHttpError(res.status, typeof said === 'string' ? said : `HTTP ${res.status}`)
    }
    return payload
  }

  return {
    get: (p) => req('GET', p),
    post: (p, b) => req('POST', p, b),
    put: (p, b) => req('PUT', p, b),
    del: (p) => req('DELETE', p).then(() => undefined),
  }
}

let client: FrameworkClient | null = null

export function frameworkClient(): FrameworkClient {
  if (!client) client = createFrameworkClient(bearerTransport(currentConfig().frameworkUrl, accessToken))
  return client
}

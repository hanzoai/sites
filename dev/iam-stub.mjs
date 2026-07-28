/**
 * A local IAM issuer, for local proof only.
 *
 * The app has exactly ONE credential path — the `@hanzo/iam` browser SDK's PKCE
 * authorize flow — and that path must be the one under test. So instead of
 * bolting a "dev token" side door onto the app, this serves the four endpoints
 * the SDK actually calls, at the paths it actually calls them on:
 *
 *   GET  /v1/iam/oauth/authorize     → 302 back to redirect_uri with code+state
 *   POST /v1/iam/oauth/token         → a real RS256 JWT
 *   GET  /v1/iam/oauth/userinfo      → the signed-in user
 *   GET  /v1/iam/.well-known/jwks    → the public key cloud validates against
 *
 * The token is signed with a freshly generated RSA key and carries the claims
 * cloud's identity middleware reads: `iss` (must match CLOUD_IAM_ISSUER), `sub`,
 * `exp`, and the `orgs` membership set whose FIRST entry is the home org — which
 * is how the engine decides tenancy. Nothing here is a stub inside the app; the
 * app cannot tell this apart from hanzo.id.
 *
 * NEVER deploy this. It signs a token for whoever asks.
 */
import { createServer } from 'node:http'
import { createSign, generateKeyPairSync } from 'node:crypto'

const PORT = Number(process.env.IAM_PORT || 9099)
const ISSUER = process.env.IAM_ISSUER || `http://127.0.0.1:${PORT}`
const USER = process.env.DEV_USER || 'z'
const ORG = process.env.DEV_ORG || 'hanzo'
const KID = 'dev-local'

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const part = (obj) => b64u(JSON.stringify(obj))

/** RS256, by hand — no dependency, so the harness cannot break on an install. */
function signJwt(header, payload) {
  const data = `${part(header)}.${part(payload)}`
  const sig = createSign('RSA-SHA256').update(data).end().sign(privateKey)
  return `${data}.${b64u(sig)}`
}

const json = (res, code, body) => {
  const s = JSON.stringify(body)
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' })
  res.end(s)
}

function mint() {
  const now = Math.floor(Date.now() / 1000)
  return signJwt(
    { alg: 'RS256', kid: KID, typ: 'JWT' },
    {
      iss: ISSUER,
      sub: USER,
      aud: 'hanzo-app',
      iat: now,
      exp: now + 12 * 3600,
      name: USER,
      preferred_username: USER,
      email: `${USER}@${ORG}.ai`,
      owner: ORG,
      // The membership SET, home first — cloud reads orgs[0] as the home org and
      // deliberately does NOT trust `owner` for a human token.
      orgs: [{ org: ORG, role: 'admin' }],
      isAdmin: false,
    },
  )
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'OPTIONS') return json(res, 204, {})

  if (url.pathname === '/v1/iam/.well-known/jwks' || url.pathname === '/.well-known/jwks.json') {
    return json(res, 200, { keys: [jwk] })
  }

  if (url.pathname === '/v1/iam/oauth/authorize') {
    // A real IAM would authenticate the human here. Locally there is exactly one.
    const redirect = url.searchParams.get('redirect_uri')
    const state = url.searchParams.get('state') ?? ''
    if (!redirect) return json(res, 400, { error: 'redirect_uri required' })
    const back = new URL(redirect)
    back.searchParams.set('code', 'dev-code')
    back.searchParams.set('state', state)
    res.writeHead(302, { location: back.toString() })
    return res.end()
  }

  if (url.pathname === '/v1/iam/oauth/token') {
    const token = mint()
    return json(res, 200, { access_token: token, id_token: token, token_type: 'Bearer', expires_in: 43200, scope: 'openid profile email' })
  }

  if (url.pathname === '/v1/iam/oauth/userinfo') {
    return json(res, 200, { sub: USER, name: USER, preferred_username: USER, email: `${USER}@${ORG}.ai`, owner: ORG })
  }

  // Discovery is optional — the SDK synthesizes the endpoints above when it 404s.
  return json(res, 404, { error: 'not found', path: url.pathname })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[iam-stub] issuer ${ISSUER} · user ${USER} · org ${ORG}`)
})

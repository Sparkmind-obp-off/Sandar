// Server-side Clerk session verification (RS256 JWT) using Web Crypto only.
// Tokens are sent as `Authorization: Bearer <session JWT>` (no cookie auth on
// the API → no ambient-credential CSRF surface). The user and workspace are
// always derived from the verified `sub` claim, never from the request body.
import type { MiddlewareHandler } from 'hono'
import type { AppEnv, AuthUser, Bindings } from '../types'
import { ApiError, newId, nowIso } from './util'

type Jwk = JsonWebKey & { kid?: string }
const jwksCache = new Map<string, { keys: Jwk[]; at: number }>()
const keyCache = new Map<string, CryptoKey>()

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)))

/** Derive the Frontend API issuer from a Clerk publishable key (pk_live_<b64(host$)>). */
export function issuerFromPublishableKey(pk?: string): string | null {
  if (!pk) return null
  const m = pk.match(/^pk_(live|test)_(.+)$/)
  if (!m) return null
  try {
    const host = atob(m[2]).replace(/\$$/, '')
    return host ? `https://${host}` : null
  } catch {
    return null
  }
}

async function importPem(pem: string): Promise<CryptoKey> {
  const cached = keyCache.get(pem)
  if (cached) return cached
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('spki', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  keyCache.set(pem, key)
  return key
}

async function jwksKey(issuer: string, kid: string): Promise<CryptoKey | null> {
  const cacheKey = `${issuer}#${kid}`
  const hit = keyCache.get(cacheKey)
  if (hit) return hit
  let entry = jwksCache.get(issuer)
  if (!entry || Date.now() - entry.at > 10 * 60 * 1000 || !entry.keys.some((k) => k.kid === kid)) {
    const res = await fetch(`${issuer}/.well-known/jwks.json`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new ApiError(503, 'UPSTREAM_UNAVAILABLE', 'Layanan masuk sedang tidak tersedia.')
    const data = (await res.json()) as { keys: Jwk[] }
    entry = { keys: data.keys || [], at: Date.now() }
    jwksCache.set(issuer, entry)
  }
  const jwk = entry.keys.find((k) => k.kid === kid)
  if (!jwk) return null
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  keyCache.set(cacheKey, key)
  return key
}

export type VerifiedClaims = { sub: string; iss: string; exp: number; azp?: string; sid?: string }

export async function verifySessionToken(token: string, env: Bindings): Promise<VerifiedClaims> {
  const unauth = (why: string) => new ApiError(401, 'UNAUTHENTICATED', 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.', { reason: why })
  const parts = token.split('.')
  if (parts.length !== 3) throw unauth('malformed')
  let header: { alg?: string; kid?: string }
  let payload: Record<string, unknown>
  try {
    header = b64urlJson(parts[0])
    payload = b64urlJson(parts[1])
  } catch {
    throw unauth('malformed')
  }
  if (header.alg !== 'RS256') throw unauth('alg')
  const issuer = env.CLERK_ISSUER || issuerFromPublishableKey(env.CLERK_PUBLISHABLE_KEY)
  if (!issuer) throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Autentikasi belum dikonfigurasi.')

  let key: CryptoKey | null = null
  if (env.CLERK_JWT_KEY) key = await importPem(env.CLERK_JWT_KEY)
  else if (header.kid) key = await jwksKey(issuer, header.kid)
  if (!key) throw unauth('key')

  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
  if (!ok) throw unauth('signature')

  const now = Math.floor(Date.now() / 1000)
  const skew = 10
  if (payload.iss !== issuer) throw unauth('issuer')
  if (typeof payload.exp !== 'number' || payload.exp + skew < now) throw unauth('expired')
  if (typeof payload.nbf === 'number' && payload.nbf - skew > now) throw unauth('nbf')
  if (typeof payload.sub !== 'string' || !payload.sub) throw unauth('sub')
  const parties = (env.AUTHORIZED_PARTIES || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (parties.length && payload.azp !== undefined && !parties.includes(String(payload.azp))) throw unauth('azp')
  return { sub: payload.sub, iss: String(payload.iss), exp: payload.exp, azp: payload.azp as string | undefined, sid: payload.sid as string | undefined }
}

/** Find-or-create the internal user + single workspace for a verified subject. */
export async function resolveUser(db: D1Database, sub: string, env: Bindings): Promise<AuthUser> {
  let row = await db
    .prepare('SELECT u.id, u.plan_id, u.account_state, w.id AS workspace_id FROM users u LEFT JOIN workspaces w ON w.owner_user_id = u.id WHERE u.auth_subject = ?')
    .bind(sub)
    .first<{ id: string; plan_id: string; account_state: string; workspace_id: string | null }>()
  if (!row) {
    const uid = newId('usr')
    const wid = newId('ws')
    const t = nowIso()
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO users (id, auth_subject, plan_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(uid, sub, 'free', t, t),
      db.prepare('INSERT OR IGNORE INTO workspaces (id, owner_user_id, title, created_at, updated_at) SELECT ?, id, ?, ?, ? FROM users WHERE auth_subject = ?').bind(wid, 'Ruang Saya', t, t, sub),
    ])
    row = await db
      .prepare('SELECT u.id, u.plan_id, u.account_state, w.id AS workspace_id FROM users u LEFT JOIN workspaces w ON w.owner_user_id = u.id WHERE u.auth_subject = ?')
      .bind(sub)
      .first()
  }
  if (!row) throw new ApiError(500, 'SAVE_FAILED', 'Gagal menyiapkan ruang pribadi.')
  if (!row.workspace_id) {
    const wid = newId('ws')
    const t = nowIso()
    await db.prepare('INSERT OR IGNORE INTO workspaces (id, owner_user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(wid, row.id, 'Ruang Saya', t, t).run()
    const w = await db.prepare('SELECT id FROM workspaces WHERE owner_user_id = ?').bind(row.id).first<{ id: string }>()
    row.workspace_id = w!.id
  }
  if (row.account_state !== 'active') throw new ApiError(403, 'FORBIDDEN', 'Akun tidak aktif.')
  const admins = (env.ADMIN_SUBJECTS || '').split(',').map((s) => s.trim()).filter(Boolean)
  return { id: row.id, sub, workspaceId: row.workspace_id, planId: row.plan_id, isAdmin: admins.includes(sub) }
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const h = c.req.header('authorization') || ''
  let sub: string | null = null
  if (h.toLowerCase().startsWith('bearer ')) {
    const claims = await verifySessionToken(h.slice(7).trim(), c.env)
    sub = claims.sub
  } else if (c.env.ENVIRONMENT === 'development' && c.req.header('x-dev-user')) {
    // Local development stub ONLY. Never active in production/test configs.
    sub = `dev_${c.req.header('x-dev-user')!.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)}`
  }
  if (!sub) throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk untuk mengakses Ruang Saya.')
  c.set('user', await resolveUser(c.env.DB, sub, c.env))
  await next()
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')?.isAdmin) throw new ApiError(403, 'FORBIDDEN', 'Hanya kurator yang berwenang.')
  await next()
}

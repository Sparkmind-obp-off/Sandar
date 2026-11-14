// Test harness: a minimal D1Database shim over node:sqlite (in-memory) plus
// RS256 JWT minting with a locally generated key pair. Synthetic data only.
import { createRequire } from 'node:module'
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type DatabaseSync = InstanceType<typeof DatabaseSync>
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { generateKeyPairSync, createSign } from 'node:crypto'
import app from '../src/index'
import type { Bindings } from '../src/types'

class Stmt {
  constructor(private db: DatabaseSync, private sql: string, private params: unknown[] = []) {}
  bind(...p: unknown[]) {
    for (const v of p) if (v === undefined) throw new Error('D1_TYPE_ERROR: undefined bind value')
    return new Stmt(this.db, this.sql, p)
  }
  private s() {
    return this.db.prepare(this.sql)
  }
  async first<T = any>(col?: string): Promise<T | null> {
    const row = this.s().get(...(this.params as any[])) as any
    if (!row) return null
    return (col ? row[col] : { ...row }) as T
  }
  async all<T = any>() {
    const rows = this.s().all(...(this.params as any[])) as any[]
    return { results: rows.map((r) => ({ ...r })) as T[], success: true, meta: {} }
  }
  async run() {
    if (/\bRETURNING\b/i.test(this.sql)) {
      const rows = this.s().all(...(this.params as any[]))
      return { results: rows, success: true, meta: { changes: rows.length, last_row_id: 0 } }
    }
    const r = this.s().run(...(this.params as any[]))
    return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
  }
  _exec() {
    return this.run()
  }
}

export function makeDb(): D1Database {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON;')
  const dir = join(__dirname, '..', 'migrations')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(join(dir, f), 'utf8'))
  db.exec(readFileSync(join(__dirname, '..', 'seed', 'catalogue.sql'), 'utf8'))
  return {
    prepare: (sql: string) => new Stmt(db, sql) as any,
    batch: async (stmts: Stmt[]) => {
      db.exec('BEGIN')
      try {
        const out = []
        for (const s of stmts) out.push(await s._exec())
        db.exec('COMMIT')
        return out
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
    exec: async (sql: string) => {
      db.exec(sql)
      return { count: 0, duration: 0 }
    },
    dump: async () => new ArrayBuffer(0),
    withSession: undefined as any,
  } as unknown as D1Database
}

export const ISSUER = 'https://clerk.test.example'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
export const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString()
const other = generateKeyPairSync('rsa', { modulusLength: 2048 })

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
export function mintToken(sub: string, opts: { expOffset?: number; iss?: string; wrongKey?: boolean; azp?: string } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test' }))
  const payload = b64u(JSON.stringify({ sub, iss: opts.iss ?? ISSUER, iat: now, nbf: now - 5, exp: now + (opts.expOffset ?? 300), azp: opts.azp ?? 'https://sandar.test' }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const sig = b64u(signer.sign(opts.wrongKey ? other.privateKey : privateKey))
  return `${header}.${payload}.${sig}`
}

export function makeEnv(over: Partial<Bindings> = {}): Bindings {
  return {
    DB: makeDb(),
    ENVIRONMENT: 'test',
    CLERK_ISSUER: ISSUER,
    CLERK_JWT_KEY: PUBLIC_PEM,
    AUTHORIZED_PARTIES: 'https://sandar.test',
    ADMIN_SUBJECTS: 'user_admin',
    BILLING_ENABLED: 'false',
    PAYMENT_PROVIDER: 'none',
    ...over,
  }
}

export async function call(env: Bindings, method: string, path: string, opts: { user?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers || {}) }
  if (opts.user) headers.authorization = `Bearer ${mintToken(opts.user)}`
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const res = await app.request(`https://sandar.test${path}`, { method, headers, body: opts.body !== undefined ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined }, env)
  let json: any = null
  const text = await res.text()
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json, headers: res.headers }
}

export async function consentAll(env: Bindings, user: string, purposes = ['workspace_storage']) {
  for (const p of purposes) await call(env, 'POST', '/api/v1/me/consents', { user, body: { purpose_code: p } })
}

// Rate limiting (D1 fixed window), minimal audit events, consent checks.
import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { ApiError, newId, nowIso, sha } from './util'

export async function rateLimit(db: D1Database, bucket: string, limit: number, windowSec: number) {
  const win = Math.floor(Date.now() / 1000 / windowSec) * windowSec
  const row = await db
    .prepare('INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1) ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1 RETURNING count')
    .bind(bucket, win)
    .first<{ count: number }>()
  if ((row?.count ?? 0) > limit) throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi sebentar lagi.')
  // opportunistic cleanup of old windows
  if (Math.random() < 0.02) await db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(win - 86400).run()
}

export async function clientKey(c: Context<AppEnv>): Promise<string> {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'local'
  return (await sha('SHA-256', `sandar:${ip}`)).slice(0, 24) // never store raw IPs
}

/** Audit events carry identifiers and outcome only — never form contents. */
export async function audit(c: Context<AppEnv>, eventType: string, outcome: string, targetType?: string, targetId?: string) {
  try {
    await c.env.DB.prepare('INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, outcome, correlation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), c.get('user')?.id ?? null, eventType, targetType ?? null, targetId ?? null, outcome, c.get('correlationId') ?? null, nowIso())
      .run()
  } catch {
    /* audit must never break the user flow */
  }
}

export const CONSENT_PURPOSES = ['workspace_storage', 'ai_processing', 'external_search'] as const
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]
export const NOTICE_VERSION = '2026-11-14.v1'

export async function hasConsent(db: D1Database, userId: string, purpose: ConsentPurpose): Promise<boolean> {
  const r = await db
    .prepare('SELECT 1 AS ok FROM consent_records WHERE user_id = ? AND purpose_code = ? AND revoked_at IS NULL LIMIT 1')
    .bind(userId, purpose)
    .first()
  return !!r
}

export async function requireConsent(db: D1Database, userId: string, purpose: ConsentPurpose) {
  if (!(await hasConsent(db, userId, purpose)))
    throw new ApiError(403, 'CONSENT_REQUIRED', 'Persetujuan untuk tujuan ini belum diberikan.', { purpose })
}

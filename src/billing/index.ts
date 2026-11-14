// Provider-neutral billing domain (docs/33, docs/34).
// - BILLING_ENABLED defaults to OFF; checkout is refused unless explicitly 'true'.
// - Checkout is created server-side only; browser redirects never prove payment.
// - Webhooks: signature verified, idempotent (webhook_events PK), replay-safe,
//   strict state transitions, audit trail. No card data is ever stored.
import type { Bindings } from '../types'
import { ApiError, hmacSha256Hex, newId, nowIso, sha, timingSafeEqual } from '../lib/util'
import { getPlan, type PlanId } from '../domain/entitlements'

export type CheckoutSession = { payment_id: string; provider: string; provider_ref: string; redirect_url: string | null; amount_minor: number; currency_code: string }
export type NormalizedEvent = { event_id: string; provider_ref: string; status: 'paid' | 'failed' | 'expired' | 'refunded' | 'pending'; amount_minor: number }

export interface PaymentGateway {
  readonly name: string
  createCheckout(input: { payment_id: string; amount_minor: number; currency_code: string; plan_id: PlanId }): Promise<{ provider_ref: string; redirect_url: string | null }>
  verifyWebhook(req: { headers: Headers; rawBody: string }): Promise<NormalizedEvent>
}

/** Deterministic mock gateway for tests/sandbox. Never contacts a real processor. */
export class MockGateway implements PaymentGateway {
  readonly name = 'mock'
  constructor(private secret: string) {}
  async createCheckout(i: { payment_id: string }) {
    return { provider_ref: `mock_${i.payment_id}`, redirect_url: null }
  }
  async verifyWebhook({ headers, rawBody }: { headers: Headers; rawBody: string }): Promise<NormalizedEvent> {
    const sig = headers.get('x-mock-signature') || ''
    const expected = await hmacSha256Hex(this.secret, rawBody)
    if (!sig || !timingSafeEqual(sig, expected)) throw new ApiError(401, 'INVALID_SIGNATURE', 'Tanda tangan webhook tidak valid.')
    const j = JSON.parse(rawBody)
    return { event_id: String(j.event_id), provider_ref: String(j.provider_ref), status: j.status, amount_minor: Number(j.amount_minor) }
  }
}

/**
 * Midtrans notification verification (signature_key = SHA512(order_id+status_code+gross_amount+ServerKey)).
 * Checkout creation intentionally NOT implemented until owner approves onboarding.
 */
export class MidtransGateway implements PaymentGateway {
  readonly name = 'midtrans'
  constructor(private serverKey: string) {}
  async createCheckout(): Promise<{ provider_ref: string; redirect_url: string | null }> {
    throw new ApiError(503, 'BILLING_NOT_READY', 'Integrasi Midtrans belum diaktifkan oleh pemilik.')
  }
  async verifyWebhook({ rawBody }: { headers: Headers; rawBody: string }): Promise<NormalizedEvent> {
    const j = JSON.parse(rawBody)
    const expected = await sha('SHA-512', `${j.order_id}${j.status_code}${j.gross_amount}${this.serverKey}`)
    if (!j.signature_key || !timingSafeEqual(String(j.signature_key), expected)) throw new ApiError(401, 'INVALID_SIGNATURE', 'Tanda tangan webhook tidak valid.')
    const map: Record<string, NormalizedEvent['status']> = { settlement: 'paid', capture: 'paid', deny: 'failed', cancel: 'failed', expire: 'expired', refund: 'refunded', pending: 'pending' }
    return { event_id: `${j.transaction_id}:${j.transaction_status}`, provider_ref: String(j.order_id), status: map[j.transaction_status] || 'pending', amount_minor: Math.round(Number(j.gross_amount)) }
  }
}

export function gatewayFor(env: Bindings): PaymentGateway | null {
  const p = (env.PAYMENT_PROVIDER || 'none').toLowerCase()
  if (p === 'mock' && env.MOCK_PAYMENT_SECRET && env.ENVIRONMENT !== 'production') return new MockGateway(env.MOCK_PAYMENT_SECRET)
  if (p === 'midtrans' && env.MIDTRANS_SERVER_KEY) return new MidtransGateway(env.MIDTRANS_SERVER_KEY)
  return null
}

export const billingEnabled = (env: Bindings) => env.BILLING_ENABLED === 'true'

export async function createCheckout(env: Bindings, userId: string, planId: PlanId): Promise<CheckoutSession> {
  if (!billingEnabled(env)) throw new ApiError(503, 'BILLING_DISABLED', 'Pembayaran belum dibuka. Semua akun saat ini memakai paket Gratis.')
  const plan = getPlan(planId)
  if (!plan.purchasable || plan.price_minor === null || plan.id !== planId) throw new ApiError(400, 'VALIDATION_ERROR', 'Paket tidak dapat dibeli.')
  const gw = gatewayFor(env)
  if (!gw) throw new ApiError(503, 'BILLING_NOT_READY', 'Penyedia pembayaran belum dikonfigurasi.')
  const id = newId('pay')
  const t = nowIso()
  await env.DB.prepare('INSERT INTO payments (id, user_id, plan_id, provider, amount_minor, currency_code, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, plan.id, gw.name, plan.price_minor, 'IDR', 'created', t, t)
    .run()
  const r = await gw.createCheckout({ payment_id: id, amount_minor: plan.price_minor, currency_code: 'IDR', plan_id: plan.id })
  await env.DB.prepare("UPDATE payments SET provider_ref = ?, status = 'pending', updated_at = ? WHERE id = ?").bind(r.provider_ref, nowIso(), id).run()
  return { payment_id: id, provider: gw.name, provider_ref: r.provider_ref, redirect_url: r.redirect_url, amount_minor: plan.price_minor, currency_code: 'IDR' }
}

const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  created: ['pending', 'paid', 'failed', 'expired'],
  pending: ['paid', 'failed', 'expired'],
  paid: ['refunded'],
  failed: [],
  expired: [],
  refunded: [],
}

export async function handleWebhook(env: Bindings, gw: PaymentGateway, headers: Headers, rawBody: string): Promise<{ outcome: string }> {
  const ev = await gw.verifyWebhook({ headers, rawBody })
  const db = env.DB
  // Idempotency / replay protection: the first insert wins.
  const ins = await db.prepare('INSERT OR IGNORE INTO webhook_events (provider, event_id, received_at, outcome) VALUES (?, ?, ?, ?)').bind(gw.name, ev.event_id, nowIso(), 'processing').run()
  if (!ins.meta.changes) return { outcome: 'duplicate_ignored' }
  const pay = await db.prepare('SELECT * FROM payments WHERE provider = ? AND provider_ref = ?').bind(gw.name, ev.provider_ref).first<any>()
  let outcome = 'unknown_payment'
  if (pay) {
    if (ev.amount_minor !== pay.amount_minor) outcome = 'amount_mismatch'
    else if (ev.status === pay.status) outcome = 'no_change'
    else if (!PAYMENT_TRANSITIONS[pay.status]?.includes(ev.status)) outcome = 'invalid_transition'
    else {
      const t = nowIso()
      const stmts = [db.prepare('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?').bind(ev.status, t, pay.id)]
      if (ev.status === 'paid') {
        const plan = getPlan(pay.plan_id)
        const end = new Date()
        if (plan.billing_period === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1)
        else end.setUTCMonth(end.getUTCMonth() + 1)
        stmts.push(
          db.prepare('INSERT INTO subscriptions (id, user_id, plan_id, status, provider, current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(newId('sub'), pay.user_id, plan.id, 'active', gw.name, end.toISOString(), t, t),
          db.prepare('UPDATE users SET plan_id = ?, updated_at = ? WHERE id = ?').bind(plan.id, t, pay.user_id),
        )
      }
      if (ev.status === 'refunded') stmts.push(db.prepare("UPDATE users SET plan_id = 'free', updated_at = ? WHERE id = ?").bind(t, pay.user_id))
      await db.batch(stmts)
      outcome = `applied:${ev.status}`
    }
  }
  await db.prepare('UPDATE webhook_events SET outcome = ? WHERE provider = ? AND event_id = ?').bind(outcome, gw.name, ev.event_id).run()
  await db.prepare('INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, outcome, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), pay?.user_id ?? null, 'billing.webhook', 'payment', pay?.id ?? null, outcome, nowIso()).run()
  return { outcome }
}

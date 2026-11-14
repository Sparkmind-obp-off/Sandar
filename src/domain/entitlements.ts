// Centralized plan / entitlement / pricing configuration (docs/34).
// Prices are HYPOTHESES for validation, not validated market prices.
// Every new account is Free. Billing is OFF unless BILLING_ENABLED === 'true'.
export type PlanId = 'free' | 'plus_monthly' | 'plus_annual' | 'organization'

export type Plan = {
  id: PlanId
  name: string
  price_minor: number | null // IDR has no minor unit in practice; we store rupiah as minor units
  currency_code: 'IDR'
  billing_period: 'month' | 'year' | 'custom' | 'none'
  purchasable: boolean
  hypothesis: true
  description: string
  quotas: {
    agent_runs_per_month: number
    ai_assist_per_month: number
    external_search_per_month: number
    active_plans: number
    goals: number
    cash_flow_items: number
    history_days: number
  }
  features: string[]
}

export const PRICING_VERSION = '2026-11-14.hypothesis-1'

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Gratis',
    price_minor: 0,
    currency_code: 'IDR',
    billing_period: 'none',
    purchasable: false,
    hypothesis: true,
    description: 'Navigasi inti, katalog sumber publik, rencana dasar, dan bantuan AI terbatas. Tetap berguna tanpa AI.',
    quotas: { agent_runs_per_month: 30, ai_assist_per_month: 10, external_search_per_month: 5, active_plans: 3, goals: 10, cash_flow_items: 60, history_days: 90 },
    features: ['Katalog sumber publik (tanpa login)', 'Arus uang & skenario deterministik', 'Rencana & langkah', 'Ekspor & hapus data'],
  },
  plus_monthly: {
    id: 'plus_monthly',
    name: 'Plus Bulanan',
    price_minor: 29000,
    currency_code: 'IDR',
    billing_period: 'month',
    purchasable: true,
    hypothesis: true,
    description: 'Kapasitas AI dan tugas lebih tinggi (fair-use), lebih banyak rencana aktif, riwayat lebih panjang.',
    quotas: { agent_runs_per_month: 300, ai_assist_per_month: 150, external_search_per_month: 60, active_plans: 20, goals: 100, cash_flow_items: 500, history_days: 730 },
    features: ['Semua fitur Gratis', 'Analisis rencana lebih dalam', 'Tinjauan kemajuan yang ditingkatkan'],
  },
  plus_annual: {
    id: 'plus_annual',
    name: 'Plus Tahunan',
    price_minor: 290000,
    currency_code: 'IDR',
    billing_period: 'year',
    purchasable: true,
    hypothesis: true,
    description: 'Setara Plus Bulanan; hemat Rp58.000 dibanding 12 kali pembayaran bulanan (setara 2 bulan gratis).',
    quotas: { agent_runs_per_month: 300, ai_assist_per_month: 150, external_search_per_month: 60, active_plans: 20, goals: 100, cash_flow_items: 500, history_days: 730 },
    features: ['Semua fitur Plus Bulanan', 'Dibayar per tahun'],
  },
  organization: {
    id: 'organization',
    name: 'Organisasi',
    price_minor: null,
    currency_code: 'IDR',
    billing_period: 'custom',
    purchasable: false,
    hypothesis: true,
    description: 'Multi-seat, administrasi berbasis peran, laporan agregat yang menjaga privasi. Harga berdasarkan penawaran — belum tersedia.',
    quotas: { agent_runs_per_month: 0, ai_assist_per_month: 0, external_search_per_month: 0, active_plans: 0, goals: 0, cash_flow_items: 0, history_days: 0 },
    features: ['Hubungi kami (belum aktif)'],
  },
}

export type Metric = 'agent_runs' | 'ai_assist' | 'external_search'
const quotaKey: Record<Metric, keyof Plan['quotas']> = {
  agent_runs: 'agent_runs_per_month',
  ai_assist: 'ai_assist_per_month',
  external_search: 'external_search_per_month',
}

export const getPlan = (id: string): Plan => PLANS[(id as PlanId) in PLANS ? (id as PlanId) : 'free']
export const currentPeriod = () => new Date().toISOString().slice(0, 7) // YYYY-MM

export async function usageFor(db: D1Database, userId: string) {
  const rows = await db.prepare('SELECT metric, count FROM usage_counters WHERE user_id = ? AND period = ?').bind(userId, currentPeriod()).all<{ metric: string; count: number }>()
  const used: Record<Metric, number> = { agent_runs: 0, ai_assist: 0, external_search: 0 }
  for (const r of rows.results || []) if (r.metric in used) used[r.metric as Metric] = r.count
  return used
}

/** Atomically consume one unit; returns false (without consuming) if quota exhausted. */
export async function consume(db: D1Database, userId: string, planId: string, metric: Metric): Promise<boolean> {
  const limit = getPlan(planId).quotas[quotaKey[metric]]
  const period = currentPeriod()
  const row = await db
    .prepare(
      `INSERT INTO usage_counters (user_id, metric, period, count) VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id, metric, period) DO UPDATE SET count = count + 1 WHERE count < ?
       RETURNING count`,
    )
    .bind(userId, metric, period, limit)
    .first<{ count: number }>()
  if (limit <= 0) {
    if (row) await db.prepare('UPDATE usage_counters SET count = count - 1 WHERE user_id = ? AND metric = ? AND period = ?').bind(userId, metric, period).run()
    return false
  }
  return !!row
}

export function quotaLimits(planId: string) {
  const p = getPlan(planId)
  return { agent_runs: p.quotas.agent_runs_per_month, ai_assist: p.quotas.ai_assist_per_month, external_search: p.quotas.external_search_per_month }
}

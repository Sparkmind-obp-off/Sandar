// Deterministic cash-flow arithmetic (docs/16). Integer minor units only.
// The language model never performs these calculations.
export const CALC_VERSION = 'cashflow-v1.0'

export type Direction = 'inflow' | 'outflow'
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly'
export type Certainty = 'confirmed' | 'estimated' | 'unknown'

export type CashItem = {
  id: string
  direction: Direction
  label: string
  amount_minor: number
  currency_code: string
  expected_date: string | null
  recurrence: Recurrence
  certainty: Certainty
}

export type Period = { from: string; to: string } // inclusive ISO dates

export type Occurrence = { item_id: string; date: string; amount_minor: number; direction: Direction; certainty: Certainty }

export type Summary = {
  calculation_version: string
  period: Period
  currency_code: string | null
  item_count: number
  occurrences: Occurrence[]
  undated_items: string[]
  total_inflow_minor: number
  total_outflow_minor: number
  net_movement_minor: number
  opening_balance_minor: number | null
  closing_estimate_minor: number | null
  by_certainty: Record<Certainty, { inflow: number; outflow: number }>
  has_entries: boolean
  assumptions: string[]
  warnings: string[]
}

const toDate = (s: string) => new Date(s + 'T00:00:00Z')
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/** Expand an item into dated occurrences within the period. Month-end safe: day 31 → last day of shorter months. */
export function occurrencesFor(item: CashItem, period: Period): Occurrence[] {
  if (!item.expected_date) return []
  const start = toDate(item.expected_date)
  const from = toDate(period.from)
  const to = toDate(period.to)
  const out: Occurrence[] = []
  const push = (d: Date) => {
    if (d >= from && d <= to) out.push({ item_id: item.id, date: fmt(d), amount_minor: item.amount_minor, direction: item.direction, certainty: item.certainty })
  }
  if (item.recurrence === 'none') {
    push(start)
    return out
  }
  const anchorDay = start.getUTCDate()
  for (let i = 0; i < 2000; i++) {
    let d: Date
    if (item.recurrence === 'weekly') d = new Date(start.getTime() + i * 7 * 86400000)
    else if (item.recurrence === 'monthly') {
      const y = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + i) / 12)
      const m = (start.getUTCMonth() + i) % 12
      d = new Date(Date.UTC(y, m, Math.min(anchorDay, daysInMonth(y, m))))
    } else {
      const y = start.getUTCFullYear() + i
      const m = start.getUTCMonth()
      d = new Date(Date.UTC(y, m, Math.min(anchorDay, daysInMonth(y, m))))
    }
    if (d > to) break
    push(d)
  }
  return out
}

export function summarize(items: CashItem[], period: Period, openingBalanceMinor: number | null): Summary {
  if (toDate(period.from) > toDate(period.to)) throw new Error('Periode tidak valid: tanggal awal setelah tanggal akhir.')
  const currencies = [...new Set(items.map((i) => i.currency_code))]
  const warnings: string[] = []
  if (currencies.length > 1) throw new Error('Mata uang campuran belum didukung. Konversi mata uang di luar cakupan MVP.')
  const occ: Occurrence[] = []
  const undated: string[] = []
  for (const it of items) {
    if (!it.expected_date) undated.push(it.id)
    else occ.push(...occurrencesFor(it, period))
  }
  occ.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const byC: Summary['by_certainty'] = { confirmed: { inflow: 0, outflow: 0 }, estimated: { inflow: 0, outflow: 0 }, unknown: { inflow: 0, outflow: 0 } }
  let inflow = 0
  let outflow = 0
  for (const o of occ) {
    if (o.direction === 'inflow') inflow += o.amount_minor
    else outflow += o.amount_minor
    byC[o.certainty][o.direction] += o.amount_minor
  }
  if (!Number.isSafeInteger(inflow) || !Number.isSafeInteger(outflow)) throw new Error('Jumlah melebihi batas perhitungan aman.')
  const net = inflow - outflow
  if (undated.length) warnings.push(`${undated.length} entri belum memiliki tanggal sehingga tidak dihitung dalam periode ini.`)
  if (byC.unknown.inflow + byC.unknown.outflow > 0) warnings.push('Sebagian angka berstatus "belum diketahui"; hasil bisa berbeda dari kenyataan.')
  const assumptions = [
    `Periode dihitung dari ${period.from} sampai ${period.to} (inklusif).`,
    'Semua angka berasal dari informasi yang Anda masukkan; SANDAR tidak menebak angka.',
    'Entri berulang bulanan pada tanggal 29–31 dijatuhkan ke hari terakhir bulan yang lebih pendek.',
    'Perhitungan memakai bilangan bulat dalam satuan terkecil mata uang (tanpa pembulatan desimal).',
    openingBalanceMinor === null ? 'Saldo awal belum diketahui, sehingga perkiraan saldo akhir tidak dihitung.' : 'Perkiraan saldo akhir = saldo awal + pergerakan bersih.',
  ]
  return {
    calculation_version: CALC_VERSION,
    period,
    currency_code: currencies[0] ?? null,
    item_count: items.length,
    occurrences: occ,
    undated_items: undated,
    total_inflow_minor: inflow,
    total_outflow_minor: outflow,
    net_movement_minor: net,
    opening_balance_minor: openingBalanceMinor,
    closing_estimate_minor: openingBalanceMinor === null ? null : openingBalanceMinor + net,
    by_certainty: byC,
    has_entries: occ.length > 0,
    assumptions,
    warnings,
  }
}

export type ScenarioChange =
  | { op: 'adjust'; item_id: string; amount_minor: number }
  | { op: 'remove'; item_id: string }
  | { op: 'add'; item: Omit<CashItem, 'id'> & { id?: string } }

/** Pure function: returns a NEW array; the baseline input is never mutated. */
export function applyScenario(baseline: readonly CashItem[], changes: ScenarioChange[]): CashItem[] {
  let items = baseline.map((i) => ({ ...i }))
  changes.forEach((ch, idx) => {
    if (ch.op === 'adjust') items = items.map((i) => (i.id === ch.item_id ? { ...i, amount_minor: ch.amount_minor } : i))
    else if (ch.op === 'remove') items = items.filter((i) => i.id !== ch.item_id)
    else if (ch.op === 'add') items.push({ ...ch.item, id: ch.item.id || `scenario_${idx}` })
  })
  return items
}

export function formatIdr(minor: number | null): string {
  if (minor === null) return 'Belum diketahui'
  const sign = minor < 0 ? '−' : ''
  return `${sign}Rp${Math.abs(minor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

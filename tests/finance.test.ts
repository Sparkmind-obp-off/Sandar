import { applyScenario, occurrencesFor, summarize, formatIdr, type CashItem } from '../src/domain/finance'

const item = (o: Partial<CashItem>): CashItem => ({ id: 'i1', direction: 'inflow', label: 'x', amount_minor: 1000, currency_code: 'IDR', expected_date: '2026-11-05', recurrence: 'none', certainty: 'confirmed', ...o })
const P = { from: '2026-11-01', to: '2026-11-30' }

describe('financial calculations (docs/16)', () => {
  it('empty period reports no entries, not a confident zero', () => {
    const s = summarize([], P, null)
    expect(s.has_entries).toBe(false)
    expect(s.net_movement_minor).toBe(0)
    expect(s.closing_estimate_minor).toBeNull()
  })
  it('one inflow and one outflow: net equals difference', () => {
    const s = summarize([item({ id: 'a', amount_minor: 5_000_000 }), item({ id: 'b', direction: 'outflow', amount_minor: 3_250_000 })], P, 100_000)
    expect(s.total_inflow_minor).toBe(5_000_000)
    expect(s.total_outflow_minor).toBe(3_250_000)
    expect(s.net_movement_minor).toBe(1_750_000)
    expect(s.closing_estimate_minor).toBe(1_850_000)
  })
  it('unknown opening amount keeps closing estimate unknown', () => {
    expect(summarize([item({})], P, null).closing_estimate_minor).toBeNull()
  })
  it('integer arithmetic has no floating point drift', () => {
    const items = Array.from({ length: 10 }, (_, i) => item({ id: 'x' + i, amount_minor: 1 }))
    expect(summarize(items, P, 0).total_inflow_minor).toBe(10)
  })
  it('monthly recurrence on the 31st falls back to month end', () => {
    const occ = occurrencesFor(item({ expected_date: '2026-01-31', recurrence: 'monthly' }), { from: '2026-01-01', to: '2026-04-30' })
    expect(occ.map((o) => o.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })
  it('weekly recurrence only within period', () => {
    const occ = occurrencesFor(item({ expected_date: '2026-10-25', recurrence: 'weekly' }), P)
    expect(occ.map((o) => o.date)).toEqual(['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29'])
  })
  it('undated items are excluded and warned about', () => {
    const s = summarize([item({ expected_date: null })], P, null)
    expect(s.undated_items).toEqual(['i1'])
    expect(s.warnings.join(' ')).toMatch(/belum memiliki tanggal/)
  })
  it('mixed currencies are rejected', () => {
    expect(() => summarize([item({}), item({ id: 'u', currency_code: 'USD' })], P, null)).toThrow(/campuran/)
  })
  it('scenario never mutates baseline', () => {
    const base = [item({ id: 'a', amount_minor: 100 }), item({ id: 'b', amount_minor: 200 })]
    const snap = JSON.stringify(base)
    const sc = applyScenario(base, [{ op: 'adjust', item_id: 'a', amount_minor: 1 }, { op: 'remove', item_id: 'b' }])
    expect(JSON.stringify(base)).toBe(snap)
    expect(sc).toHaveLength(1)
    expect(sc[0].amount_minor).toBe(1)
  })
  it('formats rupiah', () => {
    expect(formatIdr(1500000)).toBe('Rp1.500.000')
    expect(formatIdr(-2500)).toBe('−Rp2.500')
    expect(formatIdr(null)).toBe('Belum diketahui')
  })
})

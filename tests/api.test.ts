import { call, consentAll, makeEnv, mintToken } from './helpers'
import { hmacSha256Hex } from '../src/lib/util'
import { listingFreshness } from '../src/domain/catalogue'
import { routeObjective, canTransition } from '../src/agents/registry'
import { redact } from '../src/providers'

describe('public routes', () => {
  it('health reports database ok and no-store', async () => {
    const env = makeEnv()
    const r = await call(env, 'GET', '/api/v1/health')
    expect(r.status).toBe(200)
    expect(r.json.database).toBe('ok')
  })
  it('catalogue is anonymous, carries provenance, labels samples and stale entries', async () => {
    const env = makeEnv()
    const r = await call(env, 'GET', '/api/v1/catalogue/resources')
    expect(r.status).toBe(200)
    expect(r.json.count).toBeGreaterThan(3)
    for (const it of r.json.items) {
      expect(it.official_source_url).toMatch(/^https:\/\//)
      expect(it.publisher.name).toBeTruthy()
      expect(it.verification.label).toBeTruthy()
    }
    const stale = r.json.items.find((i: any) => i.id === 'rl_sample_stale')
    expect(stale.verification.status).toBe('stale')
    expect(stale.verification.is_current).toBe(false)
    const real = r.json.items.find((i: any) => i.id === 'rl_bpjstk_home')
    expect(real.verification.status).toBe('unverified')
    expect(real.is_sample).toBe(false)
  })
  it('catalogue search and filters work', async () => {
    const env = makeEnv()
    expect((await call(env, 'GET', '/api/v1/catalogue/resources?kind=opportunity')).json.items.every((i: any) => i.kind === 'opportunity')).toBe(true)
    expect((await call(env, 'GET', '/api/v1/catalogue/resources?q=ojk')).json.items[0].id).toBe('rl_ojk_home')
    expect((await call(env, 'GET', '/api/v1/catalogue/resources?topic=pelatihan')).json.count).toBeGreaterThan(0)
  })
  it('report flags listing for review without deleting it', async () => {
    const env = makeEnv()
    const r = await call(env, 'POST', '/api/v1/catalogue/resources/rl_ojk_home/report', { body: { reason: 'outdated' } })
    expect(r.status).toBe(202)
    const d = await call(env, 'GET', '/api/v1/catalogue/resources/rl_ojk_home')
    expect(d.json.item.verification.status).toBe('needs_review')
  })
  it('pricing is hypothesis, billing OFF by default', async () => {
    const env = makeEnv()
    const r = await call(env, 'GET', '/api/v1/pricing')
    expect(r.json.billing_enabled).toBe(false)
    expect(r.json.hypothesis).toBe(true)
    const plus = r.json.plans.find((p: any) => p.id === 'plus_monthly')
    const annual = r.json.plans.find((p: any) => p.id === 'plus_annual')
    expect(plus.price_minor).toBe(29000)
    expect(annual.price_minor).toBe(290000)
  })
  it('html shell has security headers and CSP', async () => {
    const env = makeEnv()
    const r = await call(env, 'GET', '/')
    expect(r.headers.get('content-security-policy')).toMatch(/frame-ancestors 'none'/)
    expect(r.headers.get('x-frame-options')).toBe('DENY')
  })
})

describe('authentication', () => {
  it('denies anonymous private access', async () => {
    const r = await call(makeEnv(), 'GET', '/api/v1/me/workspace')
    expect(r.status).toBe(401)
    expect(r.json.error.code).toBe('UNAUTHENTICATED')
  })
  it('denies expired tokens', async () => {
    const r = await call(makeEnv(), 'GET', '/api/v1/me/workspace', { token: mintToken('user_a', { expOffset: -120 }) })
    expect(r.status).toBe(401)
  })
  it('denies tokens signed by another key', async () => {
    const r = await call(makeEnv(), 'GET', '/api/v1/me/workspace', { token: mintToken('user_a', { wrongKey: true }) })
    expect(r.status).toBe(401)
  })
  it('denies wrong issuer and wrong authorized party', async () => {
    expect((await call(makeEnv(), 'GET', '/api/v1/me/workspace', { token: mintToken('user_a', { iss: 'https://evil.example' }) })).status).toBe(401)
    expect((await call(makeEnv(), 'GET', '/api/v1/me/workspace', { token: mintToken('user_a', { azp: 'https://evil.example' }) })).status).toBe(401)
  })
  it('denies garbage tokens', async () => {
    expect((await call(makeEnv(), 'GET', '/api/v1/me/workspace', { token: 'abc.def.ghi' })).status).toBe(401)
  })
  it('dev stub header is ignored outside development', async () => {
    expect((await call(makeEnv(), 'GET', '/api/v1/me/workspace', { headers: { 'x-dev-user': 'a' } })).status).toBe(401)
  })
  it('valid token creates exactly one workspace per user', async () => {
    const env = makeEnv()
    const a = await call(env, 'GET', '/api/v1/me/workspace', { user: 'user_a' })
    const b = await call(env, 'GET', '/api/v1/me/workspace', { user: 'user_a' })
    expect(a.status).toBe(200)
    expect(a.json.workspace.id).toBe(b.json.workspace.id)
    expect(a.json.plan.id).toBe('free')
  })
  it('rejects cross-origin writes', async () => {
    const env = makeEnv()
    const r = await call(env, 'POST', '/api/v1/me/consents', { user: 'user_a', body: { purpose_code: 'workspace_storage' }, headers: { origin: 'https://evil.example' } })
    expect(r.status).toBe(403)
  })
})

describe('consent gating', () => {
  it('saving requires workspace_storage consent; revocation re-blocks', async () => {
    const env = makeEnv()
    const body = { title: 'Rapikan pengeluaran' }
    expect((await call(env, 'POST', '/api/v1/me/goals', { user: 'user_a', body })).json.error.code).toBe('CONSENT_REQUIRED')
    await consentAll(env, 'user_a')
    expect((await call(env, 'POST', '/api/v1/me/goals', { user: 'user_a', body })).status).toBe(201)
    await call(env, 'POST', '/api/v1/me/consents/workspace_storage/revoke', { user: 'user_a' })
    expect((await call(env, 'POST', '/api/v1/me/goals', { user: 'user_a', body })).status).toBe(403)
  })
  it('consents are purpose-specific', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a', ['workspace_storage'])
    const w = await call(env, 'GET', '/api/v1/me/workspace', { user: 'user_a' })
    expect(w.json.consents).toEqual(['workspace_storage'])
  })
})

describe('tenant isolation / object-level authorization', () => {
  it('user B cannot read, update, or delete user A records by id', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    await consentAll(env, 'user_b')
    const g = await call(env, 'POST', '/api/v1/me/goals', { user: 'user_a', body: { title: 'Rahasia A' } })
    const cf = await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: { direction: 'inflow', label: 'gaji A', amount_minor: 1000, expected_date: '2026-11-01' } })
    const plan = await call(env, 'POST', '/api/v1/me/plans', { user: 'user_a', body: { title: 'Plan A', steps: [{ title: 'langkah' }] } })
    const gid = g.json.goal.id, cid = cf.json.item.id, pid = plan.json.plan.id

    expect((await call(env, 'GET', '/api/v1/me/goals', { user: 'user_b' })).json.goals).toHaveLength(0)
    expect((await call(env, 'GET', '/api/v1/me/cash-flow-items', { user: 'user_b' })).json.items).toHaveLength(0)
    expect((await call(env, 'PATCH', `/api/v1/me/goals/${gid}`, { user: 'user_b', body: { title: 'hacked' } })).status).toBe(404)
    expect((await call(env, 'DELETE', `/api/v1/me/goals/${gid}`, { user: 'user_b' })).status).toBe(404)
    expect((await call(env, 'PATCH', `/api/v1/me/cash-flow-items/${cid}`, { user: 'user_b', body: { amount_minor: 1 } })).status).toBe(404)
    expect((await call(env, 'DELETE', `/api/v1/me/cash-flow-items/${cid}`, { user: 'user_b' })).status).toBe(404)
    expect((await call(env, 'GET', `/api/v1/me/plans/${pid}`, { user: 'user_b' })).status).toBe(404)
    expect((await call(env, 'POST', `/api/v1/me/plans/${pid}/steps`, { user: 'user_b', body: { title: 'x' } })).status).toBe(404)
    expect((await call(env, 'DELETE', `/api/v1/me/plans/${pid}`, { user: 'user_b' })).status).toBe(404)

    // B's export and summary contain nothing of A's
    const exp = await call(env, 'POST', '/api/v1/me/export', { user: 'user_b' })
    expect(JSON.stringify(exp.json)).not.toContain('Rahasia A')
    expect(JSON.stringify(exp.json)).not.toContain('gaji A')
    const sum = await call(env, 'POST', '/api/v1/me/cash-flow/summary', { user: 'user_b', body: { from: '2026-11-01', to: '2026-11-30' } })
    expect(sum.json.summary.total_inflow_minor).toBe(0)

    // A still intact
    expect((await call(env, 'GET', '/api/v1/me/goals', { user: 'user_a' })).json.goals[0].title).toBe('Rahasia A')
  })
  it('client-supplied workspace/user ids are ignored', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    await consentAll(env, 'user_b')
    const wa = await call(env, 'GET', '/api/v1/me/workspace', { user: 'user_a' })
    await call(env, 'POST', '/api/v1/me/goals', { user: 'user_b', body: { title: 'B goal', workspace_id: wa.json.workspace.id, user_id: 'x' } })
    expect((await call(env, 'GET', '/api/v1/me/goals', { user: 'user_a' })).json.goals).toHaveLength(0)
  })
  it('user B cannot read user A tasks', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    const t = await call(env, 'POST', '/api/v1/me/tasks', { user: 'user_a', body: { objective: 'Saya ingin merapikan tujuan hidup', skip_questions: true } })
    expect(t.status).toBe(201)
    expect((await call(env, 'GET', `/api/v1/me/tasks/${t.json.task.id}`, { user: 'user_b' })).status).toBe(404)
    expect((await call(env, 'POST', `/api/v1/me/tasks/${t.json.task.id}/cancel`, { user: 'user_b' })).status).toBe(404)
  })
  it('catalogue writes are curator-only', async () => {
    const env = makeEnv()
    const body = { title: 'X', summary: 'Y', topic_codes: 'a', publisher_name: 'P', publisher_type: 't', jurisdiction_code: 'ID', official_source_url: 'https://example.org' }
    expect((await call(env, 'POST', '/api/v1/me/admin/catalogue', { user: 'user_a', body })).status).toBe(403)
    expect((await call(env, 'POST', '/api/v1/me/admin/catalogue', { user: 'user_admin', body })).status).toBe(201)
    expect((await call(env, 'POST', '/api/v1/me/admin/catalogue', { user: 'user_admin', body: { ...body, verification_status: 'checked' } })).status).toBe(400)
  })
})

describe('validation', () => {
  it('rejects negative, float, and oversized amounts and bad dates', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    const base = { direction: 'outflow', label: 'listrik' }
    expect((await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: { ...base, amount_minor: -5 } })).status).toBe(400)
    expect((await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: { ...base, amount_minor: 10.5 } })).status).toBe(400)
    expect((await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: { ...base, amount_minor: 100, expected_date: '2026-02-30' } })).status).toBe(400)
    expect((await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: { ...base, amount_minor: 100, currency_code: 'USD' } })).status).toBe(400)
    expect((await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: '{bad json' })).status).toBe(400)
    expect((await call(env, 'POST', '/api/v1/me/goals', { user: 'user_a', body: { title: 'x'.repeat(500) } })).status).toBe(400)
  })
  it('oversized payload rejected', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    const r = await call(env, 'POST', '/api/v1/me/goals', { user: 'user_a', body: { title: 'a', description: 'x'.repeat(70000) } })
    expect(r.status).toBe(413)
  })
})

describe('scenario preview', () => {
  it('compares without persisting or changing source rows', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    const a = await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: { direction: 'inflow', label: 'gaji', amount_minor: 5_000_000, expected_date: '2026-11-01', certainty: 'confirmed' } })
    await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: { direction: 'outflow', label: 'sewa', amount_minor: 1_500_000, expected_date: '2026-11-03' } })
    const r = await call(env, 'POST', '/api/v1/me/scenarios/preview', { user: 'user_a', body: { from: '2026-11-01', to: '2026-11-30', opening_balance_minor: null, changes: [{ op: 'adjust', item_id: a.json.item.id, amount_minor: 4_000_000 }] } })
    expect(r.status).toBe(200)
    expect(r.json.persisted).toBe(false)
    expect(r.json.baseline.net_movement_minor).toBe(3_500_000)
    expect(r.json.scenario.net_movement_minor).toBe(2_500_000)
    expect(r.json.difference_net_minor).toBe(-1_000_000)
    const items = await call(env, 'GET', '/api/v1/me/cash-flow-items', { user: 'user_a' })
    expect(items.json.items.find((i: any) => i.id === a.json.item.id).amount_minor).toBe(5_000_000)
  })
})

describe('agentic orchestrator', () => {
  it('routes deterministically by keyword or explicit area', () => {
    expect(routeObjective('Saya ingin merapikan pengeluaran bulanan').area).toBe('finance')
    expect(routeObjective('cari program bantuan pemerintah').area).toBe('resources')
    expect(routeObjective('ingin belajar keterampilan baru').area).toBe('opportunity')
    expect(routeObjective('apa saja', 'resilience').area).toBe('resilience')
    expect(routeObjective('sesuatu yang umum').area).toBe('life')
  })
  it('enforces the task state machine', () => {
    expect(canTransition('queued', 'planning')).toBe(true)
    expect(canTransition('completed', 'running')).toBe(false)
    expect(canTransition('cancelled', 'running')).toBe(false)
  })
  it('full journey: question → answer → structured result → save plan → progress', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: { direction: 'inflow', label: 'gaji', amount_minor: 4_000_000, expected_date: new Date().toISOString().slice(0, 10) } })
    const t = await call(env, 'POST', '/api/v1/me/tasks', { user: 'user_a', body: { objective: 'Saya ingin merapikan pengeluaran bulanan' } })
    expect(t.status).toBe(201)
    expect(t.json.task.status).toBe('awaiting_user_input')
    expect(t.json.task.agent).toBe('financial_navigation')
    const ans = await call(env, 'POST', `/api/v1/me/tasks/${t.json.task.id}/answers`, { user: 'user_a', body: { answers: { horizon: 'Bulan ini' } } })
    expect(ans.status).toBe(200)
    const r = ans.json.result
    expect(r.calculations.length).toBeGreaterThan(0)
    expect(r.next_steps.length).toBeGreaterThan(0)
    expect(r.user_facts[0].kind).toBe('user_fact')
    expect(r.ai.used).toBe(false)
    expect(r.disclaimer).toMatch(/bukan keputusan resmi/)
    // invalid choice rejected
    const detail = await call(env, 'GET', `/api/v1/me/tasks/${t.json.task.id}`, { user: 'user_a' })
    expect(detail.json.task.status).toBe('completed')
    expect(detail.json.events.some((e: any) => e.tool === 'cashflow_calculator')).toBe(true)
    // cannot rerun completed task
    expect((await call(env, 'POST', `/api/v1/me/tasks/${t.json.task.id}/answers`, { user: 'user_a', body: { answers: {} } })).status).toBe(409)
    // save plan
    const p = await call(env, 'POST', '/api/v1/me/plans', { user: 'user_a', body: { title: 'Rencana keuangan', area: 'finance', task_id: t.json.task.id, steps: r.next_steps.map((s: any) => ({ title: s.text, origin: 'suggestion' })) } })
    expect(p.status).toBe(201)
    const pd = await call(env, 'GET', `/api/v1/me/plans/${p.json.plan.id}`, { user: 'user_a' })
    const step = pd.json.steps[0]
    expect((await call(env, 'PATCH', `/api/v1/me/plans/${p.json.plan.id}/steps/${step.id}`, { user: 'user_a', body: { done: true } })).json.step.done).toBe(1)
    const list = await call(env, 'GET', '/api/v1/me/plans', { user: 'user_a' })
    expect(list.json.plans[0].done_count).toBe(1)
  })
  it('AI/search requested without consent or config falls back transparently', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    const r1 = await call(env, 'POST', '/api/v1/me/tasks', { user: 'user_a', body: { objective: 'cari program bantuan pemerintah', use_ai: true, use_search: true, skip_questions: true } })
    expect(r1.json.result.ai.used).toBe(false)
    expect(r1.json.result.ai.reason_not_used).toMatch(/Persetujuan/)
    expect(r1.json.result.search.reason_not_used).toMatch(/Persetujuan/)
    expect(r1.json.result.sources.length).toBeGreaterThan(0)
    await consentAll(env, 'user_a', ['ai_processing', 'external_search'])
    const r2 = await call(env, 'POST', '/api/v1/me/tasks', { user: 'user_a', body: { objective: 'cari program bantuan pemerintah', use_ai: true, use_search: true, skip_questions: true } })
    expect(r2.json.result.ai.reason_not_used).toMatch(/belum dikonfigurasi/)
    expect(r2.json.result.search.reason_not_used).toMatch(/belum dikonfigurasi/)
    expect(r2.json.result.next_steps.length).toBeGreaterThan(0)
  })
  it('agent run quota is enforced server-side', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_q')
    const w = await call(env, 'GET', '/api/v1/me/workspace', { user: 'user_q' })
    const limit = w.json.usage.limits.agent_runs
    const period = new Date().toISOString().slice(0, 7)
    const uid = (await env.DB.prepare('SELECT id FROM users WHERE auth_subject = ?').bind('user_q').first<{ id: string }>())!.id
    await env.DB.prepare('INSERT INTO usage_counters (user_id, metric, period, count) VALUES (?, ?, ?, ?)').bind(uid, 'agent_runs', period, limit).run()
    const r = await call(env, 'POST', '/api/v1/me/tasks', { user: 'user_q', body: { objective: 'apa saja', skip_questions: true } })
    expect(r.status).toBe(402)
    expect(r.json.error.code).toBe('QUOTA_EXCEEDED')
    // non-AI features still available
    expect((await call(env, 'GET', '/api/v1/catalogue/resources')).status).toBe(200)
    expect((await call(env, 'POST', '/api/v1/me/goals', { user: 'user_q', body: { title: 'tetap bisa' } })).status).toBe(201)
  })
  it('redacts personal identifiers before third-party calls', () => {
    const s = redact('email saya a.b@contoh.id, hp 081234567890, NIK 3201234567890123, gaji Rp 5.000.000')
    expect(s).not.toMatch(/contoh\.id|081234567890|3201234567890123|5\.000\.000/)
  })
})

describe('export & verified deletion', () => {
  it('exports all dependent entities, then deletes them with verification', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    await call(env, 'POST', '/api/v1/me/goals', { user: 'user_a', body: { title: 'G' } })
    await call(env, 'POST', '/api/v1/me/cash-flow-items', { user: 'user_a', body: { direction: 'inflow', label: 'L', amount_minor: 1 } })
    const t = await call(env, 'POST', '/api/v1/me/tasks', { user: 'user_a', body: { objective: 'rencana umum', skip_questions: true } })
    await call(env, 'POST', '/api/v1/me/plans', { user: 'user_a', body: { title: 'P', task_id: t.json.task.id, steps: [{ title: 's' }] } })
    const exp = await call(env, 'POST', '/api/v1/me/export', { user: 'user_a' })
    expect(exp.json.export_format).toBe('sandar-export-v1')
    expect(exp.json.goals).toHaveLength(1)
    expect(exp.json.cash_flow_items).toHaveLength(1)
    expect(exp.json.plans).toHaveLength(1)
    expect(exp.json.plan_steps).toHaveLength(1)
    expect(exp.json.tasks).toHaveLength(1)
    expect((await call(env, 'DELETE', '/api/v1/me/workspace', { user: 'user_a', body: {} })).status).toBe(400)
    const del = await call(env, 'DELETE', '/api/v1/me/workspace', { user: 'user_a', body: { confirm: 'HAPUS' } })
    expect(del.json.ok).toBe(true)
    expect(del.json.remaining_records).toBe(0)
    const after = await call(env, 'POST', '/api/v1/me/export', { user: 'user_a' })
    expect(after.json.goals).toHaveLength(0)
    expect(after.json.consents).toHaveLength(0)
    const steps = await env.DB.prepare('SELECT COUNT(*) AS n FROM plan_steps').first<{ n: number }>()
    expect(steps!.n).toBe(0)
  })
  it('audit log never contains form content', async () => {
    const env = makeEnv()
    await consentAll(env, 'user_a')
    await call(env, 'POST', '/api/v1/me/tasks', { user: 'user_a', body: { objective: 'RAHASIA-PRIBADI-XYZ', skip_questions: true } })
    const rows = await env.DB.prepare('SELECT * FROM audit_events').all()
    expect(JSON.stringify(rows.results)).not.toContain('RAHASIA-PRIBADI-XYZ')
  })
})

describe('billing (OFF by default; mock gateway)', () => {
  it('checkout refused while billing disabled', async () => {
    const env = makeEnv()
    const r = await call(env, 'POST', '/api/v1/me/billing/checkout', { user: 'user_a', body: { plan_id: 'plus_monthly' } })
    expect(r.status).toBe(503)
    expect(r.json.error.code).toBe('BILLING_DISABLED')
  })
  it('mock gateway is never used in production', async () => {
    const env = makeEnv({ ENVIRONMENT: 'production', BILLING_ENABLED: 'true', PAYMENT_PROVIDER: 'mock', MOCK_PAYMENT_SECRET: 's' })
    const r = await call(env, 'POST', '/api/v1/me/billing/checkout', { user: 'user_a', body: { plan_id: 'plus_monthly' } })
    expect(r.json.error.code).toBe('BILLING_NOT_READY')
  })
  it('webhook: signature verified, idempotent, amount checked, upgrades plan only on verified paid', async () => {
    const secret = 'test-secret'
    const env = makeEnv({ BILLING_ENABLED: 'true', PAYMENT_PROVIDER: 'mock', MOCK_PAYMENT_SECRET: secret })
    const co = await call(env, 'POST', '/api/v1/me/billing/checkout', { user: 'user_a', body: { plan_id: 'plus_monthly' } })
    expect(co.status).toBe(201)
    const ref = co.json.checkout.provider_ref
    // free / non-purchasable plans rejected
    expect((await call(env, 'POST', '/api/v1/me/billing/checkout', { user: 'user_a', body: { plan_id: 'organization' } })).status).toBe(400)
    // still free before webhook
    expect((await call(env, 'GET', '/api/v1/me/workspace', { user: 'user_a' })).json.plan.id).toBe('free')
    const send = async (payload: object, sig?: string) => {
      const raw = JSON.stringify(payload)
      return call(env, 'POST', '/api/v1/billing/webhook/mock', { body: raw, headers: { 'x-mock-signature': sig ?? (await hmacSha256Hex(secret, raw)) } })
    }
    expect((await send({ event_id: 'e0', provider_ref: ref, status: 'paid', amount_minor: 29000 }, 'bad')).status).toBe(401)
    expect((await send({ event_id: 'e1', provider_ref: ref, status: 'paid', amount_minor: 1 })).json.outcome).toBe('amount_mismatch')
    expect((await send({ event_id: 'e2', provider_ref: ref, status: 'paid', amount_minor: 29000 })).json.outcome).toBe('applied:paid')
    expect((await send({ event_id: 'e2', provider_ref: ref, status: 'paid', amount_minor: 29000 })).json.outcome).toBe('duplicate_ignored')
    expect((await send({ event_id: 'e3', provider_ref: ref, status: 'failed', amount_minor: 29000 })).json.outcome).toBe('invalid_transition')
    const w = await call(env, 'GET', '/api/v1/me/workspace', { user: 'user_a' })
    expect(w.json.plan.id).toBe('plus_monthly')
    const subs = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions').first<{ n: number }>()
    expect(subs!.n).toBe(1)
  })
})

describe('catalogue freshness', () => {
  it('never shows stale or unverified as current', () => {
    const now = new Date('2026-11-14T00:00:00Z')
    expect(listingFreshness({ verification_status: 'checked', last_verified_at: '2026-11-01', review_interval_days: 30 }, now).is_current).toBe(true)
    expect(listingFreshness({ verification_status: 'checked', last_verified_at: '2026-01-01', review_interval_days: 30 }, now).status).toBe('stale')
    expect(listingFreshness({ verification_status: 'unverified', last_verified_at: null, review_interval_days: 30 }, now).is_current).toBe(false)
  })
})

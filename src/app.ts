// SANDAR API — modular monolith under /api/v1 (docs/28).
import { Hono } from 'hono'
import type { AppEnv } from './types'
import { ApiError, bad, bool, intMinor, isoDate, newId, notFound, nowIso, oneOf, readJson, safeJsonParse, str } from './lib/util'
import { requireAdmin, requireAuth } from './lib/auth'
import { audit, clientKey, CONSENT_PURPOSES, hasConsent, NOTICE_VERSION, rateLimit, requireConsent } from './lib/ops'
import { applyScenario, CALC_VERSION, summarize, type CashItem, type ScenarioChange } from './domain/finance'
import { consume, getPlan, PLANS, PRICING_VERSION, quotaLimits, usageFor, type PlanId } from './domain/entitlements'
import { presentListing } from './domain/catalogue'
import { AGENTS, routeObjective, type Area } from './agents/registry'
import { cancelTask, createTask, runTask } from './agents/orchestrator'
import { firecrawlScrape, providerStatus } from './providers'
import { billingEnabled, createCheckout, gatewayFor, handleWebhook } from './billing'

export const api = new Hono<AppEnv>()

const AREAS = ['life', 'finance', 'resources', 'opportunity', 'resilience'] as const
const DIRECTIONS = ['inflow', 'outflow'] as const
const RECURRENCES = ['none', 'weekly', 'monthly', 'yearly'] as const
const CERTAINTIES = ['confirmed', 'estimated', 'unknown'] as const
const GOAL_STATUS = ['active', 'paused', 'done', 'dropped'] as const

// ---------- correlation id, security + cache headers ----------
api.use('*', async (c, next) => {
  const cid = newId('req').slice(0, 20)
  c.set('correlationId', cid)
  await next()
  c.header('x-correlation-id', cid)
  // private API responses must never enter shared caches
  if (!c.res.headers.get('cache-control')) c.header('cache-control', 'no-store')
  c.header('x-content-type-options', 'nosniff')
})

// Only same-origin browser writes (defence-in-depth; auth is bearer-token based).
api.use('*', async (c, next) => {
  const m = c.req.method
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && !c.req.path.startsWith('/api/v1/billing/webhook')) {
    const origin = c.req.header('origin')
    if (origin) {
      const allowed = new Set([new URL(c.req.url).origin, ...(c.env.AUTHORIZED_PARTIES || '').split(',').map((s) => s.trim()).filter(Boolean)])
      if (!allowed.has(origin)) throw new ApiError(403, 'FORBIDDEN', 'Asal permintaan tidak diizinkan.')
    }
  }
  await next()
})

api.onError((err, c) => {
  const cid = c.get('correlationId')
  if (err instanceof ApiError) {
    const body: Record<string, unknown> = { error: { code: err.code, message: err.message, correlation_id: cid } }
    if (err.details && err.status < 500 && err.code !== 'UNAUTHENTICATED') (body.error as any).details = err.details
    return c.json(body, err.status as any, { 'cache-control': 'no-store', 'x-correlation-id': cid })
  }
  console.error(JSON.stringify({ level: 'error', cid, path: c.req.path, name: (err as Error)?.name, msg: String((err as Error)?.message || '').slice(0, 200) }))
  return c.json({ error: { code: 'INTERNAL', message: 'Terjadi kesalahan. Data Anda tidak berubah.', correlation_id: cid } }, 500, { 'cache-control': 'no-store' })
})

api.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Rute API tidak ditemukan.', correlation_id: c.get('correlationId') } }, 404))

// ---------- public ----------
api.get('/api/v1/health', async (c) => {
  let db = 'unknown'
  try {
    const r = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM resource_listings').first<{ n: number }>()
    db = r ? 'ok' : 'error'
  } catch {
    db = 'error'
  }
  return c.json({ status: db === 'ok' ? 'ok' : 'degraded', service: 'sandar', version: '0.1.0', environment: c.env.ENVIRONMENT || 'unknown', database: db, calc_version: CALC_VERSION, time: nowIso() })
})

api.get('/api/v1/config', (c) => {
  return c.json(
    {
      clerk_publishable_key: c.env.CLERK_PUBLISHABLE_KEY || null,
      auth_mode: c.env.CLERK_PUBLISHABLE_KEY ? 'clerk' : c.env.ENVIRONMENT === 'development' ? 'dev_stub' : 'unavailable',
      billing_enabled: billingEnabled(c.env),
      notice_version: NOTICE_VERSION,
      pricing_version: PRICING_VERSION,
    },
    200,
    { 'cache-control': 'public, max-age=60' },
  )
})

api.get('/api/v1/pricing', (c) =>
  c.json(
    { pricing_version: PRICING_VERSION, hypothesis: true, billing_enabled: billingEnabled(c.env), plans: Object.values(PLANS), note: 'Harga adalah hipotesis untuk validasi. Pembayaran belum dibuka; semua akun memakai paket Gratis.' },
    200,
    { 'cache-control': 'public, max-age=300' },
  ),
)

api.get('/api/v1/agents', (c) => c.json({ agents: Object.values(AGENTS) }, 200, { 'cache-control': 'public, max-age=300' }))

api.get('/api/v1/catalogue/resources', async (c) => {
  await rateLimit(c.env.DB, `cat:${await clientKey(c)}`, 120, 60)
  const q = (c.req.query('q') || '').trim().slice(0, 80).toLowerCase()
  const topic = (c.req.query('topic') || '').trim().slice(0, 40)
  const jurisdiction = (c.req.query('jurisdiction') || '').trim().slice(0, 10)
  const kind = c.req.query('kind')
  const status = c.req.query('status')
  let sql = "SELECT * FROM resource_listings WHERE verification_status != 'withdrawn'"
  const args: unknown[] = []
  if (kind === 'resource' || kind === 'opportunity') {
    sql += ' AND kind = ?'
    args.push(kind)
  }
  if (topic) {
    sql += " AND (',' || topic_codes || ',') LIKE ?"
    args.push(`%,${topic},%`)
  }
  if (jurisdiction) {
    sql += ' AND (jurisdiction_code = ? OR jurisdiction_code LIKE ?)'
    args.push(jurisdiction, `${jurisdiction}-%`)
  }
  if (q) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(publisher_name) LIKE ? OR topic_codes LIKE ?)'
    args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  }
  sql += ' ORDER BY is_sample ASC, title ASC LIMIT 100'
  const rows = await c.env.DB.prepare(sql).bind(...args).all<any>()
  let items = (rows.results || []).map(presentListing)
  if (status) items = items.filter((i) => i.verification.status === status)
  const topics = [...new Set((rows.results || []).flatMap((r: any) => String(r.topic_codes).split(',')))].filter(Boolean).sort()
  return c.json({ items, count: items.length, topics, checked_at: nowIso() }, 200, { 'cache-control': 'public, max-age=60' })
})

api.get('/api/v1/catalogue/resources/:id', async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM resource_listings WHERE id = ? AND verification_status != 'withdrawn'").bind(c.req.param('id')).first<any>()
  if (!r) throw notFound()
  return c.json({ item: presentListing(r) }, 200, { 'cache-control': 'public, max-age=60' })
})

api.post('/api/v1/catalogue/resources/:id/report', async (c) => {
  await rateLimit(c.env.DB, `report:${await clientKey(c)}`, 10, 3600)
  const b = await readJson(c.req.raw, 4096)
  const reason = oneOf(b.reason, ['link_broken', 'outdated', 'incorrect', 'other'] as const, 'reason')
  const r = await c.env.DB.prepare('SELECT id FROM resource_listings WHERE id = ?').bind(c.req.param('id')).first()
  if (!r) throw notFound()
  // A report flags for review; it does not prove the listing is false (docs/17).
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO listing_reports (id, listing_id, reason, created_at) VALUES (?, ?, ?, ?)').bind(newId('rep'), c.req.param('id'), reason, nowIso()),
    c.env.DB.prepare("UPDATE resource_listings SET verification_status = 'needs_review', updated_at = ? WHERE id = ? AND verification_status IN ('checked','unverified','stale')").bind(nowIso(), c.req.param('id')),
  ])
  return c.json({ ok: true, message: 'Terima kasih. Entri ditandai untuk ditinjau kurator.' }, 202)
})

// ---------- billing webhook (public, signature-verified) ----------
api.post('/api/v1/billing/webhook/:provider', async (c) => {
  await rateLimit(c.env.DB, `wh:${await clientKey(c)}`, 120, 60)
  const gw = gatewayFor(c.env)
  if (!gw || gw.name !== c.req.param('provider')) throw new ApiError(404, 'NOT_FOUND', 'Webhook tidak aktif.')
  const raw = await c.req.text()
  if (raw.length > 32 * 1024) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Data terlalu besar.')
  const r = await handleWebhook(c.env, gw, c.req.raw.headers, raw)
  return c.json({ ok: true, outcome: r.outcome })
})

// ---------- private (authenticated) ----------
const me = new Hono<AppEnv>()
me.use('*', async (c, next) => {
  await rateLimit(c.env.DB, `me:${await clientKey(c)}`, 240, 60)
  await next()
})
me.use('*', requireAuth)
me.use('*', async (c, next) => {
  if (!['GET', 'HEAD'].includes(c.req.method)) await rateLimit(c.env.DB, `w:${c.get('user').id}`, 60, 60)
  await next()
})

me.get('/workspace', async (c) => {
  const u = c.get('user')
  const db = c.env.DB
  const [ws, goals, items, plans, tasks, consents, usage] = await Promise.all([
    db.prepare('SELECT id, title, created_at FROM workspaces WHERE id = ? AND owner_user_id = ?').bind(u.workspaceId, u.id).first(),
    db.prepare('SELECT COUNT(*) AS n FROM goals WHERE workspace_id = ?').bind(u.workspaceId).first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM cash_flow_items WHERE workspace_id = ?').bind(u.workspaceId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM plans WHERE workspace_id = ? AND status = 'active'").bind(u.workspaceId).first<{ n: number }>(),
    db.prepare('SELECT id, area, agent, objective, status, updated_at FROM agent_tasks WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 5').bind(u.workspaceId).all(),
    db.prepare('SELECT purpose_code FROM consent_records WHERE user_id = ? AND revoked_at IS NULL').bind(u.id).all<{ purpose_code: string }>(),
    usageFor(db, u.id),
  ])
  const plan = getPlan(u.planId)
  return c.json({
    workspace: ws,
    plan: { id: plan.id, name: plan.name, hypothesis: true },
    counts: { goals: goals?.n ?? 0, cash_flow_items: items?.n ?? 0, active_plans: plans?.n ?? 0 },
    recent_tasks: tasks.results,
    consents: (consents.results || []).map((r) => r.purpose_code),
    usage: { used: usage, limits: quotaLimits(u.planId), period: new Date().toISOString().slice(0, 7) },
    is_curator: u.isAdmin,
  })
})

// --- consent ---
me.get('/consents', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, purpose_code, notice_version, granted_at, revoked_at FROM consent_records WHERE user_id = ? ORDER BY granted_at DESC').bind(c.get('user').id).all()
  return c.json({ consents: rows.results, notice_version: NOTICE_VERSION })
})
me.post('/consents', async (c) => {
  const u = c.get('user')
  const b = await readJson(c.req.raw, 2048)
  const purpose = oneOf(b.purpose_code, CONSENT_PURPOSES, 'purpose_code')
  if (await hasConsent(c.env.DB, u.id, purpose)) return c.json({ ok: true, already: true })
  const id = newId('con')
  await c.env.DB.prepare('INSERT INTO consent_records (id, user_id, purpose_code, notice_version, granted_at) VALUES (?, ?, ?, ?, ?)').bind(id, u.id, purpose, NOTICE_VERSION, nowIso()).run()
  await audit(c, 'consent.grant', 'ok', 'consent', purpose)
  return c.json({ ok: true, id }, 201)
})
me.post('/consents/:purpose/revoke', async (c) => {
  const u = c.get('user')
  const purpose = oneOf(c.req.param('purpose'), CONSENT_PURPOSES, 'purpose')
  await c.env.DB.prepare('UPDATE consent_records SET revoked_at = ? WHERE user_id = ? AND purpose_code = ? AND revoked_at IS NULL').bind(nowIso(), u.id, purpose).run()
  await audit(c, 'consent.revoke', 'ok', 'consent', purpose)
  return c.json({ ok: true })
})

// Saving private records requires workspace_storage consent.
const storageGate = async (c: any, next: any) => {
  if (!['GET', 'HEAD', 'DELETE'].includes(c.req.method)) await requireConsent(c.env.DB, c.get('user').id, 'workspace_storage')
  await next()
}
me.use('/goals/*', storageGate)
me.use('/goals', storageGate)
me.use('/cash-flow-items/*', storageGate)
me.use('/cash-flow-items', storageGate)
me.use('/plans/*', storageGate)
me.use('/plans', storageGate)
me.use('/tasks', storageGate)

// --- goals ---
me.get('/goals', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM goals WHERE workspace_id = ? ORDER BY updated_at DESC').bind(c.get('user').workspaceId).all()
  return c.json({ goals: rows.results })
})
me.post('/goals', async (c) => {
  const u = c.get('user')
  const b = await readJson(c.req.raw, 8192)
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM goals WHERE workspace_id = ?').bind(u.workspaceId).first<{ n: number }>()
  if ((n?.n ?? 0) >= getPlan(u.planId).quotas.goals) throw new ApiError(402, 'QUOTA_EXCEEDED', 'Batas jumlah tujuan pada paket Anda tercapai.')
  const g = {
    id: newId('gol'),
    title: str(b.title, { field: 'title', required: true, max: 120 })!,
    description: str(b.description, { field: 'description', max: 1000 }),
    area: oneOf(b.area, AREAS, 'area', 'life'),
    status: oneOf(b.status, GOAL_STATUS, 'status', 'active'),
    target_date: isoDate(b.target_date, 'target_date'),
  }
  const t = nowIso()
  await c.env.DB.prepare('INSERT INTO goals (id, workspace_id, title, description, area, status, target_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(g.id, u.workspaceId, g.title, g.description, g.area, g.status, g.target_date, t, t)
    .run()
  return c.json({ goal: { ...g, created_at: t, updated_at: t } }, 201)
})
me.patch('/goals/:id', async (c) => {
  const u = c.get('user')
  const cur = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), u.workspaceId).first<any>()
  if (!cur) throw notFound()
  const b = await readJson(c.req.raw, 8192)
  const next = {
    title: b.title !== undefined ? str(b.title, { field: 'title', required: true, max: 120 }) : cur.title,
    description: b.description !== undefined ? str(b.description, { field: 'description', max: 1000 }) : cur.description,
    area: b.area !== undefined ? oneOf(b.area, AREAS, 'area') : cur.area,
    status: b.status !== undefined ? oneOf(b.status, GOAL_STATUS, 'status') : cur.status,
    target_date: b.target_date !== undefined ? isoDate(b.target_date, 'target_date') : cur.target_date,
  }
  await c.env.DB.prepare('UPDATE goals SET title = ?, description = ?, area = ?, status = ?, target_date = ?, updated_at = ? WHERE id = ? AND workspace_id = ?')
    .bind(next.title, next.description, next.area, next.status, next.target_date, nowIso(), cur.id, u.workspaceId)
    .run()
  return c.json({ goal: { ...cur, ...next } })
})
me.delete('/goals/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM goals WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), c.get('user').workspaceId).run()
  if (!r.meta.changes) throw notFound()
  return c.json({ ok: true })
})

// --- cash-flow items ---
function parseItem(b: Record<string, unknown>, partial = false, cur?: any) {
  const pick = <T>(k: string, f: () => T, d: T) => (b[k] !== undefined ? f() : partial ? (cur?.[k] as T) : d)
  const currency = pick('currency_code', () => oneOf(b.currency_code, ['IDR'] as const, 'currency_code'), 'IDR' as const)
  return {
    direction: pick('direction', () => oneOf(b.direction, DIRECTIONS, 'direction'), undefined as any) ?? (() => { throw bad('Arah (masuk/keluar) wajib dipilih.', { field: 'direction' }) })(),
    label: pick('label', () => str(b.label, { field: 'label', required: true, max: 80 })!, undefined as any) ?? (() => { throw bad('Label wajib diisi.', { field: 'label' }) })(),
    amount_minor: pick('amount_minor', () => intMinor(b.amount_minor, 'amount_minor'), undefined as any) ?? (() => { throw bad('Jumlah wajib diisi.', { field: 'amount_minor' }) })(),
    currency_code: currency,
    expected_date: pick('expected_date', () => isoDate(b.expected_date, 'expected_date'), null),
    recurrence: pick('recurrence', () => oneOf(b.recurrence, RECURRENCES, 'recurrence'), 'none' as const),
    certainty: pick('certainty', () => oneOf(b.certainty, CERTAINTIES, 'certainty'), 'estimated' as const),
    category: pick('category', () => str(b.category, { field: 'category', max: 40 }), null),
  }
}
me.get('/cash-flow-items', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM cash_flow_items WHERE workspace_id = ? ORDER BY COALESCE(expected_date, created_at) ASC').bind(c.get('user').workspaceId).all()
  return c.json({ items: rows.results })
})
me.post('/cash-flow-items', async (c) => {
  const u = c.get('user')
  const b = await readJson(c.req.raw, 4096)
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM cash_flow_items WHERE workspace_id = ?').bind(u.workspaceId).first<{ n: number }>()
  if ((n?.n ?? 0) >= getPlan(u.planId).quotas.cash_flow_items) throw new ApiError(402, 'QUOTA_EXCEEDED', 'Batas jumlah entri pada paket Anda tercapai.')
  const it = parseItem(b)
  const id = newId('cfi')
  const t = nowIso()
  await c.env.DB.prepare('INSERT INTO cash_flow_items (id, workspace_id, direction, label, amount_minor, currency_code, expected_date, recurrence, certainty, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, u.workspaceId, it.direction, it.label, it.amount_minor, it.currency_code, it.expected_date, it.recurrence, it.certainty, it.category, t, t)
    .run()
  return c.json({ item: { id, ...it, created_at: t, updated_at: t } }, 201)
})
me.patch('/cash-flow-items/:id', async (c) => {
  const u = c.get('user')
  const cur = await c.env.DB.prepare('SELECT * FROM cash_flow_items WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), u.workspaceId).first<any>()
  if (!cur) throw notFound()
  const it = parseItem(await readJson(c.req.raw, 4096), true, cur)
  await c.env.DB.prepare('UPDATE cash_flow_items SET direction = ?, label = ?, amount_minor = ?, currency_code = ?, expected_date = ?, recurrence = ?, certainty = ?, category = ?, updated_at = ? WHERE id = ? AND workspace_id = ?')
    .bind(it.direction, it.label, it.amount_minor, it.currency_code, it.expected_date, it.recurrence, it.certainty, it.category, nowIso(), cur.id, u.workspaceId)
    .run()
  return c.json({ item: { ...cur, ...it } })
})
me.delete('/cash-flow-items/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM cash_flow_items WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), c.get('user').workspaceId).run()
  if (!r.meta.changes) throw notFound()
  return c.json({ ok: true })
})

async function loadItems(c: any): Promise<CashItem[]> {
  const rows = await c.env.DB.prepare('SELECT id, direction, label, amount_minor, currency_code, expected_date, recurrence, certainty FROM cash_flow_items WHERE workspace_id = ?').bind(c.get('user').workspaceId).all()
  return rows.results || []
}
function parsePeriod(b: Record<string, unknown>) {
  const from = isoDate(b.from, 'from', true)!
  const to = isoDate(b.to, 'to', true)!
  if (from > to) throw bad('Tanggal awal harus sebelum tanggal akhir.')
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000
  if (days > 366 * 2) throw bad('Periode maksimal 2 tahun.')
  return { from, to }
}
function parseOpening(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v
  throw bad('Saldo awal harus bilangan bulat atau kosong (belum diketahui).', { field: 'opening_balance_minor' })
}

me.post('/cash-flow/summary', async (c) => {
  const b = await readJson(c.req.raw, 4096)
  try {
    return c.json({ summary: summarize(await loadItems(c), parsePeriod(b), parseOpening(b.opening_balance_minor)) })
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw bad((e as Error).message)
  }
})

// Scenario preview: pure computation, never persists or modifies source rows.
me.post('/scenarios/preview', async (c) => {
  const b = await readJson(c.req.raw, 16384)
  const period = parsePeriod(b)
  const opening = parseOpening(b.opening_balance_minor)
  const raw = Array.isArray(b.changes) ? b.changes : []
  if (raw.length > 30) throw bad('Maksimal 30 perubahan skenario.')
  const changes: ScenarioChange[] = raw.map((ch: any, i: number) => {
    const op = oneOf(ch?.op, ['adjust', 'remove', 'add'] as const, `changes[${i}].op`)
    if (op === 'adjust') return { op, item_id: str(ch.item_id, { field: 'item_id', required: true, max: 60 })!, amount_minor: intMinor(ch.amount_minor, 'amount_minor') }
    if (op === 'remove') return { op, item_id: str(ch.item_id, { field: 'item_id', required: true, max: 60 })! }
    const it = parseItem(ch.item || {})
    return { op, item: { direction: it.direction, label: it.label, amount_minor: it.amount_minor, currency_code: it.currency_code, expected_date: it.expected_date, recurrence: it.recurrence, certainty: it.certainty } }
  })
  const baselineItems = await loadItems(c)
  try {
    const baseline = summarize(baselineItems, period, opening)
    const scenario = summarize(applyScenario(baselineItems, changes), period, opening)
    return c.json({ baseline, scenario, difference_net_minor: scenario.net_movement_minor - baseline.net_movement_minor, persisted: false, label: 'Perkiraan skenario — bukan prediksi. Data asli tidak berubah.' })
  } catch (e) {
    throw bad((e as Error).message)
  }
})

// --- agentic tasks ---
me.post('/tasks', async (c) => {
  const u = c.get('user')
  const b = await readJson(c.req.raw, 8192)
  const objective = str(b.objective, { field: 'objective', required: true, min: 3, max: 500 })!
  const route = routeObjective(objective, typeof b.area === 'string' ? b.area : null)
  if (!(await consume(c.env.DB, u.id, u.planId, 'agent_runs'))) throw new ApiError(402, 'QUOTA_EXCEEDED', 'Kuota tugas bulan ini habis. Rencana dan katalog tetap bisa digunakan.')
  const inputs: Record<string, unknown> = {}
  if (b.use_ai === true) inputs.__use_ai = true
  if (b.use_search === true) inputs.__use_search = true
  if (b.skip_questions === true) inputs.__skip_questions = true
  const t = await createTask(c.env.DB, u, route.area, route.agent, objective, inputs)
  await audit(c, 'task.create', 'ok', 'task', t.id)
  if (t.status === 'awaiting_user_input') return c.json({ task: { id: t.id, status: t.status, area: route.area, agent: route.agent, route_reason: route.reason }, questions: t.questions }, 201)
  const result = await runTask(c.env, u, t.id)
  return c.json({ task: { id: t.id, status: 'completed', area: route.area, agent: route.agent, route_reason: route.reason }, result }, 201)
})
me.post('/tasks/:id/answers', async (c) => {
  const u = c.get('user')
  const task = await c.env.DB.prepare('SELECT * FROM agent_tasks WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), u.workspaceId).first<any>()
  if (!task) throw notFound()
  if (task.status !== 'awaiting_user_input') throw new ApiError(409, 'INVALID_TRANSITION', 'Tugas tidak menunggu jawaban.')
  const b = await readJson(c.req.raw, 8192)
  const answers = (b.answers && typeof b.answers === 'object' ? b.answers : {}) as Record<string, unknown>
  const inputs = safeJsonParse<Record<string, unknown>>(task.inputs_json, {})
  for (const q of AGENTS[task.agent as keyof typeof AGENTS].clarifying_questions) {
    const v = answers[q.key]
    if (v === undefined || v === null || v === '') continue
    const s = str(v, { field: q.key, max: 300 })
    if (q.kind === 'choice' && s && !q.choices!.includes(s)) throw bad(`Pilihan untuk "${q.key}" tidak valid.`)
    inputs[q.key] = s
  }
  if (b.use_ai !== undefined) inputs.__use_ai = bool(b.use_ai, 'use_ai')
  if (b.use_search !== undefined) inputs.__use_search = bool(b.use_search, 'use_search')
  await c.env.DB.prepare('UPDATE agent_tasks SET inputs_json = ?, updated_at = ? WHERE id = ? AND workspace_id = ?').bind(JSON.stringify(inputs), nowIso(), task.id, u.workspaceId).run()
  const result = await runTask(c.env, u, task.id)
  return c.json({ task: { id: task.id, status: 'completed', area: task.area, agent: task.agent }, result })
})
me.get('/tasks', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, area, agent, objective, status, error_code, created_at, updated_at FROM agent_tasks WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 50').bind(c.get('user').workspaceId).all()
  return c.json({ tasks: rows.results })
})
me.get('/tasks/:id', async (c) => {
  const u = c.get('user')
  const t = await c.env.DB.prepare('SELECT * FROM agent_tasks WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), u.workspaceId).first<any>()
  if (!t) throw notFound()
  const ev = await c.env.DB.prepare('SELECT event_type, tool, outcome, latency_ms, occurred_at FROM task_events WHERE task_id = ? ORDER BY occurred_at ASC').bind(t.id).all()
  const inputs = safeJsonParse<Record<string, unknown>>(t.inputs_json, {})
  const agent = AGENTS[t.agent as keyof typeof AGENTS]
  return c.json({
    task: { id: t.id, area: t.area, agent: t.agent, objective: t.objective, status: t.status, error_code: t.error_code, created_at: t.created_at, updated_at: t.updated_at },
    result: safeJsonParse(t.result_json, null),
    questions: t.status === 'awaiting_user_input' ? agent.clarifying_questions.filter((q) => inputs[q.key] === undefined) : [],
    events: ev.results,
  })
})
me.post('/tasks/:id/cancel', async (c) => {
  await cancelTask(c.env.DB, c.get('user'), c.req.param('id'))
  return c.json({ ok: true, status: 'cancelled' })
})
me.delete('/tasks/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM agent_tasks WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), c.get('user').workspaceId).run()
  if (!r.meta.changes) throw notFound()
  return c.json({ ok: true })
})

// --- plans & progress ---
async function planOwned(c: any, id: string) {
  const p = await c.env.DB.prepare('SELECT * FROM plans WHERE id = ? AND workspace_id = ?').bind(id, c.get('user').workspaceId).first()
  if (!p) throw notFound()
  return p as any
}
me.get('/plans', async (c) => {
  const u = c.get('user')
  const rows = await c.env.DB.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM plan_steps s WHERE s.plan_id = p.id) AS step_count,
            (SELECT COUNT(*) FROM plan_steps s WHERE s.plan_id = p.id AND s.done = 1) AS done_count
     FROM plans p WHERE p.workspace_id = ? ORDER BY p.updated_at DESC`,
  )
    .bind(u.workspaceId)
    .all()
  return c.json({ plans: rows.results })
})
me.post('/plans', async (c) => {
  const u = c.get('user')
  const b = await readJson(c.req.raw, 32768)
  const active = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM plans WHERE workspace_id = ? AND status = 'active'").bind(u.workspaceId).first<{ n: number }>()
  if ((active?.n ?? 0) >= getPlan(u.planId).quotas.active_plans) throw new ApiError(402, 'QUOTA_EXCEEDED', 'Batas rencana aktif pada paket Anda tercapai. Arsipkan rencana lama atau tunggu paket berbayar dibuka.')
  const title = str(b.title, { field: 'title', required: true, max: 120 })!
  const area = oneOf(b.area, AREAS, 'area', 'life')
  let taskId: string | null = null
  if (b.task_id) {
    const t = await c.env.DB.prepare('SELECT id FROM agent_tasks WHERE id = ? AND workspace_id = ?').bind(String(b.task_id), u.workspaceId).first<{ id: string }>()
    if (!t) throw notFound()
    taskId = t.id
  }
  const steps = Array.isArray(b.steps) ? b.steps : []
  if (steps.length > 30) throw bad('Maksimal 30 langkah per rencana.')
  const id = newId('pln')
  const t = nowIso()
  const stmts = [
    c.env.DB.prepare('INSERT INTO plans (id, workspace_id, task_id, title, area, status, review_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      id, u.workspaceId, taskId, title, area, 'active', isoDate(b.review_date, 'review_date'), str(b.notes, { field: 'notes', max: 2000 }), t, t,
    ),
  ]
  steps.forEach((s: any, i: number) => {
    stmts.push(
      c.env.DB.prepare('INSERT INTO plan_steps (id, plan_id, position, title, detail, origin, done, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)').bind(
        newId('stp'), id, i, str(s?.title, { field: `steps[${i}].title`, required: true, max: 300 }), str(s?.detail, { field: 'detail', max: 1000 }), oneOf(s?.origin, ['user', 'suggestion', 'source'] as const, 'origin', 'user'), isoDate(s?.due_date, 'due_date'), t, t,
      ),
    )
  })
  await c.env.DB.batch(stmts)
  await audit(c, 'plan.create', 'ok', 'plan', id)
  return c.json({ plan: { id, title, area, status: 'active', task_id: taskId } }, 201)
})
me.get('/plans/:id', async (c) => {
  const p = await planOwned(c, c.req.param('id'))
  const steps = await c.env.DB.prepare('SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY position ASC').bind(p.id).all()
  return c.json({ plan: p, steps: steps.results })
})
me.patch('/plans/:id', async (c) => {
  const p = await planOwned(c, c.req.param('id'))
  const b = await readJson(c.req.raw, 8192)
  const n = {
    title: b.title !== undefined ? str(b.title, { field: 'title', required: true, max: 120 }) : p.title,
    status: b.status !== undefined ? oneOf(b.status, ['active', 'archived', 'done'] as const, 'status') : p.status,
    review_date: b.review_date !== undefined ? isoDate(b.review_date, 'review_date') : p.review_date,
    notes: b.notes !== undefined ? str(b.notes, { field: 'notes', max: 2000 }) : p.notes,
  }
  await c.env.DB.prepare('UPDATE plans SET title = ?, status = ?, review_date = ?, notes = ?, updated_at = ? WHERE id = ? AND workspace_id = ?').bind(n.title, n.status, n.review_date, n.notes, nowIso(), p.id, c.get('user').workspaceId).run()
  return c.json({ plan: { ...p, ...n } })
})
me.delete('/plans/:id', async (c) => {
  const p = await planOwned(c, c.req.param('id'))
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM plan_steps WHERE plan_id = ?').bind(p.id), c.env.DB.prepare('DELETE FROM plans WHERE id = ? AND workspace_id = ?').bind(p.id, c.get('user').workspaceId)])
  await audit(c, 'plan.delete', 'ok', 'plan', p.id)
  return c.json({ ok: true })
})
me.post('/plans/:id/steps', async (c) => {
  const p = await planOwned(c, c.req.param('id'))
  const b = await readJson(c.req.raw, 4096)
  const cnt = await c.env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS mx FROM plan_steps WHERE plan_id = ?').bind(p.id).first<{ n: number; mx: number }>()
  if ((cnt?.n ?? 0) >= 30) throw bad('Maksimal 30 langkah per rencana.')
  const id = newId('stp')
  const t = nowIso()
  const step = { id, plan_id: p.id, position: (cnt?.mx ?? -1) + 1, title: str(b.title, { field: 'title', required: true, max: 300 }), detail: str(b.detail, { field: 'detail', max: 1000 }), origin: 'user', done: 0, due_date: isoDate(b.due_date, 'due_date') }
  await c.env.DB.prepare('INSERT INTO plan_steps (id, plan_id, position, title, detail, origin, done, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, p.id, step.position, step.title, step.detail, 'user', 0, step.due_date, t, t).run()
  await c.env.DB.prepare('UPDATE plans SET updated_at = ? WHERE id = ?').bind(t, p.id).run()
  return c.json({ step }, 201)
})
me.patch('/plans/:id/steps/:stepId', async (c) => {
  const p = await planOwned(c, c.req.param('id'))
  const s = await c.env.DB.prepare('SELECT * FROM plan_steps WHERE id = ? AND plan_id = ?').bind(c.req.param('stepId'), p.id).first<any>()
  if (!s) throw notFound()
  const b = await readJson(c.req.raw, 4096)
  const n = {
    title: b.title !== undefined ? str(b.title, { field: 'title', required: true, max: 300 }) : s.title,
    detail: b.detail !== undefined ? str(b.detail, { field: 'detail', max: 1000 }) : s.detail,
    done: b.done !== undefined ? (bool(b.done, 'done') ? 1 : 0) : s.done,
    due_date: b.due_date !== undefined ? isoDate(b.due_date, 'due_date') : s.due_date,
  }
  const t = nowIso()
  await c.env.DB.prepare('UPDATE plan_steps SET title = ?, detail = ?, done = ?, due_date = ?, updated_at = ? WHERE id = ? AND plan_id = ?').bind(n.title, n.detail, n.done, n.due_date, t, s.id, p.id).run()
  await c.env.DB.prepare('UPDATE plans SET updated_at = ? WHERE id = ?').bind(t, p.id).run()
  return c.json({ step: { ...s, ...n } })
})
me.delete('/plans/:id/steps/:stepId', async (c) => {
  const p = await planOwned(c, c.req.param('id'))
  const r = await c.env.DB.prepare('DELETE FROM plan_steps WHERE id = ? AND plan_id = ?').bind(c.req.param('stepId'), p.id).run()
  if (!r.meta.changes) throw notFound()
  return c.json({ ok: true })
})

// --- billing (user side; OFF by default) ---
me.get('/billing', async (c) => {
  const u = c.get('user')
  const subs = await c.env.DB.prepare('SELECT id, plan_id, status, provider, current_period_end, cancel_at_period_end FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').bind(u.id).all()
  return c.json({ plan_id: u.planId, billing_enabled: billingEnabled(c.env), subscriptions: subs.results })
})
me.post('/billing/checkout', async (c) => {
  const u = c.get('user')
  await rateLimit(c.env.DB, `checkout:${u.id}`, 5, 3600)
  const b = await readJson(c.req.raw, 1024)
  const planId = oneOf(b.plan_id, ['plus_monthly', 'plus_annual'] as const, 'plan_id') as PlanId
  const s = await createCheckout(c.env, u.id, planId)
  await audit(c, 'billing.checkout', 'created', 'payment', s.payment_id)
  return c.json({ checkout: s, note: 'Status pembayaran hanya dikonfirmasi oleh webhook terverifikasi, bukan oleh pengalihan browser.' }, 201)
})
me.post('/billing/cancel', async (c) => {
  const u = c.get('user')
  const r = await c.env.DB.prepare("UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE user_id = ? AND status = 'active'").bind(nowIso(), u.id).run()
  await audit(c, 'billing.cancel', r.meta.changes ? 'ok' : 'none', 'subscription')
  return c.json({ ok: true, changed: r.meta.changes })
})

// --- export & delete ---
me.post('/export', async (c) => {
  const u = c.get('user')
  await rateLimit(c.env.DB, `export:${u.id}`, 10, 3600)
  const db = c.env.DB
  const q = (sql: string, ...a: unknown[]) => db.prepare(sql).bind(...a).all().then((r) => r.results)
  const data = {
    export_format: 'sandar-export-v1',
    exported_at: nowIso(),
    notice: 'Ekspor ini berisi data yang Anda simpan di SANDAR. Simpan dengan aman.',
    account: { plan_id: u.planId },
    goals: await q('SELECT * FROM goals WHERE workspace_id = ?', u.workspaceId),
    cash_flow_items: await q('SELECT * FROM cash_flow_items WHERE workspace_id = ?', u.workspaceId),
    plans: await q('SELECT * FROM plans WHERE workspace_id = ?', u.workspaceId),
    plan_steps: await q('SELECT s.* FROM plan_steps s JOIN plans p ON p.id = s.plan_id WHERE p.workspace_id = ?', u.workspaceId),
    tasks: await q('SELECT id, area, agent, objective, status, result_json, created_at FROM agent_tasks WHERE workspace_id = ?', u.workspaceId),
    consents: await q('SELECT purpose_code, notice_version, granted_at, revoked_at FROM consent_records WHERE user_id = ?', u.id),
    subscriptions: await q('SELECT plan_id, status, provider, current_period_end FROM subscriptions WHERE user_id = ?', u.id),
  }
  await audit(c, 'workspace.export', 'ok', 'workspace', u.workspaceId)
  return c.json(data, 200, { 'content-disposition': `attachment; filename="sandar-export-${new Date().toISOString().slice(0, 10)}.json"` })
})
me.delete('/workspace', async (c) => {
  const u = c.get('user')
  await rateLimit(c.env.DB, `delete:${u.id}`, 5, 3600)
  const b = await readJson(c.req.raw, 1024)
  if (b.confirm !== 'HAPUS') throw bad('Ketik HAPUS untuk mengonfirmasi penghapusan.')
  const db = c.env.DB
  const w = u.workspaceId
  await db.batch([
    db.prepare('DELETE FROM plan_steps WHERE plan_id IN (SELECT id FROM plans WHERE workspace_id = ?)').bind(w),
    db.prepare('DELETE FROM plans WHERE workspace_id = ?').bind(w),
    db.prepare('DELETE FROM task_events WHERE task_id IN (SELECT id FROM agent_tasks WHERE workspace_id = ?)').bind(w),
    db.prepare('DELETE FROM agent_tasks WHERE workspace_id = ?').bind(w),
    db.prepare('DELETE FROM cash_flow_items WHERE workspace_id = ?').bind(w),
    db.prepare('DELETE FROM goals WHERE workspace_id = ?').bind(w),
    db.prepare('DELETE FROM consent_records WHERE user_id = ?').bind(u.id),
    db.prepare('DELETE FROM usage_counters WHERE user_id = ?').bind(u.id),
  ])
  const left = await db.prepare(
    `SELECT (SELECT COUNT(*) FROM goals WHERE workspace_id = ?) + (SELECT COUNT(*) FROM cash_flow_items WHERE workspace_id = ?) +
            (SELECT COUNT(*) FROM plans WHERE workspace_id = ?) + (SELECT COUNT(*) FROM agent_tasks WHERE workspace_id = ?) AS n`,
  )
    .bind(w, w, w, w)
    .first<{ n: number }>()
  await audit(c, 'workspace.delete', left?.n === 0 ? 'verified' : 'partial', 'workspace', w)
  return c.json({ ok: left?.n === 0, remaining_records: left?.n ?? null, note: 'Data ruang kerja dihapus. Catatan audit minimal (tanpa isi data) disimpan untuk keamanan. Cadangan database mengikuti jendela retensi penyedia.' })
})

// --- curator/admin (separate privileged role) ---
me.get('/admin/providers', requireAdmin, async (c) => c.json({ providers: await providerStatus(c.env) }))
me.post('/admin/catalogue', requireAdmin, async (c) => {
  const b = await readJson(c.req.raw, 16384)
  const url = str(b.official_source_url, { field: 'official_source_url', required: true, max: 400 })!
  if (!/^https:\/\//.test(url)) throw bad('URL sumber harus https.')
  const status = oneOf(b.verification_status, ['unverified', 'checked'] as const, 'verification_status', 'unverified')
  const lastVerified = isoDate(b.last_verified_at, 'last_verified_at')
  if (status === 'checked' && !lastVerified) throw bad('Status "checked" memerlukan tanggal verifikasi terakhir.')
  const id = newId('rl')
  const t = nowIso()
  await c.env.DB.prepare(
    'INSERT INTO resource_listings (id, kind, title, summary, topic_codes, publisher_name, publisher_type, jurisdiction_code, coverage_text, official_source_url, source_title, retrieved_at, last_verified_at, review_interval_days, verification_status, caveats, is_sample, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
  )
    .bind(
      id,
      oneOf(b.kind, ['resource', 'opportunity'] as const, 'kind', 'resource'),
      str(b.title, { field: 'title', required: true, max: 160 }),
      str(b.summary, { field: 'summary', required: true, max: 600 }),
      str(b.topic_codes, { field: 'topic_codes', required: true, max: 200 }),
      str(b.publisher_name, { field: 'publisher_name', required: true, max: 160 }),
      str(b.publisher_type, { field: 'publisher_type', required: true, max: 40 }),
      str(b.jurisdiction_code, { field: 'jurisdiction_code', required: true, max: 10 }),
      str(b.coverage_text, { field: 'coverage_text', max: 200 }),
      url,
      str(b.source_title, { field: 'source_title', max: 200 }),
      isoDate(b.retrieved_at, 'retrieved_at') || t.slice(0, 10),
      lastVerified,
      typeof b.review_interval_days === 'number' ? Math.min(365, Math.max(7, Math.floor(b.review_interval_days))) : 90,
      status,
      str(b.caveats, { field: 'caveats', max: 600 }),
      t,
      t,
    )
    .run()
  await audit(c, 'catalogue.create', 'ok', 'listing', id)
  return c.json({ id }, 201)
})
me.post('/admin/extract', requireAdmin, async (c) => {
  const b = await readJson(c.req.raw, 2048)
  const r = await firecrawlScrape(c.env, String(b.url || ''))
  await audit(c, 'curator.extract', r.ok ? 'ok' : r.code, 'url')
  return c.json(r.ok ? { ok: true, ...r.data, latency_ms: r.latency_ms, note: 'Kutipan untuk ditinjau kurator; bukan bukti verifikasi.' } : { ok: false, code: r.code })
})

api.route('/api/v1/me', me)

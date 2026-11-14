// SANDAR Core orchestrator: plans, routes, runs bounded tools, records events,
// consolidates a structured result. No background loops; user-triggered only.
import type { Bindings, AuthUser } from '../types'
import { AGENTS, type AgentId, type Area, type TaskStatus, canTransition } from './registry'
import { ApiError, newId, nowIso, safeJsonParse, todayIso } from '../lib/util'
import { hasConsent } from '../lib/ops'
import { consume } from '../domain/entitlements'
import { summarize, formatIdr, type CashItem } from '../domain/finance'
import { groqComplete, groqModel, tavilySearch, redact } from '../providers'
import { listingFreshness } from '../domain/catalogue'

export type ResultItem = { text: string; kind: 'user_fact' | 'calculation' | 'source_fact' | 'suggestion' | 'ai_suggestion'; source_url?: string; checked_at?: string | null; status?: string }
export type AgentResult = {
  agent: AgentId
  agent_name: string
  summary: string
  user_facts: ResultItem[]
  calculations: ResultItem[]
  sources: ResultItem[]
  web_leads: { title: string; url: string; domain: string; official_hint: boolean; note: string }[]
  options: ResultItem[]
  next_steps: ResultItem[]
  assumptions: string[]
  uncertainties: string[]
  ai: { used: boolean; provider?: string; model?: string; reason_not_used?: string }
  search: { used: boolean; reason_not_used?: string }
  disclaimer: string
  generated_at: string
}

const DISCLAIMER = 'Hasil ini adalah saran yang dapat Anda ubah, bukan keputusan resmi atau nasihat profesional. Periksa kembali informasi pada situs penerbit resmi. SANDAR tidak mengirim, membayar, atau mendaftar apa pun atas nama Anda.'

async function setStatus(db: D1Database, taskId: string, from: TaskStatus, to: TaskStatus, extra: { result?: unknown; error?: string } = {}) {
  if (!canTransition(from, to)) throw new ApiError(409, 'INVALID_TRANSITION', `Transisi ${from} → ${to} tidak diizinkan.`)
  await db
    .prepare('UPDATE agent_tasks SET status = ?, result_json = COALESCE(?, result_json), error_code = COALESCE(?, error_code), updated_at = ? WHERE id = ? AND status = ?')
    .bind(to, extra.result ? JSON.stringify(extra.result) : null, extra.error ?? null, nowIso(), taskId, from)
    .run()
  await event(db, taskId, `status:${to}`)
}

export async function event(db: D1Database, taskId: string, type: string, tool?: string, outcome?: string, latency?: number) {
  await db.prepare('INSERT INTO task_events (id, task_id, event_type, tool, outcome, latency_ms, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('tev'), taskId, type, tool ?? null, outcome ?? null, latency ?? null, nowIso()).run()
}

export async function createTask(db: D1Database, user: AuthUser, area: Area, agent: AgentId, objective: string, inputs: Record<string, unknown>) {
  const id = newId('tsk')
  const t = nowIso()
  await db
    .prepare('INSERT INTO agent_tasks (id, workspace_id, area, agent, objective, status, inputs_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.workspaceId, area, agent, objective, 'queued', JSON.stringify(inputs), t, t)
    .run()
  await event(db, id, 'status:queued')
  await setStatus(db, id, 'queued', 'planning')
  const contract = AGENTS[agent]
  const answered = Object.keys(inputs)
  const pending = contract.clarifying_questions.filter((q) => !answered.includes(q.key))
  if (pending.length && !inputs.__skip_questions) {
    await setStatus(db, id, 'planning', 'awaiting_user_input')
    return { id, status: 'awaiting_user_input' as TaskStatus, questions: pending }
  }
  return { id, status: 'planning' as TaskStatus, questions: [] }
}

function horizonToPeriod(h: unknown): { from: string; to: string; label: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const first = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  if (h === '3 bulan ke depan') return { from: todayIso(), to: new Date(Date.UTC(y, m + 3, now.getUTCDate())).toISOString().slice(0, 10), label: '3 bulan ke depan' }
  return { from: first, to: new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10), label: 'bulan ini' }
}

const TOPIC_HINTS: Record<Area, string[]> = {
  finance: ['keuangan', 'perlindungan-konsumen', 'literasi'],
  resources: ['jaminan-sosial', 'perlindungan-kerja', 'kesehatan', 'komunitas'],
  opportunity: ['pekerjaan', 'lowongan', 'pelatihan', 'digital'],
  life: [],
  resilience: ['jaminan-sosial', 'keuangan'],
}

async function catalogueMatches(db: D1Database, area: Area, objective: string, kind?: 'resource' | 'opportunity') {
  const rows = await db.prepare("SELECT * FROM resource_listings WHERE verification_status != 'withdrawn' ORDER BY is_sample ASC, updated_at DESC LIMIT 100").all<any>()
  const words = objective.toLowerCase().split(/[^a-z0-9à-ÿ-]+/).filter((w) => w.length > 3)
  const hints = TOPIC_HINTS[area]
  return (rows.results || [])
    .filter((r) => !kind || r.kind === kind)
    .map((r) => {
      const hay = `${r.title} ${r.summary} ${r.topic_codes}`.toLowerCase()
      let score = hints.some((h) => r.topic_codes.includes(h)) ? 2 : 0
      for (const w of words) if (hay.includes(w)) score += 1
      return { r, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ r }) => {
      const f = listingFreshness(r)
      return { text: `${r.title} — ${r.publisher_name}${r.is_sample ? ' (DATA CONTOH)' : ''}`, kind: 'source_fact' as const, source_url: r.official_source_url, checked_at: r.last_verified_at, status: f.label }
    })
}

function baseSteps(area: Area, objective: string, inputs: Record<string, unknown>): { options: ResultItem[]; steps: ResultItem[]; assumptions: string[] } {
  const s = (text: string): ResultItem => ({ text, kind: 'suggestion' })
  const horizon = typeof inputs.horizon === 'string' ? inputs.horizon : 'Belum tahu'
  switch (area) {
    case 'finance':
      return {
        options: [s('Lihat ringkasan arus uang dari angka yang sudah Anda masukkan.'), s('Coba skenario "bagaimana jika" tanpa mengubah data asli.'), s('Tandai angka yang masih perkiraan agar mudah diperiksa ulang.')],
        steps: [s('Tambahkan atau periksa pemasukan dan pengeluaran rutin di Ruang Saya → Arus Uang.'), s('Isi saldo awal bila diketahui; bila tidak, biarkan "belum diketahui".'), s('Bandingkan satu skenario sederhana, misalnya mengurangi satu pengeluaran tidak rutin.'), s('Periksa ketentuan kontrak/tagihan langsung kepada penyedia layanan bila ada yang belum jelas.')],
        assumptions: ['Perhitungan memakai angka yang Anda masukkan saja.', `Rentang waktu: ${horizon}.`],
      }
    case 'resources':
      return {
        options: [s('Buka sumber resmi di bawah dan baca syarat langsung dari penerbit.'), s('Catat dokumen yang mungkin diminta setelah membaca situs resmi.'), s('Hubungi kanal resmi penerbit bila informasi belum jelas.')],
        steps: [s('Pilih satu sumber resmi yang paling relevan dengan tujuan Anda.'), s('Baca bagian syarat dan prosedur di situs penerbit; jangan mengandalkan ringkasan pihak ketiga.'), s('Simpan tanggal Anda memeriksa sumber tersebut.'), s('Waspadai pihak yang meminta biaya untuk "membantu mendaftar".')],
        assumptions: ['SANDAR tidak mengetahui situasi Anda dan tidak menentukan kelayakan.'],
      }
    case 'opportunity':
      return {
        options: [s('Jelajahi jalur belajar singkat yang sesuai waktu Anda.'), s('Petakan keterampilan yang sudah dimiliki dan yang ingin dikembangkan.'), s('Gunakan portal lowongan resmi dan periksa keaslian lowongan.')],
        steps: [s('Tulis 3 keterampilan yang sudah Anda miliki (untuk diri sendiri, tidak dibagikan).'), s('Pilih satu keterampilan untuk dipelajari dalam 2–4 minggu.'), s(`Sisihkan waktu belajar sesuai kemampuan (${typeof inputs.time_per_week === 'string' ? inputs.time_per_week : 'sesuaikan'}).`), s('Jangan membayar pihak yang menjanjikan pekerjaan.')],
        assumptions: ['Peluang dan ketersediaan dapat berubah; periksa di sumber penerbit.'],
      }
    case 'resilience':
      return {
        options: [s('Susun daftar kontak dan dokumen penting yang Anda simpan sendiri.'), s('Tentukan satu tonggak kecil untuk 30 hari ke depan.'), s('Jadwalkan peninjauan rencana secara rutin.')],
        steps: [s('Tulis satu situasi "bagaimana jika" yang ingin Anda siapkan.'), s('Tentukan 2–3 langkah persiapan yang realistis.'), s(`Atur peninjauan ${typeof inputs.review_every === 'string' ? inputs.review_every.toLowerCase() : 'berkala'}.`), s('Tinjau dan ubah rencana kapan saja.')],
        assumptions: ['Ini rencana persiapan, bukan prediksi.'],
      }
    default:
      return {
        options: [s('Uraikan tujuan menjadi hasil yang ingin dicapai dan batasannya.'), s('Bandingkan 2–3 pilihan berdasarkan waktu, biaya, dan tenaga.'), s('Pilih satu langkah kecil yang bisa dimulai minggu ini.')],
        steps: [s(`Tuliskan hasil yang Anda inginkan untuk: "${objective.slice(0, 80)}".`), s('Catat apa yang sudah Anda ketahui dan apa yang belum.'), s('Pilih satu langkah pertama dan tentukan tanggal tinjau.'), s('Tinjau kembali setelah langkah pertama selesai.')],
        assumptions: [`Rentang waktu: ${horizon}.`],
      }
  }
}

export async function runTask(env: Bindings, user: AuthUser, taskId: string): Promise<AgentResult> {
  const db = env.DB
  const task = await db.prepare('SELECT * FROM agent_tasks WHERE id = ? AND workspace_id = ?').bind(taskId, user.workspaceId).first<any>()
  if (!task) throw new ApiError(404, 'NOT_FOUND', 'Tugas tidak ditemukan.')
  if (!['planning', 'awaiting_user_input'].includes(task.status)) throw new ApiError(409, 'INVALID_TRANSITION', 'Tugas ini tidak dapat dijalankan lagi.')
  await setStatus(db, taskId, task.status, 'running')
  const inputs = safeJsonParse<Record<string, unknown>>(task.inputs_json, {})
  const area = task.area as Area
  const agent = AGENTS[task.agent as AgentId]
  try {
    const base = baseSteps(area, task.objective, inputs)
    const result: AgentResult = {
      agent: agent.id,
      agent_name: agent.name,
      summary: `${agent.name}: ${agent.purpose}`,
      user_facts: [{ text: `Tujuan yang Anda tulis: "${task.objective}"`, kind: 'user_fact' }],
      calculations: [],
      sources: [],
      web_leads: [],
      options: base.options,
      next_steps: base.steps,
      assumptions: base.assumptions,
      uncertainties: [],
      ai: { used: false },
      search: { used: false },
      disclaimer: DISCLAIMER,
      generated_at: nowIso(),
    }
    for (const [k, v] of Object.entries(inputs)) if (!k.startsWith('__') && typeof v === 'string' && v) result.user_facts.push({ text: `${k}: ${v.slice(0, 200)}`, kind: 'user_fact' })

    // Tool: deterministic cash-flow calculator (finance)
    if (area === 'finance') {
      const t0 = Date.now()
      const rows = await db.prepare('SELECT id, direction, label, amount_minor, currency_code, expected_date, recurrence, certainty FROM cash_flow_items WHERE workspace_id = ?').bind(user.workspaceId).all<CashItem>()
      const items = rows.results || []
      const p = horizonToPeriod(inputs.horizon)
      if (!items.length) {
        result.uncertainties.push('Belum ada entri arus uang, sehingga belum ada perhitungan. Tambahkan di Ruang Saya → Arus Uang.')
      } else {
        try {
          const sm = summarize(items, { from: p.from, to: p.to }, null)
          result.calculations.push(
            { text: `Total pemasukan (${p.label}): ${formatIdr(sm.total_inflow_minor)}`, kind: 'calculation' },
            { text: `Total pengeluaran (${p.label}): ${formatIdr(sm.total_outflow_minor)}`, kind: 'calculation' },
            { text: `Pergerakan bersih: ${formatIdr(sm.net_movement_minor)}`, kind: 'calculation' },
          )
          result.assumptions.push(...sm.assumptions)
          result.uncertainties.push(...sm.warnings)
        } catch (e) {
          result.uncertainties.push((e as Error).message)
        }
      }
      await event(db, taskId, 'tool', 'cashflow_calculator', 'ok', Date.now() - t0)
    }

    // Tool: public catalogue lookup (read-only)
    if (area !== 'life') {
      const t0 = Date.now()
      result.sources = await catalogueMatches(db, area, task.objective, area === 'opportunity' ? 'opportunity' : undefined)
      if (!result.sources.length) result.uncertainties.push('Belum ada entri katalog yang cocok. Coba kata lain atau jelajahi katalog.')
      await event(db, taskId, 'tool', 'catalogue_lookup', `matches:${result.sources.length}`, Date.now() - t0)
    }

    // Tool: optional external search (consent + quota + configured). Leads only.
    if (['resources', 'opportunity'].includes(area) && inputs.__use_search === true) {
      if (!(await hasConsent(db, user.id, 'external_search'))) result.search.reason_not_used = 'Persetujuan pencarian eksternal belum diberikan.'
      else if (!(await consume(db, user.id, user.planId, 'external_search'))) result.search.reason_not_used = 'Kuota pencarian bulan ini habis. Katalog tetap tersedia.'
      else {
        const q = `${redact(task.objective)} site resmi Indonesia`
        const r = await tavilySearch(env, q, 5)
        await event(db, taskId, 'tool', 'tavily_search', r.ok ? `hits:${r.data.length}` : r.code, r.latency_ms)
        if (r.ok) {
          result.search.used = true
          result.web_leads = r.data.map((h) => ({ ...h, note: h.official_hint ? 'Domain tampak resmi — tetap buka dan periksa langsung.' : 'Bukan domain resmi — perlakukan sebagai petunjuk saja.' }))
          result.uncertainties.push('Hasil pencarian web adalah petunjuk, bukan fakta terverifikasi.')
        } else result.search.reason_not_used = r.code === 'DISABLED' ? 'Penyedia pencarian belum dikonfigurasi.' : 'Pencarian sedang tidak tersedia; gunakan katalog.'
      }
    }

    // Tool: optional AI rewrite (consent + quota + configured). Minimized context only.
    if (inputs.__use_ai === true) {
      if (!(await hasConsent(db, user.id, 'ai_processing'))) result.ai.reason_not_used = 'Persetujuan pemrosesan AI belum diberikan.'
      else if (!(await consume(db, user.id, user.planId, 'ai_assist'))) result.ai.reason_not_used = 'Kuota bantuan AI bulan ini habis. Rencana dasar tetap tersedia.'
      else {
        const system =
          'Anda asisten perencanaan SANDAR. Jawab dalam Bahasa Indonesia yang tenang dan netral. Berikan 3-5 langkah praktis bernomor, singkat. ' +
          'DILARANG: menentukan kelayakan program, menjanjikan hasil, memberi nasihat hukum/medis/pajak/investasi/kredit, menyarankan berutang, menyebut program atau kontak yang tidak pasti ada, menebak keadaan pribadi pengguna. ' +
          'Jika perlu fakta resmi, sarankan pengguna memeriksa situs penerbit resmi.'
        const userMsg = `Area: ${agent.name}. Tujuan (sudah disamarkan): ${redact(task.objective)}`
        const r = await groqComplete(env, system, userMsg, 450)
        await event(db, taskId, 'tool', 'groq_rewrite', r.ok ? 'ok' : r.code, r.latency_ms)
        if (r.ok && r.data.trim()) {
          result.ai = { used: true, provider: 'groq', model: groqModel(env) }
          const lines = r.data.split('\n').map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim()).filter((l) => l.length > 8).slice(0, 5)
          for (const l of lines) result.options.push({ text: l.slice(0, 300), kind: 'ai_suggestion' })
        } else result.ai.reason_not_used = r.ok ? 'AI tidak memberi jawaban.' : r.code === 'DISABLED' ? 'Penyedia AI belum dikonfigurasi.' : r.code === 'CAP_REACHED' ? 'Batas harian AI tercapai.' : 'AI sedang tidak tersedia; rencana dasar tetap ditampilkan.'
      }
    }

    await setStatus(db, taskId, 'running', 'completed', { result })
    return result
  } catch (e) {
    await setStatus(db, taskId, 'running', 'failed', { error: e instanceof ApiError ? e.code : 'AGENT_ERROR' }).catch(() => {})
    throw e instanceof ApiError ? e : new ApiError(500, 'AGENT_ERROR', 'Tugas gagal diproses. Data Anda tidak berubah.')
  }
}

export async function cancelTask(db: D1Database, user: AuthUser, taskId: string) {
  const task = await db.prepare('SELECT status FROM agent_tasks WHERE id = ? AND workspace_id = ?').bind(taskId, user.workspaceId).first<{ status: TaskStatus }>()
  if (!task) throw new ApiError(404, 'NOT_FOUND', 'Tugas tidak ditemukan.')
  await setStatus(db, taskId, task.status, 'cancelled')
}

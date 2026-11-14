// Specialist agent contracts (docs/35). Each agent is a bounded workflow, not
// a free-running model. Deterministic logic produces the baseline result;
// optional AI only rewrites/expands suggestions and is always labelled.

export type Area = 'life' | 'finance' | 'resources' | 'opportunity' | 'resilience'
export type AgentId = 'life_navigation' | 'financial_navigation' | 'public_resource' | 'opportunity_skills' | 'resilience_planning'

export type TaskStatus = 'queued' | 'planning' | 'awaiting_user_input' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'

export const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ['planning', 'cancelled'],
  planning: ['awaiting_user_input', 'running', 'failed', 'cancelled'],
  awaiting_user_input: ['running', 'cancelled'],
  running: ['awaiting_approval', 'completed', 'failed', 'cancelled'],
  awaiting_approval: ['completed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
}

export function canTransition(from: TaskStatus, to: TaskStatus) {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export type AgentContract = {
  id: AgentId
  area: Area
  name: string
  purpose: string
  allowed_tools: string[]
  prohibited: string[]
  timeout_ms: number
  clarifying_questions: { key: string; question: string; optional: boolean; kind: 'text' | 'choice'; choices?: string[] }[]
}

const COMMON_PROHIBITED = [
  'Mengirim lamaran, pembayaran, pesan, atau data ke pihak lain',
  'Menentukan kelayakan program sebagai fakta',
  'Memprofilkan orang yang disebut namanya',
  'Diagnosis kesehatan / nasihat hukum, pajak, investasi, atau kredit',
  'Menjanjikan hasil',
]

export const AGENTS: Record<AgentId, AgentContract> = {
  life_navigation: {
    id: 'life_navigation',
    area: 'life',
    name: 'Navigasi Hidup',
    purpose: 'Menstrukturkan situasi, memperjelas tujuan, membandingkan pilihan, dan menyusun rencana yang bisa ditinjau.',
    allowed_tools: ['deterministic_planner', 'groq_rewrite (opsional, dengan persetujuan)'],
    prohibited: COMMON_PROHIBITED,
    timeout_ms: 20000,
    clarifying_questions: [
      { key: 'horizon', question: 'Dalam rentang waktu berapa Anda ingin melihat kemajuan?', optional: true, kind: 'choice', choices: ['1 minggu', '1 bulan', '3 bulan', 'Belum tahu'] },
      { key: 'constraint', question: 'Apa batasan utama yang perlu diperhitungkan? (boleh dilewati)', optional: true, kind: 'text' },
    ],
  },
  financial_navigation: {
    id: 'financial_navigation',
    area: 'finance',
    name: 'Navigasi Keuangan',
    purpose: 'Membantu memahami arus uang dari angka yang Anda masukkan dan menemukan sumber resmi terkait keuangan. Bukan penasihat keuangan.',
    allowed_tools: ['cashflow_calculator (deterministik)', 'catalogue_lookup', 'groq_rewrite (opsional)'],
    prohibited: [...COMMON_PROHIBITED, 'Menyarankan meminjam, berinvestasi, menjual aset, atau melewatkan pembayaran'],
    timeout_ms: 20000,
    clarifying_questions: [
      { key: 'horizon', question: 'Periode mana yang ingin dilihat?', optional: true, kind: 'choice', choices: ['Bulan ini', '3 bulan ke depan', 'Belum tahu'] },
    ],
  },
  public_resource: {
    id: 'public_resource',
    area: 'resources',
    name: 'Sumber & Layanan Publik',
    purpose: 'Mencari dan menata sumber resmi beserta asal-usul, tanggal pemeriksaan, dan ketidakpastiannya.',
    allowed_tools: ['catalogue_lookup', 'tavily_search (opsional, dengan persetujuan; hasil = petunjuk)'],
    prohibited: COMMON_PROHIBITED,
    timeout_ms: 20000,
    clarifying_questions: [
      { key: 'jurisdiction', question: 'Cakupan wilayah yang relevan? (boleh dilewati)', optional: true, kind: 'choice', choices: ['Nasional', 'Provinsi saya', 'Belum tahu'] },
    ],
  },
  opportunity_skills: {
    id: 'opportunity_skills',
    area: 'opportunity',
    name: 'Peluang & Keterampilan',
    purpose: 'Menjelajahi jalur belajar, keterampilan, dan peluang kerja dengan langkah praktis dari informasi publik.',
    allowed_tools: ['catalogue_lookup', 'tavily_search (opsional)', 'groq_rewrite (opsional)'],
    prohibited: [...COMMON_PROHIBITED, 'Mengirim lamaran kerja'],
    timeout_ms: 20000,
    clarifying_questions: [
      { key: 'time_per_week', question: 'Berapa waktu belajar per minggu yang realistis?', optional: true, kind: 'choice', choices: ['< 2 jam', '2–5 jam', '> 5 jam', 'Belum tahu'] },
    ],
  },
  resilience_planning: {
    id: 'resilience_planning',
    area: 'resilience',
    name: 'Ketahanan & Rencana ke Depan',
    purpose: 'Menyusun rencana cadangan, tonggak, dan rutinitas peninjauan — bukan prediksi atau diagnosis.',
    allowed_tools: ['deterministic_planner', 'groq_rewrite (opsional)'],
    prohibited: COMMON_PROHIBITED,
    timeout_ms: 20000,
    clarifying_questions: [
      { key: 'review_every', question: 'Seberapa sering Anda ingin meninjau rencana ini?', optional: true, kind: 'choice', choices: ['Mingguan', 'Bulanan', 'Belum tahu'] },
    ],
  },
}

export const AREA_TO_AGENT: Record<Area, AgentId> = {
  life: 'life_navigation',
  finance: 'financial_navigation',
  resources: 'public_resource',
  opportunity: 'opportunity_skills',
  resilience: 'resilience_planning',
}

const KEYWORDS: [Area, RegExp][] = [
  ['finance', /\b(uang|keuangan|anggaran|budget|gaji|tagihan|utang|hutang|cicilan|pengeluaran|pemasukan|tabung|biaya)\b/i],
  ['resources', /\b(bantuan|bansos|layanan|program|pemerintah|bpjs|subsidi|resmi|dinas|kelurahan|jaminan)\b/i],
  ['opportunity', /\b(kerja|pekerjaan|lowongan|karier|karir|kursus|belajar|pelatihan|skill|keterampilan|usaha|bisnis)\b/i],
  ['resilience', /\b(darurat|cadangan|rencana ke depan|masa depan|siaga|jaga-jaga|risiko|persiapan|pensiun)\b/i],
]

/** Deterministic router: explicit area wins; otherwise keyword match; otherwise life navigation. */
export function routeObjective(objective: string, explicit?: string | null): { area: Area; agent: AgentId; reason: string } {
  if (explicit && explicit in AREA_TO_AGENT) return { area: explicit as Area, agent: AREA_TO_AGENT[explicit as Area], reason: 'Dipilih oleh pengguna' }
  for (const [area, re] of KEYWORDS) if (re.test(objective)) return { area, agent: AREA_TO_AGENT[area], reason: 'Dicocokkan dari kata kunci tujuan' }
  return { area: 'life', agent: 'life_navigation', reason: 'Bawaan: navigasi hidup umum' }
}

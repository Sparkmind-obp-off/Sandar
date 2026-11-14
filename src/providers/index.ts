// Server-side BYOK provider adapters (docs/32, docs/35).
// - Keys only from Cloudflare secrets (env). Never logged, never returned.
// - Timeouts, one bounded retry on 5xx/network, global daily caps stored in D1.
// - Disabled/unconfigured state is a normal, supported state.
// - Callers MUST only pass non-sensitive, minimized text (enforced by redact()).
import type { Bindings } from '../types'
import { todayIso } from '../lib/util'

export type ProviderName = 'groq' | 'tavily' | 'firecrawl'
export type ProviderResult<T> = { ok: true; data: T; latency_ms: number } | { ok: false; code: 'DISABLED' | 'CAP_REACHED' | 'UPSTREAM_ERROR' | 'TIMEOUT' | 'BLOCKED_INPUT'; latency_ms: number; status?: number }

const DEFAULT_CAPS: Record<ProviderName, number> = { groq: 200, tavily: 30, firecrawl: 10 }

export function providerCaps(env: Bindings): Record<ProviderName, number> {
  const caps = { ...DEFAULT_CAPS }
  for (const part of (env.PROVIDER_DAILY_CAPS || '').split(',')) {
    const [k, v] = part.split('=').map((s) => s?.trim())
    if (k && k in caps && /^\d+$/.test(v || '')) caps[k as ProviderName] = Number(v)
  }
  return caps
}

export function isConfigured(env: Bindings, p: ProviderName): boolean {
  if (p === 'groq') return !!env.GROQ_API_KEY
  if (p === 'tavily') return !!env.TAVILY_API_KEY
  return !!env.FIRECRAWL_API_KEY
}

export async function providerStatus(env: Bindings) {
  const caps = providerCaps(env)
  const rows = await env.DB.prepare('SELECT provider, count FROM provider_usage WHERE period_day = ?').bind(todayIso()).all<{ provider: string; count: number }>()
  const used: Record<string, number> = {}
  for (const r of rows.results || []) used[r.provider] = r.count
  return (['groq', 'tavily', 'firecrawl'] as ProviderName[]).map((p) => ({
    provider: p,
    configured: isConfigured(env, p),
    daily_cap: caps[p],
    used_today: used[p] || 0,
    state: !isConfigured(env, p) ? 'disabled' : (used[p] || 0) >= caps[p] ? 'cap_reached' : 'available',
    model: p === 'groq' ? env.GROQ_MODEL || 'llama-3.1-8b-instant' : undefined,
  }))
}

async function reserve(env: Bindings, p: ProviderName): Promise<boolean> {
  const cap = providerCaps(env)[p]
  if (cap <= 0) return false
  const row = await env.DB.prepare(
    `INSERT INTO provider_usage (provider, period_day, count) VALUES (?, ?, 1)
     ON CONFLICT(provider, period_day) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count`,
  )
    .bind(p, todayIso(), cap)
    .first<{ count: number }>()
  return !!row
}

/** Strip obvious personal identifiers before any third-party call. */
export function redact(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b\d{16}\b/g, '[nomor-identitas]') // NIK-like
    .replace(/(\+?62|0)8\d{7,12}\b/g, '[telepon]')
    .replace(/\b\d{10,}\b/g, '[nomor]')
    .replace(/\b(?:Rp\.?\s?)?\d{1,3}(?:[.,]\d{3})+(?:,\d+)?\b/gi, '[jumlah]')
    .slice(0, 600)
}

async function call(url: string, init: RequestInit, timeoutMs: number): Promise<{ res?: Response; timeout?: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      if (res.status >= 500 && attempt === 0) continue
      return { res }
    } catch (e) {
      if (attempt === 1) return { timeout: (e as Error)?.name === 'TimeoutError' }
    }
  }
  return {}
}

async function guarded<T>(env: Bindings, p: ProviderName, fn: () => Promise<{ res?: Response; timeout?: boolean }>, parse: (j: any) => T): Promise<ProviderResult<T>> {
  const t0 = Date.now()
  if (!isConfigured(env, p)) return { ok: false, code: 'DISABLED', latency_ms: 0 }
  if (!(await reserve(env, p))) return { ok: false, code: 'CAP_REACHED', latency_ms: 0 }
  const { res, timeout } = await fn()
  const latency_ms = Date.now() - t0
  if (!res) return { ok: false, code: timeout ? 'TIMEOUT' : 'UPSTREAM_ERROR', latency_ms }
  if (!res.ok) return { ok: false, code: 'UPSTREAM_ERROR', latency_ms, status: res.status }
  try {
    return { ok: true, data: parse(await res.json()), latency_ms }
  } catch {
    return { ok: false, code: 'UPSTREAM_ERROR', latency_ms }
  }
}

// ---- Groq (OpenAI-compatible chat completions) -------------------------------
export async function groqComplete(env: Bindings, system: string, user: string, maxTokens = 500): Promise<ProviderResult<string>> {
  return guarded(
    env,
    'groq',
    () =>
      call(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model: env.GROQ_MODEL || 'llama-3.1-8b-instant',
            temperature: 0.3,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        },
        15000,
      ),
    (j) => String(j?.choices?.[0]?.message?.content || '').slice(0, 4000),
  )
}

// ---- Tavily (public web search; results are leads, not facts) ---------------
export type SearchHit = { title: string; url: string; snippet: string; domain: string; official_hint: boolean }
const OFFICIAL_TLDS = [/\.go\.id$/i, /\.gov$/i, /\.gov\.[a-z]{2}$/i, /\.ac\.id$/i, /ojk\.go\.id$/i]
export const isOfficialDomain = (d: string) => OFFICIAL_TLDS.some((r) => r.test(d))

export async function tavilySearch(env: Bindings, query: string, maxResults = 5): Promise<ProviderResult<SearchHit[]>> {
  const q = redact(query)
  if (q.length < 3) return { ok: false, code: 'BLOCKED_INPUT', latency_ms: 0 }
  return guarded(
    env,
    'tavily',
    () =>
      call(
        'https://api.tavily.com/search',
        {
          method: 'POST',
          headers: { authorization: `Bearer ${env.TAVILY_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ query: q, search_depth: 'basic', max_results: Math.min(maxResults, 8), include_answer: false, include_raw_content: false }),
        },
        12000,
      ),
    (j) =>
      ((j?.results as any[]) || []).slice(0, 8).map((r) => {
        let domain = ''
        try {
          domain = new URL(r.url).hostname
        } catch {}
        return { title: String(r.title || '').slice(0, 200), url: String(r.url || ''), snippet: String(r.content || '').slice(0, 300), domain, official_hint: isOfficialDomain(domain) }
      }).filter((h) => /^https:\/\//.test(h.url)),
  )
}

// ---- Firecrawl (single public page → markdown excerpt; curator use) ---------
export async function firecrawlScrape(env: Bindings, url: string): Promise<ProviderResult<{ title: string; excerpt: string; url: string }>> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { ok: false, code: 'BLOCKED_INPUT', latency_ms: 0 }
  }
  if (u.protocol !== 'https:' || /(^|\.)(localhost|internal|local)$/i.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.username || u.password)
    return { ok: false, code: 'BLOCKED_INPUT', latency_ms: 0 }
  return guarded(
    env,
    'firecrawl',
    () =>
      call(
        'https://api.firecrawl.dev/v1/scrape',
        {
          method: 'POST',
          headers: { authorization: `Bearer ${env.FIRECRAWL_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ url: u.toString(), formats: ['markdown'], onlyMainContent: true, timeout: 20000 }),
        },
        25000,
      ),
    (j) => ({ title: String(j?.data?.metadata?.title || '').slice(0, 200), excerpt: String(j?.data?.markdown || '').slice(0, 1500), url: u.toString() }),
  )
}

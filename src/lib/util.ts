export const nowIso = () => new Date().toISOString()
export const todayIso = () => new Date().toISOString().slice(0, 10)
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message)
  }
}

export const bad = (message: string, details?: unknown) => new ApiError(400, 'VALIDATION_ERROR', message, details)
export const notFound = () => new ApiError(404, 'NOT_FOUND', 'Data tidak ditemukan.')

type StrOpts = { required?: boolean; min?: number; max?: number; field: string }
export function str(v: unknown, o: StrOpts): string | null {
  if (v === undefined || v === null || v === '') {
    if (o.required) throw bad(`Kolom "${o.field}" wajib diisi.`, { field: o.field })
    return null
  }
  if (typeof v !== 'string') throw bad(`Kolom "${o.field}" harus berupa teks.`, { field: o.field })
  const s = v.trim()
  if (o.required && !s) throw bad(`Kolom "${o.field}" wajib diisi.`, { field: o.field })
  if (o.min && s.length < o.min) throw bad(`Kolom "${o.field}" minimal ${o.min} karakter.`, { field: o.field })
  if (s.length > (o.max ?? 500)) throw bad(`Kolom "${o.field}" maksimal ${o.max ?? 500} karakter.`, { field: o.field })
  return s || null
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string, fallback?: T): T {
  if ((v === undefined || v === null || v === '') && fallback !== undefined) return fallback
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw bad(`Nilai "${field}" tidak valid.`, { field, allowed })
  return v as T
}

export function intMinor(v: unknown, field: string, max = 1_000_000_000_000): number {
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) v = Number(v.trim())
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw bad(`"${field}" harus bilangan bulat (tanpa desimal).`, { field })
  if (v < 0) throw bad(`"${field}" tidak boleh negatif. Gunakan arah masuk/keluar.`, { field })
  if (v > max) throw bad(`"${field}" terlalu besar.`, { field })
  return v
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export function isoDate(v: unknown, field: string, required = false): string | null {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`Tanggal "${field}" wajib diisi.`, { field })
    return null
  }
  if (typeof v !== 'string' || !DATE_RE.test(v)) throw bad(`Tanggal "${field}" harus berformat YYYY-MM-DD.`, { field })
  const d = new Date(v + 'T00:00:00Z')
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw bad(`Tanggal "${field}" tidak valid.`, { field })
  return v
}

export function bool(v: unknown, field: string, fallback = false): boolean {
  if (v === undefined || v === null) return fallback
  if (typeof v !== 'boolean') throw bad(`"${field}" harus true/false.`, { field })
  return v
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const len = Number(req.headers.get('content-length') || '0')
  if (len > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Data terlalu besar.')
  const text = await req.text()
  if (text.length > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Data terlalu besar.')
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not object')
    return parsed as Record<string, unknown>
  } catch {
    throw bad('Format JSON tidak valid.')
  }
}

export function safeJsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function sha(alg: 'SHA-256' | 'SHA-512', input: string): Promise<string> {
  const buf = await crypto.subtle.digest(alg, new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

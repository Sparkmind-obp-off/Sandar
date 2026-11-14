// Public catalogue freshness rules (docs/17). A stale listing is never shown as "verified current".
export type Freshness = { status: string; label: string; is_current: boolean; days_since_check: number | null }

export function listingFreshness(r: { verification_status: string; last_verified_at: string | null; review_interval_days: number }, now = new Date()): Freshness {
  if (r.verification_status === 'withdrawn') return { status: 'withdrawn', label: 'Ditarik', is_current: false, days_since_check: null }
  if (r.verification_status === 'needs_review') return { status: 'needs_review', label: 'Perlu diperiksa', is_current: false, days_since_check: null }
  if (!r.last_verified_at || r.verification_status === 'unverified') return { status: 'unverified', label: 'Belum diverifikasi SANDAR', is_current: false, days_since_check: null }
  const days = Math.floor((now.getTime() - new Date(r.last_verified_at + (r.last_verified_at.length === 10 ? 'T00:00:00Z' : '')).getTime()) / 86400000)
  if (r.verification_status === 'stale' || days > r.review_interval_days) return { status: 'stale', label: 'Informasi lama', is_current: false, days_since_check: days }
  return { status: 'checked', label: 'Terverifikasi', is_current: true, days_since_check: days }
}

export function presentListing(r: any) {
  const f = listingFreshness(r)
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    topics: String(r.topic_codes || '').split(',').filter(Boolean),
    publisher: { name: r.publisher_name, type: r.publisher_type },
    jurisdiction: r.jurisdiction_code,
    coverage: r.coverage_text,
    official_source_url: r.official_source_url,
    source_title: r.source_title,
    retrieved_at: r.retrieved_at,
    last_verified_at: r.last_verified_at,
    review_interval_days: r.review_interval_days,
    verification: f,
    caveats: r.caveats,
    is_sample: !!r.is_sample,
  }
}

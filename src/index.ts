// SANDAR — Agentic Life Navigation & Resilience OS
// Cloudflare Pages entry: security headers, versioned API, SPA shell.
import { Hono } from 'hono'
import type { AppEnv } from './types'
import { api } from './app'
import { issuerFromPublishableKey } from './lib/auth'

const app = new Hono<AppEnv>()

app.use('*', async (c, next) => {
  await next()
  const clerk = issuerFromPublishableKey(c.env.CLERK_PUBLISHABLE_KEY) || ''
  const h = c.res.headers
  h.set('x-content-type-options', 'nosniff')
  h.set('referrer-policy', 'strict-origin-when-cross-origin')
  h.set('x-frame-options', 'DENY')
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()')
  h.set('strict-transport-security', 'max-age=31536000; includeSubDomains')
  h.set('cross-origin-opener-policy', 'same-origin-allow-popups')
  if ((h.get('content-type') || '').includes('text/html')) {
    h.set(
      'content-security-policy',
      [
        "default-src 'self'",
        `script-src 'self' ${clerk} https://cdn.protect.clerk.com https://challenges.cloudflare.com`,
        `connect-src 'self' ${clerk} https://cdn.protect.clerk.com https://*.client.protect.clerk.com https://*.client.protect.clerk.com:* https://api.clerk.com https://clerk-telemetry.com`,
        "img-src 'self' data: https://img.clerk.com",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        'frame-src https://challenges.cloudflare.com',
        "worker-src 'self' blob:",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
      ].join('; '),
    )
  }
})

app.route('/', api)

const shell = (clerkPk: string | undefined) => `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SANDAR — Navigasi Hidup & Ketahanan</title>
<meta name="description" content="SANDAR membantu Anda melihat langkah berikutnya dengan lebih jelas — tanpa mengambil kendali dari Anda.">
<meta name="theme-color" content="#0f5c4d">
<meta name="sandar-clerk-pk" content="${(clerkPk || '').replace(/[^A-Za-z0-9_$-]/g, '')}">
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/static/manifest.webmanifest">
<link rel="stylesheet" href="/static/styles.css?v=clerk6-20261115a">
</head>
<body>
<a class="skip-link" href="#main">Lewati ke konten utama</a>
<div id="root"><noscript><p style="padding:1rem">SANDAR memerlukan JavaScript. Katalog sumber publik juga tersedia melalui <a href="/api/v1/catalogue/resources">API publik</a>.</p></noscript></div>
<div id="live" class="sr-only" aria-live="polite" aria-atomic="true"></div>
<script src="/static/core.js?v=clerk6-20261115a" defer></script>
<script src="/static/ruang.js?v=clerk6-20261115a" defer></script>
<script src="/static/app.js?v=clerk6-20261115a" defer></script>
</body>
</html>`

// Unknown API paths must return a JSON 404, never the SPA shell.
app.all('/api/*', (c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Rute API tidak ditemukan.' } }, 404, { 'cache-control': 'no-store' }),
)

app.get('*', (c) => {
  return c.html(shell(c.env.CLERK_PUBLISHABLE_KEY), 200, { 'cache-control': 'no-cache' })
})

export default app

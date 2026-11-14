import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:3000'
const pages = ['/', '/mulai?area=finance', '/jelajahi', '/coba/arus-uang', '/harga', '/masuk']
const widths = [360, 390, 430, 768, 1024, 1440]
const b = await chromium.launch(); const issues = []
for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage()
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error' && !/cloudflareinsights|favicon/.test(m.text())) errs.push(m.text().slice(0,150)) })
  for (const path of pages) {
    await p.goto(base + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(700)
    const r = await p.evaluate(() => {
      const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth
      const small = [...document.querySelectorAll('a,button,input,select,textarea')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && r.height < 24 && getComputedStyle(e).display !== 'none' && !e.closest('footer') && !e.classList.contains('skip-link') }).length
      return { overflow: sw > cw + 1, sw, cw, small, h1: document.querySelector('h1')?.textContent?.slice(0,40) }
    })
    if (r.overflow || r.small) issues.push(`${w}px ${path}: overflow=${r.overflow}(${r.sw}/${r.cw}) smallTargets=${r.small}`)
    if (w === 390 || w === 1440) await p.screenshot({ path: `shot-${w}-${path.replace(/[\/?=&]/g,'_') || 'home'}.png`, fullPage: path === '/' })
  }
  if (w <= 430) { // mobile menu check
    await p.goto(base + '/', { waitUntil: 'networkidle' })
    const vis = await p.isVisible('.menu-toggle'); await p.click('.menu-toggle'); await p.waitForTimeout(200)
    const open = await p.isVisible('#nav-list a[href="/jelajahi"]'); await p.keyboard.press('Escape'); await p.waitForTimeout(150)
    const closed = !(await p.isVisible('#nav-list a[href="/jelajahi"]'))
    if (!(vis && open && closed)) issues.push(`${w}px menu toggle vis=${vis} open=${open} closedEsc=${closed}`)
  }
  if (errs.length) issues.push(`${w}px errors: ${[...new Set(errs)].join(' | ')}`)
  await ctx.close()
}
console.log(issues.length ? issues.join('\n') : 'NO RESPONSIVE ISSUES at ' + widths.join(','))
await b.close()

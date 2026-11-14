import { chromium } from 'playwright'
const b = await chromium.launch()
const out = {}
for (const [name, w, h] of [['mobile', 390, 844], ['desktop', 1440, 900]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  const errs = []
  p.on('console', (m) => { if (m.type() === 'error' && !/cloudflareinsights/.test(m.text())) errs.push(m.text().slice(0, 200)) })
  await p.goto('https://sandar.biz.id/masuk', { waitUntil: 'networkidle', timeout: 45000 })
  await p.waitForTimeout(6000)
  const txt = await p.locator('#clerk-mount').innerText().catch(() => '')
  out[name] = { outdated: /outdated/i.test(txt), hasGoogle: /Google/i.test(txt), clerkVersion: await p.evaluate(() => window.Clerk?.version), loaded: await p.evaluate(() => !!window.Clerk?.loaded), errs }
  await p.screenshot({ path: `signin-${name}.png`, fullPage: false })
  await p.close()
}
console.log(JSON.stringify(out, null, 1))
await b.close()

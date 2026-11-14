import { chromium } from 'playwright'
const SK = process.env.SK, ORIGIN = 'https://sandar.biz.id'
const bapi = async (m, p, body) => { const r = await fetch('https://api.clerk.com/v1' + p, { method: m, headers: { authorization: 'Bearer ' + SK, 'content-type': 'application/json', 'user-agent': 'sandar-e2e' }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json().catch(() => ({}))] }
const R = []; const ok = (c, m) => { R.push((c ? 'PASS ' : 'FAIL ') + m); console.log((c ? 'PASS ' : 'FAIL ') + m) }
const users = []
const b = await chromium.launch()
async function login(tag) {
  const [s, u] = await bapi('POST', '/users', { username: 'e2e' + tag + Date.now().toString(36), password: crypto.randomUUID() + 'Aa1!', skip_password_checks: true, external_id: 'sandar-e2e-' + tag })
  if (s >= 300) throw new Error('create user ' + s + JSON.stringify(u))
  users.push(u.id)
  const [s2, t] = await bapi('POST', '/sign_in_tokens', { user_id: u.id, expires_in_seconds: 300 })
  if (s2 >= 300) throw new Error('ticket ' + s2 + JSON.stringify(t))
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const p = await ctx.newPage()
  await p.goto(ORIGIN + '/', { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.Clerk && window.Clerk.loaded, null, { timeout: 30000 })
  const res = await p.evaluate(async (ticket) => {
    const si = await window.Clerk.client.signIn.create({ strategy: 'ticket', ticket })
    await window.Clerk.setActive({ session: si.createdSessionId })
    return { status: si.status, user: window.Clerk.user?.id }
  }, t.token)
  return { p, ctx, uid: u.id, res }
}
const api = (p, path, opts = {}) => p.evaluate(async ([path, opts]) => {
  const tok = opts.token === undefined ? await window.Clerk.session?.getToken() : opts.token
  const r = await fetch('/api/v1' + path, { method: opts.method || 'GET', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined })
  return { status: r.status, json: await r.json().catch(() => null), tok }
}, [path, opts])
try {
  const A = await login('a'), B = await login('b')
  ok(A.res.status === 'complete' && A.res.user === A.uid, 'real Clerk Production browser session established on sandar.biz.id (user A)')
  // UI: protected page renders for signed-in user
  await A.p.goto(ORIGIN + '/ruang', { waitUntil: 'networkidle' }); await A.p.waitForTimeout(3000)
  ok(/Pusat Komando/.test(await A.p.locator('#view').innerText()), 'Ruang Saya (protected UI) renders after sign-in')
  const w = await api(A.p, '/me/workspace')
  ok(w.status === 200 && w.json.plan.id === 'free', 'backend verified real session; workspace resolved for authenticated user')
  const claims = JSON.parse(Buffer.from(w.tok.split('.')[1], 'base64url').toString())
  ok(claims.sub === A.uid && claims.iss === 'https://clerk.sandar.biz.id', `token sub matches Clerk user, iss=${claims.iss}, azp=${claims.azp}`)
  // consent + agent journey through UI
  for (const pc of ['workspace_storage', 'ai_processing', 'external_search']) await api(A.p, '/me/consents', { method: 'POST', body: { purpose_code: pc } })
  await A.p.goto(ORIGIN + '/ruang/tugas/baru?area=opportunity', { waitUntil: 'networkidle' }); await A.p.waitForTimeout(2500)
  await A.p.fill('#objective', 'Saya ingin belajar keterampilan digital dasar untuk mencari kerja')
  await A.p.check('[data-optin=ai_processing]'); await A.p.check('[data-optin=external_search]')
  await A.p.click('#task-form button[type=submit]')
  await A.p.waitForURL(/\/ruang\/tugas\/tsk_/, { timeout: 30000 }); await A.p.waitForTimeout(2500)
  if (await A.p.locator('#q-form').count()) { await A.p.click('#q-form button[type=submit]'); await A.p.waitForTimeout(12000) }
  const resultTxt = await A.p.locator('#view').innerText()
  ok(/Pilih langkah untuk rencana Anda/.test(resultTxt), 'agent result rendered (structured layers)')
  ok(/Saran AI/.test(resultTxt), 'Groq AI suggestions present and labelled "Saran AI" (live provider)')
  ok(/Petunjuk dari web/.test(resultTxt), 'Tavily web leads present and labelled unverified (live provider)')
  const taskId = A.p.url().split('/').pop()
  const td = await api(A.p, '/me/tasks/' + taskId)
  console.log('task tool events:', td.json.events.filter(e => e.tool).map(e => `${e.tool}:${e.outcome}:${e.latency_ms}ms`).join(' | '))
  await A.p.click('#save-form button[type=submit]'); await A.p.waitForURL(/\/ruang\/rencana\/pln_/, { timeout: 20000 }); await A.p.waitForTimeout(2000)
  const planId = A.p.url().split('/').pop()
  ok(planId.startsWith('pln_'), 'plan saved from selected suggestions')
  await A.p.locator('[data-step]').first().check(); await A.p.waitForTimeout(2500)
  const pl = await api(A.p, '/me/plans')
  ok(pl.json.plans[0].done_count === 1, 'progress tracked (1 step done)')
  // isolation
  await api(B.p, '/me/consents', { method: 'POST', body: { purpose_code: 'workspace_storage' } })
  ok((await api(B.p, '/me/plans/' + planId)).status === 404, 'user B cannot read user A plan')
  ok((await api(B.p, '/me/tasks/' + taskId)).status === 404, 'user B cannot read user A task')
  ok((await api(B.p, '/me/plans/' + planId, { method: 'DELETE' })).status === 404, 'user B cannot delete user A plan')
  ok(!JSON.stringify((await api(B.p, '/me/export', { method: 'POST' })).json).includes(planId), 'user B export excludes user A data')
  // forged / tampered
  const t = w.tok
  ok((await api(A.p, '/me/workspace', { token: t.slice(0, -6) + 'AAAAAA' })).status === 401, 'tampered real token rejected')
  ok((await api(A.p, '/me/workspace', { token: '' })).status === 401, 'anonymous request rejected')
  // cleanup data, logout
  await api(A.p, '/me/workspace', { method: 'DELETE', body: { confirm: 'HAPUS' } }); await api(B.p, '/me/workspace', { method: 'DELETE', body: { confirm: 'HAPUS' } })
  const lastTok = (await api(A.p, '/me/workspace')).tok
  await A.p.goto(ORIGIN + '/ruang', { waitUntil: 'networkidle' }); await A.p.waitForTimeout(2000)
  if (await A.p.isVisible('.menu-toggle')) { await A.p.click('.menu-toggle'); await A.p.waitForTimeout(300) } ok(await A.p.isVisible('#btn-signout'), 'logout button reachable via mobile menu'); await A.p.click('#btn-signout'); await A.p.waitForTimeout(3000)
  ok(await A.p.evaluate(() => !window.Clerk.user && !window.Clerk.session), 'logout cleared Clerk session in browser')
  await A.p.goto(ORIGIN + '/ruang', { waitUntil: 'networkidle' }); await A.p.waitForTimeout(3000)
  ok(/Masuk untuk membuka Ruang Saya/.test(await A.p.locator('#view').innerText()), 'protected UI requires sign-in after logout')
  const exp = JSON.parse(Buffer.from(lastTok.split('.')[1], 'base64url').toString()).exp
  const wait = Math.max(0, exp * 1000 - Date.now() + 12000); console.log('waiting', Math.round(wait / 1000), 's for last pre-logout token to expire')
  await new Promise(r => setTimeout(r, wait))
  ok((await api(A.p, '/me/workspace', { token: lastTok })).status === 401, 'pre-logout token rejected after expiry')
  await A.p.screenshot({ path: 'after-logout.png' })
} catch (e) { console.log('ERROR', e.message) }
finally {
  for (const id of users) console.log('cleanup clerk user', id, (await bapi('DELETE', '/users/' + id))[0])
  await b.close()
  console.log(`SUMMARY ${R.filter(x => x.startsWith('PASS')).length}/${R.length} passed`)
  console.log('SUBJECTS ' + users.join(','))
}

/* SANDAR — Ruang Saya (private workspace). Requires authentication. */
(function () {
  'use strict'
  const S = window.SANDAR
  const { esc, idr, fmtDate, announce, $, $$ } = S

  const AREAS = { life: 'Navigasi Hidup', finance: 'Keuangan', resources: 'Sumber & Layanan Publik', opportunity: 'Peluang & Keterampilan', resilience: 'Ketahanan & Rencana ke Depan' }
  const STATUS = { queued: 'Antre', planning: 'Merencanakan', awaiting_user_input: 'Menunggu jawaban Anda', running: 'Berjalan', awaiting_approval: 'Menunggu persetujuan', completed: 'Selesai', failed: 'Gagal', cancelled: 'Dibatalkan' }
  const PURPOSES = {
    workspace_storage: ['Penyimpanan Ruang Saya', 'Menyimpan tujuan, entri arus uang, tugas, dan rencana Anda di database SANDAR (Cloudflare D1) agar bisa dibuka lagi. Diperlukan untuk menyimpan.'],
    ai_processing: ['Bantuan AI (opsional)', 'Teks tujuan yang telah disamarkan dikirim ke Groq untuk menyusun saran tambahan. Data arus uang tidak dikirim. Hasil diberi label "Saran AI".'],
    external_search: ['Pencarian web (opsional)', 'Teks tujuan yang telah disamarkan dikirim ke Tavily untuk mencari petunjuk sumber publik. Hasil adalah petunjuk, bukan fakta terverifikasi.'],
  }

  async function ws(force) {
    if (!S.state.workspace || force) S.state.workspace = await S.api('/me/workspace')
    return S.state.workspace
  }

  const shell = (active, inner) => `
    <div class="sidebar-layout">
      <aside class="sidebar" aria-label="Menu Ruang Saya"><nav><ul>
        ${[['/ruang', 'Pusat Komando', '◎'], ['/ruang/tugas/baru', 'Tujuan baru', '＋'], ['/ruang/rencana', 'Rencana Saya', '☰'], ['/ruang/arus-uang', 'Arus Uang', '↗'], ['/ruang/tujuan', 'Tujuan', '◇'], ['/ruang/riwayat', 'Riwayat tugas', '↺'], ['/pengaturan', 'Privasi & data', '⚙']]
          .map(([h, l, i]) => `<li><a href="${h}" data-link ${active === h ? 'aria-current="page"' : ''}><span class="nav-ico" aria-hidden="true">${i}</span>${l}</a></li>`).join('')}
      </ul></nav></aside>
      <section>${inner}</section>
    </div>`

  function consentGate(w, purpose, nextPath) {
    if (w.consents.includes(purpose)) return ''
    const [t, d] = PURPOSES[purpose]
    return `<div class="notice warn" role="note"><strong>${esc(t)} belum disetujui.</strong> ${esc(d)}
      <div class="row" style="margin-top:.5rem"><button class="btn" type="button" data-consent="${purpose}" data-next="${esc(nextPath || location.pathname)}">Setujui penyimpanan</button><a class="btn secondary" href="/pengaturan" data-link>Pelajari di Pengaturan</a></div></div>`
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-consent]')
    if (!b) return
    b.disabled = true
    try { await S.api('/me/consents', { method: 'POST', body: { purpose_code: b.dataset.consent } }); await ws(true); announce('Persetujuan disimpan'); S.go(b.dataset.next || location.pathname) } catch (err) { b.insertAdjacentHTML('afterend', S.errorBox(err)); b.disabled = false }
  })

  // ---------- Command center ----------
  S.route('/ruang', async (v) => {
    S.setTitle('Pusat Komando')
    v.innerHTML = '<p class="loading">Memuat Ruang Saya…</p>'
    const w = await ws(true)
    const plans = w.consents.includes('workspace_storage') ? (await S.api('/me/plans')).plans : []
    const active = plans.filter((p) => p.status === 'active')
    const next = active.find((p) => p.step_count > p.done_count)
    const u = w.usage
    const meter = (k, label) => { const used = u.used[k], lim = u.limits[k], pct = lim ? Math.min(100, Math.round((used / lim) * 100)) : 100; return `<div class="meter"><div class="row small"><span>${label}</span><span class="muted" style="margin-left:auto">${used} / ${lim}</span></div><div class="progress" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${lim}" aria-valuenow="${used}"><span style="width:${pct}%"></span></div></div>` }
    const hour = new Date().getHours()
    const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam'
    v.innerHTML = shell('/ruang', `
      <div class="ws-head"><div><span class="eyebrow">${greet}</span><h1>Pusat Komando</h1></div>
        <div class="row"><span class="badge neutral">Paket ${esc(w.plan.name)}</span><a class="btn small-btn" href="/ruang/tugas/baru" data-link>＋ Tujuan baru</a></div></div>
      ${consentGate(w, 'workspace_storage', '/ruang')}
      <div class="dash-grid">
        <section class="card next-card" aria-labelledby="nx-h"><span class="eyebrow" style="color:rgba(255,255,255,.7)">Langkah berikutnya</span>
          ${next ? `<h2 id="nx-h" style="margin:.4rem 0 .3rem;font-size:1.35rem">${esc(next.title)}</h2><p class="small">${next.done_count} dari ${next.step_count} langkah selesai</p><div class="progress" style="background:rgba(255,255,255,.15);margin:.6rem 0 1rem" role="progressbar" aria-label="Kemajuan rencana" aria-valuemin="0" aria-valuemax="${next.step_count}" aria-valuenow="${next.done_count}"><span style="width:${Math.round(next.done_count / next.step_count * 100)}%;background:#fff"></span></div><a class="btn" href="/ruang/rencana/${esc(next.id)}" data-link>Lanjutkan rencana →</a>`
            : `<h2 id="nx-h" style="margin:.4rem 0 .3rem;font-size:1.35rem">Mulai dari satu tujuan</h2><p class="small">Tulis apa yang ingin Anda urus. SANDAR menyusun pilihan yang bisa Anda ubah.</p><a class="btn" href="/ruang/tugas/baru" data-link>Tulis tujuan →</a>`}
        </section>
        <section class="card" aria-labelledby="sm-h"><h2 class="panel-title" id="sm-h">Ringkasan</h2>
          <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:.5rem;text-align:left">
            <div><div class="stat">${w.counts.active_plans}</div><div class="small muted">Rencana aktif</div></div>
            <div><div class="stat">${w.counts.goals}</div><div class="small muted">Tujuan</div></div>
            <div><div class="stat">${w.counts.cash_flow_items}</div><div class="small muted">Entri uang</div></div>
          </div></section>
        <section class="card" aria-labelledby="us-h"><h2 class="panel-title" id="us-h">Pemakaian ${esc(u.period)}</h2>${meter('agent_runs', 'Tugas agen')}${meter('ai_assist', 'Bantuan AI')}${meter('external_search', 'Pencarian web')}
          <p class="small muted" style="margin:0">Saat kuota habis, rencana, katalog, dan perhitungan tetap bisa dipakai.</p></section>
      </div>
      <section class="card" style="margin-top:1rem" aria-labelledby="rt-h"><div class="row" style="justify-content:space-between"><h2 class="panel-title" id="rt-h" style="margin:0">Tugas terbaru</h2><a class="small" href="/ruang/riwayat" data-link>Lihat semua</a></div>
      ${w.recent_tasks.length ? `<ul class="task-list">${w.recent_tasks.map((t) => `<li><a href="/ruang/tugas/${esc(t.id)}" data-link>${esc(t.objective)}</a><span class="badge neutral">${esc(AREAS[t.area] || t.area)}</span><span class="badge ${t.status === 'completed' ? 'ok' : t.status === 'failed' ? 'bad' : 'warn'}">${esc(STATUS[t.status] || t.status)}</span></li>`).join('')}</ul>` : '<div class="empty" style="margin-top:.8rem"><h3>Belum ada tugas</h3><p class="small" style="margin:0">Tugas yang Anda mulai akan muncul di sini.</p></div>'}</section>`)
  }, { auth: true })

  // ---------- New task (orchestrator) ----------
  S.route('/ruang/tugas/baru', async (v) => {
    S.setTitle('Tujuan baru')
    const w = await ws()
    const it = S.intent.get()
    const preset = new URLSearchParams(location.search).get('area') || (it && it.area) || ''
    const has = (p) => w.consents.includes(p)
    const toggle = (p, label, desc) => `<div class="layer" style="margin:.5rem 0"><label class="choice" style="font-weight:600"><input type="checkbox" data-optin="${p}" ${has(p) ? 'checked' : ''}> ${label}</label><p class="small muted" style="margin:.2rem 0 0 1.9rem">${desc}</p></div>`
    v.innerHTML = shell('/ruang/tugas/baru', `
      <div class="ws-head"><div><span class="eyebrow">SANDAR CORE</span><h1>Apa yang ingin Anda urus?</h1></div></div>
      <p class="lead" style="margin-top:-.5rem">Tulis dengan kata-kata Anda sendiri. SANDAR Core mengarahkan ke agen yang sesuai dan hanya menanyakan yang perlu.</p>
      <form id="task-form" class="card" novalidate>
        <div class="field" style="max-width:none"><label for="objective">Tujuan atau situasi</label>
          <textarea id="objective" maxlength="500" required aria-describedby="obj-h">${esc((it && it.objective) || '')}</textarea>
          <span id="obj-h" class="hint">Contoh: “Saya ingin merapikan pengeluaran bulanan”. Jangan tulis NIK, nomor rekening, alamat, atau data kesehatan.</span></div>
        <div class="field"><label for="area">Area</label>
          <select id="area"><option value="">Biarkan SANDAR memilih</option>${Object.entries(AREAS).map(([k, l]) => `<option value="${k}" ${preset === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <fieldset><legend>Persetujuan</legend>
          ${toggle('workspace_storage', 'Simpan tugas dan rencana di Ruang Saya <span class="badge neutral">Diperlukan</span>', PURPOSES.workspace_storage[1])}
          ${toggle('ai_processing', 'Gunakan bantuan AI (Groq) <span class="badge neutral">Opsional</span>', PURPOSES.ai_processing[1])}
          ${toggle('external_search', 'Cari petunjuk di web (Tavily) <span class="badge neutral">Opsional</span>', PURPOSES.external_search[1])}
          <p class="small muted" style="margin:.5rem 0 0">Tanpa AI dan pencarian, SANDAR tetap menyusun rencana dasar dari logika deterministik dan katalog. Persetujuan bisa dicabut di Privasi &amp; data.</p>
        </fieldset>
        <div id="task-err" role="alert"></div>
        <div class="row"><button class="btn" type="submit">Susun pilihan <span aria-hidden="true">→</span></button><a class="btn ghost" href="/ruang" data-link>Batal</a></div>
      </form>`)
    $('#task-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const objective = $('#objective').value.trim()
      const err = $('#task-err')
      if (objective.length < 3) { err.innerHTML = '<p class="err">Tuliskan tujuan minimal 3 karakter.</p>'; $('#objective').setAttribute('aria-invalid', 'true'); return $('#objective').focus() }
      const want = Object.fromEntries($$('[data-optin]').map((c) => [c.dataset.optin, c.checked]))
      if (!want.workspace_storage) { err.innerHTML = '<p class="err">Persetujuan penyimpanan diperlukan agar tugas dan rencana dapat disimpan. Anda tetap bisa memakai katalog dan kalkulator tamu tanpa menyimpan.</p>'; return }
      const btn = e.submitter || $('#task-form button[type=submit]')
      btn.disabled = true; btn.textContent = 'SANDAR sedang menyusun…'
      try {
        for (const [p, on] of Object.entries(want)) {
          if (on && !has(p)) await S.api('/me/consents', { method: 'POST', body: { purpose_code: p } })
          if (!on && has(p)) await S.api(`/me/consents/${p}/revoke`, { method: 'POST' })
        }
        const r = await S.api('/me/tasks', { method: 'POST', body: { objective, area: $('#area').value || undefined, use_ai: !!want.ai_processing, use_search: !!want.external_search } })
        S.intent.clear(); S.state.workspace = null
        S.go('/ruang/tugas/' + r.task.id)
      } catch (er) { err.innerHTML = S.errorBox(er); btn.disabled = false; btn.innerHTML = 'Susun pilihan <span aria-hidden="true">→</span>' }
    })
  }, { auth: true })

  // ---------- Task detail: questions → result → save as plan ----------
  const layer = (title, badge, cls, items, empty) => items && items.length ? `<section class="layer"><h3>${esc(title)} <span class="badge ${cls}">${esc(badge)}</span></h3><ul>${items.map((i) => `<li>${esc(i.text)}${i.source_url ? ` — <a href="${esc(i.source_url)}" target="_blank" rel="noopener noreferrer">sumber resmi ↗<span class="sr-only"> (tab baru)</span></a>` : ''}${i.status ? ` <span class="badge ${i.status === 'Terverifikasi' ? 'ok' : 'neutral'}">${esc(i.status)}</span>` : ''}</li>`).join('')}</ul></section>` : empty ? `<section class="layer"><h3>${esc(title)}</h3><p class="muted small">${esc(empty)}</p></section>` : ''

  S.route('/ruang/tugas/:id', async (v, { id }) => {
    v.innerHTML = '<p class="loading">Memuat tugas…</p>'
    const d = await S.api('/me/tasks/' + encodeURIComponent(id))
    const t = d.task
    S.setTitle('Tugas: ' + t.objective.slice(0, 40))
    let inner = `<p><a href="/ruang/riwayat" data-link>← Riwayat tugas</a></p>
      <h1>${esc(t.objective)}</h1>
      <p class="row"><span class="badge neutral">${esc(AREAS[t.area] || t.area)}</span><span class="badge ${t.status === 'completed' ? 'ok' : t.status === 'failed' ? 'bad' : 'warn'}">${esc(STATUS[t.status])}</span></p>`
    if (t.status === 'awaiting_user_input') {
      inner += `<form id="q-form" class="card" novalidate><h2 style="margin-top:0">Beberapa pertanyaan singkat</h2><p class="small muted">Semua pertanyaan boleh dilewati.</p>
        ${d.questions.map((q) => q.kind === 'choice' ? `<fieldset><legend>${esc(q.question)}</legend>${q.choices.map((c, i) => `<label class="choice"><input type="radio" name="${esc(q.key)}" value="${esc(c)}"> ${esc(c)}</label>`).join('')}<label class="choice"><input type="radio" name="${esc(q.key)}" value="" checked> Lewati</label></fieldset>` : `<div class="field"><label for="q-${esc(q.key)}">${esc(q.question)}</label><input type="text" id="q-${esc(q.key)}" name="${esc(q.key)}" maxlength="300"></div>`).join('')}
        <div id="q-err" role="alert"></div>
        <div class="row"><button class="btn" type="submit">Tampilkan hasil</button><button class="btn secondary" type="button" id="btn-cancel">Batalkan tugas</button></div></form>`
    } else if (t.status === 'completed' && d.result) {
      const r = d.result
      const selectable = [...r.next_steps, ...r.options]
      inner += `
        <div class="notice small">${esc(r.disclaimer)}</div>
        <p><strong>${esc(r.agent_name)}</strong> — ${esc(r.summary.replace(r.agent_name + ': ', ''))}</p>
        ${layer('Yang Anda sampaikan', 'Fakta dari Anda', 'neutral', r.user_facts)}
        ${layer('Perhitungan', 'Perhitungan sistem', 'info', r.calculations)}
        ${layer('Sumber terkait', 'Fakta sumber publik', 'ok', r.sources)}
        ${r.web_leads.length ? `<section class="layer"><h3>Petunjuk dari web <span class="badge warn">Belum diverifikasi</span></h3><ul>${r.web_leads.map((h) => `<li><a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(h.title || h.domain)} ↗</a> <span class="small muted">(${esc(h.domain)})</span> ${h.official_hint ? '<span class="badge ok">Domain tampak resmi</span>' : '<span class="badge neutral">Bukan domain resmi</span>'}<br><span class="small muted">${esc(h.note)}</span></li>`).join('')}</ul></section>` : ''}
        <section class="layer"><h3>Pilih langkah untuk rencana Anda <span class="badge warn">Saran</span></h3>
          <p class="small muted">Centang yang ingin Anda simpan. Anda bisa mengubah atau menambah langkah setelahnya.</p>
          <form id="save-form">
            ${selectable.map((s, i) => `<label class="choice"><input type="checkbox" name="pick" value="${i}" ${i < r.next_steps.length ? 'checked' : ''}> <span>${esc(s.text)} ${s.kind === 'ai_suggestion' ? '<span class="badge warn">Saran AI</span>' : ''}</span></label>`).join('')}
            <div class="field" style="margin-top:1rem"><label for="plan-title">Judul rencana</label><input id="plan-title" type="text" maxlength="120" value="${esc(t.objective.slice(0, 120))}"></div>
            <div class="field"><label for="plan-review">Tanggal tinjau (opsional)</label><input id="plan-review" type="date"></div>
            <div id="save-err" role="alert"></div>
            <div class="row"><button class="btn" type="submit">Simpan sebagai rencana</button><button class="btn secondary" type="button" id="btn-discard">Buang hasil ini</button></div>
          </form>
        </section>
        ${r.assumptions.length ? `<section class="layer"><h3>Asumsi</h3><ul>${r.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : ''}
        ${r.uncertainties.length ? `<section class="layer"><h3>Ketidakpastian & yang perlu diperiksa</h3><ul>${r.uncertainties.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : ''}
        <p class="small muted">AI: ${r.ai.used ? `digunakan (${esc(r.ai.provider)} · ${esc(r.ai.model)})` : esc(r.ai.reason_not_used || 'tidak digunakan')} · Pencarian web: ${r.search.used ? 'digunakan' : esc(r.search.reason_not_used || 'tidak digunakan')} · Dibuat ${fmtDate(r.generated_at)}</p>`
      v.innerHTML = shell('', inner)
      $('#save-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const picks = $$('input[name=pick]:checked').map((c) => selectable[+c.value])
        try {
          const p = await S.api('/me/plans', { method: 'POST', body: { title: $('#plan-title').value.trim() || t.objective.slice(0, 120), area: t.area, task_id: t.id, review_date: $('#plan-review').value || undefined, steps: picks.map((s) => ({ title: s.text.slice(0, 300), origin: s.kind === 'source_fact' ? 'source' : 'suggestion' })) } })
          announce('Rencana disimpan'); S.state.workspace = null; S.go('/ruang/rencana/' + p.plan.id)
        } catch (err) { $('#save-err').innerHTML = S.errorBox(err) }
      })
      $('#btn-discard').onclick = async () => { if (!(await S.confirm({ title: 'Buang hasil ini?', body: 'Tugas dan hasilnya akan dihapus dari Ruang Saya.', confirmLabel: 'Buang hasil', danger: true }))) return; await S.api('/me/tasks/' + t.id, { method: 'DELETE' }); announce('Hasil dibuang'); S.go('/ruang') }
      return
    } else {
      inner += `<div class="notice ${t.status === 'failed' ? 'bad' : ''}">${t.status === 'failed' ? 'Tugas gagal diproses. Data Anda tidak berubah. Silakan coba lagi.' : 'Tugas ini ' + esc(STATUS[t.status]).toLowerCase() + '.'}</div><a class="btn" href="/ruang/tugas/baru" data-link>Tulis tujuan baru</a>`
    }
    inner += `<details style="margin-top:1rem"><summary>Jejak tugas (audit)</summary><ul class="small">${d.events.map((e) => `<li>${esc(e.occurred_at.slice(11, 19))} — ${esc(e.event_type)}${e.tool ? ' · ' + esc(e.tool) : ''}${e.outcome ? ' · ' + esc(e.outcome) : ''}${e.latency_ms != null ? ' · ' + e.latency_ms + 'ms' : ''}</li>`).join('')}</ul></details>`
    v.innerHTML = shell('', inner)
    const qf = $('#q-form')
    if (qf) {
      qf.addEventListener('submit', async (e) => {
        e.preventDefault()
        const answers = {}
        d.questions.forEach((q) => { const el = q.kind === 'choice' ? $(`input[name="${q.key}"]:checked`) : $(`#q-${q.key}`); if (el && el.value) answers[q.key] = el.value })
        const btn = qf.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Memproses…'
        try { await S.api(`/me/tasks/${t.id}/answers`, { method: 'POST', body: { answers } }); S.router() } catch (err) { $('#q-err').innerHTML = S.errorBox(err); btn.disabled = false; btn.textContent = 'Tampilkan hasil' }
      })
      $('#btn-cancel').onclick = async () => { await S.api(`/me/tasks/${t.id}/cancel`, { method: 'POST' }); announce('Tugas dibatalkan'); S.router() }
    }
  }, { auth: true })

  S.route('/ruang/riwayat', async (v) => {
    S.setTitle('Riwayat tugas')
    const d = await S.api('/me/tasks')
    v.innerHTML = shell('/ruang/riwayat', `<h1>Riwayat tugas</h1>${d.tasks.length ? `<div class="table-wrap"><table><thead><tr><th>Tujuan</th><th>Area</th><th>Status</th><th>Diperbarui</th></tr></thead><tbody>${d.tasks.map((t) => `<tr><td><a href="/ruang/tugas/${esc(t.id)}" data-link>${esc(t.objective)}</a></td><td>${esc(AREAS[t.area] || t.area)}</td><td>${esc(STATUS[t.status])}</td><td>${fmtDate(t.updated_at)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada tugas.</p>'}`)
  }, { auth: true })

  // ---------- Plans ----------
  S.route('/ruang/rencana', async (v) => {
    S.setTitle('Rencana Saya')
    const w = await ws()
    const d = w.consents.includes('workspace_storage') ? await S.api('/me/plans') : { plans: [] }
    v.innerHTML = shell('/ruang/rencana', `<h1>Rencana Saya</h1>${consentGate(w, 'workspace_storage')}
      ${d.plans.length ? `<div class="grid">${d.plans.map((p) => { const pct = p.step_count ? Math.round((p.done_count / p.step_count) * 100) : 0; return `<article class="card"><h2 style="margin-top:0;font-size:1.1rem"><a href="/ruang/rencana/${esc(p.id)}" data-link>${esc(p.title)}</a></h2><p class="row small"><span class="badge neutral">${esc(AREAS[p.area] || p.area)}</span><span class="badge ${p.status === 'active' ? 'info' : p.status === 'done' ? 'ok' : 'neutral'}">${{ active: 'Aktif', archived: 'Diarsipkan', done: 'Selesai' }[p.status]}</span></p><div class="progress" role="progressbar" aria-label="Kemajuan" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div><p class="small muted">${p.done_count}/${p.step_count} langkah · Tinjau: ${p.review_date ? fmtDate(p.review_date) : '—'}</p></article>` }).join('')}</div>` : '<p class="muted">Belum ada rencana. <a href="/ruang/tugas/baru" data-link>Mulai dari satu tujuan</a>.</p>'}`)
  }, { auth: true })

  S.route('/ruang/rencana/:id', async (v, { id }) => {
    const load = async () => {
      const d = await S.api('/me/plans/' + encodeURIComponent(id))
      const p = d.plan
      S.setTitle(p.title)
      const done = d.steps.filter((s) => s.done).length
      v.innerHTML = shell('/ruang/rencana', `
        <p><a href="/ruang/rencana" data-link>← Rencana Saya</a></p>
        <h1>${esc(p.title)}</h1>
        <p class="muted">${done} dari ${d.steps.length} langkah selesai${p.review_date ? ' · Tinjau ' + fmtDate(p.review_date) : ''}</p>
        <section class="card" aria-labelledby="steps-h"><h2 id="steps-h" style="margin-top:0">Langkah</h2>
          ${d.steps.length ? d.steps.map((s) => `<div class="step-item ${s.done ? 'done' : ''}"><input type="checkbox" id="s-${esc(s.id)}" data-step="${esc(s.id)}" ${s.done ? 'checked' : ''}><label for="s-${esc(s.id)}" class="t" style="font-weight:400;flex:1">${esc(s.title)} ${s.origin === 'source' ? '<span class="badge ok">Dari sumber</span>' : s.origin === 'suggestion' ? '<span class="badge warn">Saran</span>' : ''}</label><button class="btn link" data-delstep="${esc(s.id)}" aria-label="Hapus langkah ${esc(s.title)}">Hapus</button></div>`).join('') : '<p class="muted">Belum ada langkah.</p>'}
          <form id="add-step" class="row" style="margin-top:1rem"><label for="new-step" class="sr-only">Langkah baru</label><input id="new-step" type="text" maxlength="300" placeholder="Tambah langkah Anda sendiri" style="flex:1;min-width:200px"><button class="btn secondary" type="submit">Tambah</button></form>
        </section>
        <section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Pengaturan rencana</h2>
          <form id="plan-edit">
            <div class="field"><label for="pe-title">Judul</label><input id="pe-title" type="text" maxlength="120" value="${esc(p.title)}"></div>
            <div class="field"><label for="pe-review">Tanggal tinjau</label><input id="pe-review" type="date" value="${esc(p.review_date || '')}"></div>
            <div class="field"><label for="pe-notes">Catatan pribadi</label><textarea id="pe-notes" maxlength="2000">${esc(p.notes || '')}</textarea></div>
            <div class="field"><label for="pe-status">Status</label><select id="pe-status"><option value="active">Aktif</option><option value="done">Selesai</option><option value="archived">Diarsipkan</option></select></div>
            <div id="pe-msg" aria-live="polite"></div>
            <div class="row"><button class="btn" type="submit">Simpan perubahan</button><button class="btn danger" type="button" id="btn-delplan">Hapus rencana</button></div>
          </form></section>`)
      $('#pe-status').value = p.status
      $$('[data-step]').forEach((c) => (c.onchange = async () => { try { await S.api(`/me/plans/${p.id}/steps/${c.dataset.step}`, { method: 'PATCH', body: { done: c.checked } }); announce(c.checked ? 'Langkah ditandai selesai' : 'Langkah ditandai belum selesai'); load() } catch (e) { c.checked = !c.checked; S.toast(e.message, 'bad') } }))
      $$('[data-delstep]').forEach((b) => (b.onclick = async () => { if (!(await S.confirm({ title: 'Hapus langkah ini?', body: 'Langkah akan dihapus dari rencana.', confirmLabel: 'Hapus', danger: true }))) return; await S.api(`/me/plans/${p.id}/steps/${b.dataset.delstep}`, { method: 'DELETE' }); announce('Langkah dihapus'); load() }))
      $('#add-step').onsubmit = async (e) => { e.preventDefault(); const tt = $('#new-step').value.trim(); if (!tt) return $('#new-step').focus(); try { await S.api(`/me/plans/${p.id}/steps`, { method: 'POST', body: { title: tt } }); announce('Langkah ditambahkan'); await load(); $('#new-step').focus() } catch (er) { S.toast(er.message, 'bad') } }
      $('#plan-edit').onsubmit = async (e) => { e.preventDefault(); try { await S.api(`/me/plans/${p.id}`, { method: 'PATCH', body: { title: $('#pe-title').value, review_date: $('#pe-review').value || null, notes: $('#pe-notes').value, status: $('#pe-status').value } }); $('#pe-msg').innerHTML = '<div class="notice ok">Perubahan disimpan.</div>'; announce('Perubahan disimpan') } catch (er) { $('#pe-msg').innerHTML = S.errorBox(er) } }
      $('#btn-delplan').onclick = async () => { if (!(await S.confirm({ title: 'Hapus rencana ini?', body: `"${p.title}" beserta ${d.steps.length} langkahnya akan dihapus. Tindakan ini tidak dapat dibatalkan.`, confirmLabel: 'Hapus rencana', danger: true }))) return; await S.api('/me/plans/' + p.id, { method: 'DELETE' }); S.state.workspace = null; announce('Rencana dihapus'); S.go('/ruang/rencana') }
    }
    v.innerHTML = '<p class="loading">Memuat rencana…</p>'
    await load()
  }, { auth: true })

  // ---------- Cash flow (persisted) ----------
  S.route('/ruang/arus-uang', async (v) => {
    S.setTitle('Arus Uang')
    const w = await ws()
    const now = new Date()
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    let items = []
    const certL = { confirmed: 'Pasti', estimated: 'Perkiraan', unknown: 'Belum tahu' }
    const recL = { none: 'Sekali', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' }
    v.innerHTML = shell('/ruang/arus-uang', `
      <h1>Arus Uang</h1>
      <p class="lead">Angka berasal dari yang Anda masukkan. Perhitungan bersifat deterministik dan transparan — bukan nasihat keuangan.</p>
      ${consentGate(w, 'workspace_storage', '/ruang/arus-uang')}
      <details class="card" ${w.consents.includes('workspace_storage') ? '' : 'hidden'}><summary><strong>Tambah entri</strong></summary>
        <form id="cf-form" novalidate style="margin-top:1rem">
          <fieldset><legend>Arah</legend><label class="choice"><input type="radio" name="direction" value="inflow" checked> Pemasukan</label><label class="choice"><input type="radio" name="direction" value="outflow"> Pengeluaran</label></fieldset>
          <div class="field"><label for="cf-label">Nama entri</label><input id="cf-label" type="text" maxlength="80" required></div>
          <div class="field"><label for="cf-amt">Jumlah (Rp, bilangan bulat)</label><input id="cf-amt" type="text" inputmode="numeric" required></div>
          <div class="field"><label for="cf-date">Tanggal (boleh kosong)</label><input id="cf-date" type="date"><span class="hint">Entri tanpa tanggal tidak dihitung dalam periode.</span></div>
          <div class="field"><label for="cf-rec">Pengulangan</label><select id="cf-rec">${Object.entries(recL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
          <fieldset><legend>Kepastian</legend>${Object.entries(certL).map(([k, l]) => `<label class="choice"><input type="radio" name="certainty" value="${k}" ${k === 'estimated' ? 'checked' : ''}> ${l}</label>`).join('')}</fieldset>
          <div id="cf-err" role="alert"></div><button class="btn" type="submit">Simpan entri</button>
        </form></details>
      <section style="margin-top:1rem"><h2>Entri Anda</h2><div id="cf-list"><p class="loading">Memuat…</p></div></section>
      <section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Ringkasan periode</h2>
        <form id="sum-form" class="grid">
          <div class="field"><label for="p-from">Dari</label><input id="p-from" type="date" value="${first}"></div>
          <div class="field"><label for="p-to">Sampai</label><input id="p-to" type="date" value="${last}"></div>
          <div class="field"><label for="p-open">Saldo awal (opsional)</label><input id="p-open" type="text" inputmode="numeric" placeholder="Belum diketahui"></div>
          <div class="field" style="justify-content:flex-end"><button class="btn" type="submit">Hitung</button></div>
        </form><div id="sum-out" aria-live="polite"></div></section>
      <section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Skenario “bagaimana jika”</h2>
        <p class="small muted">Ubah jumlah atau keluarkan entri untuk melihat perbandingan. Data asli tidak berubah dan tidak disimpan.</p>
        <div id="sc-box"></div><button class="btn secondary" type="button" id="sc-run">Bandingkan skenario</button><div id="sc-out" aria-live="polite"></div></section>`)
    const opening = () => { const r = $('#p-open').value.trim().replace(/[.\s]/g, ''); if (!r) return null; if (!/^-?\d{1,13}$/.test(r)) throw new Error('Saldo awal harus bilangan bulat.'); return Number(r) }
    const renderList = () => {
      $('#cf-list').innerHTML = items.length ? `<div class="table-wrap"><table><thead><tr><th>Entri</th><th>Arah</th><th>Tanggal</th><th>Ulang</th><th>Kepastian</th><th class="num">Jumlah</th><th><span class="sr-only">Aksi</span></th></tr></thead><tbody>${items.map((i) => `<tr><td>${esc(i.label)}</td><td>${i.direction === 'inflow' ? 'Masuk' : 'Keluar'}</td><td>${i.expected_date ? fmtDate(i.expected_date) : '<span class="muted">Tanpa tanggal</span>'}</td><td>${recL[i.recurrence]}</td><td>${certL[i.certainty]}</td><td class="num">${idr(i.amount_minor)}</td><td><button class="btn link" data-delcf="${esc(i.id)}" aria-label="Hapus ${esc(i.label)}">Hapus</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada entri.</p>'
      $$('[data-delcf]').forEach((b) => (b.onclick = async () => { if (!(await S.confirm({ title: 'Hapus entri ini?', body: 'Entri arus uang akan dihapus permanen.', confirmLabel: 'Hapus', danger: true }))) return; await S.api('/me/cash-flow-items/' + b.dataset.delcf, { method: 'DELETE' }); announce('Entri dihapus'); await loadItems() }))
      $('#sc-box').innerHTML = items.length ? items.map((i) => `<div class="row small" style="margin:.3rem 0"><label for="sc-${esc(i.id)}" style="min-width:12rem">${esc(i.label)} (${i.direction === 'inflow' ? 'masuk' : 'keluar'})</label><input id="sc-${esc(i.id)}" data-sc="${esc(i.id)}" type="text" inputmode="numeric" value="${i.amount_minor}" style="max-width:12rem"><label class="choice"><input type="checkbox" data-scrm="${esc(i.id)}"> Keluarkan</label></div>`).join('') : '<p class="muted small">Tambahkan entri terlebih dahulu.</p>'
    }
    const loadItems = async () => { if (!w.consents.includes('workspace_storage')) { $('#cf-list').innerHTML = '<p class="muted">Setujui penyimpanan untuk menyimpan entri. Atau <a href="/coba/arus-uang" data-link>coba tanpa menyimpan</a>.</p>'; return } items = (await S.api('/me/cash-flow-items')).items; renderList() }
    const summaryHtml = (s, title) => `<section class="layer"><h3>${esc(title)} <span class="badge info">Perhitungan sistem · ${esc(s.calculation_version)}</span></h3>
      ${s.has_entries ? '' : '<p class="muted">Belum ada data untuk periode ini.</p>'}
      <dl class="kv"><dt>Total pemasukan</dt><dd>${idr(s.total_inflow_minor)}</dd><dt>Total pengeluaran</dt><dd>${idr(s.total_outflow_minor)}</dd><dt>Pergerakan bersih</dt><dd><strong>${idr(s.net_movement_minor)}</strong></dd><dt>Saldo awal</dt><dd>${idr(s.opening_balance_minor)}</dd><dt>Perkiraan saldo akhir</dt><dd>${idr(s.closing_estimate_minor)}</dd><dt>Dari angka pasti</dt><dd>masuk ${idr(s.by_certainty.confirmed.inflow)} · keluar ${idr(s.by_certainty.confirmed.outflow)}</dd></dl>
      ${s.warnings.length ? `<ul class="small">${s.warnings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <details class="small"><summary>Asumsi perhitungan</summary><ul>${s.assumptions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details></section>`
    const cfForm = $('#cf-form')
    if (cfForm) cfForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const raw = $('#cf-amt').value.trim().replace(/[.\s]/g, '')
      if (!$('#cf-label').value.trim()) { $('#cf-err').innerHTML = '<p class="err">Nama entri wajib diisi.</p>'; return $('#cf-label').focus() }
      if (!/^\d{1,13}$/.test(raw)) { $('#cf-err').innerHTML = '<p class="err">Jumlah harus bilangan bulat tanpa desimal.</p>'; return $('#cf-amt').focus() }
      try {
        await S.api('/me/cash-flow-items', { method: 'POST', body: { direction: $('input[name=direction]:checked').value, label: $('#cf-label').value, amount_minor: Number(raw), expected_date: $('#cf-date').value || null, recurrence: $('#cf-rec').value, certainty: $('input[name=certainty]:checked').value } })
        $('#cf-err').innerHTML = ''; cfForm.reset(); announce('Entri disimpan'); S.state.workspace = null; await loadItems()
      } catch (er) { $('#cf-err').innerHTML = S.errorBox(er) }
    })
    $('#sum-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      try { const r = await S.api('/me/cash-flow/summary', { method: 'POST', body: { from: $('#p-from').value, to: $('#p-to').value, opening_balance_minor: opening() } }); $('#sum-out').innerHTML = summaryHtml(r.summary, 'Hasil'); announce('Ringkasan dihitung') } catch (er) { $('#sum-out').innerHTML = S.errorBox(er) }
    })
    $('#sc-run').onclick = async () => {
      try {
        const changes = []
        $$('[data-scrm]').forEach((c) => { if (c.checked) changes.push({ op: 'remove', item_id: c.dataset.scrm }) })
        $$('[data-sc]').forEach((inp) => { const it = items.find((i) => i.id === inp.dataset.sc); const n = Number(inp.value.replace(/[.\s]/g, '')); if (it && Number.isSafeInteger(n) && n >= 0 && n !== it.amount_minor && !changes.some((c) => c.item_id === it.id)) changes.push({ op: 'adjust', item_id: it.id, amount_minor: n }) })
        const r = await S.api('/me/scenarios/preview', { method: 'POST', body: { from: $('#p-from').value, to: $('#p-to').value, opening_balance_minor: opening(), changes } })
        $('#sc-out').innerHTML = `<div class="notice small">${esc(r.label)}</div><div class="grid">${summaryHtml(r.baseline, 'Data asli')}${summaryHtml(r.scenario, 'Skenario')}</div><p><strong>Selisih pergerakan bersih: ${idr(r.difference_net_minor)}</strong></p>`
        announce('Skenario dibandingkan')
      } catch (er) { $('#sc-out').innerHTML = S.errorBox(er) }
    }
    await loadItems()
  }, { auth: true })

  // ---------- Goals ----------
  S.route('/ruang/tujuan', async (v) => {
    S.setTitle('Tujuan')
    const w = await ws()
    const load = async () => {
      const d = w.consents.includes('workspace_storage') ? await S.api('/me/goals') : { goals: [] }
      $('#g-list').innerHTML = d.goals.length ? `<ul>${d.goals.map((g) => `<li class="step-item ${g.status === 'done' ? 'done' : ''}"><input type="checkbox" id="g-${esc(g.id)}" data-goal="${esc(g.id)}" ${g.status === 'done' ? 'checked' : ''}><label class="t" for="g-${esc(g.id)}" style="flex:1;font-weight:400">${esc(g.title)} <span class="badge neutral">${esc(AREAS[g.area] || g.area)}</span>${g.target_date ? ` <span class="small muted">target ${fmtDate(g.target_date)}</span>` : ''}</label><button class="btn link" data-delgoal="${esc(g.id)}" aria-label="Hapus ${esc(g.title)}">Hapus</button></li>`).join('')}</ul>` : '<p class="muted">Belum ada tujuan.</p>'
      $$('[data-goal]').forEach((c) => (c.onchange = async () => { await S.api('/me/goals/' + c.dataset.goal, { method: 'PATCH', body: { status: c.checked ? 'done' : 'active' } }); announce('Tujuan diperbarui'); load() }))
      $$('[data-delgoal]').forEach((b) => (b.onclick = async () => { if (!(await S.confirm({ title: 'Hapus tujuan ini?', body: 'Tujuan akan dihapus permanen.', confirmLabel: 'Hapus', danger: true }))) return; await S.api('/me/goals/' + b.dataset.delgoal, { method: 'DELETE' }); announce('Tujuan dihapus'); load() }))
    }
    v.innerHTML = shell('/ruang/tujuan', `<h1>Tujuan</h1>${consentGate(w, 'workspace_storage')}
      <form id="goal-form" class="card" ${w.consents.includes('workspace_storage') ? '' : 'hidden'} novalidate>
        <div class="field"><label for="goal-title">Tujuan</label><input id="goal-title" type="text" maxlength="120" required></div>
        <div class="grid"><div class="field"><label for="goal-area">Area</label><select id="goal-area">${Object.entries(AREAS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="field"><label for="goal-date">Target (opsional)</label><input id="goal-date" type="date"></div></div>
        <div id="goal-err" role="alert"></div><button class="btn" type="submit">Tambah tujuan</button></form>
      <div id="g-list" style="margin-top:1rem"></div>`)
    $('#goal-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      try { await S.api('/me/goals', { method: 'POST', body: { title: $('#goal-title').value, area: $('#goal-area').value, target_date: $('#goal-date').value || null } }); e.target.reset(); $('#goal-err').innerHTML = ''; announce('Tujuan ditambahkan'); load() } catch (er) { $('#goal-err').innerHTML = S.errorBox(er) }
    })
    load()
  }, { auth: true })

  // ---------- Settings & privacy ----------
  S.route('/pengaturan', async (v) => {
    S.setTitle('Pengaturan & Privasi')
    if (!S.signedIn()) {
      v.innerHTML = `<h1>Pengaturan & Privasi</h1><p>Anda belum masuk. SANDAR tidak menyimpan data apa pun tentang pengunjung tanpa akun, dan kalkulator tamu tidak mengirim angka ke server.</p><p><a href="/privasi" data-link>Baca pemberitahuan privasi</a> · <a class="btn" href="/masuk?next=/pengaturan" data-link>Masuk</a></p>`
      return
    }
    const w = await ws(true)
    const billing = await S.api('/me/billing')
    v.innerHTML = `<h1>Pengaturan & Privasi</h1>
      <section class="card"><h2 style="margin-top:0">Persetujuan per tujuan</h2>
        <p class="small muted">Setiap persetujuan terpisah. Satu persetujuan tidak mengizinkan tujuan lain. Versi pemberitahuan: ${esc(S.state.noticeVersion || '')}</p>
        ${Object.entries(PURPOSES).map(([k, [t, d]]) => { const on = w.consents.includes(k); return `<div class="layer"><h3>${esc(t)} <span class="badge ${on ? 'ok' : 'neutral'}">${on ? 'Aktif' : 'Tidak aktif'}</span></h3><p class="small">${esc(d)}</p>${on ? `<button class="btn secondary" data-revoke="${k}">Cabut persetujuan</button>` : `<button class="btn" data-consent="${k}" data-next="/pengaturan">Setujui</button>`}</div>` }).join('')}
      </section>
      <section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Paket</h2>
        <p>Paket saat ini: <strong>${esc(w.plan.name)}</strong>. Pembayaran ${billing.billing_enabled ? 'aktif' : 'belum dibuka — semua akun memakai paket Gratis'}.</p><a href="/harga" data-link>Lihat paket & harga (hipotesis)</a></section>
      <section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Ekspor data</h2>
        <p class="small">Unduh semua data Ruang Saya dalam format JSON yang dapat dibaca.</p><button class="btn secondary" id="btn-export">Unduh ekspor</button><div id="exp-msg" aria-live="polite"></div></section>
      <section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Hapus data Ruang Saya</h2>
        <p class="small">Menghapus semua tujuan, entri arus uang, tugas, rencana, persetujuan, dan pemakaian. Catatan audit minimal (tanpa isi data) disimpan untuk keamanan. Untuk menghapus akun masuk, gunakan menu akun Clerk.</p>
        <form id="del-form"><div class="field"><label for="del-confirm">Ketik <strong>HAPUS</strong> untuk mengonfirmasi</label><input id="del-confirm" type="text" autocomplete="off"></div><div id="del-msg" role="alert"></div><button class="btn danger" type="submit">Hapus semua data saya</button></form></section>
      ${w.is_curator ? `<section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Kurator</h2><div id="prov"><p class="loading">Memuat status penyedia…</p></div></section>` : ''}`
    $$('[data-revoke]').forEach((b) => (b.onclick = async () => { await S.api(`/me/consents/${b.dataset.revoke}/revoke`, { method: 'POST' }); S.state.workspace = null; announce('Persetujuan dicabut'); S.router() }))
    $('#btn-export').onclick = async () => {
      try { const d = await S.api('/me/export', { method: 'POST' }); const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sandar-ekspor-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); $('#exp-msg').innerHTML = '<div class="notice ok">Ekspor diunduh.</div>' } catch (e) { $('#exp-msg').innerHTML = S.errorBox(e) }
    }
    $('#del-form').onsubmit = async (e) => {
      e.preventDefault()
      if ($('#del-confirm').value !== 'HAPUS') { $('#del-msg').innerHTML = '<p class="err">Ketik HAPUS (huruf besar) untuk mengonfirmasi.</p>'; return }
      try { const r = await S.api('/me/workspace', { method: 'DELETE', body: { confirm: 'HAPUS' } }); S.state.workspace = null; $('#del-msg').innerHTML = `<div class="notice ${r.ok ? 'ok' : 'warn'}">${r.ok ? 'Data terhapus dan sudah diverifikasi (0 catatan tersisa).' : 'Penghapusan sebagian; coba lagi.'} ${esc(r.note)}</div>` } catch (er) { $('#del-msg').innerHTML = S.errorBox(er) }
    }
    if (w.is_curator) { try { const p = await S.api('/me/admin/providers'); $('#prov').innerHTML = `<table><thead><tr><th>Penyedia</th><th>Status</th><th>Pakai hari ini</th><th>Batas</th></tr></thead><tbody>${p.providers.map((x) => `<tr><td>${esc(x.provider)}${x.model ? ' · ' + esc(x.model) : ''}</td><td>${esc(x.state)}</td><td>${x.used_today}</td><td>${x.daily_cap}</td></tr>`).join('')}</tbody></table>` } catch (e) { $('#prov').innerHTML = S.errorBox(e) } }
  })
})()

/* SANDAR frontend core — vanilla JS, no tracking, no third-party analytics.
   All dynamic text is escaped with esc() before insertion. */
(function () {
  'use strict'
  const S = (window.SANDAR = window.SANDAR || {})
  const pkMeta = document.querySelector('meta[name="sandar-clerk-pk"]')
  const cfg = { clerkPk: (pkMeta && pkMeta.content) || null }
  S.state = { user: null, clerk: null, authReady: false, workspace: null }

  // ---------- utils ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const idr = (n) => (n === null || n === undefined ? 'Belum diketahui' : (n < 0 ? '−' : '') + 'Rp' + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
  const fmtDate = (s) => {
    if (!s) return '—'
    const d = new Date(s.length === 10 ? s + 'T00:00:00Z' : s)
    return isNaN(d) ? esc(s) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  const announce = (msg) => {
    const el = document.getElementById('live')
    if (el) { el.textContent = ''; setTimeout(() => (el.textContent = msg), 30) }
  }
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
  Object.assign(S, { esc, idr, fmtDate, announce, $, $$ })

  // ---------- API client ----------
  S.api = async function (path, opts = {}) {
    const headers = { accept: 'application/json' }
    if (opts.body !== undefined) headers['content-type'] = 'application/json'
    if (opts.auth !== false && S.state.clerk && S.state.clerk.session) {
      try {
        const t = await S.state.clerk.session.getToken()
        if (t) headers.authorization = 'Bearer ' + t
      } catch (_) {}
    }
    let res
    try {
      res = await fetch('/api/v1' + path, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin' })
    } catch (e) {
      const err = new Error('Tidak dapat terhubung. Periksa koneksi internet Anda.')
      err.code = 'NETWORK'
      throw err
    }
    let data = null
    try { data = await res.json() } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && data.error && data.error.message) || 'Terjadi kesalahan.')
      err.code = data && data.error && data.error.code
      err.status = res.status
      err.details = data && data.error && data.error.details
      err.cid = data && data.error && data.error.correlation_id
      throw err
    }
    return data
  }

  S.errorBox = (e) => {
    const map = {
      UNAUTHENTICATED: 'Silakan masuk untuk melanjutkan.',
      FORBIDDEN: 'Anda tidak memiliki izin untuk tindakan ini.',
      NOT_FOUND: 'Data tidak ditemukan atau sudah dihapus.',
      RATE_LIMITED: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.',
      NETWORK: 'Tidak dapat terhubung. Periksa koneksi Anda; data yang belum tersimpan tidak hilang dari formulir.',
    }
    const msg = map[e.code] || e.message
    return `<div class="notice bad" role="alert"><strong>Belum berhasil.</strong> ${esc(msg)}${e.cid ? `<br><span class="small muted">Kode rujukan: ${esc(e.cid)}</span>` : ''}${e.code === 'UNAUTHENTICATED' ? ' <a href="/masuk" data-link>Masuk</a>' : ''}</div>`
  }

  // ---------- auth (Clerk Production) ----------
  S.initAuth = function () {
    return new Promise((resolve) => {
      if (!cfg.clerkPk || /\.pages\.dev$/.test(location.hostname)) { S.state.authReady = true; return resolve() }
      let host
      try { host = atob(cfg.clerkPk.replace(/^pk_(live|test)_/, '')).replace(/\$$/, '') } catch (_) { S.state.authReady = true; return resolve() }

      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        S.state.authReady = true
        resolve()
      }
      const timer = setTimeout(() => {
        console.warn('Clerk initialization timed out')
        done()
      }, 15000)
      const loadScript = (src, publishableKey) => new Promise((ok, fail) => {
        const script = document.createElement('script')
        script.src = src
        script.async = true
        script.crossOrigin = 'anonymous'
        if (publishableKey) script.setAttribute('data-clerk-publishable-key', publishableKey)
        script.onload = ok
        script.onerror = () => fail(new Error('Failed to load Clerk script: ' + src))
        document.head.appendChild(script)
      })

      ;(async () => {
        try {
          // Clerk Core 3 separates the prebuilt UI bundle from ClerkJS.
          await loadScript(`https://${host}/npm/@clerk/ui@1/dist/ui.browser.js`)
          await loadScript(`https://${host}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, cfg.clerkPk)
          await window.Clerk.load({
            localization: undefined,
            ui: { ClerkUI: window.__internal_ClerkUICtor },
          })
          S.state.clerk = window.Clerk
          S.state.user = window.Clerk.user || null
          window.Clerk.addListener(({ user }) => {
            const changed = (S.state.user && S.state.user.id) !== (user && user.id)
            S.state.user = user || null
            if (changed) { S.state.workspace = null; S.renderNav(); S.router() }
          })
        } catch (e) {
          console.warn('Clerk initialization failed', e)
        } finally {
          clearTimeout(timer)
          done()
        }
      })()
    })
  }
  S.signedIn = () => !!(S.state.clerk && S.state.clerk.user)
  S.signOut = async () => { if (S.state.clerk) await S.state.clerk.signOut(); S.state.workspace = null; S.go('/') }

  // ---------- layout ----------
  const NAV = () => [
    ['/', 'Beranda'],
    ...(S.signedIn() ? [['/ruang', 'Ruang Saya']] : []),
    ['/jelajahi', 'Jelajahi'],
    ['/pengaturan', 'Pengaturan & Privasi'],
  ]
  S.renderLayout = function () {
    document.getElementById('root').innerHTML = `
      <div id="offline-banner" hidden role="status">Anda sedang luring. Beberapa fitur mungkin tidak tersedia.</div>
      <header class="site"><div class="wrap">
        <a class="brand" href="/" data-link aria-label="SANDAR, ke beranda"><img src="/static/favicon.svg" alt="" width="32" height="32"> SANDAR</a>
        <nav class="main" aria-label="Navigasi utama"><ul id="nav-list"></ul></nav>
      </div></header>
      <main id="main" tabindex="-1"><div class="wrap" id="view"></div></main>
      <footer class="site"><div class="wrap">
        <strong>SANDAR — Agentic Life Navigation & Resilience OS</strong>
        <p class="small muted">Membuat langkah berikutnya lebih jelas, tanpa mengambil kendali dari Anda. SANDAR bukan layanan darurat, bukan penasihat keuangan/hukum/medis, dan tidak menentukan kelayakan program.</p>
        <ul>
          <li><a href="/cara-kerja" data-link>Cara kerja</a></li>
          <li><a href="/harga" data-link>Paket & harga</a></li>
          <li><a href="/privasi" data-link>Privasi</a></li>
          <li><a href="/ketentuan" data-link>Ketentuan (draf)</a></li>
          <li><a href="/aksesibilitas" data-link>Aksesibilitas</a></li>
          <li><a href="/bantuan" data-link>Bantuan & kontak</a></li>
        </ul>
        <p class="small muted">Dalam keadaan darurat, hubungi 112.</p>
      </div></footer>`
    S.renderNav()
    const ob = () => { const b = document.getElementById('offline-banner'); if (b) b.hidden = navigator.onLine }
    addEventListener('online', ob); addEventListener('offline', ob); ob()
  }
  S.renderNav = function () {
    const ul = document.getElementById('nav-list')
    if (!ul) return
    const path = location.pathname
    ul.innerHTML = NAV().map(([href, label]) => {
      const cur = href === '/' ? path === '/' : path === href || path.startsWith(href + '/')
      return `<li><a href="${href}" data-link ${cur ? 'aria-current="page"' : ''}>${esc(label)}</a></li>`
    }).join('') + (S.signedIn() ? `<li><button type="button" id="btn-signout">Keluar</button></li>` : `<li><a href="/masuk" data-link ${path === '/masuk' ? 'aria-current="page"' : ''}>Masuk</a></li>`)
    const so = document.getElementById('btn-signout')
    if (so) so.onclick = S.signOut
  }

  // ---------- router ----------
  S.routes = []
  S.route = (pattern, handler, opts = {}) => S.routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), handler, opts })
  S.go = (path) => { history.pushState({}, '', path); S.router() }
  S.view = () => document.getElementById('view')
  S.setTitle = (t) => (document.title = t ? `${t} — SANDAR` : 'SANDAR — Navigasi Hidup & Ketahanan')
  S.router = async function () {
    const path = location.pathname
    S.renderNav()
    const v = S.view()
    for (const r of S.routes) {
      const m = path.match(r.re)
      if (!m) continue
      if (r.opts.auth && !S.state.authReady) { v.innerHTML = '<p class="loading">Memuat…</p>' }
      if (r.opts.auth && !S.signedIn()) {
        S.setTitle('Masuk diperlukan')
        v.innerHTML = `<h1>Masuk untuk membuka Ruang Saya</h1>
          <p class="lead">Ruang Saya menyimpan tujuan, arus uang, dan rencana Anda secara pribadi. Katalog publik dan penjelasan tetap bisa dibuka tanpa masuk.</p>
          <div class="row"><a class="btn" href="/masuk?next=${encodeURIComponent(path)}" data-link>Masuk atau daftar</a><a class="btn secondary" href="/coba/arus-uang" data-link>Coba hitung arus uang tanpa akun</a></div>`
        return focusMain()
      }
      try { await r.handler(v, m.groups || {}) } catch (e) { v.innerHTML = S.errorBox(e) }
      return focusMain()
    }
    S.setTitle('Halaman tidak ditemukan')
    v.innerHTML = `<h1>Halaman tidak ditemukan</h1><p>Halaman yang Anda cari tidak ada. <a href="/" data-link>Kembali ke beranda</a>.</p>`
    focusMain()
  }
  function focusMain() { const m = document.getElementById('main'); if (m) m.focus({ preventScroll: true }); window.scrollTo(0, 0) }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]')
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return
    e.preventDefault()
    S.go(a.getAttribute('href'))
  })
  addEventListener('popstate', () => S.router())

  // ---------- shared renderers ----------
  S.statusBadge = (v) => {
    const cls = { checked: 'ok', stale: 'warn', unverified: 'neutral', needs_review: 'warn', withdrawn: 'bad' }[v.status] || 'neutral'
    return `<span class="badge ${cls}">${esc(v.label)}</span>`
  }
  S.listingCard = (it) => `
    <article class="card" aria-labelledby="l-${esc(it.id)}">
      <div class="row">${S.statusBadge(it.verification)} ${it.is_sample ? '<span class="badge info">Data contoh</span>' : ''} <span class="badge neutral">${it.kind === 'opportunity' ? 'Peluang' : 'Sumber/layanan'}</span></div>
      <h3 id="l-${esc(it.id)}" style="margin-top:.5rem"><a href="/jelajahi/${esc(it.id)}" data-link>${esc(it.title)}</a></h3>
      <p class="small">${esc(it.summary)}</p>
      <p class="small muted">Penerbit: ${esc(it.publisher.name)} · Cakupan: ${esc(it.coverage || it.jurisdiction)} · Diperiksa: ${it.last_verified_at ? fmtDate(it.last_verified_at) : 'belum'}</p>
    </article>`

  // ---------- public pages ----------
  S.route('/', async (v) => {
    S.setTitle('')
    v.innerHTML = `
      <section class="hero hero-home" aria-labelledby="hero-title">
        <div class="hero-copy">
          <span class="eyebrow">SANDAR · LIFE NAVIGATION & RESILIENCE</span>
          <h1 id="hero-title">Saat hidup berubah, temukan langkah berikutnya.</h1>
          <p class="lead">Ruang bantu untuk menata keadaan, memahami pilihan, dan menyusun langkah yang masuk akal — dengan keputusan tetap di tangan Anda.</p>
          <div class="row hero-actions">
            <a class="btn" href="/mulai" data-link>Mulai perjalanan</a>
            <a class="btn secondary" href="/jelajahi" data-link>Jelajahi tanpa akun</a>
          </div>
          <p class="small muted hero-note">Tidak perlu mengisi profil. Mulai dari satu hal yang ingin Anda urus.</p>
        </div>
        <aside class="hero-panel" aria-label="Prinsip SANDAR">
          <span class="hero-panel-mark" aria-hidden="true">S</span>
          <p class="hero-panel-title">Anda memegang kendali.</p>
          <p class="small">SANDAR membantu memetakan pilihan. Anda yang menentukan apa yang ingin dicoba, disimpan, atau diubah.</p>
          <ul class="hero-points">
            <li>Privasi berdasarkan persetujuan</li>
            <li>Fakta dan saran dibedakan</li>
            <li>Tetap berguna tanpa AI</li>
          </ul>
        </aside>
      </section>

      <section class="journey-section" aria-labelledby="journey-title">
        <div class="section-heading">
          <div><span class="eyebrow">MULAI DARI KEBUTUHAN ANDA</span><h2 id="journey-title">Apa yang ingin Anda urus lebih dulu?</h2></div>
          <p class="muted small">Pilih satu. Anda bisa berpindah area kapan saja.</p>
        </div>
        <div class="grid journey-grid">
          <a class="card task journey-card" href="/mulai?area=finance" data-link><span class="icon" aria-hidden="true">↗</span><span class="card-kicker">KEUANGAN</span><h3>Memahami arus uang</h3><span class="small muted">Petakan pemasukan, pengeluaran, dan beberapa skenario sederhana. Bisa mencoba tanpa akun.</span><span class="card-link">Mulai dari sini <span aria-hidden="true">→</span></span></a>
          <a class="card task journey-card" href="/mulai?area=resources" data-link><span class="icon" aria-hidden="true">⌂</span><span class="card-kicker">SUMBER PUBLIK</span><h3>Menemukan layanan resmi</h3><span class="small muted">Jelajahi sumber pemerintah dan layanan publik dengan status pemeriksaan yang jelas.</span><span class="card-link">Jelajahi sumber <span aria-hidden="true">→</span></span></a>
          <a class="card task journey-card" href="/mulai?area=opportunity" data-link><span class="icon" aria-hidden="true">✳</span><span class="card-kicker">PELUANG & KETERAMPILAN</span><h3>Menentukan arah berikutnya</h3><span class="small muted">Susun jalur belajar dan cari peluang dari informasi publik.</span><span class="card-link">Lihat pilihan <span aria-hidden="true">→</span></span></a>
          <a class="card task journey-card" href="/mulai?area=resilience" data-link><span class="icon" aria-hidden="true">⌁</span><span class="card-kicker">KETAHANAN</span><h3>Membuat rencana ke depan</h3><span class="small muted">Pecah tujuan menjadi langkah kecil dan siapkan alternatif bila keadaan berubah.</span><span class="card-link">Susun rencana <span aria-hidden="true">→</span></span></a>
        </div>
      </section>

      <section class="journey-flow" aria-labelledby="flow-title">
        <div class="section-heading"><div><span class="eyebrow">ALUR YANG SEDERHANA</span><h2 id="flow-title">Dari kebingungan menuju langkah yang bisa dilakukan.</h2></div></div>
        <ol class="steps-howto">
          <li><span class="step-label">01 · CERITAKAN</span><h3>Mulai dari tujuan Anda</h3><p class="small muted">Tulis dengan kata-kata sendiri atau pilih area. Tidak perlu membuat profil lengkap.</p></li>
          <li><span class="step-label">02 · PETAKAN</span><h3>SANDAR membantu menata</h3><p class="small muted">Core mengarahkan tugas ke kapabilitas yang sesuai, menyusun opsi, sumber, asumsi, dan pertanyaan seperlunya.</p></li>
          <li><span class="step-label">03 · TENTUKAN</span><h3>Pilih langkah Anda</h3><p class="small muted">Tinjau hasil, ubah atau abaikan saran, lalu simpan rencana jika Anda menginginkannya.</p></li>
          <li><span class="step-label">04 · TINJAU</span><h3>Lanjutkan sesuai keadaan</h3><p class="small muted">Kembali untuk melihat kemajuan dan menyesuaikan rencana. Tidak ada keputusan yang diambil atas nama Anda.</p></li>
        </ol>
      </section>

      <section class="trust trust-wide" aria-label="Privasi dan batasan">
        <div><span class="eyebrow">PRIVASI & KENDALI</span><h2>Data Anda bukan harga untuk mendapatkan bantuan.</h2><p class="small">Anda memilih apa yang disimpan dan apakah bantuan AI atau pencarian eksternal digunakan. Anda dapat mengekspor atau menghapus data ruang kerja.</p></div>
        <ul class="small"><li>Tidak menebak penghasilan atau kelayakan.</li><li>Tidak menjual data atau membuat profil orang.</li><li>Tidak mengirim lamaran, pembayaran, atau pesan atas nama Anda.</li><li>Informasi publik tetap dapat dijelajahi tanpa akun.</li></ul>
      </section>`
  })

  S.route('/mulai', async (v) => {
    S.setTitle('Mulai perjalanan')
    const qs = new URLSearchParams(location.search)
    const area = qs.get('area') || ''
    const labels = { life: 'Menata situasi dan pilihan', finance: 'Memahami arus uang', resources: 'Menemukan sumber dan layanan publik', opportunity: 'Menjelajahi peluang dan keterampilan', resilience: 'Membuat rencana ke depan' }
    const cards = [
      ['life','Menata situasi','Uraikan hal yang ingin Anda bereskan dan petakan beberapa pilihan.','◎'],
      ['finance','Arus uang','Lihat pemasukan, pengeluaran, dan skenario sederhana.','↗'],
      ['resources','Sumber publik','Telusuri layanan resmi dan persyaratan dari penerbitnya.','⌂'],
      ['opportunity','Peluang & keterampilan','Susun jalur belajar atau eksplorasi peluang.','✳'],
      ['resilience','Rencana ke depan','Buat langkah kecil dan pilihan cadangan.','⌁'],
    ]
    const chosen = labels[area] ? area : 'life'
    const next = '/ruang/tugas/baru?area=' + encodeURIComponent(chosen)
    v.innerHTML = `
      <div class="onboarding-wrap">
        <a class="back-link" href="/" data-link>← Kembali ke beranda</a>
        <div class="onboarding-heading"><span class="eyebrow">MULAI DENGAN RINGAN</span><h1>Hal apa yang ingin Anda buat lebih jelas?</h1><p class="lead">Pilih titik awal. Tidak ada jawaban yang salah dan Anda tidak perlu menceritakan semuanya sekaligus.</p></div>
        <div class="onboarding-progress" aria-label="Langkah 1 dari 3"><span class="active"></span><span></span><span></span></div>
        <p class="small muted">LANGKAH 1 DARI 3 · PILIH AREA</p>
        <div class="grid onboarding-grid">
          ${cards.map(([key,title,desc,icon]) => `<a class="card task onboarding-choice ${chosen===key?'selected':''}" href="/mulai?area=${key}" data-link ${chosen===key?'aria-current="true"':''}><span class="icon" aria-hidden="true">${icon}</span><h3>${title}</h3><span class="small muted">${desc}</span><span class="choice-indicator" aria-hidden="true">${chosen===key?'✓':'+'}</span></a>`).join('')}
        </div>
        <div class="onboarding-next card">
          <div><span class="eyebrow">AREA TERPILIH</span><h2>${labels[chosen]}</h2><p class="small muted">Berikutnya Anda dapat menuliskan tujuan dengan kata-kata sendiri. Akun diperlukan saat menggunakan Ruang Saya untuk menyimpan dan melanjutkan rencana.</p></div>
          <div class="row"><a class="btn" href="/masuk?next=${encodeURIComponent(next)}" data-link>Lanjutkan <span aria-hidden="true">→</span></a><a class="btn secondary" href="/jelajahi" data-link>Jelajahi tanpa akun</a></div>
        </div>
        <p class="small muted onboarding-privacy">Privasi: jangan masukkan NIK, kata sandi, nomor rekening, atau data sensitif. Persetujuan penyimpanan dan pemrosesan AI akan dijelaskan terpisah.</p>
      </div>`
  })

  S.route('/jelajahi', async (v) => {
    S.setTitle('Jelajahi sumber publik')
    const qs = new URLSearchParams(location.search)
    v.innerHTML = `
      <h1>Jelajahi sumber & peluang publik</h1>
      <p class="lead">Tautan ke penerbit resmi beserta status pemeriksaannya. Selalu baca syarat langsung di situs penerbit.</p>
      <form id="cat-form" class="card" role="search" aria-label="Cari katalog">
        <div class="grid">
          <div class="field"><label for="q">Kata kunci</label><input id="q" name="q" type="search" value="${esc(qs.get('q') || '')}" placeholder="mis. jaminan, pelatihan"></div>
          <div class="field"><label for="kind">Jenis</label><select id="kind" name="kind"><option value="">Semua</option><option value="resource">Sumber/layanan</option><option value="opportunity">Peluang</option></select></div>
          <div class="field"><label for="topic">Topik</label><select id="topic" name="topic"><option value="">Semua topik</option></select></div>
          <div class="field"><label for="status">Status</label><select id="status" name="status"><option value="">Semua status</option><option value="checked">Terverifikasi</option><option value="unverified">Belum diverifikasi</option><option value="stale">Informasi lama</option><option value="needs_review">Perlu diperiksa</option></select></div>
        </div>
        <button class="btn" type="submit">Terapkan</button>
      </form>
      <div class="notice small">Label <strong>“Belum diverifikasi SANDAR”</strong> berarti kami baru menautkan situs resmi penerbit, belum meninjau isi program. Label <strong>“Data contoh”</strong> menandai entri fiktif untuk pengujian.</div>
      <div id="cat-results" aria-live="polite"><p class="loading">Memuat katalog…</p></div>`
    $('#kind').value = qs.get('kind') || ''
    $('#status').value = qs.get('status') || ''
    const load = async () => {
      const p = new URLSearchParams()
      for (const k of ['q', 'kind', 'topic', 'status']) { const val = $('#' + k).value; if (val) p.set(k, val) }
      history.replaceState({}, '', '/jelajahi' + (p.toString() ? '?' + p : ''))
      const box = $('#cat-results')
      box.innerHTML = '<p class="loading">Memuat katalog…</p>'
      try {
        const d = await S.api('/catalogue/resources?' + p, { auth: false })
        const tsel = $('#topic')
        if (tsel.options.length <= 1) { d.topics.forEach((t) => tsel.insertAdjacentHTML('beforeend', `<option value="${esc(t)}">${esc(t)}</option>`)); tsel.value = qs.get('topic') || '' }
        box.innerHTML = d.items.length ? `<p class="small muted">${d.count} entri ditemukan.</p><div class="grid">${d.items.map(S.listingCard).join('')}</div>` : '<p>Belum ada entri yang cocok. Coba kata kunci lain atau hapus filter.</p>'
        announce(`${d.count} entri ditemukan`)
      } catch (e) { box.innerHTML = S.errorBox(e) }
    }
    $('#cat-form').addEventListener('submit', (e) => { e.preventDefault(); load() })
    load()
  })

  S.route('/jelajahi/:id', async (v, { id }) => {
    v.innerHTML = '<p class="loading">Memuat…</p>'
    const { item: it } = await S.api('/catalogue/resources/' + encodeURIComponent(id), { auth: false })
    S.setTitle(it.title)
    v.innerHTML = `
      <p><a href="/jelajahi" data-link>← Kembali ke katalog</a></p>
      <article>
        <div class="row">${S.statusBadge(it.verification)} ${it.is_sample ? '<span class="badge info">Data contoh — bukan program nyata</span>' : ''}</div>
        <h1 style="margin-top:.5rem">${esc(it.title)}</h1>
        <p class="lead">${esc(it.summary)}</p>
        ${!it.verification.is_current ? `<div class="notice warn" role="note">${it.verification.status === 'stale' ? 'Informasi ini sudah melewati jadwal pemeriksaan ulang. Jangan anggap masih berlaku sebelum memeriksa situs penerbit.' : 'SANDAR belum memverifikasi isi program ini. Periksa ketentuan langsung di situs penerbit.'}</div>` : ''}
        <section class="layer" aria-labelledby="prov"><h3 id="prov">Asal-usul informasi <span class="badge info">Fakta sumber publik</span></h3>
          <dl class="kv">
            <dt>Penerbit</dt><dd>${esc(it.publisher.name)}</dd>
            <dt>Cakupan</dt><dd>${esc(it.coverage || it.jurisdiction)}</dd>
            <dt>Sumber resmi</dt><dd><a href="${esc(it.official_source_url)}" target="_blank" rel="noopener noreferrer">${esc(it.source_title || it.official_source_url)} <span class="sr-only">(membuka tab baru)</span>↗</a></dd>
            <dt>Diambil</dt><dd>${fmtDate(it.retrieved_at)}</dd>
            <dt>Terakhir diverifikasi</dt><dd>${it.last_verified_at ? fmtDate(it.last_verified_at) : 'Belum diverifikasi'}</dd>
            <dt>Jadwal tinjau</dt><dd>Setiap ${esc(it.review_interval_days)} hari</dd>
            <dt>Topik</dt><dd>${it.topics.map((t) => `<span class="badge neutral">${esc(t)}</span>`).join(' ')}</dd>
          </dl>
        </section>
        ${it.caveats ? `<section class="layer"><h3>Catatan penting</h3><p>${esc(it.caveats)}</p></section>` : ''}
        <section class="layer" aria-labelledby="rep"><h3 id="rep">Ada yang salah atau kedaluwarsa?</h3>
          <form id="report" class="row"><label for="reason" class="sr-only">Alasan</label>
            <select id="reason"><option value="link_broken">Tautan rusak</option><option value="outdated">Informasi lama</option><option value="incorrect">Tidak sesuai sumber</option><option value="other">Lainnya</option></select>
            <button class="btn secondary" type="submit">Laporkan untuk ditinjau</button></form>
          <div id="rep-msg" aria-live="polite"></div>
          <p class="small muted">Laporan menandai entri untuk ditinjau kurator; tidak otomatis berarti entri salah. Tidak ada data pribadi yang dikirim.</p>
        </section>
      </article>`
    $('#report').addEventListener('submit', async (e) => {
      e.preventDefault()
      try { const r = await S.api(`/catalogue/resources/${encodeURIComponent(id)}/report`, { method: 'POST', body: { reason: $('#reason').value }, auth: false }); $('#rep-msg').innerHTML = `<div class="notice ok">${esc(r.message)}</div>` } catch (err) { $('#rep-msg').innerHTML = S.errorBox(err) }
    })
  })

  // Guest calculator — in-memory only, nothing is sent or stored.
  S.route('/coba/arus-uang', async (v) => {
    S.setTitle('Coba hitung arus uang')
    const items = []
    v.innerHTML = `
      <h1>Hitung arus uang (tanpa akun)</h1>
      <p class="lead">Masukkan pemasukan dan pengeluaran untuk satu bulan. Angka hanya ada di halaman ini dan hilang saat halaman ditutup — tidak dikirim ke server.</p>
      <p class="small muted">Alat ini tidak memberi nasihat keuangan dan tidak menebak angka Anda.</p>
      <form id="g-form" class="card" novalidate>
        <fieldset><legend>Arah</legend>
          <label class="choice"><input type="radio" name="dir" value="inflow" checked> Pemasukan</label>
          <label class="choice"><input type="radio" name="dir" value="outflow"> Pengeluaran</label>
        </fieldset>
        <div class="field"><label for="g-label">Nama entri</label><input id="g-label" type="text" maxlength="80" required aria-describedby="g-label-h"><span id="g-label-h" class="hint">Contoh: gaji, listrik, sewa. Hindari informasi pribadi.</span></div>
        <div class="field"><label for="g-amt">Jumlah per bulan (Rp)</label><input id="g-amt" type="text" inputmode="numeric" required aria-describedby="g-amt-h"><span id="g-amt-h" class="hint">Bilangan bulat tanpa titik, mis. 1500000.</span></div>
        <fieldset><legend>Kepastian</legend>
          <label class="choice"><input type="radio" name="cert" value="confirmed"> Pasti</label>
          <label class="choice"><input type="radio" name="cert" value="estimated" checked> Perkiraan</label>
          <label class="choice"><input type="radio" name="cert" value="unknown"> Belum tahu</label>
        </fieldset>
        <div id="g-err" role="alert"></div>
        <button class="btn" type="submit">Tambahkan</button>
      </form>
      <div id="g-out" aria-live="polite"></div>
      <div class="notice">Ingin menyimpan, membuat skenario, dan rencana? <a href="/masuk?next=/ruang/arus-uang" data-link>Masuk ke Ruang Saya</a> — penyimpanan hanya setelah Anda menyetujuinya.</div>`
    const render = () => {
      const inflow = items.filter((i) => i.dir === 'inflow').reduce((a, b) => a + b.amt, 0)
      const outflow = items.filter((i) => i.dir === 'outflow').reduce((a, b) => a + b.amt, 0)
      $('#g-out').innerHTML = items.length ? `
        <section class="layer"><h3>Angka yang Anda masukkan <span class="badge neutral">Fakta dari Anda</span></h3>
          <div class="table-wrap"><table><thead><tr><th>Entri</th><th>Arah</th><th>Kepastian</th><th class="num">Jumlah</th><th><span class="sr-only">Aksi</span></th></tr></thead><tbody>
          ${items.map((i, ix) => `<tr><td>${esc(i.label)}</td><td>${i.dir === 'inflow' ? 'Masuk' : 'Keluar'}</td><td>${{ confirmed: 'Pasti', estimated: 'Perkiraan', unknown: 'Belum tahu' }[i.cert]}</td><td class="num">${idr(i.amt)}</td><td><button class="btn link" data-del="${ix}" aria-label="Hapus ${esc(i.label)}">Hapus</button></td></tr>`).join('')}
          </tbody></table></div></section>
        <section class="layer"><h3>Perhitungan <span class="badge info">Perhitungan sistem</span></h3>
          <dl class="kv"><dt>Total pemasukan</dt><dd>${idr(inflow)}</dd><dt>Total pengeluaran</dt><dd>${idr(outflow)}</dd><dt>Selisih</dt><dd><strong>${idr(inflow - outflow)}</strong></dd></dl>
          <p class="small muted">Asumsi: semua entri dihitung sekali dalam satu bulan. Perkiraan, bukan prediksi.</p></section>` : '<p class="muted">Belum ada entri.</p>'
      $$('[data-del]').forEach((b) => (b.onclick = () => { items.splice(+b.dataset.del, 1); render(); announce('Entri dihapus') }))
    }
    $('#g-form').addEventListener('submit', (e) => {
      e.preventDefault()
      const label = $('#g-label').value.trim()
      const raw = $('#g-amt').value.trim().replace(/[.\s]/g, '')
      const err = $('#g-err')
      if (!label) { err.innerHTML = '<p class="err">Nama entri wajib diisi.</p>'; return $('#g-label').focus() }
      if (!/^\d{1,13}$/.test(raw)) { err.innerHTML = '<p class="err">Jumlah harus bilangan bulat tanpa desimal.</p>'; return $('#g-amt').focus() }
      err.innerHTML = ''
      items.push({ label: label.slice(0, 80), amt: Number(raw), dir: $('input[name=dir]:checked').value, cert: $('input[name=cert]:checked').value })
      $('#g-label').value = ''; $('#g-amt').value = ''
      render(); announce('Entri ditambahkan, hasil diperbarui'); $('#g-label').focus()
    })
    render()
  })

  S.route('/masuk', async (v) => {
    S.setTitle('Masuk')
    const next = new URLSearchParams(location.search).get('next')
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/ruang'
    if (/\.pages\.dev$/.test(location.hostname)) { v.innerHTML = `<h1>Masuk</h1><div class="notice">Masuk tersedia di domain utama SANDAR. <a class="btn" href="https://www.sandar.biz.id/masuk?next=${encodeURIComponent(safeNext)}">Lanjut ke www.sandar.biz.id</a></div>`; return }
    if (!cfg.clerkPk) { v.innerHTML = '<h1>Masuk</h1><div class="notice warn">Layanan masuk belum dikonfigurasi. Katalog publik tetap tersedia.</div>'; return }
    if (S.signedIn()) return S.go(safeNext)
    v.innerHTML = `
      <h1>Masuk atau daftar</h1>
      <div class="trust small">Akun diperlukan hanya untuk menyimpan data pribadi di Ruang Saya. Masuk diproses oleh Clerk (penyedia autentikasi). SANDAR tidak menyimpan kata sandi Anda. Setelah masuk, Anda tetap memilih apakah data disimpan.</div>
      <div id="clerk-mount"><p class="loading">Memuat formulir masuk…</p></div>`
    if (!S.state.clerk) { $('#clerk-mount').innerHTML = '<div class="notice bad" role="alert">Layanan masuk sedang tidak dapat dimuat. Coba muat ulang halaman.</div>'; return }
    $('#clerk-mount').innerHTML = ''
    S.state.clerk.mountSignIn($('#clerk-mount'), { forceRedirectUrl: safeNext, signUpForceRedirectUrl: safeNext, routing: 'hash' })
  })

  const staticPage = (title, html) => async (v) => { S.setTitle(title); v.innerHTML = `<h1>${esc(title)}</h1>${html}` }
  S.route('/cara-kerja', staticPage('Cara kerja SANDAR', `
    <p class="lead">SANDAR adalah perangkat lunak swalayan: satu pusat komando (SANDAR Core) yang mengarahkan tujuan Anda ke agen spesialis dengan batasan yang jelas.</p>
    <h2>Agen spesialis</h2>
    <ul><li><strong>Navigasi Hidup</strong> — menata situasi, tujuan, dan pilihan.</li><li><strong>Navigasi Keuangan</strong> — perhitungan deterministik dari angka Anda; bukan penasihat.</li><li><strong>Sumber & Layanan Publik</strong> — sumber resmi beserta asal-usul dan tanggal pemeriksaan.</li><li><strong>Peluang & Keterampilan</strong> — jalur belajar dan peluang dari informasi publik.</li><li><strong>Ketahanan & Rencana ke Depan</strong> — rencana cadangan, bukan prediksi.</li><li><strong>Rencana & Kemajuan</strong> — langkah yang Anda kendalikan.</li></ul>
    <h2>Lapisan hasil yang dipisahkan</h2>
    <p>Setiap hasil memisahkan <span class="badge neutral">Fakta dari Anda</span> <span class="badge info">Perhitungan sistem</span> <span class="badge ok">Fakta sumber publik</span> <span class="badge warn">Saran</span> <span class="badge warn">Saran AI</span>, beserta asumsi dan ketidakpastian.</p>
    <h2>Saat AI atau pencarian tidak tersedia</h2>
    <p>SANDAR tetap memberi rencana dasar dari logika deterministik dan katalog. AI dan pencarian web bersifat opsional, memerlukan persetujuan terpisah, dan dibatasi kuota.</p>`))
  S.route('/privasi', staticPage('Pemberitahuan privasi (draf)', `
    <div class="notice warn">Draf untuk ditinjau pemilik/penasihat hukum. Belum merupakan dokumen hukum yang disetujui.</div>
    <h2>Data yang kami simpan</h2><ul><li>Identitas akun dari penyedia autentikasi (pengenal unik; kata sandi tidak disimpan SANDAR).</li><li>Data yang Anda simpan sendiri: tujuan, entri arus uang, tugas, rencana — hanya setelah Anda memberi persetujuan penyimpanan.</li><li>Catatan persetujuan (tujuan, versi pemberitahuan, waktu).</li><li>Catatan audit minimal tanpa isi formulir.</li></ul>
    <h2>Yang tidak kami lakukan</h2><ul><li>Tidak menjual data, tidak beriklan berbasis perilaku, tidak memakai data Anda untuk melatih model.</li><li>Tidak meminta NIK, kredensial bank, alamat lengkap, data kesehatan, atau data anggota keluarga.</li><li>Tidak mengirim data pribadi ke AI atau pihak ketiga secara bawaan.</li></ul>
    <h2>Pemrosesan opsional</h2><p><strong>Bantuan AI (Groq)</strong> dan <strong>pencarian web (Tavily)</strong> hanya berjalan bila Anda mengaktifkan persetujuan masing-masing. Yang dikirim hanya teks tujuan yang telah disamarkan (email, nomor telepon, nomor identitas, dan nominal uang dihapus). Data arus uang tidak pernah dikirim.</p>
    <h2>Hak Anda</h2><p>Ekspor dan hapus seluruh data ruang kerja dari <a href="/pengaturan" data-link>Pengaturan & Privasi</a>. Cadangan database penyedia infrastruktur mengikuti jendela retensi penyedia.</p>`))
  S.route('/ketentuan', staticPage('Ketentuan layanan (draf)', `
    <div class="notice warn">Draf untuk ditinjau. Belum disetujui secara hukum.</div>
    <ul><li>SANDAR menyediakan alat bantu perencanaan swalayan. Hasilnya adalah saran, bukan keputusan resmi atau nasihat profesional.</li><li>SANDAR tidak menjamin kelayakan bantuan, pekerjaan, penghasilan, atau hasil apa pun.</li><li>SANDAR tidak melakukan transaksi, pengajuan, atau pengiriman pesan atas nama pengguna.</li><li>Paket berbayar belum dibuka. Harga yang ditampilkan adalah hipotesis dan dapat berubah sebelum peluncuran.</li><li>Dilarang menggunakan SANDAR untuk memprofilkan atau mengawasi orang lain.</li></ul>`))
  S.route('/aksesibilitas', staticPage('Aksesibilitas', `<p>Target kami WCAG 2.2 AA: struktur semantik, navigasi papan ketik, fokus terlihat, label formulir, kontras, dukungan zoom, pengumuman pembaca layar, dan gerak berkurang. Pengujian dengan pengguna pembaca layar belum dilakukan. Laporkan hambatan melalui halaman <a href="/bantuan" data-link>Bantuan</a>.</p>`))
  S.route('/bantuan', staticPage('Bantuan & kontak', `<p>SANDAR adalah produk swalayan. Untuk pertanyaan, laporan keamanan, atau hambatan aksesibilitas, hubungi pemilik produk melalui <a href="https://github.com/Sparkmind-obp-off/Sandar/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>. Jangan sertakan data pribadi.</p><div class="notice">Dalam keadaan darurat, hubungi <strong>112</strong>.</div>`))
  S.route('/harga', async (v) => {
    S.setTitle('Paket & harga')
    v.innerHTML = '<p class="loading">Memuat…</p>'
    const d = await S.api('/pricing', { auth: false })
    v.innerHTML = `
      <h1>Paket & harga</h1>
      <div class="notice warn" role="note"><strong>Hipotesis harga.</strong> ${esc(d.note)}</div>
      <div class="grid">${d.plans.map((p) => `
        <article class="card"><h2 style="margin-top:0">${esc(p.name)}</h2>
          <p class="price">${p.price_minor === null ? 'Hubungi kami' : p.price_minor === 0 ? 'Rp0' : idr(p.price_minor)}<span class="small muted">${p.billing_period === 'month' ? ' / bulan' : p.billing_period === 'year' ? ' / tahun' : ''}</span></p>
          <p class="small">${esc(p.description)}</p>
          ${p.quotas.agent_runs_per_month ? `<ul class="small"><li>${p.quotas.agent_runs_per_month} tugas agen / bulan</li><li>${p.quotas.ai_assist_per_month} bantuan AI / bulan (fair-use)</li><li>${p.quotas.external_search_per_month} pencarian web / bulan</li><li>${p.quotas.active_plans} rencana aktif</li></ul>` : ''}
          <ul class="small">${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          ${p.id === 'free' ? '<span class="badge ok">Paket bawaan semua akun</span>' : `<button class="btn secondary" disabled aria-disabled="true">Belum tersedia</button>`}
        </article>`).join('')}</div>
      <p class="small muted">Informasi esensial — katalog sumber publik, perhitungan dasar, rencana, ekspor, dan hapus data — selalu gratis. Tidak ada AI tanpa batas. Saat kuota habis, fitur tanpa AI tetap dapat dipakai. Versi harga: ${esc(d.pricing_version)}.</p>`
  })
})()

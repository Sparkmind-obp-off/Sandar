/* SANDAR bootstrap: layout first (public content never waits for auth), then auth, then route. */
(function () {
  'use strict'
  const S = window.SANDAR
  S.renderLayout()
  const needsAuth = /^\/(ruang|pengaturan|masuk)/.test(location.pathname)
  if (!needsAuth) S.router()
  else S.view().innerHTML = '<p class="loading">Memuat…</p>'
  S.initAuth().then(() => { S.renderNav(); S.router() })
})()

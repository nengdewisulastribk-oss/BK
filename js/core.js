/* ==========================================================
   CORE — util, API client (fetch ke GAS), cache SWR, router, UI
   Prinsip gas-instant-ux: SPA (navigasi 0 ms), render dari cache dulu
   lalu segarkan di latar belakang, Optimistic UI, batch di server.
   ========================================================== */
'use strict';
const BK = window.BK = { cfg: window.BK_CONFIG, ic: window.BK_ic, routes: [], leave: [], state: {} };
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
BK.$ = $; BK.$$ = $$;
BK.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const esc = BK.esc;
BK.sleep = ms => new Promise(r => setTimeout(r, ms));
BK.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
BK.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/* ---------- penyimpanan ---------- */
const mk = st => ({
  get(k, d) { try { const v = st.getItem('bk_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { st.setItem('bk_' + k, JSON.stringify(v)); } catch (e) { /* kuota penuh */ } },
  del(k) { try { st.removeItem('bk_' + k); } catch (e) {} },
  clear(prefix) { try { Object.keys(st).filter(k => k.indexOf('bk_' + prefix) === 0).forEach(k => st.removeItem(k)); } catch (e) {} }
});
BK.LS = mk(localStorage);   // referensi publik & draf formulir
BK.SS = mk(sessionStorage); // cache data admin (hilang saat tab ditutup — privasi)

/* ---------- sesi admin ---------- */
BK.Auth = {
  token: null, user: null,
  load() {
    try {
      const raw = sessionStorage.getItem('bk_sess') || localStorage.getItem('bk_sess');
      if (raw) { const o = JSON.parse(raw); this.token = o.token; this.user = o.user; }
    } catch (e) {}
  },
  save(token, user, remember) {
    this.token = token; this.user = user;
    const s = JSON.stringify({ token, user });
    sessionStorage.removeItem('bk_sess'); localStorage.removeItem('bk_sess');
    (remember ? localStorage : sessionStorage).setItem('bk_sess', s);
  },
  patch(user) { this.user = user; const w = localStorage.getItem('bk_sess') ? localStorage : sessionStorage; w.setItem('bk_sess', JSON.stringify({ token: this.token, user })); },
  clear() { this.token = null; this.user = null; sessionStorage.removeItem('bk_sess'); localStorage.removeItem('bk_sess'); BK.SS.clear('c_'); BK.cache = {}; }
};
BK.cache = {}; // cache memori (paling cepat)
BK.isSuper = () => BK.Auth.user && BK.Auth.user.role === 'Super Admin';

/* ---------- API client ---------- */
const mkErr = (code, msg) => { const e = new Error(msg); e.code = code; return e; };
const READ = new Set(['getPublic', 'dashboard', 'listTamu', 'getFoto', 'getSettings', 'listUsers', 'listLog', 'listTrash', 'exportTamu', 'me']);
BK.configured = () => !!BK.cfg.GAS_URL && !/XXXX/.test(BK.cfg.GAS_URL);

BK.api = async function (action, data, o) {
  o = o || {};
  if (!BK.configured()) throw mkErr('CONFIG', 'URL backend (GAS_URL) belum diisi di js/config.js');
  const tries = (o.retry != null ? o.retry : READ.has(action) ? 2 : 0) + 1;
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), o.timeout || 45000);
    try {
      // text/plain => tidak memicu CORS preflight (diblok GAS)
      const res = await fetch(BK.cfg.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: BK.Auth.token, tz: BK.tz(), data: data || {} }), signal: ctl.signal, redirect: 'follow' });
      clearTimeout(tm);
      const j = await res.json();
      BK.online(true);
      if (!j.success) {
        if (j.code === 'AUTH' && action !== 'login') { BK.Auth.clear(); BK.toast(j.message || 'Sesi berakhir', 'warn'); BK.go('#/admin/login'); }
        throw mkErr(j.code || 'ERR', j.message || 'Terjadi kesalahan');
      }
      return j.data;
    } catch (e) {
      clearTimeout(tm); last = e;
      if (e.code) throw e;
      BK.online(false);
      if (i < tries - 1) await BK.sleep(700 * (i + 1));
    }
  }
  throw mkErr('NET', 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.');
};

// GET ringan (tanpa preflight) untuk data publik & pemanasan server
BK.warm = () => { if (BK.configured()) fetch(BK.cfg.GAS_URL + '?action=ping', { mode: 'no-cors' }).catch(() => {}); };
BK.online = ok => { BK.state.online = ok; const el = $('#syncDot'); if (el) { el.className = 'sync-dot' + (ok ? '' : ' off'); el.lastChild.textContent = ok ? 'Sistem Aktif' : 'Tidak Terhubung'; } };

/* Stale-While-Revalidate: tampilkan cache seketika, lalu segarkan.
   render(data, fromCache) dipanggil 1x (cache) dan 1x (segar). */
BK.swr = function (key, fetcher, render) {
  let c = BK.cache[key] || BK.SS.get('c_' + key);
  if (c) render(c.d !== undefined ? c.d : c, true);
  return fetcher().then(d => { const o = { t: Date.now(), d }; BK.cache[key] = o; BK.SS.set('c_' + key, o); render(d, false); return d; })
    .catch(e => { if (!c) throw e; BK.toast('Menampilkan data tersimpan — ' + e.message, 'warn'); });
};

/* ---------- zona waktu PERANGKAT (otomatis, tanpa konfigurasi) ----------
   Nama zona IANA dibaca dari browser/perangkat lalu dikirim di setiap request ke server.
   Waktu dari server berupa instan UTC ("...Z") dan otomatis ditampilkan dalam jam perangkat. */
const p2 = n => String(n).padStart(2, '0');
BK.tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } };
const TZ_ID = { 'Asia/Jakarta': 'WIB', 'Asia/Pontianak': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Ujung_Pandang': 'WITA', 'Asia/Jayapura': 'WIT' };
let _ab = { t: 0, v: '' };
BK.tzAbbr = () => {   // singkatan zona: WIB / WITA / WIT, atau GMT±n untuk zona lain
  if (Date.now() - _ab.t < 600000 && _ab.v) return _ab.v;
  let v = TZ_ID[BK.tz()];
  if (!v) { try { const x = new Intl.DateTimeFormat('id-ID', { timeZoneName: 'short' }).formatToParts(new Date()).find(y => y.type === 'timeZoneName'); v = x && x.value; } catch (e) {} }
  if (!v) { const o = -new Date().getTimezoneOffset(), a = Math.abs(o); v = 'GMT' + (o < 0 ? '-' : '+') + Math.floor(a / 60) + (a % 60 ? ':' + p2(a % 60) : ''); }
  _ab = { t: Date.now(), v }; return v;
};
BK.tzLabel = () => BK.tzAbbr() + (BK.tz() ? ' (' + BK.tz() + ')' : '');   // mis. "WITA (Asia/Makassar)"
BK.nowStr = () => new Date().toLocaleString('id-ID') + ' ' + BK.tzAbbr();   // "Dicetak" pada laporan: jam perangkat + zona
BK.localYMD = d => { d = d || new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };   // tanggal menurut jam perangkat

/* ---------- format ---------- */
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
BK.fmtTgl = s => { s = String(s || '').substring(0, 10); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + ' ' + BLN[+m[2] - 1] + ' ' + m[1] : (s || '-'); };
BK.fmtDT = iso => { if (!iso) return '-'; const d = new Date(iso); return isNaN(d) ? String(iso) : BK.fmtTgl(BK.localYMD(d)) + ', ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ' ' + BK.tzAbbr(); };
BK.ago = iso => {
  const t = new Date(iso).getTime(); if (!t) return ''; const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' menit lalu'; if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
  return Math.floor(s / 86400) + ' hari lalu';
};
BK.initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
BK.JENIS = { siswa: { l: 'Siswa', ic: 'school', d: 'Peserta didik aktif' }, umum: { l: 'Umum', ic: 'users', d: 'Orang tua / wali / guru' }, khusus: { l: 'Khusus', ic: 'building', d: 'Dinas / instansi' } };
BK.badgeJenis = j => `<span class="badge b-${j}"><i class="dot"></i>${esc((BK.JENIS[j] || {}).l || j)}</span>`;
BK.badgeStatus = s => `<span class="badge s-${esc(s || 'Baru')}"><i class="dot"></i>${esc(s || 'Baru')}</span>`;
BK.avatar = (r, cls) => `<span class="avatar ${cls || ''}">${r.Thumb ? `<img src="${esc(r.Thumb)}" alt="" loading="lazy">` : esc(BK.initials(r.Nama))}</span>`;
BK.logo = (cls) => `<img src="${esc(BK.cfg.LOGO)}" alt="Logo BK" class="${cls || ''}" onerror="this.onerror=null;this.src='assets/logo.svg'">`;

/* ---------- toast & modal ---------- */
BK.toast = function (msg, type, ms) {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div'); t.className = 'toast ' + (type || '');
  t.innerHTML = BK.ic(type === 'err' ? 'alert' : type === 'warn' ? 'info' : 'checkc', 18) + '<span>' + esc(msg) + '</span>';
  box.appendChild(t); setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, ms || 3200);
};
BK.modal = function (html, o) {
  o = o || {};
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  const close = v => { ov.remove(); document.removeEventListener('keydown', esc_); if (o.onClose) o.onClose(v); };
  const esc_ = e => { if (e.key === 'Escape' && !o.sticky) close(); };
  ov.addEventListener('mousedown', e => { if (e.target === ov && !o.sticky) close(); });
  document.addEventListener('keydown', esc_);
  document.body.appendChild(ov);
  ov.close = close; const f = $('input,select,textarea,button.btn-primary', ov); if (f && !o.noFocus) f.focus();
  return ov;
};
BK.confirm = (title, text, okLabel, danger) => new Promise(res => {
  const m = BK.modal(`<h3>${esc(title)}</h3><p class="t2">${text}</p>
    <div class="foot"><button class="btn btn-outline" data-r="0">Batal</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(okLabel || 'Ya, lanjutkan')}</button></div>`, { onClose: () => res(false) });
  $$('[data-r]', m).forEach(b => b.onclick = () => { const v = b.dataset.r === '1'; m.remove(); res(v); });
});
BK.loading = (btn, on, label) => {
  if (!btn) return; if (on) { btn.dataset.h = btn.innerHTML; btn.innerHTML = '<span class="spin"></span> ' + (label || 'Memproses...'); btn.classList.add('is-loading'); }
  else { if (btn.dataset.h) btn.innerHTML = btn.dataset.h; btn.classList.remove('is-loading'); }
};
BK.copy = async (txt, msg) => { try { await navigator.clipboard.writeText(txt); } catch (e) { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } BK.toast(msg || 'Disalin'); };
BK.download = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

/* ---------- gambar: kompres di sisi pengguna (target <= 500 KB, lebar 800 px) ---------- */
BK.compress = function (src, maxW, maxKB) {
  maxW = maxW || 800; maxKB = maxKB || 500;
  const w0 = src.videoWidth || src.naturalWidth || src.width, h0 = src.videoHeight || src.naturalHeight || src.height;
  let w = Math.min(maxW, w0), h = Math.round(h0 * w / w0), q = 0.85, out;
  const c = document.createElement('canvas');
  for (let i = 0; i < 8; i++) {
    c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h);
    out = c.toDataURL('image/jpeg', q);
    if (out.length * 0.75 / 1024 <= maxKB) break;
    if (q > 0.5) q -= 0.1; else { w = Math.round(w * 0.85); h = Math.round(h * 0.85); }
  }
  return out;
};
BK.thumb = function (src) {
  const w0 = src.videoWidth || src.naturalWidth || src.width, h0 = src.videoHeight || src.naturalHeight || src.height, s = Math.min(w0, h0), S = 56;
  const c = document.createElement('canvas'); c.width = c.height = S;
  c.getContext('2d').drawImage(src, (w0 - s) / 2, (h0 - s) / 2, s, s, 0, 0, S, S);
  return c.toDataURL('image/jpeg', 0.55);
};

/* ---------- router hash (SPA, tanpa reload) ---------- */
BK.route = (re, fn, o) => BK.routes.push({ re, fn, o: o || {} });
BK.onLeave = fn => BK.leave.push(fn);
BK.go = h => { if (location.hash === h) BK.resolve(); else location.hash = h; };
BK.parse = () => {
  const raw = location.hash.replace(/^#/, '') || '/', [path, qs] = raw.split('?');
  const q = {}; (qs || '').split('&').filter(Boolean).forEach(p => { const [k, v] = p.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  return { path, q };
};
BK.resolve = function () {
  const { path, q } = BK.parse();
  BK.leave.splice(0).forEach(f => { try { f(); } catch (e) {} });
  for (const r of BK.routes) {
    const m = path.match(r.re);
    if (!m) continue;
    if (r.o.admin && !BK.Auth.token) { BK.go('#/admin/login'); return; }
    if (r.o.superOnly && !BK.isSuper()) { BK.toast('Halaman ini khusus Super Admin', 'warn'); BK.go('#/admin'); return; }
    window.scrollTo(0, 0);
    r.fn(m.slice(1), q); return;
  }
  BK.go('#/');
};
window.addEventListener('hashchange', () => BK.resolve());

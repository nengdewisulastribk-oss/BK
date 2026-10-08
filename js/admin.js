/* ==========================================================
   PANEL ADMIN (1/2) — shell, login, dashboard, data tamu, detail/edit
   ========================================================== */
(function () {
  'use strict';
  const { $, $$, esc, ic } = BK;
  BK.rec = {};      // registri baris tamu (detail terbuka instan dari memori)
  BK.photos = {};   // cache foto penuh (memori saja)
  const reg = rows => (rows || []).forEach(r => { BK.rec[r.ID_Kunjungan] = r; });
  const fail = e => BK.toast(e.message || 'Terjadi kesalahan', 'err', 4500);
  const NAV = [
    { id: 'dash', h: '#/admin', l: 'Dashboard', i: 'grid' },
    { id: 'tamu', h: '#/admin/tamu', l: 'Data Tamu', i: 'users' },
    { id: 'users', h: '#/admin/users', l: 'Kelola Admin', i: 'shieldok', sup: 1 },
    { id: 'log', h: '#/admin/log', l: 'Log & Pengaturan', i: 'sliders', sup: 1 }
  ];
  const appUrl = () => location.origin + location.pathname;
  const device = () => { const u = navigator.userAgent; return (/Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iOS' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'Perangkat') + ' ' + (/Edg/.test(u) ? 'Edge' : /Chrome/.test(u) ? 'Chrome' : /Firefox/.test(u) ? 'Firefox' : /Safari/.test(u) ? 'Safari' : ''); };
  BK.appUrl = appUrl;

  /* ---------- shell ---------- */
  function shell(active) {
    const u = BK.Auth.user || {};
    if (BK.state.mode !== 'adm') {
      BK.state.mode = 'adm';
      const items = NAV.filter(n => !n.sup || BK.isSuper());
      $('#app').innerHTML = `<div class="adm">
      <aside class="side"><a class="brand" href="#/admin" style="padding:0 6px 14px;justify-content:center">${BK.logo()}<div><b>${esc(BK.cfg.NAMA_APP)}</b><span>Layanan Konseling Digital</span></div></a>
        <span class="eyebrow" style="padding:6px 12px">Menu Utama</span>
        ${items.map(n => `<a class="nav-a" data-n="${n.id}" href="${n.h}" title="${n.l}">${ic(n.i, 20)}<span class="nav-l">${n.l}</span>${n.sup ? '<span class="tagx">Super Admin</span>' : ''}</a>`).join('')}
        <span class="eyebrow" style="padding:18px 12px 6px;margin-top:auto">Akses Cepat</span>
        <a class="nav-a" href="#/" title="Portal Tamu">${ic('qr', 20)}<span class="nav-l">Portal Tamu</span></a>
        <a class="nav-a out" href="javascript:void 0" data-act="logout" title="Keluar">${ic('logout', 20)}<span class="nav-l">Logout Sesi</span></a>
        <div class="me"><span class="avatar">${esc(BK.initials(u.nama))}</span><div class="t grow"><b class="ell" style="display:block;font-size:13px">${esc(u.nama)}</b><span class="small muted">${esc(u.role)}</span></div></div></aside>
      <div style="min-width:0"><header class="topbar">
        <form class="search" id="gsearch" role="search">${ic('search', 17)}<input type="search" placeholder="Cari tamu, ID kunjungan, instansi..." aria-label="Cari"></form>
        <span class="grow"></span><span id="syncDot" class="sync-dot"><i class="dot"></i><span>Sistem Aktif</span></span>
        <button class="btn btn-primary btn-sm" data-act="qr" style="display:none" id="qrBtn">${ic('qr', 15)} Unduh QR</button>
        <div style="position:relative"><button class="avatar lg" id="me" aria-label="Menu akun" style="cursor:pointer;background:var(--primary);color:#fff;border:0">${ic('user', 18)}</button></div>
      </header><main id="main" class="main"></main></div>
      <nav class="bottom-nav">${items.map(n => `<a data-n="${n.id}" href="${n.h}">${ic(n.i, 20)}<span>${n.l.split(' ')[0]}</span></a>`).join('')}<a href="#/">${ic('qr', 20)}<span>Portal</span></a></nav></div>`;
      $('#qrBtn').style.display = '';
      $('#gsearch').onsubmit = e => { e.preventDefault(); BK.state.Q = Object.assign(qDefault(), { q: e.target.querySelector('input').value.trim() }); BK.go('#/admin/tamu'); };
      $('#app').addEventListener('click', onShellClick);
    }
    $$('.nav-a[data-n],.bottom-nav a[data-n]').forEach(a => a.classList.toggle('on', a.dataset.n === active));
    return $('#main');
  }
  function onShellClick(e) {
    const a = e.target.closest('[data-act]'); const me = e.target.closest('#me');
    if (me) { toggleMenu(); return; }
    if (!a) { const p = $('.menu-pop'); if (p && !e.target.closest('.menu-pop')) p.remove(); return; }
    if (a.dataset.act === 'logout') logout();
    if (a.dataset.act === 'qr') BK.qrModal();
  }
  function toggleMenu() {
    const old = $('.menu-pop'); if (old) { old.remove(); return; }
    const u = BK.Auth.user, d = document.createElement('div'); d.className = 'menu-pop';
    d.innerHTML = `<div style="padding:10px 12px"><b>${esc(u.nama)}</b><div class="small muted">${esc(u.role)} • @${esc(u.username)}</div></div><hr style="border:0;border-top:1px solid var(--border);margin:4px 0">
      <button data-m="pw">${ic('key', 16)} Ubah Password</button><button data-m="qr">${ic('qr', 16)} QR Code Portal Tamu</button><button data-m="portal">${ic('ext', 16)} Buka Portal Tamu</button><button data-m="out" style="color:#DC2626">${ic('logout', 16)} Keluar</button>`;
    $('#me').parentNode.appendChild(d);
    d.onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; d.remove(); ({ pw: () => BK.pwModal(), qr: () => BK.qrModal(), portal: () => window.open(appUrl(), '_blank'), out: logout })[b.dataset.m](); };
  }
  async function logout() {
    const t = BK.Auth.token; BK.api('logout', {}, { retry: 0 }).catch(() => {});
    BK.Auth.clear(); BK.state.mode = null; BK.toast('Anda telah keluar', 'ok'); BK.go('#/admin/login');
  }

  /* ---------- login ---------- */
  function login() {
    if (BK.Auth.token) { BK.go('#/admin'); return; }
    BK.state.mode = 'login'; BK.warm();
    $('#app').innerHTML = `<div class="login-bg"><div class="login-card view-enter" style="text-align:center">
      <div style="width:130px;height:130px;margin:0 auto 12px;border-radius:50%;background:#F1ECDA;padding:6px">${BK.logo().replace('<img', '<img style="width:100%;height:100%;border-radius:50%"')}</div>
      <span class="pill tag-live"><i class="dot"></i> SISTEM BUKU TAMU BK DIGITAL</span>
      <h1 class="h-lg" style="margin:14px 0 6px">Portal Masuk Guru BK</h1><p class="t2">Silakan masukkan kredensial akun untuk mengelola buku tamu, rekapan konseling, dan data presensi.</p>
      <form id="lf" style="text-align:left;margin-top:22px;display:grid;gap:16px" novalidate>
        <div class="field"><label for="u">NIP atau Username Akun <span class="req">*</span></label><div class="input-wrap">${ic('user', 17)}<input class="input" id="u" autocomplete="username" autocapitalize="none" placeholder="Masukkan NIP atau username" required></div></div>
        <div class="field"><label for="p">Kata Sandi <span class="req">*</span></label><div class="input-wrap">${ic('lock', 17)}<input class="input" id="p" type="password" autocomplete="current-password" placeholder="••••••••" required><button type="button" class="btn-icon trail" id="eye" style="border:0;background:none" aria-label="Tampilkan sandi">${ic('eye', 18)}</button></div></div>
        <label class="check"><input type="checkbox" id="rm"> Ingat sesi perangkat ini (hingga 6 jam tanpa aktivitas)</label>
        <div id="lerr" class="alert warn hidden"></div>
        <button class="btn btn-primary btn-block" id="lb" type="submit" style="min-height:52px;font-size:15px">Masuk ke Panel Admin ${ic('arrow', 18)}</button></form>
      <div class="alert warn" style="text-align:left;margin-top:18px">${ic('shield', 18)}<div><b>Pemberitahuan Keamanan:</b> Akun akan dikunci sementara selama 15 menit setelah 5 kali percobaan gagal berturut-turut. Sesi otomatis berakhir setelah 60 menit tidak aktif.</div></div>
      <a href="#/" class="btn btn-outline btn-sm" style="margin-top:20px">${ic('back', 15)} Kembali ke Buku Tamu Kiosk (Halaman Tamu)</a></div></div>`;
    $('#eye').onclick = () => { const p = $('#p'); p.type = p.type === 'password' ? 'text' : 'password'; $('#eye').innerHTML = ic(p.type === 'password' ? 'eye' : 'eyeoff', 18); };
    $('#u').focus();
    $('#lf').onsubmit = async e => {
      e.preventDefault(); const u = $('#u').value.trim(), p = $('#p').value, box = $('#lerr'); box.classList.add('hidden');
      if (!u || !p) { box.textContent = 'Username dan kata sandi wajib diisi.'; box.classList.remove('hidden'); return; }
      BK.loading($('#lb'), true, 'Memeriksa...');
      try {
        const r = await BK.api('login', { username: u, password: p, remember: $('#rm').checked, perangkat: device() }, { retry: 1 });
        BK.Auth.save(r.token, r.user, $('#rm').checked); BK.state.mode = null;
        BK.api('dashboard').then(d => { BK.cache.dash = { t: Date.now(), d }; reg(d.recent); }).catch(() => {});  // prefetch: dashboard instan
        BK.go('#/admin'); if (r.user.wajibGanti) setTimeout(() => BK.pwModal(true), 300);
      } catch (er) { BK.loading($('#lb'), false); box.innerHTML = ic('alert', 16) + ' <div>' + esc(er.message) + '</div>'; box.classList.remove('hidden'); }
    };
  }

  /* ---------- ubah password (modal & kartu) ---------- */
  const strength = p => { const c = [p.length >= 8, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)]; return { c, n: c.filter(Boolean).length }; };
  BK.pwFormHtml = () => `<div style="display:grid;gap:14px">
    <div class="field"><label>Password Saat Ini</label><input class="input" id="pw0" type="password" autocomplete="current-password"></div>
    <div class="field"><label>Password Baru</label><input class="input" id="pw1" type="password" autocomplete="new-password" placeholder="Minimal 8 karakter, huruf besar/kecil & angka"><div class="prog" style="margin-top:6px"><i id="pwbar" style="width:0"></i></div><div class="help" id="pwhint"></div></div>
    <div class="field"><label>Ulangi Password Baru</label><input class="input" id="pw2" type="password" autocomplete="new-password"></div></div>`;
  BK.pwBind = root => {
    $('#pw1', root).oninput = e => { const s = strength(e.target.value); $('#pwbar', root).style.width = s.n * 25 + '%'; $('#pwbar', root).style.background = s.n < 3 ? '#F59E0B' : '#10B981'; $('#pwhint', root).textContent = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'][s.n]; };
  };
  BK.pwSubmit = async (root, btn) => {
    const a = $('#pw0', root).value, b = $('#pw1', root).value, c = $('#pw2', root).value;
    if (!a || !b) return BK.toast('Lengkapi semua kolom', 'warn');
    if (b !== c) return BK.toast('Ulangi password baru tidak sama', 'warn');
    if (strength(b).n < 3 || b.length < 8) return BK.toast('Password min. 8 karakter dengan huruf besar, kecil, dan angka', 'warn');
    BK.loading(btn, true);
    try { await BK.api('changePassword', { lama: a, baru: b }); BK.toast('Password berhasil diperbarui', 'ok'); const u = BK.Auth.user; u.wajibGanti = false; BK.Auth.patch(u); return true; }
    catch (e) { fail(e); } finally { BK.loading(btn, false); }
  };
  BK.pwModal = force => {
    const m = BK.modal(`<h3>${force ? 'Ganti Password Awal' : 'Ubah Password Pribadi'}</h3><p class="t2 small" style="margin-bottom:14px">${force ? 'Demi keamanan, ganti password sementara Anda sebelum melanjutkan.' : 'Perbarui kata sandi untuk akun Anda.'}</p>${BK.pwFormHtml()}
      <div class="foot">${force ? '' : '<button class="btn btn-outline" data-x>Batal</button>'}<button class="btn btn-primary" data-ok>${ic('lock', 15)} Perbarui Password</button></div>`, { sticky: !!force });
    BK.pwBind(m); const x = $('[data-x]', m); if (x) x.onclick = () => m.remove();
    $('[data-ok]', m).onclick = async e => { if (await BK.pwSubmit(m, e.currentTarget)) m.remove(); };
  };

  /* ---------- dashboard ---------- */
  let trendMode = 'hari';
  function dash() {
    const m = shell('dash'), u = BK.Auth.user;
    m.innerHTML = `<div class="view-enter" id="dv"><div class="page-head"><div><span class="pill tag-live"><i class="dot"></i> Sistem Informasi Presensi & Konseling • Live Sync</span><h1 class="h-lg" style="margin-top:8px">Selamat Datang, ${esc(u.nama)}</h1><p class="t2">Pantau ringkasan kunjungan ruang Bimbingan & Konseling hari ini secara real-time.</p></div>
      <div class="act"><button class="btn btn-outline btn-sm" id="rf">${ic('refresh', 15)} Sinkronisasi</button><button class="btn btn-primary btn-sm" data-act="qr">${ic('qr', 15)} Unduh QR Code</button></div></div><div id="dbody">${skel()}</div></div>`;
    $('#rf').onclick = e => { BK.loading(e.currentTarget, true, 'Sinkron...'); BK.api('dashboard').then(d => { BK.cache.dash = { t: Date.now(), d }; paintDash(d); BK.toast('Data disinkronkan', 'ok'); }).catch(fail).finally(() => BK.loading(e.currentTarget, false)); };
    BK.swr('dash', () => BK.api('dashboard'), d => paintDash(d)).catch(e => { $('#dbody').innerHTML = `<div class="card empty">${ic('wifi', 30)}<p style="margin-top:8px">${esc(e.message)}</p><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="BK.resolve()">Coba Lagi</button></div>`; });
  }
  const skel = () => `<div class="grid g4">${'<div class="card skel" style="height:150px"></div>'.repeat(4)}</div><div class="grid g-main" style="margin-top:16px"><div class="card skel" style="height:320px"></div><div class="card skel" style="height:320px"></div></div>`;
  const pct = (a, b) => b ? Math.round((a - b) / b * 100) : (a ? 100 : 0);
  const sgn = n => (n >= 0 ? '+' : '') + n + '%';
  function paintDash(d) {
    const box = $('#dbody'); if (!box) return; reg(d.recent);
    const y = d.trend.hari[5] ? d.trend.hari[5].n : 0, pj = d.perJenis, tj = pj.siswa + pj.umum + pj.khusus;
    const done = d.status.Selesai, tot = d.status.Baru + d.status.Diproses + done;
    box.innerHTML = `
    <div class="grid g4">
      <div class="card card-dark kpi"><div class="top"><div><span class="eyebrow">Ruang BK Hari Ini</span><div class="h-sm" style="margin-top:6px">Total Tamu Hari Ini</div></div><span class="ib">${ic('up', 18)}</span></div><div class="metric" style="margin-top:auto">${d.hariIni} <small style="font-size:14px;font-weight:500">Tamu</small></div><div class="sub"><span class="pill" style="background:rgba(255,255,255,.15);color:#fff">${sgn(pct(d.hariIni, y))}</span> dari kemarin (${y})</div></div>
      <div class="card kpi"><div class="top"><div><span class="eyebrow">${esc(d.bulanLabel)}</span><div class="h-sm" style="margin-top:6px">Total Kunjungan Bulanan</div></div><span class="ib">${ic('sheet', 18)}</span></div><div class="metric" style="margin-top:auto">${d.bulanIni} <small class="t2" style="font-size:14px;font-weight:500">Orang</small></div>
        <div class="sub"><span class="legend"><i style="background:var(--primary)"></i>${pj.siswa} Siswa</span><span class="legend"><i style="background:#3B82F6"></i>${pj.umum} Umum</span><span class="legend"><i style="background:#8B5CF6"></i>${pj.khusus} Khusus</span></div></div>
      <div class="card kpi"><div class="top"><div><span class="eyebrow">TA ${esc(d.taLabel)}</span><div class="h-sm" style="margin-top:6px">Kumulatif Layanan BK</div></div><span class="ib">${ic('school', 18)}</span></div><div class="metric" style="margin-top:auto">${d.ta} <small class="t2" style="font-size:14px;font-weight:500">Sesi</small></div><div class="sub">Total seluruh catatan: <b>${d.total}</b> • ${sgn(pct(d.bulanIni, d.bulanLalu))} dari bulan lalu</div></div>
      <div class="card card-mint kpi"><div class="top"><div><span class="eyebrow">Tindak Lanjut Guru BK</span><div class="h-sm" style="margin-top:6px">Status Penanganan</div></div><span class="ib">${ic('checkc', 18)}</span></div>
        <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px">${[['Baru', '#F59E0B', 'Antre'], ['Diproses', '#3B82F6', 'Proses'], ['Selesai', '#10B981', 'Selesai']].map(s => `<div class="stat-box"><b style="color:${s[1]}">${d.status[s[0]]}</b><span class="small muted">${s[2]}</span></div>`).join('')}</div>
        <div class="sub">Efisiensi tuntas: <b>${tot ? (done / tot * 100).toFixed(1) : 0}%</b></div></div>
    </div>
    <div class="grid g-main" style="margin-top:16px">
      <div class="card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><span class="eyebrow">Statistik Aktivitas</span><div class="h-md">Tren Kunjungan Tamu</div><p class="small t2">Pola kedatangan siswa, wali murid, dan pihak eksternal</p></div>
        <div class="seg" id="seg">${[['hari', 'Hari'], ['minggu', 'Minggu'], ['bulan', 'Bulan']].map(s => `<button data-t="${s[0]}" class="${trendMode === s[0] ? 'on' : ''}">${s[1]}</button>`).join('')}</div></div><div id="bars"></div><div id="peak" class="alert info" style="margin-top:12px;font-size:12px"></div></div>
      <div class="card"><span class="eyebrow">Demografi</span><div class="h-md">Proporsi Kategori</div><p class="small t2">Komposisi tipe pengunjung bulan ini</p>${donut(pj, tj)}
        ${[['Siswa', pj.siswa, 'var(--primary)'], ['Umum / Wali', pj.umum, '#3B82F6'], ['Dinas / Instansi', pj.khusus, '#8B5CF6']].map(x => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0"><span class="legend"><i style="background:${x[2]}"></i>${x[0]}</span><span><b>${x[1]}</b> <span class="pill" style="background:#F1F5F9">${tj ? Math.round(x[1] / tj * 100) : 0}%</span></span></div>`).join('')}</div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(290px,1fr));margin-top:16px">
      <div class="card"><span class="eyebrow">Klasifikasi Masalah</span><div class="h-md" style="margin-bottom:12px">Sebaran Bidang Layanan</div>${bidangBars(d.perBidang)}</div>
      <div class="card"><span class="eyebrow">Tingkat Pendidikan</span><div class="h-md" style="margin-bottom:12px">Distribusi Kelas</div><p class="small muted" style="margin-bottom:8px">Kunjungan siswa bulan ini</p>${[['XII', 'Konsultasi PTN/Karir'], ['XI', 'Dominan Peminatan'], ['X', 'Adaptasi Lingkungan']].map(k => `<div class="row-item" style="margin-bottom:8px;cursor:default"><span class="avatar" style="background:${k[0] === 'XI' ? 'var(--primary)' : '#fff'};color:${k[0] === 'XI' ? '#fff' : 'var(--text)'}">${k[0]}</span><div class="grow"><b>Kelas ${k[0]}</b><div class="small muted">${k[1]}</div></div><b class="h-md">${d.perTingkat[k[0]] || 0}</b><span class="small muted">siswa</span></div>`).join('')}<a class="btn btn-outline btn-sm btn-block" href="#/admin/tamu" data-f="siswa">Lihat Data Siswa ${ic('arrow', 14)}</a></div>
      <div class="card"><span class="eyebrow" style="color:var(--mint)">● Kunjungan Terkini</span><div class="h-md" style="margin-bottom:12px">Verifikasi foto selfie dan presensi</div>
        ${d.recent.length ? d.recent.map(r => `<div class="row-item" data-id="${esc(r.ID_Kunjungan)}" style="margin-bottom:8px">${BK.avatar(r, 'lg')}<div class="grow"><b class="ell" style="display:block">${esc(r.Nama)}</b><div class="small muted ell">${esc(r.Jenis === 'siswa' ? 'Kelas ' + r.Kelas : r.Jenis === 'umum' ? r.Status_Tamu : r.Asal_Dinas_Instansi)} • ${esc(BK.ago(r.Timestamp))}</div></div>${BK.badgeJenis(r.Jenis)}</div>`).join('') : '<div class="empty">Belum ada kunjungan.</div>'}
        <a class="btn btn-outline btn-sm btn-block" href="#/admin/tamu" data-f="semua">Buka Semua Data Tamu ${ic('arrow', 14)}</a></div>
    </div>
    <div class="banner"><div style="display:flex;gap:14px;align-items:center"><span class="ib" style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.14);display:grid;place-items:center">${ic('qr', 24)}</span><div><b class="h-sm">Kiosk Tamu Terhubung</b><p class="small" style="color:#d1fae5;max-width:560px">Tablet/ponsel di depan Ruang BK dapat membuka halaman tamu langsung dari tautan atau QR Code.</p></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-sm" style="background:#fff;color:var(--primary)" href="${appUrl()}" target="_blank" rel="noopener">${ic('ext', 15)} Buka Portal Kiosk</a><button class="btn btn-sm" style="background:rgba(255,255,255,.14);color:#fff" data-act="qr">${ic('qr', 15)} QR Code</button></div></div>`;
    const drawTrend = () => { const arr = d.trend[trendMode], mx = Math.max(1, ...arr.map(a => a.n)), top = arr.reduce((a, b) => b.n > a.n ? b : a, arr[0]);
      $('#bars').innerHTML = `<div class="bars">${arr.map(a => `<div class="b"><div class="bar ${a.n === mx && mx > 0 ? 'hi' : a.n >= mx * .6 && a.n ? 'md' : ''}" style="height:${Math.max(3, a.n / mx * 85)}%">${a.n ? `<span>${a.n}</span>` : ''}</div><small>${esc(a.l)}</small></div>`).join('')}</div>`;
      $('#peak').innerHTML = ic('info', 16) + `<span>${top.n ? `Puncak kunjungan tertinggi: <b>${esc(top.l)}</b> (${top.n} sesi).` : 'Belum ada kunjungan pada periode ini.'}</span>`;
      $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.t === trendMode)); };
    drawTrend();
    $('#seg').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { trendMode = b.dataset.t; drawTrend(); } };
    box.onclick = e => { const r = e.target.closest('[data-id]'); if (r) BK.go('#/admin/tamu/' + r.dataset.id); const f = e.target.closest('[data-f]'); if (f) BK.state.Q = Object.assign(qDefault(), { jenis: f.dataset.f }); };
  }
  function donut(pj, tot) {
    const C = 2 * Math.PI * 54, segs = [[pj.siswa, '#1B5E3C'], [pj.umum, '#3B82F6'], [pj.khusus, '#8B5CF6']]; let off = 0;
    return `<div class="donut"><svg width="170" height="170" viewBox="0 0 140 140" style="transform:rotate(-90deg)"><circle cx="70" cy="70" r="54" fill="none" stroke="#EEF2F7" stroke-width="18"/>${tot ? segs.map(s => { const len = s[0] / tot * C, o = `<circle cx="70" cy="70" r="54" fill="none" stroke="${s[1]}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"/>`; off += len; return o; }).join('') : ''}</svg><div class="c"><div class="metric">${tot}</div><span class="small muted">Total Entri</span></div></div>`;
  }
  function bidangBars(pb) {
    const keys = Object.keys(pb), tot = keys.reduce((a, k) => a + pb[k], 0), IC = { Pribadi: 'heart', Sosial: 'users', Belajar: 'book', Karir: 'briefcase' };
    if (!keys.length) return '<div class="empty">Belum ada data bulan ini.</div>';
    return keys.sort((a, b) => pb[b] - pb[a]).map(k => `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-weight:600;font-size:13px"><span style="display:flex;gap:8px;align-items:center">${ic(IC[k] || 'check', 16)} ${esc(k)}</span><span>${pb[k]} Sesi</span></div><div class="prog" style="margin:6px 0 2px"><i style="width:${pb[k] / tot * 100}%"></i></div><span class="small muted">${Math.round(pb[k] / tot * 100)}% dari total</span></div>`).join('');
  }

  /* ---------- data tamu ---------- */
  const qDefault = () => ({ jenis: 'semua', q: '', from: '', to: '', kelas: '', bidang: '', status: '', selfie: false, page: 1, size: 25 });
  BK.state.Q = BK.state.Q || qDefault();
  let reqN = 0;
  const subOf = r => r.Jenis === 'siswa' ? 'Siswa Aktif' : r.Jenis === 'umum' ? (r.Status_Tamu || 'Tamu') + (r.Nama_Murid ? ' • ' + r.Nama_Murid : '') : (r.Jabatan || 'Tamu Dinas');
  const unitOf = r => r.Jenis === 'khusus' ? r.Asal_Dinas_Instansi : r.Kelas ? (r.Jenis === 'umum' ? 'Kelas ' : '') + r.Kelas : '-';
  const bidChips = s => String(s || '').split(', ').filter(Boolean).map(b => `<span class="pill" style="background:#F1F5F9;color:var(--text-2);font-weight:500;margin:1px">${esc(b)}</span>`).join('');
  function tamu(q) {
    const m = shell('tamu'), Q = BK.state.Q, ref = (BK.pub && BK.pub.ref) || {};
    m.innerHTML = `<div class="view-enter">
    <div class="page-head"><div><span class="pill" style="background:#F1F5F9;color:var(--text-2)">DATABASE KONSELING</span><h1 class="h-lg" style="margin-top:8px">Data Tamu & Kunjungan BK</h1><p class="t2" style="max-width:640px">Kelola, cari, verifikasi selfie, dan ekspor seluruh catatan kunjungan ruang Bimbingan & Konseling secara terpusat dan rahasia.</p></div>
      <div class="act"><button class="btn btn-outline" id="xls">${ic('sheet', 16)} Unduh Rekap Excel</button><button class="btn btn-primary" id="pdf">${ic('file', 16)} Ekspor PDF Resmi</button><button class="btn btn-outline" id="rpt">${ic('camera', 16)} Laporan Berfoto</button></div></div>
    <div class="grid g3" style="margin-bottom:16px" id="kpis">${'<div class="card skel" style="height:96px"></div>'.repeat(3)}</div>
    <div class="tabs" id="tabs"></div>
    <div class="card" style="margin-top:14px"><div class="filters" id="flt">
      <div class="input-wrap" style="grid-column:1/-1">${ic('search', 16)}<input class="input" id="fq" placeholder="Cari nama, instansi, ID kunjungan, email..." value="${esc(Q.q)}"></div>
      <div class="field"><input class="input" id="ff" type="date" value="${Q.from}" aria-label="Dari tanggal"></div><div class="field"><input class="input" id="ft" type="date" value="${Q.to}" aria-label="Sampai tanggal"></div>
      <select class="select" id="fk" aria-label="Kelas"><option value="">Semua Kelas</option>${(ref.kelas || []).map(k => `<option ${Q.kelas === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
      <select class="select" id="fb" aria-label="Bidang"><option value="">Semua Bidang</option>${(ref.bidang || []).map(k => `<option ${Q.bidang === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
      <select class="select" id="fs" aria-label="Status"><option value="">Semua Status</option>${['Baru', 'Diproses', 'Selesai'].map(k => `<option ${Q.status === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
      <label class="chip ${Q.selfie ? 'on' : ''}" id="fsl" style="justify-content:center">${ic('camera', 14)} Hanya yang Berselfie</label>
      <button class="btn btn-outline btn-sm" id="fr" style="grid-column:1/-1;justify-self:end">${ic('refresh', 14)} Reset Filter</button></div></div>
    <div class="card" style="margin-top:14px;padding:8px 12px 16px"><div id="tbl"></div><div id="pgr"></div></div></div>`;
    paintTabs(null);
    const run = () => { Q.page = 1; load(); };
    $('#fq').oninput = BK.debounce(e => { Q.q = e.target.value.trim(); run(); }, 300);
    $('#ff').onchange = e => { Q.from = e.target.value; run(); }; $('#ft').onchange = e => { Q.to = e.target.value; run(); };
    $('#fk').onchange = e => { Q.kelas = e.target.value; run(); }; $('#fb').onchange = e => { Q.bidang = e.target.value; run(); }; $('#fs').onchange = e => { Q.status = e.target.value; run(); };
    $('#fsl').onclick = e => { Q.selfie = !Q.selfie; e.currentTarget.classList.toggle('on', Q.selfie); run(); };
    $('#fr').onclick = () => { BK.state.Q = Object.assign(qDefault()); tamu(); };
    $('#xls').onclick = () => doExport('xls'); $('#pdf').onclick = () => doExport('pdf'); $('#rpt').onclick = () => BK.laporan.open();
    $('#tabs').onclick = e => { const t = e.target.closest('[data-j]'); if (t) { Q.jenis = t.dataset.j; run(); } };
    if (!BK.pub.ref.kelas) BK.loadPub();
    load();
  }
  function paintTabs(counts) {
    const Q = BK.state.Q, c = counts || BK.state.counts || {};
    $('#tabs').innerHTML = [['semua', 'Semua Tamu', 'users'], ['siswa', 'Siswa', 'school'], ['umum', 'Umum / Orang Tua', 'users'], ['khusus', 'Khusus / Instansi', 'building']].map(t => `<button class="tab ${Q.jenis === t[0] ? 'on' : ''}" data-j="${t[0]}">${ic(t[2], 16)} ${t[1]} <em>${c[t[0]] != null ? c[t[0]] : '–'}</em></button>`).join('');
  }
  const fltOf = Q => ({ jenis: Q.jenis, q: Q.q, from: Q.from, to: Q.to, kelas: Q.kelas, bidang: Q.bidang, status: Q.status, selfie: Q.selfie });
  function load() {
    const Q = BK.state.Q, my = ++reqN, key = 'list_' + JSON.stringify([Q.jenis, Q.q, Q.from, Q.to, Q.kelas, Q.bidang, Q.status, Q.selfie, Q.page, Q.size]);
    const t = $('#tbl'); if (!t) return;
    if (!BK.cache[key] && !BK.SS.get('c_' + key)) t.style.opacity = '.55'; // data lama tetap tampil, redup saat memuat
    BK.swr(key, () => BK.api('listTamu', Object.assign(fltOf(Q), { page: Q.page, size: Q.size })), (d, fromCache) => { if (my !== reqN) return; paintList(d); t.style.opacity = ''; })
      .catch(e => { if (my !== reqN) return; t.style.opacity = ''; t.innerHTML = `<div class="empty">${ic('wifi', 30)}<p style="margin-top:8px">${esc(e.message)}</p><button class="btn btn-primary btn-sm" style="margin-top:12px" id="rt">Coba Lagi</button></div>`; $('#rt').onclick = load; });
  }
  function paintList(d) {
    if (!$('#tbl')) return; reg(d.rows); BK.state.counts = d.counts; paintTabs(d.counts);
    const Q = BK.state.Q, k = d.kpi;
    $('#kpis').innerHTML = `<div class="card kpi" style="min-height:0"><div class="top"><div><span class="eyebrow">Total Kunjungan Terdata</span><div class="metric" style="margin-top:8px">${k.total.toLocaleString('id-ID')}</div></div><span class="ib">${ic('users', 18)}</span></div><span class="small muted">Total catatan tamu terverifikasi</span></div>
      <div class="card kpi" style="min-height:0"><div class="top"><div><span class="eyebrow">Perlu Tindak Lanjut</span><div class="metric" style="margin-top:8px;color:var(--pending)">${k.baru} <span class="badge s-Baru" style="vertical-align:middle">Antrean Baru</span></div></div><span class="ib" style="background:#FEF3C7;color:#B45309">${ic('clock', 18)}</span></div><span class="small muted">Memerlukan disposisi Guru BK</span></div>
      <div class="card kpi" style="min-height:0"><div class="top"><div><span class="eyebrow">Selesai Ditangani</span><div class="metric" style="margin-top:8px;color:var(--done)">${k.selesaiBulanIni} <span class="small muted" style="font-weight:500">bulan ini</span></div></div><span class="ib">${ic('checkc', 18)}</span></div><span class="small muted">Layanan tuntas & terdokumentasi</span></div>`;
    const rows = d.rows;
    if (!rows.length) { $('#tbl').innerHTML = `<div class="empty">${ic('search', 34)}<p style="margin-top:8px"><b>Tidak ada data yang cocok.</b></p><p class="small">Ubah kata kunci atau reset filter.</p></div>`; $('#pgr').innerHTML = ''; return; }
    $('#tbl').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID Kunjungan</th><th>Waktu & Tanggal</th><th>Nama Tamu & Selfie</th><th>Kategori</th><th>Kelas / Instansi</th><th>Bidang Layanan</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(r => `<tr data-id="${esc(r.ID_Kunjungan)}">
      <td class="mono">${esc(r.ID_Kunjungan)}</td><td><b>${esc(BK.fmtTgl(r.Tanggal))}</b><div class="small muted">${esc(r.Jam)} ${BK.tzAbbr()}</div></td>
      <td><div style="display:flex;gap:10px;align-items:center">${BK.avatar(r)}<div style="min-width:0"><b class="ell" style="display:block;max-width:220px">${esc(r.Nama)}</b><div class="small muted ell" style="max-width:220px">${esc(subOf(r))}</div></div></div></td>
      <td>${BK.badgeJenis(r.Jenis)}</td><td>${esc(unitOf(r))}</td><td>${bidChips(r.Bidang_Layanan_BK)}</td><td>${BK.badgeStatus(r.Status_Tindak_Lanjut)}</td><td>${ic('right', 18)}</td></tr>`).join('')}</tbody></table></div>
      <div class="cards-m">${rows.map(r => `<div class="mcard" data-id="${esc(r.ID_Kunjungan)}"><div style="display:flex;gap:10px;align-items:center">${BK.avatar(r, 'lg')}<div class="grow"><b class="ell" style="display:block">${esc(r.Nama)}</b><div class="small muted ell">${esc(subOf(r))}</div></div>${BK.badgeJenis(r.Jenis)}</div>
        <div class="small t2" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><span class="mono">${esc(r.ID_Kunjungan)}</span><span>${esc(BK.fmtTgl(r.Tanggal))}, ${esc(r.Jam)} ${BK.tzAbbr()}</span></div><div>${bidChips(r.Bidang_Layanan_BK)} ${BK.badgeStatus(r.Status_Tindak_Lanjut)}</div></div>`).join('')}</div>`;
    $('#tbl').onclick = e => { const r = e.target.closest('[data-id]'); if (r) BK.go('#/admin/tamu/' + r.dataset.id); };
    // pagination
    const pages = Math.max(1, Math.ceil(d.total / d.size)), p = d.page, a = Math.max(1, Math.min(p - 2, pages - 4)), b = Math.min(pages, a + 4), nums = [];
    for (let i = a; i <= b; i++) nums.push(`<button class="${i === p ? 'on' : ''}" data-p="${i}">${i}</button>`);
    $('#pgr').innerHTML = `<div class="pager"><span class="small t2">Menampilkan <b>${(p - 1) * d.size + 1} – ${Math.min(p * d.size, d.total)}</b> dari <b>${d.total.toLocaleString('id-ID')}</b> kunjungan</span>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><select class="select" id="ps" style="height:36px;width:auto;font-size:12px">${[10, 25, 50, 100].map(n => `<option value="${n}" ${n === d.size ? 'selected' : ''}>${n} data per halaman</option>`).join('')}</select>
      <div class="pg"><button data-p="${p - 1}" ${p <= 1 ? 'disabled' : ''}>${ic('left', 16)}</button>${a > 1 ? '<button data-p="1">1</button><span>…</span>' : ''}${nums.join('')}${b < pages ? '<span>…</span><button data-p="' + pages + '">' + pages + '</button>' : ''}<button data-p="${p + 1}" ${p >= pages ? 'disabled' : ''}>${ic('right', 16)}</button></div></div></div>`;
    $('#pgr').onclick = e => { const bt = e.target.closest('[data-p]'); if (bt && !bt.disabled) { Q.page = +bt.dataset.p; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
    $('#ps').onchange = e => { Q.size = +e.target.value; Q.page = 1; load(); };
    // prefetch halaman berikutnya agar terasa instan
    if (p < pages) { const nk = 'list_' + JSON.stringify([Q.jenis, Q.q, Q.from, Q.to, Q.kelas, Q.bidang, Q.status, Q.selfie, p + 1, Q.size]); if (!BK.cache[nk]) BK.api('listTamu', Object.assign(fltOf(Q), { page: p + 1, size: Q.size })).then(x => { BK.cache[nk] = { t: Date.now(), d: x }; reg(x.rows); }).catch(() => {}); }
  }

  /* ---------- ekspor ---------- */
  const COLS = [['ID_Kunjungan', 'ID Kunjungan'], ['Tanggal', 'Tanggal'], ['Jam', 'Jam'], ['Zona', 'Zona Waktu'], ['Jenis', 'Jenis Tamu'], ['Nama', 'Nama'], ['Email', 'Email'], ['No_HP', 'No. HP'], ['Kelas', 'Kelas'], ['Nama_Murid', 'Nama Murid'], ['Asal_Dinas_Instansi', 'Instansi'], ['Jabatan', 'Jabatan'], ['Status_Tamu', 'Status Tamu'], ['Alamat', 'Alamat'], ['Tujuan', 'Tujuan'], ['Bidang_Layanan_BK', 'Bidang Layanan'], ['Keterangan', 'Keterangan'], ['Status_Tindak_Lanjut', 'Status'], ['Catatan_Guru_BK', 'Catatan Guru BK']];
  const colLbl = c => c[0] === 'Jam' ? 'Jam (' + BK.tzAbbr() + ')' : c[1];                       // header Jam memuat zona
  const colVal = (c, x) => c[0] === 'Zona' ? BK.tzLabel() : c[0] === 'Jenis' ? (BK.JENIS[x.Jenis] || {}).l : x[c[0]];
  async function doExport(fmt) {
    const Q = BK.state.Q, btn = $(fmt === 'xls' ? '#xls' : '#pdf'); BK.loading(btn, true, 'Menyiapkan...');
    try {
      const r = await BK.api('exportTamu', fltOf(Q), { timeout: 60000 });
      if (!r.rows.length) { BK.toast('Tidak ada data untuk diekspor', 'warn'); return; }
      const rng = (Q.from || 'awal') + '_sd_' + (Q.to || BK.fmtTgl(BK.localYMD()).replace(/ /g, '-')), name = 'Rekap-Tamu-BK_' + rng;
      const head = COLS.map(c => `<th>${colLbl(c)}</th>`).join(''), body = r.rows.map(x => '<tr>' + COLS.map(c => `<td>${esc(c[0] === 'No_HP' ? "'" + x[c[0]] : colVal(c, x))}</td>`).join('') + '</tr>').join('');
      if (fmt === 'xls') {
        BK.download(name + '.xls', new Blob(['\ufeff<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></body></html>'], { type: 'application/vnd.ms-excel' }));
      } else {
        $('#printArea').innerHTML = `<h2>Rekap Kunjungan Ruang BK — ${esc(BK.cfg.NAMA_SEKOLAH)}</h2><p style="font-size:11px;margin-bottom:8px">Periode: ${esc(Q.from || 'awal')} s.d. ${esc(Q.to || 'sekarang')} • ${r.rows.length} data • Zona waktu ${esc(BK.tzLabel())} • Dicetak ${esc(BK.nowStr())} oleh ${esc(BK.Auth.user.nama)}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
        BK.toast('Pilih "Simpan sebagai PDF" pada dialog cetak', 'ok', 4500); setTimeout(() => window.print(), 300);
      }
      if (r.truncated) BK.toast('Ekspor dibatasi 5.000 baris — persempit rentang tanggal', 'warn', 5000);
      BK.api('logExport', { format: fmt.toUpperCase(), jumlah: r.rows.length, rentang: rng }, { retry: 0 }).catch(() => {});
    } catch (e) { fail(e); } finally { BK.loading(btn, false); }
  }

  /* ---------- detail & edit ---------- */
  const EDITF = {
    siswa: ['Nama', 'Kelas', 'No_HP', 'Email', 'Alamat', 'Tujuan', 'Bidang_Layanan_BK', 'Keterangan'],
    umum: ['Nama', 'Email', 'No_HP', 'Status_Tamu', 'Alamat', 'Nama_Murid', 'Kelas', 'Bidang_Layanan_BK', 'Keterangan'],
    khusus: ['Nama', 'Asal_Dinas_Instansi', 'Jabatan', 'Email', 'No_HP', 'Alamat', 'Tujuan', 'Bidang_Layanan_BK', 'Keterangan']
  };
  const LBL = { Nama: 'Nama Lengkap Pengunjung', Kelas: 'Kelas', No_HP: 'No. WhatsApp / HP', Email: 'Email', Alamat: 'Alamat / Domisili', Tujuan: 'Tujuan Layanan', Bidang_Layanan_BK: 'Bidang Layanan Bimbingan & Konseling', Keterangan: 'Keterangan Keperluan', Status_Tamu: 'Status Tamu', Nama_Murid: 'Nama Murid', Asal_Dinas_Instansi: 'Asal Dinas / Instansi', Jabatan: 'Jabatan' };
  let E = null;
  async function findRec(id) {
    if (BK.rec[id]) return BK.rec[id];
    const d = await BK.api('listTamu', { q: id, size: 5, jenis: 'semua' }); reg(d.rows); return BK.rec[id];
  }
  async function detail([id]) {
    const m = shell('tamu'); m.innerHTML = `<div class="view-enter"><div class="card skel" style="height:200px"></div></div>`;
    let r; try { r = await findRec(id); } catch (e) { fail(e); BK.go('#/admin/tamu'); return; }
    if (!r) { BK.toast('Data tidak ditemukan', 'err'); BK.go('#/admin/tamu'); return; }
    E = { id, bidang: String(r.Bidang_Layanan_BK || '').split(', ').filter(Boolean), status: r.Status_Tindak_Lanjut || 'Baru' };
    paintDetail(r);
    loadPhoto(id);
  }
  function paintDetail(r) {
    const m = $('#main'); if (!m) return; const ref = BK.pub.ref, j = r.Jenis, id = r.ID_Kunjungan, sup = BK.isSuper();
    const f = k => {
      const v = r[k] || '', lab = LBL[k];
      if (k === 'Kelas') return `<div class="field"><label>${lab}</label><select class="select" data-e="${k}"><option value=""></option>${ref.kelas.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;
      if (k === 'Tujuan') { const o = j === 'siswa' ? ref.tujuan_siswa : ref.tujuan_khusus; return `<div class="field span2"><label>${lab}</label><div class="radios c3" data-tr>${o.map(x => `<button type="button" class="radio ${x === v ? 'on' : ''}" data-tv="${esc(x)}"><span class="rb"></span><b style="font-size:13px">${esc(x)}</b></button>`).join('')}</div><input type="hidden" data-e="Tujuan" value="${esc(v)}"></div>`; }
      if (k === 'Bidang_Layanan_BK') return `<div class="field span2"><label>${lab}</label><div class="chips" id="dch">${ref.bidang.map(b => `<button type="button" class="chip ${E.bidang.indexOf(b) > -1 ? 'on' : ''}" data-cb="${esc(b)}">${esc(b)}</button>`).join('')}</div></div>`;
      if (k === 'Keterangan') return `<div class="field span2"><label>${lab}</label><textarea class="textarea" data-e="${k}" maxlength="500" style="min-height:110px">${esc(v)}</textarea></div>`;
      return `<div class="field ${k === 'Alamat' ? 'span2' : ''}"><label>${lab}</label><input class="input" data-e="${k}" value="${esc(v)}" maxlength="200"></div>`;
    };
    m.innerHTML = `<div class="view-enter">
    <div class="crumb"><a href="#/admin/tamu">${ic('left', 13)} Kembali ke Data Tamu</a> <span>/</span> <span>Layanan Konseling</span> <span>/</span> <b>Detail & Edit Sesi Tamu</b></div>
    <div class="card" style="display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap"><div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h1 class="h-lg">Detail Kunjungan Tamu</h1><span class="pill mono" style="background:#F1F5F9">${esc(id)} <button data-cp aria-label="Salin ID" style="display:inline-flex">${ic('copy', 12)}</button></span></div>
      <div style="margin:8px 0" id="hstat">${BK.badgeStatus(r.Status_Tindak_Lanjut)}</div><div class="small t2" style="display:flex;gap:14px;flex-wrap:wrap"><span>${ic('clock', 14)} ${esc(BK.fmtTgl(r.Tanggal))} • ${esc(r.Jam)} ${BK.tzAbbr()}</span><span>${BK.badgeJenis(j)}</span></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-soft" id="prt">${ic('printer', 16)} Cetak Berkas (PDF)</button>${sup ? `<button class="btn btn-danger" id="del">${ic('trash', 16)} Hapus Data <span class="pill" style="background:#fff;color:#B91C1C;font-size:9px">SUPER ADMIN</span></button>` : ''}</div></div>
    <div class="grid g-detail" style="margin-top:16px;align-items:start">
      <div style="display:grid;gap:16px"><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b class="h-sm" style="display:flex;gap:8px;align-items:center">${ic('camera', 20)} Bukti Foto Selfie</b><span class="pill tag-live">Kamera Kiosk Masuk</span></div>
          <div class="shot-box" id="pbox" style="aspect-ratio:4/3">${r.Thumb ? `<img src="${esc(r.Thumb)}" alt="" style="filter:blur(6px);transform:scale(1.1)">` : `<div class="skel" style="height:100%"></div>`}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><button class="btn btn-soft btn-sm" id="zoom" disabled>${ic('zoom', 15)} Perbesar Foto</button><button class="btn btn-soft btn-sm" id="dl" disabled>${ic('download', 15)} Unduh</button></div>
          <div class="kv-rows" id="pinfo" style="margin-top:12px"><div><span>Berkas Asli</span><b>…</b></div></div></div>
        <div class="card card-mint"><b class="h-sm">Ringkasan Kunjungan</b><div class="kv-rows" style="margin-top:8px"><div><span>Jenis tamu</span><b>${esc(BK.JENIS[j].l)}</b></div><div><span>Dicatat pada</span><b>${esc(BK.fmtTgl(r.Tanggal))}, ${esc(r.Jam)} ${BK.tzAbbr()}</b></div><div><span>Terakhir diubah</span><b id="lastmod">${r.Diubah_Oleh ? esc(r.Diubah_Oleh) + ' • ' + esc(BK.fmtDT(r.Diubah_Pada)) : '—'}</b></div></div></div></div>
      <div style="display:grid;gap:16px"><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><b class="h-md" style="display:flex;gap:8px;align-items:center">${ic('file', 20)} Data Identitas & Registrasi</b></div>
          <div class="alert info" style="margin:12px 0">${ic('info', 16)}<span>Admin dapat mengoreksi data masukan formulir jika terdapat kesalahan ketik atau pembaruan kontak.</span></div><div class="form-grid c2" id="dform">${EDITF[j].map(f).join('')}</div></div>
        <div class="card"><b class="h-md" style="display:flex;gap:8px;align-items:center">${ic('lock', 20)} Lembar Catatan Guru BK <span class="pill tag-live" style="margin-left:auto">DOKUMEN RAHASIA BK</span></b><p class="small muted">Kerahasiaan terjamin sesuai kode etik ABKIN</p>
          <div class="field" style="margin-top:14px"><span class="lbl">Status Progres Layanan Sesi Ini:</span><div class="radios c3" id="sts">${[['Baru', 'Menunggu konseling', '#F59E0B'], ['Diproses', 'Konseling aktif berjalan', '#3B82F6'], ['Selesai', 'Tuntas & diarsipkan', '#10B981']].map(s => `<button type="button" class="radio ${E.status === s[0] ? 'on' : ''}" data-s="${s[0]}"><span class="rb"></span><span><b style="font-size:13px">${s[0] === 'Baru' ? 'Baru' : s[0] === 'Diproses' ? 'Sedang Diproses' : 'Selesai'}</b><br><span class="small muted">${s[1]}</span></span><i class="dot" style="color:${s[2]};margin-left:auto;margin-top:6px"></i></button>`).join('')}</div></div>
          <div class="field" style="margin-top:16px"><label>Catatan Hasil Bimbingan & Observasi Guru BK:</label><textarea class="textarea" id="cat" maxlength="3000" style="min-height:170px" placeholder="Tulis hasil bimbingan, observasi, dan rencana tindak lanjut...">${esc(r.Catatan_Guru_BK || '')}</textarea><div class="help" id="cnt"></div></div></div></div></div>
    <div class="sticky-bar"><button class="btn btn-outline" id="cancel">${ic('x', 15)} Batalkan Perubahan</button><span class="small muted" id="dirty">Perubahan disimpan otomatis ke Google Sheets saat Anda menekan tombol simpan</span><button class="btn btn-primary" id="save" style="min-width:230px">${ic('checkc', 16)} Simpan Catatan & Update Status</button></div></div>`;
    bindDetail(r);
  }
  function bindDetail(r) {
    const id = r.ID_Kunjungan, m = $('#main'), cnt = () => { $('#cnt').textContent = $('#cat').value.length + ' / 3000 karakter'; };
    cnt(); $('#cat').addEventListener('input', cnt);
    m.onclick = e => {
      const cb = e.target.closest('[data-cb]'), tv = e.target.closest('[data-tv]'), s = e.target.closest('[data-s]');
      if (cb) { const v = cb.dataset.cb, i = E.bidang.indexOf(v); i > -1 ? E.bidang.splice(i, 1) : E.bidang.push(v); cb.classList.toggle('on'); }
      if (tv) { $$('[data-tv]').forEach(x => x.classList.toggle('on', x === tv)); $('[data-e="Tujuan"]').value = tv.dataset.tv; }
      if (s) { E.status = s.dataset.s; $$('#sts .radio').forEach(x => x.classList.toggle('on', x === s)); }
      if (e.target.closest('[data-cp]')) BK.copy(id, 'ID disalin');
    };
    $('#cancel').onclick = () => BK.go('#/admin/tamu');
    $('#save').onclick = () => saveDetail(id);
    $('#prt').onclick = () => printDetail(BK.rec[id]);
    const del = $('#del'); if (del) del.onclick = () => delDetail(id);
  }
  function collect(r) {
    const ch = {};
    $$('[data-e]').forEach(el => { const k = el.dataset.e; if (String(el.value).trim() !== String(r[k] || '')) ch[k] = el.value.trim(); });
    const b = E.bidang.join(', '); if (b !== String(r.Bidang_Layanan_BK || '')) ch.Bidang_Layanan_BK = b;
    if (E.status !== (r.Status_Tindak_Lanjut || 'Baru')) ch.Status_Tindak_Lanjut = E.status;
    const c = $('#cat').value.trim(); if (c !== String(r.Catatan_Guru_BK || '')) ch.Catatan_Guru_BK = c;
    return ch;
  }
  function patchCaches(id, fields) {
    Object.keys(BK.cache).forEach(k => { if (k.indexOf('list_') === 0) { const d = BK.cache[k].d; (d.rows || []).forEach(x => { if (x.ID_Kunjungan === id) Object.assign(x, fields); }); BK.SS.set('c_' + k, BK.cache[k]); } });
    delete BK.cache.dash; BK.SS.del('c_dash');
  }
  async function saveDetail(id) {
    const r = BK.rec[id], ch = collect(r);
    if (!Object.keys(ch).length) { BK.toast('Tidak ada perubahan untuk disimpan', 'warn'); return; }
    if (!ch.Nama && !String(r.Nama).trim()) return;
    const prev = Object.assign({}, r), me = BK.Auth.user, now = new Date(); const iso = now.toISOString();
    Object.assign(r, ch, { Diubah_Oleh: me.nama, Diubah_Pada: iso }); patchCaches(id, r);       // OPTIMISTIC: UI langsung berubah
    $('#hstat').innerHTML = BK.badgeStatus(r.Status_Tindak_Lanjut); $('#lastmod').textContent = me.nama + ' • baru saja'; BK.toast('Perubahan disimpan', 'ok');
    BK.api('updateTamu', { id, perubahan: ch }, { retry: 1 }).then(res => { if (res.diubahPada) { r.Diubah_Pada = res.diubahPada; } })
      .catch(e => { Object.assign(r, prev); patchCaches(id, prev); fail(e); BK.toast('Perubahan dibatalkan — gagal tersimpan', 'err', 5000); if (location.hash.indexOf(id) > -1) paintDetail(r); });
  }
  async function delDetail(id) {
    const m = BK.modal(`<h3>Hapus Data Kunjungan?</h3><p class="t2 small">Data dipindahkan ke <b>Keranjang Sampah</b> (dapat dipulihkan Super Admin selama 30 hari). Foto selfie dipindah ke folder "Terhapus".</p>
      <div class="field" style="margin-top:12px"><label>Alasan penghapusan <span class="req">*</span></label><input class="input" id="alasan" maxlength="200" placeholder="mis. Entri duplikat"></div><div class="foot"><button class="btn btn-outline" data-x>Batal</button><button class="btn btn-danger" data-ok>${ic('trash', 15)} Hapus</button></div>`);
    $('[data-x]', m).onclick = () => m.remove();
    $('[data-ok]', m).onclick = async e => { const a = $('#alasan', m).value.trim(); if (!a) return BK.toast('Alasan wajib diisi', 'warn');
      BK.loading(e.currentTarget, true); try { await BK.api('deleteTamu', { id, alasan: a }); m.remove(); Object.keys(BK.cache).filter(k => k.indexOf('list_') === 0 || k === 'dash').forEach(k => delete BK.cache[k]); BK.SS.clear('c_'); delete BK.rec[id]; BK.toast('Data dipindahkan ke sampah', 'ok'); BK.go('#/admin/tamu'); } catch (er) { fail(er); BK.loading(e.currentTarget, false); } };
  }
  async function loadPhoto(id) {
    const show = p => { const box = $('#pbox'); if (!box || !p) return; box.innerHTML = `<img src="${p.dataUrl}" alt="Selfie ${esc(BK.rec[id] ? BK.rec[id].Nama : '')}">`;
      $('#pinfo').innerHTML = `<div><span>Berkas Asli</span><b>${esc(p.nama)}</b></div><div><span>Lokasi Drive</span><b>${esc(p.folder)}</b></div><div><span>Ukuran</span><b>${Math.round(p.ukuran / 1024)} KB</b></div>`;
      const z = $('#zoom'), d = $('#dl'); if (z) { z.disabled = false; z.onclick = () => BK.modal(`<img src="${p.dataUrl}" style="width:100%;border-radius:12px" alt=""><div class="foot"><button class="btn btn-outline" onclick="this.closest('.overlay').remove()">Tutup</button></div>`, { wide: true }); }
      if (d) { d.disabled = false; d.onclick = () => { fetch(p.dataUrl).then(r => r.blob()).then(b => BK.download(p.nama, b)); }; } };
    if (BK.photos[id]) return show(BK.photos[id]);
    if (!BK.rec[id] || !BK.rec[id].Thumb && !BK.rec[id].ID_File_Foto) { /* tetap coba */ }
    try { BK.photos[id] = await BK.api('getFoto', { id }, { timeout: 60000 }); show(BK.photos[id]); }
    catch (e) { const box = $('#pbox'); if (box) box.innerHTML = `<div class="empty" style="padding:30px 10px">${ic('camera', 28)}<p class="small" style="margin-top:6px">${esc(e.message)}</p></div>`; }
  }
  function printDetail(r) {
    $('#printArea').innerHTML = `<h2>Detail Kunjungan Ruang BK — ${esc(r.ID_Kunjungan)}</h2><p style="font-size:11px">${esc(BK.cfg.NAMA_SEKOLAH)} • Zona waktu ${esc(BK.tzLabel())} • Dicetak ${esc(BK.nowStr())} oleh ${esc(BK.Auth.user.nama)} • DOKUMEN RAHASIA BK</p><table><tbody>${COLS.map(c => `<tr><th style="width:28%">${colLbl(c)}</th><td>${esc(colVal(c, r))}</td></tr>`).join('')}</tbody></table>${BK.photos[r.ID_Kunjungan] ? `<p style="margin-top:10px"><img src="${BK.photos[r.ID_Kunjungan].dataUrl}" style="max-width:260px"></p>` : ''}`;
    window.print();
  }

  BK.route(/^\/admin\/login$/, login);
  BK.route(/^\/admin$/, dash, { admin: true });
  BK.route(/^\/admin\/tamu$/, tamu, { admin: true });
  BK.route(/^\/admin\/tamu\/([\w-]+)$/, detail, { admin: true });
  BK.adminShell = shell; BK.adminFail = fail; BK.regRows = reg; BK.qDefault = qDefault;
})();

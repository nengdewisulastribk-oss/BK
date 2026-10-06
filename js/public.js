/* ==========================================================
   HALAMAN PUBLIK — Pilih jenis tamu, formulir, selfie, konfirmasi
   ========================================================== */
(function () {
  'use strict';
  const { $, $$, esc, ic } = BK;
  const DEF_REF = {
    kelas: ['X.1','X.2','X.3','X.4','X.5','XI.1','XI.2','XI.3','XI.4','XI.5','XII.1','XII.2','XII.3','XII.4','XII.5'],
    bidang: ['Pribadi', 'Sosial', 'Belajar', 'Karir'],
    status_tamu: ['Orang Tua', 'Wali', 'Wali Kelas', 'Guru Wali', 'Lainnya'],
    tujuan_siswa: ['Konseling Individu', 'Bimbingan Kelompok', 'Konsultasi Umum'],
    tujuan_khusus: ['Koordinasi Layanan BK', 'Monitoring & Evaluasi', 'Kunjungan Kerja', 'Lainnya']
  };
  const DEF_INFO = { nama_sekolah: BK.cfg.NAMA_SEKOLAH, konselor_standby: 'Guru BK Piket', konselor_info: 'Koordinator BK', jam_layanan: '07.15 - 14.30 WIB', hotline: '', lokasi_bk: 'Ruang Bimbingan & Konseling' };
  const BIDANG_IC = { Pribadi: 'heart', Sosial: 'users', Belajar: 'book', Karir: 'briefcase' };
  const BIDANG_DESC = { Pribadi: 'Emosi, kepercayaan diri, dan masalah pribadi', Sosial: 'Hubungan dengan teman, keluarga, dan lingkungan', Belajar: 'Motivasi, strategi belajar, dan prestasi', Karir: 'Pilihan jurusan, studi lanjut, dan masa depan' };

  // data publik: render dari cache lokal lebih dulu, segarkan di latar belakang
  const cached = BK.LS.get('pub', null);
  BK.pub = cached || { ref: DEF_REF, info: DEF_INFO };
  BK.loadPub = () => BK.api('getPublic').then(d => { BK.pub = d; BK.LS.set('pub', d); }).catch(() => {});

  let F = null, cam = { stream: null, facing: 'user' };

  /* ---------- model form ---------- */
  const newForm = (jenis, old) => Object.assign({ jenis, nama: '', email: '', hp: '', alamat: '', alamatPilih: '', kelas: '', tujuan: '', bidang: [], ket: '',
    namaMurid: '', statusPilih: '', statusManual: '', instansi: '', jabatan: '', setuju: false, website: '', foto: null, thumb: null, touched: {} },
    old ? { nama: old.nama, email: old.email, hp: old.hp, bidang: old.bidang || [] } : {});
  const saveDraft = BK.debounce(() => { if (!F) return; const c = Object.assign({}, F, { foto: null, thumb: null, touched: {} }); BK.LS.set('draft', { t: Date.now(), F: c }); }, 400);
  const loadDraft = () => { const d = BK.LS.get('draft', null); if (d && Date.now() - d.t < 30 * 60000 && d.F && d.F.jenis) return Object.assign(newForm(d.F.jenis), d.F, { foto: null, thumb: null, touched: {} }); BK.LS.del('draft'); return null; };

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normHp = s => String(s || '').replace(/[\s\-().]/g, '');
  const hpOk = s => /^(\+62|62|0)\d{8,13}$/.test(normHp(s));
  function validate(f) {
    const e = {}, r = (k, m) => { if (!String(f[k] || '').trim()) e[k] = m || 'Wajib diisi'; };
    r('nama', f.jenis === 'siswa' ? 'Nama murid wajib diisi' : 'Nama wajib diisi');
    if (!EMAIL.test(String(f.email).trim())) e.email = f.email ? 'Format email tidak valid' : 'Email wajib diisi';
    if (!hpOk(f.hp)) e.hp = f.hp ? 'Nomor tidak valid (awali 08 atau +62, 9–14 digit)' : 'Nomor HP wajib diisi';
    if (!f.bidang.length) e.bidang = 'Pilih minimal satu bidang layanan';
    if (f.jenis === 'siswa') { r('kelas', 'Pilih kelas'); r('tujuan', 'Pilih tujuan layanan'); r('alamat'); }
    if (f.jenis === 'umum') {
      r('alamatPilih', 'Pilih alamat'); if (f.alamatPilih === 'Lainnya') r('alamat', 'Isi alamat Anda');
      r('statusPilih', 'Pilih status tamu'); if (f.statusPilih === 'Lainnya') r('statusManual', 'Isi status Anda');
      r('namaMurid', 'Nama murid wajib diisi'); r('kelas', 'Pilih kelas'); r('ket', 'Keterangan wajib diisi');
    }
    if (f.jenis === 'khusus') { r('instansi', 'Asal dinas/instansi wajib diisi'); r('jabatan'); r('alamat'); r('tujuan', 'Pilih tujuan'); r('ket', 'Keterangan wajib diisi'); }
    if (!f.setuju) e.setuju = 'Persetujuan wajib dicentang';
    return e;
  }
  function payload(f) {
    const p = { jenis: f.jenis, nama: f.nama.trim(), email: f.email.trim(), hp: normHp(f.hp), bidang: f.bidang, ket: f.ket.trim(), setuju: true, website: f.website };
    if (f.jenis === 'siswa') Object.assign(p, { kelas: f.kelas, tujuan: f.tujuan, alamat: f.alamat.trim(), namaMurid: f.nama.trim() });
    if (f.jenis === 'umum') Object.assign(p, { alamat: f.alamatPilih === 'Lainnya' ? f.alamat.trim() : f.alamatPilih, statusTamu: f.statusPilih === 'Lainnya' ? f.statusManual.trim() : f.statusPilih, namaMurid: f.namaMurid.trim(), kelas: f.kelas });
    if (f.jenis === 'khusus') Object.assign(p, { instansi: f.instansi.trim(), jabatan: f.jabatan.trim(), alamat: f.alamat.trim(), tujuan: f.tujuan });
    return p;
  }

  /* ---------- shell publik ---------- */
  function shell(active) {
    if (BK.state.mode !== 'pub') {
      BK.state.mode = 'pub';
      $('#app').innerHTML = `
      <header class="pub-head"><div class="in">
        <a class="brand" href="#/">${BK.logo()}<div><b>${esc(BK.cfg.NAMA_APP)}</b><span>Layanan Buku Tamu Digital</span></div></a>
        <nav class="pub-nav"><a href="#/" data-n="home">Isi Kunjungan</a><a href="#/layanan" data-n="layanan">Layanan Konseling</a><a href="#/jadwal" data-n="jadwal">Jadwal Guru BK</a></nav>
        <a class="btn btn-outline btn-sm" href="#/admin" style="gap:8px">Masuk Petugas ${ic('user', 16)}</a>
      </div></header>
      <main id="main" class="wrap"></main>
      <footer class="pub-foot"><div class="in"><span>Bimbingan dan Konseling ${esc(BK.cfg.NAMA_SEKOLAH)}. Seluruh hak cipta dilindungi.</span><span>Kerahasiaan data tamu dijaga &amp; dilindungi</span></div></footer>`;
    }
    $$('.pub-nav a').forEach(a => a.classList.toggle('on', a.dataset.n === active));
    return $('#main');
  }
  const stepper = n => `<div class="stepper">${[['Pilih Kategori & Isi Data', 'Tahap aktif'], ['Ambil Foto Selfie', 'Verifikasi wajah'], ['Konfirmasi Kunjungan', 'Ringkasan']].map((s, i) => {
    const st = i + 1 < n ? 'done' : i + 1 === n ? 'on' : '';
    return `<div class="step ${st}"><span class="n">${i + 1 < n ? ic('check', 15) : i + 1}</span><div class="grow"><small>${s[1]}</small><b>${i + 1}. ${s[0]}</b></div></div>`;
  }).join('')}</div>`;

  /* ---------- field builders ---------- */
  const err = k => `<div class="help bad" data-err="${k}"></div>`;
  const inp = (k, label, o) => { o = o || {}; return `<div class="field ${o.span ? 'span2' : ''}"><label for="f_${k}">${label}${o.opt ? ' <span class="muted">(Opsional)</span>' : ' <span class="req">*</span>'}</label>
    <div class="input-wrap">${o.icon ? ic(o.icon, 17) : ''}<input class="input" id="f_${k}" data-k="${k}" type="${o.type || 'text'}" inputmode="${o.mode || 'text'}" autocomplete="${o.ac || 'off'}" placeholder="${esc(o.ph || '')}" maxlength="${o.max || 120}" value="${esc(F[k])}"></div>
    ${o.help ? `<div class="help">${ic('info', 13)} ${o.help}</div>` : ''}${err(k)}</div>`; };
  const sel = (k, label, opts, ph, o) => { o = o || {}; return `<div class="field ${o.span ? 'span2' : ''}"><label for="f_${k}">${label} <span class="req">*</span></label>
    <select class="select" id="f_${k}" data-k="${k}"><option value="">${esc(ph || 'Pilih...')}</option>${opts.map(x => `<option ${F[k] === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>${err(k)}</div>`; };
  const area = (k, label, o) => { o = o || {}; return `<div class="field span2"><label for="f_${k}">${label}${o.opt ? ' <span class="muted">(Opsional)</span>' : ' <span class="req">*</span>'}<span class="muted" style="float:right;font-weight:500">Maks. ${o.max || 250} karakter</span></label>
    <textarea class="textarea" id="f_${k}" data-k="${k}" maxlength="${o.max || 250}" placeholder="${esc(o.ph || '')}">${esc(F[k])}</textarea>${err(k)}</div>`; };
  const radios = (k, label, opts, cols) => `<div class="field span2"><span class="lbl">${label} <span class="req">*</span></span><div class="radios ${cols ? 'c3' : ''}" role="radiogroup">${opts.map(x => `<button type="button" class="radio ${F[k] === x ? 'on' : ''}" data-radio="${k}" data-v="${esc(x)}" role="radio" aria-checked="${F[k] === x}"><span class="rb"></span><span><b style="font-size:13px">${esc(x)}</b></span></button>`).join('')}</div>${err(k)}</div>`;
  const chips = ref => `<div class="field span2"><span class="lbl">Bidang Layanan BK <span class="req">*</span> <span class="muted" style="float:right;font-weight:500">Pilih satu atau lebih</span></span>
    <div class="chips">${ref.bidang.map(b => `<button type="button" class="chip ${F.bidang.indexOf(b) > -1 ? 'on' : ''}" data-chip="${esc(b)}" aria-pressed="${F.bidang.indexOf(b) > -1}">${ic(BIDANG_IC[b] || 'check', 15)} ${esc(b)}${F.bidang.indexOf(b) > -1 ? ic('check', 14) : ''}</button>`).join('')}</div>${err('bidang')}</div>`;
  const cond = (when, html) => `<div class="cond ${F[when[0]] === when[1] ? '' : 'hidden'}" data-when="${when[0]}=${when[1]}" style="grid-column:1/-1">${html}</div>`;

  function formFields() {
    const ref = BK.pub.ref;
    if (F.jenis === 'siswa') return `
      ${inp('nama', 'Nama Lengkap Murid', { icon: 'user', ph: 'Sesuai nama absensi kelas', ac: 'name' })}
      ${sel('kelas', 'Kelas', ref.kelas, 'Pilih kelas')}
      ${inp('hp', 'No. WhatsApp / HP', { icon: 'phone', type: 'tel', mode: 'tel', ph: '08xxxxxxxxxx', ac: 'tel', max: 18 })}
      ${inp('email', 'Email Aktif Siswa / Sekolah', { icon: 'mail', type: 'email', mode: 'email', ph: 'nama@email.com', ac: 'email' })}
      ${radios('tujuan', 'Tujuan Layanan Konseling', ref.tujuan_siswa, true)}
      ${chips(ref)}
      ${inp('alamat', 'Alamat / Tempat Tinggal', { icon: 'pin', ph: 'Jl. ..., Palangka Raya', span: true, max: 200 })}
      ${area('ket', 'Keterangan Tambahan / Topik Konseling', { opt: true, ph: 'Ceritakan singkat keperluan Anda...' })}`;
    if (F.jenis === 'umum') return `
      ${inp('nama', 'Nama Lengkap', { icon: 'user', ph: 'Nama Anda', ac: 'name' })}
      ${inp('hp', 'No. WhatsApp / HP', { icon: 'phone', type: 'tel', mode: 'tel', ph: '08xxxxxxxxxx', ac: 'tel', max: 18 })}
      ${inp('email', 'Email Aktif', { icon: 'mail', type: 'email', mode: 'email', ph: 'nama@email.com', ac: 'email' })}
      ${sel('statusPilih', 'Status Tamu', ref.status_tamu, 'Pilih status')}
      ${cond(['statusPilih', 'Lainnya'], inp('statusManual', 'Tuliskan Status Anda', { ph: 'mis. Kakak kandung', span: true }))}
      ${sel('alamatPilih', 'Alamat', ['SMA Negeri 6 Palangka Raya', 'Lainnya'], 'Pilih alamat')}
      ${cond(['alamatPilih', 'Lainnya'], inp('alamat', 'Tuliskan Alamat Anda', { icon: 'pin', ph: 'Alamat lengkap', span: true, max: 200 }))}
      ${inp('namaMurid', 'Nama Murid yang Dituju', { icon: 'school', ph: 'Nama murid', max: 100 })}
      ${sel('kelas', 'Kelas Murid', ref.kelas, 'Pilih kelas')}
      ${chips(ref)}
      ${area('ket', 'Keterangan', { ph: 'Jelaskan keperluan kunjungan Anda...' })}`;
    return `
      ${inp('nama', 'Nama Lengkap', { icon: 'user', ph: 'Nama Anda', ac: 'name' })}
      ${inp('instansi', 'Asal Dinas / Instansi', { icon: 'building', ph: 'mis. Dinas Pendidikan Provinsi', max: 150 })}
      ${inp('jabatan', 'Jabatan', { icon: 'briefcase', ph: 'Jabatan Anda', max: 100 })}
      ${inp('hp', 'No. WhatsApp / HP', { icon: 'phone', type: 'tel', mode: 'tel', ph: '08xxxxxxxxxx', ac: 'tel', max: 18 })}
      ${inp('email', 'Email Aktif / Dinas', { icon: 'mail', type: 'email', mode: 'email', ph: 'nama@instansi.go.id', ac: 'email' })}
      ${sel('tujuan', 'Tujuan Kunjungan', ref.tujuan_khusus, 'Pilih tujuan')}
      ${inp('alamat', 'Alamat', { icon: 'pin', ph: 'Alamat kantor / instansi', span: true, max: 200 })}
      ${chips(ref)}
      ${area('ket', 'Keterangan', { ph: 'Jelaskan keperluan kunjungan...' })}`;
  }

  /* ---------- HOME ---------- */
  function home() {
    const m = shell('home'), info = Object.assign({}, DEF_INFO, BK.pub.info);
    if (!F) { F = loadDraft(); if (F) setTimeout(() => BK.toast('Draf formulir sebelumnya dipulihkan', 'ok'), 400); else F = newForm('siswa'); }
    m.innerHTML = `<div class="view-enter">
    <section class="hero">
      ${BK.logo('logo')}
      <div><span class="pill tag-live"><i class="dot"></i> Kios Tamu Digital • Ruang BK Terintegrasi</span>
        <h1 class="h-hero" style="margin:10px 0 6px">Buku Tamu Digital BK ${esc(info.nama_sekolah)}</h1>
        <p class="t2" style="max-width:640px">Selamat datang di ruang Bimbingan &amp; Konseling. Silakan pilih kategori kunjungan Anda untuk memulai pencatatan yang aman, ramah, dan terjaga kerahasiaannya.</p></div>
      <div class="safe-box"><span class="eyebrow" style="display:flex;gap:6px;align-items:center">${ic('shield', 14)} Data Dirahasiakan</span><b style="font-size:18px">Hanya untuk Guru BK</b><div class="small muted">Sesuai kode etik Guru BK Indonesia</div></div>
    </section>
    ${stepper(1)}
    <h2 class="h-sm" style="margin-bottom:2px">Pilih Kategori Kunjungan</h2><p class="small muted" style="margin-bottom:12px">Pilih tipe pengunjung untuk menyesuaikan formulir registrasi</p>
    <div class="cats" id="cats">${Object.keys(BK.JENIS).map(j => `<button type="button" class="cat ${F.jenis === j ? 'on' : ''}" data-cat="${j}"><span class="tick">${ic('check', 14)}</span><span class="ico">${ic(BK.JENIS[j].ic, 22)}</span><b>${BK.JENIS[j].l}</b><p>${{ siswa: 'Peserta didik SMA Negeri 6 Palangka Raya untuk layanan Bimbingan Pribadi, Sosial, Belajar, & Karir.', umum: 'Orang tua, wali murid, guru wali kelas, atau tamu personal yang berkepentingan dengan tim BK.', khusus: 'Tamu kedinasan, pengawas sekolah, instansi pemerintah, atau lembaga mitra kerja sama.' }[j]}</p></button>`).join('')}</div>
    <form id="form" class="card form-card" style="margin-top:22px" novalidate autocomplete="off">
      <span class="eyebrow" style="color:var(--mint)">● Formulir Pendaftaran Tamu</span>
      <h2 class="h-md" id="formTitle" style="margin:4px 0 18px"></h2>
      <input class="hp" type="text" name="website" data-k="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="form-grid c2" id="formFields"></div>
      <label class="check card-mint" style="margin-top:20px;padding:14px;border-radius:12px;border:1px solid #DCFCE7;background:var(--mint-soft)"><input type="checkbox" data-k="setuju" ${F.setuju ? 'checked' : ''}><span><b>Persetujuan Pencatatan & Foto Verifikasi:</b> Saya menyatakan data di atas adalah benar milik saya, dan bersedia melanjutkan ke tahap pengambilan foto selfie di ruang BK ${esc(info.nama_sekolah)} sesuai standar keamanan administrasi sekolah.</span></label>${err('setuju')}
      <div class="form-actions"><span class="small muted" style="display:flex;gap:6px;align-items:center">${ic('refresh', 14)} Draf tersimpan otomatis di perangkat ini <button type="button" class="btn btn-sm btn-outline" id="resetForm" style="margin-left:6px">Kosongkan</button></span>
        <button class="btn btn-accent" id="next" type="submit" style="min-width:260px">${ic('camera', 18)} Lanjutkan ke Pengambilan Selfie ${ic('arrow', 18)}</button></div>
    </form>
    <div class="info3">
      <div class="card"><span class="eyebrow">Konselor Standby</span><div class="h-sm" style="margin-top:8px">${esc(info.konselor_standby)}</div><p class="small t2">${esc(info.konselor_info)}</p><p class="small muted" style="margin-top:16px;display:flex;gap:6px;align-items:center">${ic('clock', 14)} Jam Pelayanan: ${esc(info.jam_layanan)}</p></div>
      <div class="card"><span class="eyebrow">Lokasi Layanan</span><div class="h-sm" style="margin-top:8px">${esc(info.lokasi_bk)}</div><p class="small t2">Suasana tenang dan privat untuk konseling yang nyaman. Datang dan isi buku tamu sebelum masuk ruangan.</p></div>
      <div class="card card-dark"><span class="eyebrow">Pusat Bantuan Cepat</span><div class="h-sm" style="margin-top:8px">Butuh Pendampingan Segera?</div><p class="small" style="color:#d1fae5">Jangan ragu berbicara. Ruang BK adalah sahabat murid yang aman tanpa penghakiman.</p>${info.hotline ? `<p style="margin-top:12px;font-weight:700">Hotline BK: ${esc(info.hotline)}</p>` : ''}</div>
    </div></div>`;
    $('#formTitle').textContent = { siswa: 'Data Registrasi Siswa BK', umum: 'Data Registrasi Tamu Umum', khusus: 'Data Registrasi Tamu Khusus' }[F.jenis];
    $('#formFields').innerHTML = formFields();
    bindForm(); refreshUI(true);
    if (!BK.configured()) m.insertAdjacentHTML('afterbegin', `<div class="alert warn" style="margin-bottom:16px">${ic('alert', 18)}<div><b>Backend belum terhubung.</b> Isi <span class="mono">GAS_URL</span> di <span class="mono">js/config.js</span> dengan URL Web App Google Apps Script.</div></div>`);
  }

  function refreshUI(initial) {
    const e = validate(F);
    $$('[data-err]').forEach(el => { const k = el.dataset.err, show = (F.touched[k] || F.touched.__all) && e[k]; el.innerHTML = show ? ic('alert', 13) + ' ' + esc(e[k]) : ''; el.style.display = show ? '' : 'none';
      const inpEl = $('[data-k="' + k + '"]'); if (inpEl && inpEl.classList) inpEl.classList.toggle('err', !!show); });
    $$('.cond').forEach(c => { const [k, v] = c.dataset.when.split('='); c.classList.toggle('hidden', F[k] !== v); });
    const ok = !Object.keys(e).length; const b = $('#next'); if (b) { b.disabled = !ok; b.title = ok ? '' : 'Lengkapi semua isian yang wajib'; }
    if (!initial) saveDraft();
    return e;
  }
  function bindForm() {
    const form = $('#form');
    form.addEventListener('input', ev => { const k = ev.target.dataset.k; if (!k || ev.target.type === 'checkbox') return; F[k] = ev.target.value; refreshUI(); });
    form.addEventListener('change', ev => { const k = ev.target.dataset.k; if (!k) return; F[k] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; F.touched[k] = true; refreshUI(); });
    form.addEventListener('focusout', ev => { const k = ev.target.dataset && ev.target.dataset.k; if (k) { F.touched[k] = true; refreshUI(); } });
    form.addEventListener('click', ev => {
      const c = ev.target.closest('[data-chip]'), r = ev.target.closest('[data-radio]');
      if (c) { const v = c.dataset.chip, i = F.bidang.indexOf(v); i > -1 ? F.bidang.splice(i, 1) : F.bidang.push(v); F.touched.bidang = true;
        c.classList.toggle('on'); c.setAttribute('aria-pressed', i < 0); c.innerHTML = ic(({ Pribadi: 'heart', Sosial: 'users', Belajar: 'book', Karir: 'briefcase' })[v] || 'check', 15) + ' ' + esc(v) + (i < 0 ? ic('check', 14) : ''); refreshUI(); }
      if (r) { const k = r.dataset.radio; F[k] = r.dataset.v; F.touched[k] = true; $$('[data-radio="' + k + '"]').forEach(x => { const on = x.dataset.v === F[k]; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); }); refreshUI(); }
    });
    form.addEventListener('submit', ev => {
      ev.preventDefault(); const e = validate(F);
      if (Object.keys(e).length) { F.touched.__all = true; refreshUI(); const first = $('.err') || $('[data-err]:not([style*="none"])'); if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' }); BK.toast('Lengkapi isian yang ditandai', 'warn'); return; }
      BK.go('#/selfie');
    });
    $('#cats').addEventListener('click', ev => { const b = ev.target.closest('[data-cat]'); if (!b || b.dataset.cat === F.jenis) return;
      F = newForm(b.dataset.cat, F); $$('.cat').forEach(x => x.classList.toggle('on', x === b));
      $('#formTitle').textContent = { siswa: 'Data Registrasi Siswa BK', umum: 'Data Registrasi Tamu Umum', khusus: 'Data Registrasi Tamu Khusus' }[F.jenis];
      $('#formFields').innerHTML = formFields(); $('[data-k="setuju"]').checked = false; refreshUI(); });
    $('#resetForm').onclick = () => { F = newForm(F.jenis); BK.LS.del('draft'); home(); BK.toast('Formulir dikosongkan'); };
  }

  /* ---------- SELFIE ---------- */
  function stopCam() { if (cam.stream) { cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; } }
  function selfie() {
    if (!F || Object.keys(validate(F)).length) { BK.go('#/'); return; }
    const m = shell('home'), info = Object.assign({}, DEF_INFO, BK.pub.info), p = payload(F);
    m.innerHTML = `<div class="view-enter">
    <div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:space-between;border-radius:var(--r-xl)">
      <div style="display:flex;gap:14px;align-items:center;min-width:0">${BK.logo('logo').replace('class="logo"', 'style="width:52px;height:52px;border-radius:14px"')}
        <div class="grow"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b class="h-md">${esc(p.nama)}</b>${BK.badgeJenis(F.jenis)}${p.kelas ? `<span class="badge" style="background:#EFF6FF;color:#1E40AF">Kelas ${esc(p.kelas)}</span>` : ''}</div>
        <div class="small t2 ell">Tujuan: <b>${esc(p.tujuan || p.bidang.join(', '))}</b></div></div></div>
      <span class="pill" style="background:#EFF6FF;color:#1E3A8A;padding:9px 14px">${ic('lock', 14)} Sesi Rahasia Terproteksi</span>
    </div>
    ${stepper(2)}
    <div class="cam-grid">
      <div>
        <div class="card" style="border-radius:var(--r-xl)">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
            <span id="camStatus" class="small t2" style="display:flex;gap:8px;align-items:center"><i class="dot" style="color:var(--muted)"></i> Menyiapkan kamera...</span>
            <button class="btn btn-sm btn-soft" id="flip" type="button">${ic('flip', 15)} Ganti Kamera</button></div>
          <div class="cam" id="camBox"><video id="vid" playsinline muted autoplay class="mirror"></video><img class="shot hidden" id="shot" alt="Hasil selfie"><div class="oval" id="oval"></div><div class="hint" id="hint">Posisikan wajah di dalam bingkai</div><div class="state hidden" id="camState"></div></div>
          <div class="cam-bar"><span class="small t2" id="camHelp">Klik tombol lingkaran hijau saat posisi siap.</span>
            <button type="button" class="shutter" id="snap" aria-label="Ambil foto">${ic('camera', 28)}</button>
            <span class="pill tag-live" id="sizeTag">${ic('check', 13)} Kompresi otomatis ≤ 500 KB</span></div>
        </div>
        <div class="card" style="margin-top:16px;background:#F1F5FF;border-color:#E0E7FF"><div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap"><span class="avatar lg" style="background:#fff">${ic('camera', 20)}</span>
          <div class="grow"><b>Izin Kamera Terkendala atau Tanpa Webcam?</b><p class="small t2">Jika browser memblokir akses kamera, Anda bisa mengambil foto selfie dari kamera bawaan ponsel atau memilih foto dari galeri (JPG, PNG, HEIC — maks. 10 MB sebelum dikompres).</p>
          <div style="margin-top:10px"><input type="file" id="file" accept="image/*" capture="user" class="sr"><label for="file" class="btn btn-primary btn-sm" style="cursor:pointer">${ic('upload', 15)} Ambil / Pilih Foto</label></div></div></div></div>
      </div>
      <aside style="display:grid;gap:16px;align-content:start">
        <div class="card"><b class="h-sm" style="display:flex;gap:8px;align-items:center">${ic('bulb', 20)} Petunjuk Selfie Tamu BK</b>
          <ul class="tips"><li><span class="n">1</span><div><b>Wajah Jelas Tanpa Aksesori Penutup</b><p class="small t2">Buka masker, kacamata hitam, atau topi agar wajah terlihat jelas.</p></div></li>
          <li><span class="n">2</span><div><b>Pencahayaan Cukup</b><p class="small t2">Hindari membelakangi jendela terang (backlight) agar wajah tidak tampak gelap.</p></div></li>
          <li><span class="n">3</span><div><b>Kerahasiaan Terjamin</b><p class="small t2">Foto disimpan di Google Drive privat milik BK dan hanya dapat diakses Guru BK/admin.</p></div></li></ul></div>
        <div class="card card-dark"><span class="eyebrow" style="display:flex;gap:6px;align-items:center">${ic('shieldok', 14)} Guru BK Piket Hari Ini</span><div class="h-md" style="margin:6px 0">${esc(info.konselor_standby)}</div><p class="small" style="color:#d1fae5">${esc(info.lokasi_bk)} • Jam layanan ${esc(info.jam_layanan)}</p></div>
        <div class="card" style="display:flex;gap:12px">${ic('shield', 22)}<div><b>Kebijakan Privasi</b><p class="small t2">Data kunjungan dan swafoto dilindungi dan hanya dipakai untuk administrasi layanan BK.</p></div></div>
      </aside>
    </div>
    <div class="sticky-bar"><button class="btn btn-soft" id="back" type="button">${ic('back', 16)} Kembali ke Edit Formulir</button>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span class="small muted" style="text-align:right">Langkah 2 dari 3 Tahapan</span>
        <button class="btn btn-primary" id="send" type="button" disabled style="min-width:250px">Kirim Kunjungan & Lanjut Konfirmasi ${ic('arrow', 16)}</button></div></div></div>`;
    $('#back').onclick = () => BK.go('#/');
    $('#flip').onclick = () => { cam.facing = cam.facing === 'user' ? 'environment' : 'user'; startCam(); };
    $('#snap').onclick = snap;
    $('#send').onclick = send;
    $('#file').onchange = onFile;
    BK.onLeave(stopCam);
    if (F.foto) showShot(); else startCam();
  }
  const camMsg = (txt, ok) => { const s = $('#camStatus'); if (s) s.innerHTML = `<i class="dot" style="color:${ok ? 'var(--mint)' : 'var(--pending)'}"></i> ${txt}`; };
  async function startCam() {
    stopCam(); const v = $('#vid'), st = $('#camState'); if (!v) return;
    st.classList.add('hidden'); $('#shot').classList.add('hidden'); v.classList.remove('hidden'); $('#oval').classList.remove('hidden'); $('#hint').classList.remove('hidden');
    F.foto = null; F.thumb = null; $('#send').disabled = true; $('#snap').disabled = false; $('#snap').innerHTML = ic('camera', 28); $('#camHelp').textContent = 'Klik tombol lingkaran hijau saat posisi siap.';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { noCam('Browser ini tidak mendukung akses kamera. Gunakan tombol "Ambil / Pilih Foto" di bawah.'); return; }
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cam.facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (!$('#vid')) { stopCam(); return; }
      v.classList.toggle('mirror', cam.facing === 'user'); v.srcObject = cam.stream; await v.play().catch(() => {});
      camMsg((cam.facing === 'user' ? 'Kamera Depan' : 'Kamera Belakang') + ' Siap', true);
    } catch (e) {
      noCam(e && e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau pakai tombol "Ambil / Pilih Foto".' : 'Kamera tidak ditemukan. Gunakan tombol "Ambil / Pilih Foto" di bawah.');
    }
  }
  function noCam(msg) { camMsg('Kamera tidak tersedia'); const st = $('#camState'); st.innerHTML = `<div>${ic('camera', 34)}<p style="margin-top:8px">${esc(msg)}</p></div>`; st.classList.remove('hidden'); $('#oval').classList.add('hidden'); $('#hint').classList.add('hidden'); $('#snap').disabled = true; }
  function snap() {
    const v = $('#vid'); if (!v || !v.videoWidth) { BK.toast('Kamera belum siap', 'warn'); return; }
    F.foto = BK.compress(v, 800, 500); F.thumb = BK.thumb(v); stopCam(); showShot();
  }
  function showShot() {
    const v = $('#vid'), im = $('#shot'); im.src = F.foto; im.classList.remove('hidden'); v.classList.add('hidden'); $('#oval').classList.add('hidden'); $('#hint').classList.add('hidden'); $('#camState').classList.add('hidden');
    camMsg('Foto Terverifikasi', true); $('#send').disabled = false;
    $('#camHelp').innerHTML = `Ukuran foto: <b>${Math.round(F.foto.length * 0.75 / 1024)} KB</b>`;
    const sn = $('#snap'); sn.disabled = false; sn.innerHTML = ic('refresh', 26); sn.setAttribute('aria-label', 'Foto ulang'); sn.onclick = () => { sn.onclick = snap; sn.setAttribute('aria-label', 'Ambil foto'); startCam(); };
  }
  async function onFile(ev) {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    if (f.size > 10 * 1048576) { BK.toast('Ukuran foto maksimal 10 MB', 'err'); return; }
    try {
      let src; if (window.createImageBitmap) { try { src = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch (e) { src = null; } }
      if (!src) src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
      F.foto = BK.compress(src, 800, 500); F.thumb = BK.thumb(src); stopCam(); showShot();
    } catch (e) { BK.toast('Format foto tidak didukung browser ini (mis. HEIC). Ambil foto langsung dengan kamera.', 'err', 5000); }
    ev.target.value = '';
  }

  /* ---------- KIRIM (optimistic: pindah layar seketika) ---------- */
  function send() {
    if (!F.foto) return;
    const pl = Object.assign(payload(F), { reqId: F.reqId || (F.reqId = BK.uid()), foto: F.foto, thumb: F.thumb });
    BK.state.sending = { status: 'sending', pl, snap: { jenis: F.jenis, p: payload(F), foto: F.foto, kelas: F.kelas } };
    BK.go('#/sukses'); doSend();
  }
  async function doSend() {
    const s = BK.state.sending; if (!s) return; s.status = 'sending'; paintSuccess();
    try { s.res = await BK.api('submitTamu', s.pl, { retry: 2, timeout: 70000 }); s.status = 'ok'; BK.LS.del('draft'); F = null; }
    catch (e) { s.status = 'err'; s.msg = e.message; }
    paintSuccess();
  }
  let tick = null;
  function sukses() {
    const s = BK.state.sending; if (!s) { BK.go('#/'); return; }
    shell('home'); $('#main').innerHTML = '<div class="wrap narrow" style="padding:0" id="succ"></div>'; paintSuccess();
    BK.onLeave(() => { clearInterval(tick); tick = null; });
  }
  function paintSuccess() {
    const box = $('#succ'), s = BK.state.sending; if (!box || !s) return;
    const p = s.snap.p, info = Object.assign({}, DEF_INFO, BK.pub.info);
    const st = `<div class="stepper" style="grid-template-columns:repeat(3,1fr)">${['Isi Formulir', 'Verifikasi Selfie', 'Registrasi Sukses'].map((t, i) => `<div class="step ${i < 2 || s.status === 'ok' ? 'done' : 'on'}"><span class="n">${i < 2 || s.status === 'ok' ? ic('check', 15) : '3'}</span><div class="grow"><b>${i + 1}. ${t}</b></div></div>`).join('')}</div>`;
    if (s.status === 'sending') { box.innerHTML = st + `<div class="success"><div class="top"><div class="tick pulse">${ic('upload', 34)}</div><h1 class="h-lg">Menyimpan kunjungan Anda...</h1><p style="color:#d1fae5;margin-top:6px">Mohon tunggu sebentar dan jangan tutup halaman ini.</p></div></div>`; return; }
    if (s.status === 'err') { box.innerHTML = st + `<div class="success"><div class="top" style="background:linear-gradient(135deg,#991B1B,#7F1D1D)"><div class="tick" style="background:#EF4444">${ic('alert', 34)}</div><h1 class="h-lg">Kunjungan belum tersimpan</h1><p style="color:#fecaca;margin-top:6px">${esc(s.msg)}</p></div>
      <div class="body"><div class="alert info">${ic('info', 18)}<div>Data dan foto Anda <b>tidak hilang</b>. Tekan tombol di bawah untuk mencoba mengirim ulang (aman, tidak akan tercatat dobel).</div></div>
      <button class="btn btn-primary btn-block" id="retry">${ic('refresh', 16)} Coba Kirim Ulang</button><button class="btn btn-outline btn-block" id="edit">Kembali ke Formulir</button></div></div>`;
      $('#retry').onclick = doSend; $('#edit').onclick = () => { F = F || Object.assign(newForm(s.snap.jenis), s.form || {}); BK.go('#/'); }; if (!F) { F = formFromPayload(s); } return; }
    const r = s.res, left = BK.state.left != null ? BK.state.left : BK.cfg.RESET_DETIK;
    box.innerHTML = st + `<div class="success" id="ticketCard">
      <div class="top"><div class="tick">${ic('check', 38)}</div><span class="eyebrow" style="color:#6ee7b7">Layanan Bimbingan Konseling</span><h1 class="h-lg" style="margin:6px 0">Kunjungan Anda Telah Berhasil Dicatat!</h1>
        <p style="color:#d1fae5;max-width:480px;margin:auto">Terima kasih telah berkunjung ke Ruang Bimbingan &amp; Konseling ${esc(info.nama_sekolah)}. Data dan kerahasiaan Anda terjamin sesuai kode etik konseling.</p></div>
      <div class="body">
        <div class="ticket"><div style="display:flex;gap:12px;align-items:center"><span class="avatar lg" style="background:var(--primary);color:#fff">${ic('ticket', 20)}</span><div><span class="small muted">NOMOR TIKET KUNJUNGAN</span><div class="h-md mono" style="font-size:20px">${esc(r.id)}</div></div></div>
          <div style="display:flex;gap:8px;align-items:center"><button class="btn btn-sm btn-outline" id="cpId">${ic('copy', 14)} Salin ID</button><span class="pill tag-live"><i class="dot"></i> Tersimpan di Cloud</span></div></div>
        <div style="display:grid;gap:14px;grid-template-columns:1fr" class="sgrid"><div class="kv">
          <div class="it"><span class="i">${ic('user', 17)}</span><div><small>Nama Pengunjung</small><b>${esc(p.nama)}</b><div class="small t2">${esc(BK.JENIS[s.snap.jenis].l)}${p.kelas ? ' • Kelas ' + esc(p.kelas) : ''}${p.instansi ? ' • ' + esc(p.instansi) : ''}</div></div></div>
          <div class="it"><span class="i">${ic('clock', 17)}</span><div><small>Waktu Kedatangan</small><b>${esc(BK.fmtTgl(r.tanggal))}, ${esc(r.jam)} ${BK.tzAbbr()}</b></div></div>
          <div class="it"><span class="i">${ic('heart', 17)}</span><div><small>Bidang Layanan</small><b>${esc(p.bidang.join(', '))}</b>${p.tujuan ? `<div class="small t2">${esc(p.tujuan)}</div>` : ''}</div></div>
          <div class="it"><span class="i">${ic('shieldok', 17)}</span><div><small>Guru BK Bertugas</small><b>${esc(info.konselor_standby)}</b><div class="small t2">${esc(info.lokasi_bk)}</div></div></div></div>
          <div><span class="small muted" style="display:flex;gap:6px;align-items:center;margin-bottom:6px">${ic('camera', 14)} Bukti Presensi Selfie</span><div class="shot-box"><img src="${s.snap.foto}" alt="Selfie Anda"></div></div></div>
        <div class="next-box">${ic('info', 22)}<div><b style="font-size:16px">Langkah Selanjutnya:</b><p class="t2" style="margin-top:4px">Silakan langsung menuju ke <b>${esc(info.lokasi_bk)}</b> atau tunggu panggilan nama Anda oleh Guru BK di ruang tunggu. Mohon tetap tertib dan menjaga ketenangan area konseling.</p></div></div>
        <button class="btn btn-primary btn-block" id="nextGuest" style="min-height:54px;font-size:15px">${ic('user', 18)} Isi untuk Tamu Berikutnya (Reset Formulir Kiosk)</button>
        <button class="btn btn-outline btn-block" id="printT">${ic('printer', 16)} Cetak Bukti / Simpan Tiket (PDF)</button>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);flex-wrap:wrap;gap:8px"><span>${ic('refresh', 13)} Otomatis kembali ke layar awal dalam <b id="cd" style="color:var(--text)">${left}</b> detik</span><button class="btn btn-sm btn-outline" id="hold">${BK.state.hold ? 'Lanjutkan' : 'Tahan Layar'}</button></div>
      </div></div>`;
    $('#cpId').onclick = () => BK.copy(r.id, 'ID kunjungan disalin');
    $('#nextGuest').onclick = resetKiosk; $('#printT').onclick = () => printTicket(r, p, s);
    $('#hold').onclick = e => { BK.state.hold = !BK.state.hold; e.target.textContent = BK.state.hold ? 'Lanjutkan' : 'Tahan Layar'; };
    if (!tick) { BK.state.left = BK.cfg.RESET_DETIK; tick = setInterval(() => { if (BK.state.hold) return; BK.state.left--; const c = $('#cd'); if (c) c.textContent = BK.state.left; if (BK.state.left <= 0) resetKiosk(); }, 1000); }
  }
  function formFromPayload(s) { const p = s.snap.p, f = newForm(s.snap.jenis); Object.assign(f, { nama: p.nama, email: p.email, hp: p.hp, bidang: p.bidang, ket: p.ket, kelas: p.kelas || '', tujuan: p.tujuan || '', alamat: p.alamat || '', namaMurid: p.namaMurid || '', instansi: p.instansi || '', jabatan: p.jabatan || '', setuju: true, foto: s.snap.foto, thumb: s.pl.thumb, reqId: s.pl.reqId });
    if (f.jenis === 'umum') { const st = BK.pub.ref.status_tamu; f.alamatPilih = p.alamat === 'SMA Negeri 6 Palangka Raya' ? p.alamat : 'Lainnya'; f.statusPilih = st.indexOf(p.statusTamu) > -1 ? p.statusTamu : 'Lainnya'; f.statusManual = f.statusPilih === 'Lainnya' ? p.statusTamu : ''; }
    return f; }
  function resetKiosk() { clearInterval(tick); tick = null; BK.state.left = null; BK.state.hold = false; BK.state.sending = null; F = null; BK.LS.del('draft'); BK.go('#/'); if (location.hash === '#/' || !location.hash) BK.resolve(); }
  function printTicket(r, p, s) {
    $('#printArea').innerHTML = `<div style="max-width:420px;margin:auto;font-family:Arial,sans-serif;text-align:center"><img src="${esc(BK.cfg.LOGO)}" width="70" alt=""><h2>Bukti Kunjungan Ruang BK</h2><p>${esc(BK.cfg.NAMA_SEKOLAH)}</p><hr><h1 style="letter-spacing:1px">${esc(r.id)}</h1>
      <table style="margin-top:10px"><tr><th>Nama</th><td>${esc(p.nama)}</td></tr><tr><th>Kategori</th><td>${esc(BK.JENIS[s.snap.jenis].l)}</td></tr><tr><th>Waktu</th><td>${esc(BK.fmtTgl(r.tanggal))}, ${esc(r.jam)} ${BK.tzAbbr()}</td></tr><tr><th>Bidang</th><td>${esc(p.bidang.join(', '))}</td></tr></table><p style="margin-top:12px;font-size:11px">Data bersifat rahasia sesuai kode etik Guru BK.</p></div>`;
    window.print();
  }

  /* ---------- halaman info ---------- */
  function layanan() {
    const m = shell('layanan'), ref = BK.pub.ref;
    m.innerHTML = `<div class="view-enter wrap narrow" style="padding:0"><h1 class="h-lg">Layanan Konseling</h1><p class="t2" style="margin:6px 0 20px">Ruang BK hadir untuk mendampingi murid, orang tua, dan mitra sekolah di empat bidang layanan.</p>
      <div class="grid g2">${ref.bidang.map(b => `<div class="card card-hover" style="display:flex;gap:14px"><span class="avatar lg" style="background:var(--mint-100)">${ic(BIDANG_IC[b] || 'check', 22)}</span><div><b class="h-sm">Bimbingan ${esc(b)}</b><p class="small t2">${esc(BIDANG_DESC[b] || '')}</p></div></div>`).join('')}</div>
      <a class="btn btn-primary" href="#/" style="margin-top:22px">Isi Buku Tamu ${ic('arrow', 16)}</a></div>`;
  }
  function jadwal() {
    const m = shell('jadwal'), info = Object.assign({}, DEF_INFO, BK.pub.info);
    m.innerHTML = `<div class="view-enter wrap narrow" style="padding:0"><h1 class="h-lg">Jadwal Guru BK</h1><p class="t2" style="margin:6px 0 20px">Informasi jam layanan dan konselor yang bertugas.</p>
      <div class="card kv-rows" style="font-size:14px"><div><span>Konselor standby</span><b>${esc(info.konselor_standby)}</b></div><div><span>Peran</span><b>${esc(info.konselor_info)}</b></div><div><span>Jam pelayanan</span><b>${esc(info.jam_layanan)}</b></div><div><span>Lokasi</span><b>${esc(info.lokasi_bk)}</b></div>${info.hotline ? `<div><span>Hotline</span><b>${esc(info.hotline)}</b></div>` : ''}</div>
      <a class="btn btn-primary" href="#/" style="margin-top:22px">Isi Buku Tamu ${ic('arrow', 16)}</a></div>`;
  }

  BK.route(/^\/$/, home); BK.route(/^\/selfie$/, selfie); BK.route(/^\/sukses$/, sukses);
  BK.route(/^\/layanan$/, layanan); BK.route(/^\/jadwal$/, jadwal);
})();

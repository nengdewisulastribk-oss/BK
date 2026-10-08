/* ==========================================================
   LAPORAN BERFOTO — ringkasan statistik + kartu per tamu (foto,
   data formulir pendaftaran, sampai catatan Guru BK).
   Periode: harian / bulanan / rentang tanggal.
   Alur (gas-instant-ux): data dari 1 panggilan batch, foto diambil
   per kelompok kecil secara paralel (hindari timeout GAS), lalu
   dicetak/disimpan sebagai PDF lewat dialog cetak browser.
   ========================================================== */
(function () {
  'use strict';
  const { $, $$, esc, ic } = BK;
  const MAX_FOTO = 200, BATCH = 6, PAR = 3;
  const pad = n => String(n).padStart(2, '0');
  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const tglPanjang = s => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? (+m[3]) + ' ' + BLN[+m[2] - 1] + ' ' + m[1] : String(s); };
  BK.rptPhotos = BK.rptPhotos || {};   // cache foto laporan (memori saja)

  const LBL = { Email: 'Email', No_HP: 'No. WhatsApp / HP', Kelas: 'Kelas', Status_Tamu: 'Status Tamu', Nama_Murid: 'Nama Murid', Asal_Dinas_Instansi: 'Asal Dinas / Instansi', Jabatan: 'Jabatan', Alamat: 'Alamat / Domisili', Tujuan: 'Tujuan Layanan', Bidang_Layanan_BK: 'Bidang Layanan', Keterangan: 'Keterangan Keperluan', Status_Tindak_Lanjut: 'Status Tindak Lanjut' };
  const ORDER = ['Email', 'No_HP', 'Kelas', 'Status_Tamu', 'Nama_Murid', 'Asal_Dinas_Instansi', 'Jabatan', 'Alamat', 'Tujuan', 'Bidang_Layanan_BK', 'Keterangan', 'Status_Tindak_Lanjut'];

  /* ---------- periode ---------- */
  function period(mode, a, b) {
    if (mode === 'hari') { if (!a) return null; return { from: a, to: a, label: tglPanjang(a), judul: 'Laporan Harian' }; }
    if (mode === 'bulan') {
      const m = String(a || '').match(/^(\d{4})-(\d{2})$/); if (!m) return null;
      const last = new Date(+m[1], +m[2], 0).getDate();
      return { from: a + '-01', to: a + '-' + pad(last), label: BLN[+m[2] - 1] + ' ' + m[1], judul: 'Laporan Bulanan' };
    }
    if (!a || !b) return null; if (a > b) { const t = a; a = b; b = t; }
    return { from: a, to: b, label: tglPanjang(a) + ' s.d. ' + tglPanjang(b), judul: 'Laporan Periode' };
  }

  /* ---------- statistik ---------- */
  function stats(rows) {
    const S = { total: rows.length, jenis: { siswa: 0, umum: 0, khusus: 0 }, status: { Baru: 0, Diproses: 0, Selesai: 0 }, bidang: {}, tingkat: { X: 0, XI: 0, XII: 0 }, foto: 0 };
    rows.forEach(r => {
      if (S.jenis[r.Jenis] != null) S.jenis[r.Jenis]++;
      const st = r.Status_Tindak_Lanjut || 'Baru'; if (S.status[st] != null) S.status[st]++;
      String(r.Bidang_Layanan_BK || '').split(', ').forEach(b => { if (b) S.bidang[b] = (S.bidang[b] || 0) + 1; });
      if (r.Jenis === 'siswa') { const k = String(r.Kelas || '').split('.')[0]; if (S.tingkat[k] != null) S.tingkat[k]++; }
      if (r.ID_File_Foto) S.foto++;
    });
    return S;
  }
  const bars = (map, keepOrder) => {
    let e = Object.keys(map).map(k => [k, map[k]]);
    if (!keepOrder) e.sort((a, b) => b[1] - a[1]);
    const tot = e.reduce((s, x) => s + x[1], 0), mx = Math.max.apply(null, e.map(x => x[1]).concat(1));
    if (!e.length || !tot) return '<div class="br"><span class="l">Tidak ada data</span></div>';
    return e.map(x => `<div class="br"><span class="l">${esc(x[0])}</span><span class="b"><i style="width:${Math.round(x[1] / mx * 100)}%"></i></span><span class="n">${x[1]} (${Math.round(x[1] / tot * 100)}%)</span></div>`).join('');
  };

  /* ---------- susun dokumen laporan ---------- */
  const CSS = `<style>
@page{size:A4;margin:12mm}
.rpt{font-size:11px;color:#111;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rpt .hd{display:flex;align-items:center;gap:12px;border-bottom:2px solid #1B5E3C;padding-bottom:8px;margin-bottom:10px}
.rpt .hd img{width:46px;height:46px;object-fit:contain}
.rpt h1{font-size:18px;margin:0;color:#1B5E3C}
.rpt .sub{font-size:11px;color:#444;margin-top:2px}
.rpt h3{font-size:13px;margin:14px 0 6px;color:#1B5E3C;border-left:4px solid #1B5E3C;padding-left:8px}
.rpt .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.rpt .kpi{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;background:#f8fafc}
.rpt .kpi b{display:block;font-size:20px;color:#1B5E3C;line-height:1.1}
.rpt .kpi span{font-size:10px;color:#555}
.rpt .cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.rpt .br{display:grid;grid-template-columns:34% 1fr 24%;gap:6px;align-items:center;margin:3px 0;font-size:10.5px}
.rpt .br .b{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}
.rpt .br .b i{display:block;height:100%;background:#2E9E6B}
.rpt .br .n{text-align:right}
.rpt .pg{break-before:page;page-break-before:always}
.rpt .tm{display:flex;gap:12px;border:1px solid #cbd5e1;border-radius:8px;padding:8px;margin-bottom:8px;break-inside:avoid;page-break-inside:avoid}
.rpt .ph{flex:0 0 30mm;text-align:center}
.rpt .ph img,.rpt .ph .nf{width:30mm;height:38mm;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;display:block}
.rpt .ph .nf{display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#64748b;font-size:10px;text-align:center;padding:4px}
.rpt .kv{flex:1;min-width:0}
.rpt .kv .nm{font-size:13px;font-weight:700;margin-bottom:3px}
.rpt .kv .r{display:grid;grid-template-columns:30mm 1fr;gap:6px;padding:2px 0;border-bottom:1px dotted #d6dbe3}
.rpt .kv .r:last-child{border-bottom:0}
.rpt .kv .r span:first-child{color:#555;font-size:10px}
.rpt .kv .r span:last-child{word-break:break-word;white-space:pre-wrap}
.rpt .kv .note{background:#fffbeb;border-left:3px solid #f59e0b;padding:3px 6px;margin-top:3px}
.rpt .ft{margin-top:10px;font-size:9px;color:#666;border-top:1px solid #cbd5e1;padding-top:6px}
</style>`;

  function card(r, i, o) {
    const rows = [['ID Kunjungan', r.ID_Kunjungan], ['Waktu Kedatangan', BK.fmtTgl(r.Tanggal) + ', ' + r.Jam + ' ' + BK.tzAbbr()]]
      .concat(ORDER.map(k => [LBL[k], r[k]]).filter(x => String(x[1] == null ? '' : x[1]).trim() !== ''));
    const html = rows.map(x => `<div class="r"><span>${esc(x[0])}</span><span>${esc(x[1])}</span></div>`).join('');
    const note = o.catatan ? `<div class="r note"><span>Catatan Guru BK</span><span>${esc(String(r.Catatan_Guru_BK || '').trim() || '—')}</span></div>` : '';
    const img = BK.rptPhotos[r.ID_File_Foto];
    const ph = !o.foto ? '' : `<div class="ph">${img ? `<img src="${esc(img)}" alt="Foto ${esc(r.Nama)}">` : `<div class="nf">${r.ID_File_Foto ? 'Foto tidak dapat dimuat' : 'Tanpa foto'}</div>`}</div>`;
    return `<div class="tm">${ph}<div class="kv"><div class="nm">${i + 1}. ${esc(r.Nama)} <span style="font-weight:500;color:#555">— ${esc((BK.JENIS[r.Jenis] || {}).l || r.Jenis)}</span></div>${html}${note}</div></div>`;
  }

  function build(rows, per, o) {
    const S = stats(rows), who = (BK.Auth.user && BK.Auth.user.nama) || '-';
    const span = (Date.parse(per.to) - Date.parse(per.from)) / 86400000;
    let trend = '';
    if (per.from !== per.to) {
      const byM = span > 31, map = {};
      rows.forEach(r => { const k = byM ? String(r.Tanggal).substring(0, 7) : r.Tanggal; map[k] = (map[k] || 0) + 1; });
      const out = {}; Object.keys(map).sort().forEach(k => { out[byM ? BLN[+k.substring(5, 7) - 1] + ' ' + k.substring(0, 4) : BK.fmtTgl(k)] = map[k]; });
      trend = `<h3>Kunjungan per ${byM ? 'Bulan' : 'Hari'}</h3>${bars(out, true)}`;
    }
    return CSS + `<div class="rpt">
<div class="hd">${BK.logo()}<div><h1>${esc(per.judul)} Kunjungan Ruang BK</h1><div class="sub">${esc(BK.cfg.NAMA_SEKOLAH)} • Periode: <b>${esc(per.label)}</b></div>
<div class="sub">Zona waktu ${esc(BK.tzLabel())} • Dicetak ${esc(BK.nowStr())} oleh ${esc(who)}</div></div></div>
<h3>Ringkasan Statistik</h3>
<div class="kpis"><div class="kpi"><b>${S.total}</b><span>Total kunjungan</span></div><div class="kpi"><b>${S.jenis.siswa}</b><span>Siswa</span></div><div class="kpi"><b>${S.jenis.umum}</b><span>Umum (ortu/wali/guru)</span></div><div class="kpi"><b>${S.jenis.khusus}</b><span>Khusus (dinas/instansi)</span></div></div>
<div class="cols"><div><h3>Status Tindak Lanjut</h3>${bars(S.status, true)}<h3>Siswa per Tingkat Kelas</h3>${bars(S.tingkat, true)}<h3>Kelengkapan Foto</h3>${bars({ 'Berfoto': S.foto, 'Tanpa foto': S.total - S.foto }, true)}</div>
<div><h3>Bidang Layanan BK</h3>${bars(S.bidang)}</div></div>
${trend}
<div class="pg"></div><h3>Daftar Kunjungan Lengkap (${S.total} tamu, urut waktu kedatangan)</h3>
${rows.map((r, i) => card(r, i, o)).join('')}
<div class="ft">Dokumen ini bersifat rahasia dan hanya untuk keperluan Bimbingan dan Konseling. ${o.catatan ? '' : 'Catatan Guru BK tidak disertakan dalam laporan ini.'}</div></div>`;
  }

  /* ---------- foto: kelompok kecil, paralel ---------- */
  async function loadPhotos(rows, onProg, ctl) {
    const ids = rows.map(r => r.ID_File_Foto).filter(id => id && !BK.rptPhotos[id]), batches = [];
    for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
    let idx = 0, done = 0, failed = 0, authErr = null;
    async function worker() {
      while (idx < batches.length && !authErr && !(ctl && ctl.cancel)) {
        const b = batches[idx++];
        try { const r = await BK.api('getFotoBatch', { ids: b }, { timeout: 60000, retry: 2 }); Object.assign(BK.rptPhotos, (r && r.fotos) || {}); }
        catch (e) { if (e.code === 'AUTH') { authErr = e; return; } failed += b.length; }
        done += b.length; if (onProg) onProg(done, ids.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(PAR, batches.length) }, worker));
    if (authErr) throw authErr;
    return failed;
  }

  /* ---------- dialog ---------- */
  function open() {
    const today = BK.localYMD();
    let mode = 'hari';
    const ctl = { cancel: false };
    const ov = BK.modal(`<h3>Laporan Berfoto</h3>
      <p class="t2 small" style="margin-bottom:12px">Ringkasan statistik + kartu tiap tamu lengkap dengan foto, data pendaftaran, sampai catatan Guru BK. Hasilnya bisa disimpan sebagai PDF.</p>
      <div class="seg" id="rm"><button type="button" data-m="hari" class="on">Harian</button><button type="button" data-m="bulan">Bulanan</button><button type="button" data-m="rentang">Rentang Tanggal</button></div>
      <div id="rp" style="margin-top:12px"></div>
      <div class="field" style="margin-top:10px"><label class="lbl" for="rj">Jenis tamu</label><select class="select" id="rj"><option value="semua">Semua jenis tamu</option><option value="siswa">Siswa</option><option value="umum">Umum</option><option value="khusus">Khusus</option></select></div>
      <div class="chips" style="margin-top:12px"><label class="chip on" id="rf">${ic('camera', 14)} Sertakan foto</label><label class="chip on" id="rc">${ic('file', 14)} Sertakan catatan Guru BK</label></div>
      <div id="rst" class="small t2" style="margin-top:12px;min-height:34px" aria-live="polite"></div>
      <div class="foot"><button class="btn btn-outline" id="rx" type="button">Batal</button><button class="btn btn-primary" id="rg" type="button">${ic('file', 16)} Buat Laporan</button></div>`,
      { wide: false, onClose: () => { ctl.cancel = true; } });
    const status = (t, err) => { const el = $('#rst', ov); if (el) { el.textContent = t; el.style.color = err ? 'var(--danger)' : ''; } };
    const paint = () => {
      $('#rp', ov).innerHTML = mode === 'hari' ? `<div class="field"><label class="lbl" for="p1">Tanggal</label><input class="input" type="date" id="p1" value="${today}"></div>`
        : mode === 'bulan' ? `<div class="field"><label class="lbl" for="p1">Bulan</label><input class="input" type="month" id="p1" value="${today.substring(0, 7)}"></div>`
        : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label class="lbl" for="p1">Dari tanggal</label><input class="input" type="date" id="p1" value="${today.substring(0, 8)}01"></div><div class="field"><label class="lbl" for="p2">Sampai tanggal</label><input class="input" type="date" id="p2" value="${today}"></div></div>`;
      $$('#rm button', ov).forEach(b => b.classList.toggle('on', b.dataset.m === mode));
    };
    paint();
    $('#rm', ov).onclick = e => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; paint(); status(''); } };
    $('#rf', ov).onclick = e => { e.preventDefault(); e.currentTarget.classList.toggle('on'); };
    $('#rc', ov).onclick = e => { e.preventDefault(); e.currentTarget.classList.toggle('on'); };
    $('#rx', ov).onclick = () => ov.close();
    $('#rg', ov).onclick = async () => {
      const per = period(mode, ($('#p1', ov) || {}).value, ($('#p2', ov) || {}).value);
      if (!per) { status('Lengkapi periode laporan terlebih dahulu.', true); return; }
      const o = { foto: $('#rf', ov).classList.contains('on'), catatan: $('#rc', ov).classList.contains('on') }, btn = $('#rg', ov);
      BK.loading(btn, true, 'Menyiapkan...');
      try {
        status('Mengambil data kunjungan…');
        const r = await BK.api('exportTamu', { jenis: $('#rj', ov).value, from: per.from, to: per.to }, { timeout: 60000 });
        const rows = (r.rows || []).slice().sort((a, b) => String(a.Timestamp || a.Tanggal + a.Jam) < String(b.Timestamp || b.Tanggal + b.Jam) ? -1 : 1);
        if (!rows.length) { status('Tidak ada kunjungan pada periode ini.', true); return; }
        const nFoto = rows.filter(x => x.ID_File_Foto).length;
        if (o.foto && nFoto > MAX_FOTO) { status(nFoto + ' tamu berfoto — melebihi batas ' + MAX_FOTO + ' per laporan. Persempit periode atau matikan "Sertakan foto".', true); return; }
        if (o.foto && nFoto) {
          status('Memuat foto 0/' + nFoto + '…');
          const fail = await loadPhotos(rows, (d, t) => status('Memuat foto ' + d + '/' + t + '…'), ctl);
          if (ctl.cancel) return;
          if (fail) BK.toast(fail + ' foto gagal dimuat — kartunya ditandai "Foto tidak dapat dimuat"', 'warn', 5000);
        }
        status('Menyusun laporan…');
        const area = $('#printArea'); area.innerHTML = build(rows, per, o);
        await Promise.all($$('img', area).map(im => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
        const name = 'Laporan-BK_' + per.from + (per.to !== per.from ? '_sd_' + per.to : ''), old = document.title;
        document.title = name; window.addEventListener('afterprint', () => { document.title = old; }, { once: true });
        ov.close();
        BK.toast('Pilih "Simpan sebagai PDF" pada dialog cetak' + (r.truncated ? ' (data dibatasi 5.000 baris)' : ''), 'ok', 5000);
        setTimeout(() => window.print(), 300);
        BK.api('logExport', { format: 'FOTO-PDF', jumlah: rows.length, rentang: per.from + '_sd_' + per.to }, { retry: 0 }).catch(() => {});
      } catch (e) { status(e.message || 'Terjadi kesalahan', true); }
      finally { BK.loading(btn, false); }
    };
  }

  BK.laporan = { open, _t: { period, stats, build, loadPhotos } };
})();

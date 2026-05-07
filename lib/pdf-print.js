/**
 * pdf-print.js — Generate PDF via window.print()
 * Membuat halaman cetak terstruktur di iframe tersembunyi,
 * lalu trigger browser print dialog (user pilih "Save as PDF").
 * Bekerja di Chrome, Firefox, Safari, Edge — termasuk HP Android & iOS.
 */

const PdfPrint = (() => {

  function fmtMin(m) { return Number(m).toLocaleString('id-ID'); }
  function minToHour(m) { return (m / 60).toFixed(2); }
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function monthName(period) {
    const [y, m] = period.split('-');
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }
  function dayName(period, day) {
    const [y, m] = period.split('-');
    return new Date(y, m - 1, day).toLocaleDateString('id-ID', { weekday: 'short' });
  }
  function daysInMonth(period) {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function hasDayData(day) {
    const op = day.operations.reduce((s, p) => s + Object.values(p.items).reduce((a, b) => a + (Number(b) || 0), 0), 0);
    const non = Object.values(day.nonOperations).reduce((a, b) => a + (Number(b) || 0), 0);
    return op + non > 0;
  }

  function buildHTML(db, period) {
    const m = db.months[period] || { days: {}, parafLeader: '', parafForeman: '' };
    const mn = monthName(period);
    const td = daysInMonth(period);

    // ── Aggregate ──
    const projTotals = {};
    const nonOpTotals = {};
    let totalOp = 0, totalNon = 0;

    Object.entries(m.days).forEach(([ds, day]) => {
      day.operations.forEach(p => {
        const s = Object.values(p.items).reduce((a, b) => a + (Number(b) || 0), 0);
        if (!projTotals[p.projectName]) projTotals[p.projectName] = { number: p.projectNumber || '', total: 0 };
        projTotals[p.projectName].total += s;
        totalOp += s;
      });
      Object.entries(day.nonOperations).forEach(([k, v]) => {
        const n = Number(v) || 0;
        nonOpTotals[k] = (nonOpTotals[k] || 0) + n;
        totalNon += n;
      });
    });

    const totalAll = totalOp + totalNon;
    const ratio = totalAll > 0 ? Math.round(totalOp / totalAll * 100) : 0;

    // ── Project rows ──
    const projRows = Object.entries(projTotals)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, v], i) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${esc(v.number)}</td>
          <td>${esc(name)}</td>
          <td style="text-align:right">${fmtMin(v.total)}</td>
          <td style="text-align:right">${minToHour(v.total)}</td>
        </tr>`).join('');

    // ── Non-op rows ──
    const nonOpRows = Object.entries(nonOpTotals)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, v]) => `
        <tr>
          <td>${esc(name)}</td>
          <td style="text-align:right">${fmtMin(v)}</td>
          <td style="text-align:right">${minToHour(v)}</td>
        </tr>`).join('');

    // ── Daily rows ──
    const dailyRows = (() => {
      let rows = '';
      for (let d = 1; d <= td; d++) {
        const day = m.days[d];
        if (!day || !hasDayData(day)) continue;
        const op = day.operations.reduce((s, p) => s + Object.values(p.items).reduce((a, b) => a + (Number(b) || 0), 0), 0);
        const non = Object.values(day.nonOperations).reduce((a, b) => a + (Number(b) || 0), 0);
        const t = op + non;
        const r = t > 0 ? Math.round(op / t * 100) : 0;
        const tgt = Number(day.target) || 480;
        const ot = t - tgt;
        const [y, mo] = period.split('-');
        const dow = new Date(y, mo - 1, d).getDay();
        const isWknd = dow === 0 || dow === 6;
        rows += `<tr style="${isWknd ? 'color:#dc2626' : ''}">
          <td>${d} ${esc(dayName(period, d).substring(0, 3))}</td>
          <td style="text-align:right">${fmtMin(op)}</td>
          <td style="text-align:right">${fmtMin(non)}</td>
          <td style="text-align:right">${fmtMin(t)}</td>
          <td style="text-align:center">${r}%</td>
          <td style="text-align:right">${tgt}</td>
          <td style="text-align:right;${ot > 0 ? 'color:#1e40af' : ot < 0 ? 'color:#dc2626' : ''}">${ot > 0 ? '+' : ''}${ot}</td>
          <td>${esc(day.note || '')}</td>
        </tr>`;
      }
      return rows || '<tr><td colspan="8" style="text-align:center;color:#6b7280">Belum ada data</td></tr>';
    })();

    // ── Detail Operation (per project per item) ──
    const allProjects = new Map();
    Object.entries(m.days).forEach(([ds, day]) => {
      day.operations.forEach(p => {
        if (!allProjects.has(p.projectName))
          allProjects.set(p.projectName, { number: p.projectNumber || '', days: {} });
        const e = allProjects.get(p.projectName);
        if (!e.days[ds]) e.days[ds] = {};
        Object.entries(p.items).forEach(([item, min]) => {
          if (Number(min) > 0) e.days[ds][item] = (e.days[ds][item] || 0) + Number(min);
        });
      });
    });

    const opItems = db.opItems || [];
    let detailRows = '';
    allProjects.forEach((proj, projName) => {
      opItems.forEach((item, idx) => {
        let rowTotal = 0;
        let cells = '';
        for (let d = 1; d <= td; d++) {
          const v = proj.days[d] ? (proj.days[d][item] || 0) : 0;
          rowTotal += v;
          cells += `<td style="text-align:right;font-size:9px">${v || ''}</td>`;
        }
        if (idx === 0) {
          detailRows += `<tr style="background:#dbeafe">
            <td colspan="2" style="font-weight:700;font-size:10px">${esc(projName)}</td>
            <td style="font-size:9px;color:#6b7280">${esc(proj.number)}</td>
            ${Array(td).fill('<td></td>').join('')}
          </tr>`;
        }
        if (rowTotal > 0 || true) {
          detailRows += `<tr>
            <td></td><td style="font-size:9px">${esc(item)}</td><td></td>
            ${cells}
          </tr>`;
        }
      });
    });

    // Total per day row
    let totalOpCells = '', totalNonCells = '', totalAllCells = '';
    for (let d = 1; d <= td; d++) {
      const day = m.days[d];
      if (!day) { totalOpCells += '<td></td>'; totalNonCells += '<td></td>'; totalAllCells += '<td></td>'; continue; }
      const op = day.operations.reduce((s, p) => s + Object.values(p.items).reduce((a, b) => a + (Number(b) || 0), 0), 0);
      const non = Object.values(day.nonOperations).reduce((a, b) => a + (Number(b) || 0), 0);
      totalOpCells += `<td style="text-align:right;font-size:9px;font-weight:700">${op || ''}</td>`;
      totalNonCells += `<td style="text-align:right;font-size:9px;font-weight:700">${non || ''}</td>`;
      totalAllCells += `<td style="text-align:right;font-size:9px;font-weight:700">${(op + non) || ''}</td>`;
    }

    // Build date header for detail table
    const dateHeaderCells = (() => {
      let h = '';
      for (let d = 1; d <= td; d++) {
        const [y, mo] = period.split('-');
        const dow = new Date(y, mo - 1, d).getDay();
        const isWknd = dow === 0 || dow === 6;
        h += `<th style="text-align:center;font-size:8px;${isWknd ? 'color:#dc2626' : ''}">${d}</th>`;
      }
      return h;
    })();

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan Harian - ${esc(db.profile.name)} - ${mn}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
  h1 { font-size: 14px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 11px; color: #1e40af; margin: 12px 0 4px; border-bottom: 1px solid #1e40af; padding-bottom: 2px; }
  .info-row { display: flex; gap: 20px; margin-bottom: 8px; font-size: 11px; }
  .info-row span { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #1e40af; color: #fff; padding: 4px 6px; text-align: left; font-size: 10px; }
  td { padding: 3px 6px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
  tr:nth-child(even) td { background: #f9fafb; }
  .summary-box { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .summary-item { border: 1px solid #dbeafe; border-radius: 4px; padding: 6px; text-align: center; }
  .summary-item .val { font-size: 16px; font-weight: 700; color: #1e40af; }
  .summary-item .lbl { font-size: 9px; color: #6b7280; }
  .paraf-row { display: flex; gap: 40px; margin-top: 16px; font-size: 10px; }
  .paraf-item { flex: 1; text-align: center; }
  .paraf-line { border-top: 1px solid #000; margin-top: 20px; padding-top: 2px; }
  @page { margin: 12mm; size: A4; }
  @media print {
    body { font-size: 10px; }
    h2 { break-before: avoid; }
    table { break-inside: avoid; }
    .page-break { break-before: page; }
  }
</style>
</head>
<body>
  <h1>LAPORAN HARIAN PROGRAMMER</h1>
  <div class="info-row">
    <div>Nama : <span>${esc(db.profile.name || '—')}</span></div>
    <div>NPK : <span>${esc(db.profile.npk || '—')}</span></div>
    <div>Bulan : <span>${mn}</span></div>
  </div>

  <div class="summary-box">
    <div class="summary-item"><div class="val">${minToHour(totalOp)}</div><div class="lbl">Total Operasi (jam)</div></div>
    <div class="summary-item"><div class="val">${minToHour(totalNon)}</div><div class="lbl">Non-Operasi (jam)</div></div>
    <div class="summary-item"><div class="val">${minToHour(totalAll)}</div><div class="lbl">Total Jam Kerja</div></div>
    <div class="summary-item"><div class="val">${ratio}%</div><div class="lbl">Operation Ratio</div></div>
  </div>

  <h2>Resume Per Project (Operation)</h2>
  <table>
    <thead><tr><th style="width:30px">No</th><th style="width:90px">No. Order</th><th>Nama Project</th><th style="text-align:right;width:80px">Total Menit</th><th style="text-align:right;width:70px">Total Jam</th></tr></thead>
    <tbody>${projRows || '<tr><td colspan="5" style="text-align:center;color:#6b7280">Belum ada data</td></tr>'}</tbody>
  </table>

  <h2>Non-Operation</h2>
  <table>
    <thead><tr><th>Item</th><th style="text-align:right;width:80px">Total Menit</th><th style="text-align:right;width:80px">Total Jam</th></tr></thead>
    <tbody>${nonOpRows || '<tr><td colspan="3" style="text-align:center;color:#6b7280">Belum ada data</td></tr>'}</tbody>
  </table>

  <h2>Rincian Per Hari</h2>
  <table>
    <thead><tr><th style="width:55px">Tanggal</th><th style="text-align:right">Operasi</th><th style="text-align:right">Non-Op</th><th style="text-align:right">Total</th><th style="text-align:center">Ratio</th><th style="text-align:right">Target</th><th style="text-align:right">Overtime</th><th>Catatan</th></tr></thead>
    <tbody>${dailyRows}</tbody>
  </table>

  <div class="paraf-row">
    <div class="paraf-item">Leader<div class="paraf-line">${esc(m.parafLeader || '')}</div></div>
    <div class="paraf-item">Foreman<div class="paraf-line">${esc(m.parafForeman || '')}</div></div>
    <div class="paraf-item">Dibuat oleh<div class="paraf-line">${esc(db.profile.name || '')}</div></div>
  </div>

  <div class="page-break"></div>

  <h1 style="margin-top:8px">DETAIL HARIAN PER PROJECT</h1>
  <div class="info-row" style="margin-bottom:8px">
    <div>${esc(db.profile.name || '—')} — ${mn}</div>
  </div>
  <div style="overflow-x:auto">
    <table style="font-size:9px; min-width:${200 + td * 22}px">
      <thead>
        <tr>
          <th style="width:20px"></th>
          <th style="min-width:120px">Item Pekerjaan</th>
          <th style="width:70px">No. Order</th>
          ${dateHeaderCells}
        </tr>
      </thead>
      <tbody>
        ${detailRows}
        <tr style="background:#dbeafe;font-weight:700">
          <td colspan="3" style="font-size:10px">TOTAL OPERASI</td>
          ${totalOpCells}
        </tr>
        <tr style="background:#fef3c7;font-weight:700">
          <td colspan="3" style="font-size:10px">TOTAL NON-OP</td>
          ${totalNonCells}
        </tr>
        <tr style="background:#d1fae5;font-weight:700">
          <td colspan="3" style="font-size:10px">TOTAL KESELURUHAN</td>
          ${totalAllCells}
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }

  /**
   * Print laporan ke dialog cetak browser
   * @param {object} db - database object
   * @param {string} period - "YYYY-MM"
   */
  function print(db, period) {
    const html = buildHTML(db, period);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 300);
    };
  }

  return { print, buildHTML };
})();


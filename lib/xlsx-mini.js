/**
 * xlsx-mini.js — Minimal XLSX / ZIP writer
 * Tidak memerlukan library eksternal apapun.
 * Menghasilkan file .xlsx valid (Office Open XML / SpreadsheetML)
 * yang bisa dibuka di Microsoft Excel, Google Sheets, LibreOffice.
 *
 * API:
 *   XlsxMini.writeSheets(sheets)  → Uint8Array (binary .xlsx)
 *   sheets = [ { name: "Sheet1", data: [ [row1col1, row1col2, ...], ... ] }, ... ]
 *   Cell values: string → shared string cell, number → numeric cell, null/"" → empty
 */

const XlsxMini = (() => {

  // ── CRC-32 (lookup table) ──────────────────────────────────────────────────
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (c >>> 1) ^ 0xEDB88320 : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();

  function crc32(data) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const enc = new TextEncoder();
  function str2u8(s) { return enc.encode(s); }
  function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
  function u32(v) { return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]; }
  function xmlEsc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── ZIP writer (store / no compression) ───────────────────────────────────
  function zipFiles(fileMap) {
    // Build entry list: { nameBytes, dataBytes, crc, sz }
    const entries = Object.entries(fileMap).map(([name, content]) => {
      const nameBytes = str2u8(name);
      const dataBytes = typeof content === 'string' ? str2u8(content) : content;
      return { nameBytes, dataBytes, crc: crc32(dataBytes), sz: dataBytes.length };
    });

    // Pre-calculate total buffer size
    const localSize  = entries.reduce((a, e) => a + 30 + e.nameBytes.length + e.sz, 0);
    const cdirSize   = entries.reduce((a, e) => a + 46 + e.nameBytes.length, 0);
    const totalSize  = localSize + cdirSize + 22;
    const buf = new Uint8Array(totalSize);
    let pos = 0;

    function wb(arr) { buf.set(arr, pos); pos += arr.length; }
    function wn(bytes) { for (const b of bytes) buf[pos++] = b; }

    // Local file headers + data
    const offsets = [];
    entries.forEach(e => {
      offsets.push(pos);
      wn([0x50, 0x4B, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // sig + ver + flags + comp + time
      wn(u32(e.crc)); wn(u32(e.sz)); wn(u32(e.sz));
      wn(u16(e.nameBytes.length)); wn([0, 0]); // extra length
      wb(e.nameBytes); wb(e.dataBytes);
    });

    // Central directory
    const cdOff = pos;
    entries.forEach((e, i) => {
      wn([0x50, 0x4B, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      wn(u32(e.crc)); wn(u32(e.sz)); wn(u32(e.sz));
      wn(u16(e.nameBytes.length));
      wn([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // extra + comment + disk + iattr + eattr
      wn(u32(offsets[i]));
      wb(e.nameBytes);
    });

    // End of central directory
    const cdSz = pos - cdOff, n = entries.length;
    wn([0x50, 0x4B, 0x05, 0x06, 0, 0, 0, 0]);
    wn(u16(n)); wn(u16(n)); wn(u32(cdSz)); wn(u32(cdOff)); wn([0, 0]);

    return buf;
  }

  // ── Cell reference (A1-style) ──────────────────────────────────────────────
  function cellRef(r, c) {
    const col = c < 26
      ? String.fromCharCode(65 + c)
      : String.fromCharCode(64 + Math.floor(c / 26)) + String.fromCharCode(65 + (c % 26));
    return col + (r + 1);
  }

  // ── Sheet XML builder ──────────────────────────────────────────────────────
  // Requires sharedStrings Map to be pre-populated (two-pass approach)
  function sheetToXml(aoa, sharedStrings) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            + '<sheetData>';
    aoa.forEach((row, ri) => {
      if (!row || !row.length) return;
      let rowXml = '';
      row.forEach((cell, ci) => {
        if (cell == null || cell === '') return;
        const ref = cellRef(ri, ci);
        if (typeof cell === 'number') {
          rowXml += `<c r="${ref}" t="n"><v>${cell}</v></c>`;
        } else {
          const idx = sharedStrings.get(String(cell));
          rowXml += `<c r="${ref}" t="s"><v>${idx}</v></c>`;
        }
      });
      if (rowXml) xml += `<row r="${ri + 1}">${rowXml}</row>`;
    });
    xml += '</sheetData></worksheet>';
    return xml;
  }

  // ── Main export function ───────────────────────────────────────────────────
  /**
   * @param {Array<{name: string, data: Array<Array>}>} sheets
   * @returns {Uint8Array} binary .xlsx file
   */
  function writeSheets(sheets) {
    // Pass 1: collect all unique strings across all sheets
    const sharedStrings = new Map();
    let ssIdx = 0;
    sheets.forEach(sh =>
      sh.data.forEach(row =>
        row && row.forEach(cell => {
          if (cell != null && typeof cell === 'string' && cell !== '' && !sharedStrings.has(cell)) {
            sharedStrings.set(cell, ssIdx++);
          }
        })
      )
    );

    // Pass 2: build sheet XMLs
    const sheetXmls = sheets.map(sh => sheetToXml(sh.data, sharedStrings));

    // Shared strings XML
    const ssXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ssIdx}" uniqueCount="${ssIdx}">`
      + [...sharedStrings.entries()]
          .sort((a, b) => a[1] - b[1])
          .map(([s]) => `<si><t xml:space="preserve">${xmlEsc(s)}</t></si>`)
          .join('')
      + '</sst>';

    // Workbook XML
    const wbXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets>'
      + sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 2}"/>`).join('')
      + '</sheets></workbook>';

    // Relationships
    const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
      + sheets.map((s, i) =>
          `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')
      + '</Relationships>';

    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>';

    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
      + sheets.map((s, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')
      + '</Types>';

    // Assemble ZIP
    const fileMap = {
      '[Content_Types].xml': ct,
      '_rels/.rels': rootRels,
      'xl/workbook.xml': wbXml,
      'xl/_rels/workbook.xml.rels': wbRels,
      'xl/sharedStrings.xml': ssXml,
    };
    sheetXmls.forEach((xml, i) => {
      fileMap[`xl/worksheets/sheet${i + 1}.xml`] = xml;
    });
    return zipFiles(fileMap);
  }

  return { writeSheets };
})();


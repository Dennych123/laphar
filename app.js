// ============================================================
// LAPORAN HARIAN PROGRAMMER - Local-first PWA
// Database: localStorage; Export: CSV / TXT / PDF / XLSX
// ============================================================

// ---------- DEFAULT DATA ----------
const DEFAULT_OP_ITEMS = [
  "Preparation",
  "Program Making PLC/HMI",
  "Debugging",
  "Trial",
  "Monitoring",
  "Modify/Additional Program",
  "Trouble Shooting",
  "Meeting Project (Diskusi)",
  "Pengisian Atarimae",
  "Training"
];

const DEFAULT_NONOP_ITEMS = [
  "Meeting Pagi",
  "Update Progress/Schedule",
  "Toilet",
  "5MK",
  "Laporan Harian",
  "Waiting",
  "Izin",
  "Edukasi",
  "Others"
];

const DEFAULT_PROJECTS = [
  { number: "6969-M001", name: "Mesin Pembuat Kopi Otomatis (Anti Ngantuk)" },
  { number: "6969-M002", name: "Robot Pengganti Rapat Senin Pagi" },
  { number: "6969-M003", name: "Conveyor Pengiriman Gorengan ke Meja" },
  { number: "6969-M004", name: "Auto-Clicker Absen Tanpa Datang" },
  { number: "6969-M005", name: "PLC Pengatur Kipas Angin Ruang Kerja" },
  { number: "6969-M006", name: "Sensor Deteksi Bos Datang (Early Warning)" },
  { number: "6969-M007", name: "Mesin Cetak Laporan Otomatis Jam 16:59" },
  { number: "6969-M008", name: "HMI Pemilih Menu Kantin Digital" },
  { number: "6969-M009", name: "Sistem Antrian Toilet Cerdas IoT" },
  { number: "6969-M010", name: "Robot Penjawab Email Seolah Sibuk" },
  { number: "6969-K001", name: "Camera Check Isi Kulkas Kantor" },
  { number: "7777-M001", name: "HVAC Ruang Server (Biar Gak Panas Sendiri)" },
  { number: "7777-M002", name: "Bender Kawat Untuk Jemur Baju" },
  { number: "7777-M003", name: "Vending Machine Camilan Shift Malam" },
  { number: "7777-M004", name: "Soldering Otomatis Sambil Dengarkan Musik" },
  { number: "HAHA-M001", name: "Overflow Deteksi Air Galon Mau Habis" },
  { number: "HAHA-M002", name: "Support Prog Mesin Pembuat Mie Instan" },
  { number: "0", name: "Proyek Rahasia (Jangan Bilang Siapa-siapa)" },
  { number: "0", name: "Kaizen: Kursi Ergonomis Anti Ketiduran" },
  { number: "0", name: "Improve: Jalur Kabel Biar Gak Kesandung" },
  { number: "0", name: "NG History: Kenapa Selalu Salah Tombol" },
  { number: "0", name: "Interlock Safety: Kunci Lemari Snack" }
];

// ---------- STATE ----------
const STORE_KEY = "laporan_harian_v1";
let DB = loadDB();
let currentPeriod = ymKey(new Date());   // "2026-03"
let currentDay = 1;                      // 1..31

// ---------- STORAGE ----------
function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error(e); }
  return {
    profile: { name: "", npk: "" },
    masterProjects: [...DEFAULT_PROJECTS],
    opItems: [...DEFAULT_OP_ITEMS],
    nonOpItems: [...DEFAULT_NONOP_ITEMS],
    nwt: 480,
    months: {} // { "2026-03": { days: { 1: {...}, 2: {...} }, parafLeader, parafForeman } }
  };
}

function saveDB() {
  localStorage.setItem(STORE_KEY, JSON.stringify(DB));
}

function ensureMonth(period) {
  if (!DB.months[period]) {
    DB.months[period] = {
      days: {},
      parafLeader: "",
      parafForeman: ""
    };
  }
  return DB.months[period];
}

function ensureDay(period, day) {
  const m = ensureMonth(period);
  if (!m.days[day]) {
    // Default target: weekend (Sat/Sun) = 420, weekday = 480
    const dow = dayOfWeek(period, day);
    const defaultTarget = (dow === 0 || dow === 6) ? 420 : 480;
    m.days[day] = {
      operations: [],     // [{ projectNumber, projectName, items: { "Preparation": 0, ... } }]
      nonOperations: {},  // { "Meeting Pagi": 15, ... }
      target: defaultTarget,
      note: ""
    };
  }
  // backward-compat: ensure target exists
  if (m.days[day].target === undefined) {
    const dow = dayOfWeek(period, day);
    m.days[day].target = (dow === 0 || dow === 6) ? 420 : 480;
  }
  return m.days[day];
}

// ---------- HELPERS ----------
function ymKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function daysInMonth(period) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function dayOfWeek(period, day) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, day).getDay(); // 0=Sun
}
function dayName(period, day) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("id-ID", { weekday: "short" });
}
function fmtMin(min) {
  if (!min) return "0";
  return Number(min).toLocaleString("id-ID");
}
function minToHour(min) {
  return (min / 60).toFixed(2);
}
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show " + type;
  setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- PAGE ROUTING ----------
function switchPage(p) {
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.page === p));
  document.querySelectorAll(".page").forEach(s => s.classList.toggle("active", s.id === "page-" + p));
  if (p === "resume") renderResume();
  if (p === "data") renderDataPage();
  if (p === "settings") renderSettings();
  window.scrollTo(0, 0);
}
document.querySelectorAll("nav button").forEach(b => b.addEventListener("click", () => switchPage(b.dataset.page)));

// ---------- INPUT PAGE ----------
function initInputPage() {
  document.getElementById("periodInput").value = currentPeriod;
  document.getElementById("nwtInput").value = DB.nwt;

  document.getElementById("periodInput").addEventListener("change", (e) => {
    currentPeriod = e.target.value;
    currentDay = 1;
    renderDayTabs();
    renderDayContent();
    updateHeader();
  });
  document.getElementById("nwtInput").addEventListener("change", (e) => {
    DB.nwt = Number(e.target.value) || 480;
    saveDB();
  });

  // paraf inputs auto-save on blur
  ["parafLeader", "parafForeman"].forEach(id => {
    document.getElementById(id).addEventListener("blur", (e) => {
      const m = ensureMonth(currentPeriod);
      m[id] = e.target.value;
      saveDB();
    });
  });
  document.getElementById("dayNote").addEventListener("blur", (e) => {
    const d = ensureDay(currentPeriod, currentDay);
    d.note = e.target.value;
    saveDB();
  });

  // default to today's day
  const today = new Date();
  if (ymKey(today) === currentPeriod) currentDay = today.getDate();

  renderDayTabs();
  renderDayContent();
  updateHeader();
}

function updateHeader() {
  const sub = document.getElementById("headerSub");
  const name = DB.profile.name || "(belum diisi)";
  const [y, m] = currentPeriod.split("-");
  const monthName = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  sub.textContent = `${name} • ${monthName}`;
  document.getElementById("dataPeriod").textContent = monthName;
}

function renderDayTabs() {
  const total = daysInMonth(currentPeriod);
  const wrap = document.getElementById("dayTabs");
  wrap.innerHTML = "";
  const m = ensureMonth(currentPeriod);
  for (let d = 1; d <= total; d++) {
    const btn = document.createElement("button");
    const dow = dayOfWeek(currentPeriod, d);
    const isWeekend = dow === 0 || dow === 6;
    const hasData = m.days[d] && hasDayData(m.days[d]);
    btn.innerHTML = `<div style="font-weight:700;">${d}</div><div style="font-size:9px;opacity:.7;">${dayName(currentPeriod, d).substring(0,3)}</div>`;
    if (d === currentDay) btn.classList.add("active");
    if (isWeekend) btn.classList.add("weekend");
    if (hasData) btn.classList.add("has-data");
    btn.onclick = () => {
      currentDay = d;
      renderDayTabs();
      renderDayContent();
    };
    wrap.appendChild(btn);
  }
  // scroll active into view
  setTimeout(() => {
    const active = wrap.querySelector("button.active");
    if (active) active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, 50);
}

function hasDayData(day) {
  const opSum = day.operations.reduce((s, p) => s + Object.values(p.items).reduce((a, b) => a + (Number(b) || 0), 0), 0);
  const nonSum = Object.values(day.nonOperations).reduce((a, b) => a + (Number(b) || 0), 0);
  return opSum + nonSum > 0;
}

function renderDayContent() {
  const day = ensureDay(currentPeriod, currentDay);
  const m = ensureMonth(currentPeriod);
  document.getElementById("parafLeader").value = m.parafLeader || "";
  document.getElementById("parafForeman").value = m.parafForeman || "";
  document.getElementById("dayNote").value = day.note || "";

  // Set target dropdown
  const targetSelect = document.getElementById("targetSelect");
  const knownTargets = ["480", "580", "660", "420"];
  const tgt = String(day.target || 480);
  if (knownTargets.includes(tgt)) {
    targetSelect.value = tgt;
    document.getElementById("customTargetRow").style.display = "none";
  } else {
    targetSelect.value = "custom";
    document.getElementById("customTargetRow").style.display = "block";
    document.getElementById("customTarget").value = tgt;
  }

  renderOpProjects();
  renderNonOpItems();
  recalcDay();
}

function renderOpProjects() {
  const wrap = document.getElementById("opProjects");
  const empty = document.getElementById("opEmpty");
  const day = ensureDay(currentPeriod, currentDay);
  wrap.innerHTML = "";
  if (day.operations.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  day.operations.forEach((proj, idx) => {
    const block = document.createElement("div");
    block.className = "project-block";
    const total = Object.values(proj.items).reduce((a, b) => a + (Number(b) || 0), 0);
    block.innerHTML = `
      <div class="project-header">
        <div>
          <strong>${escapeHtml(proj.projectName)}</strong>
          <div class="small">${escapeHtml(proj.projectNumber || "")}</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <span class="total badge">${fmtMin(total)} mnt</span>
          <button class="btn-danger btn-sm" onclick="removeOpProject(${idx})">✕</button>
        </div>
      </div>
    `;
    DB.opItems.forEach(item => {
      const v = proj.items[item] || 0;
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="name">${escapeHtml(item)}</div>
        <input type="number" min="0" step="5" value="${v || ''}" placeholder="0"
               data-proj="${idx}" data-item="${escapeAttr(item)}" oninput="onOpItemChange(this)">
        <button class="del btn-sm" onclick="quickFill(this, ${idx}, '${escapeAttr(item)}')" title="Quick fill">⏱</button>
      `;
      block.appendChild(row);
    });
    wrap.appendChild(block);
  });
}

window.onOpItemChange = function (input) {
  const idx = Number(input.dataset.proj);
  const item = input.dataset.item;
  const day = ensureDay(currentPeriod, currentDay);
  day.operations[idx].items[item] = Number(input.value) || 0;
  saveDB();
  recalcDay();
  // update project total badge without full re-render
  const total = Object.values(day.operations[idx].items).reduce((a, b) => a + (Number(b) || 0), 0);
  const badge = input.closest(".project-block").querySelector(".total");
  if (badge) badge.textContent = fmtMin(total) + " mnt";
};

window.quickFill = function (btn, idx, item) {
  // Cycle through common values: 60, 120, 240, 480, 0
  const input = btn.parentElement.querySelector("input");
  const presets = [60, 120, 240, 480, 0];
  const cur = Number(input.value) || 0;
  const ci = presets.indexOf(cur);
  input.value = presets[(ci + 1) % presets.length];
  input.dispatchEvent(new Event("input"));
};

window.removeOpProject = function (idx) {
  if (!confirm("Hapus project ini dari hari aktif?")) return;
  const day = ensureDay(currentPeriod, currentDay);
  day.operations.splice(idx, 1);
  saveDB();
  renderOpProjects();
  recalcDay();
  renderDayTabs();
};

function renderNonOpItems() {
  const wrap = document.getElementById("nonOpItems");
  const day = ensureDay(currentPeriod, currentDay);
  wrap.innerHTML = "";
  DB.nonOpItems.forEach(item => {
    const v = day.nonOperations[item] || 0;
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="name">${escapeHtml(item)}</div>
      <input type="number" min="0" step="5" value="${v || ''}" placeholder="0"
             data-item="${escapeAttr(item)}" oninput="onNonOpChange(this)">
      <button class="del btn-sm" onclick="quickFillNonOp(this, '${escapeAttr(item)}')" title="Quick fill">⏱</button>
    `;
    wrap.appendChild(row);
  });
}

window.onNonOpChange = function (input) {
  const item = input.dataset.item;
  const day = ensureDay(currentPeriod, currentDay);
  day.nonOperations[item] = Number(input.value) || 0;
  saveDB();
  recalcDay();
};

window.quickFillNonOp = function (btn, item) {
  const input = btn.parentElement.querySelector("input");
  const presets = [10, 15, 30, 60, 0];
  const cur = Number(input.value) || 0;
  const ci = presets.indexOf(cur);
  input.value = presets[(ci + 1) % presets.length];
  input.dispatchEvent(new Event("input"));
};

function recalcDay() {
  const day = ensureDay(currentPeriod, currentDay);
  const op = day.operations.reduce((s, p) => s + Object.values(p.items).reduce((a, b) => a + (Number(b) || 0), 0), 0);
  const non = Object.values(day.nonOperations).reduce((a, b) => a + (Number(b) || 0), 0);
  const total = op + non;
  const ratio = total > 0 ? Math.round((op / total) * 100) : 0;
  document.getElementById("dayOp").textContent = fmtMin(op);
  document.getElementById("dayNonOp").textContent = fmtMin(non);
  document.getElementById("dayTotal").textContent = fmtMin(total);
  document.getElementById("dayRatio").textContent = ratio + "%";

  // Target indicator
  const target = Number(day.target) || 480;
  const status = document.getElementById("targetStatus");
  const fill = document.getElementById("targetFill");
  const diff = total - target;
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  fill.style.width = pct + "%";
  fill.classList.remove("under", "exact", "over");
  status.classList.remove("under", "exact", "over", "empty");

  if (total === 0) {
    status.textContent = `🎯 Target: ${target} mnt (${(target/60).toFixed(2)} jam) — belum ada input`;
    status.classList.add("empty");
    fill.classList.add("under");
  } else if (diff < 0) {
    const need = Math.abs(diff);
    const needHr = Math.floor(need / 60);
    const needMin = need % 60;
    const needStr = needHr > 0 ? `${needHr}j ${needMin}m` : `${needMin}m`;
    status.textContent = `⚠️ Kurang ${need} menit (${needStr}) untuk mencapai ${target} mnt`;
    status.classList.add("under");
    fill.classList.add("under");
  } else if (diff === 0) {
    status.textContent = `✅ Pas! Total ${total} menit = target ${target} menit`;
    status.classList.add("exact");
    fill.classList.add("exact");
  } else {
    const overHr = Math.floor(diff / 60);
    const overMin = diff % 60;
    const overStr = overHr > 0 ? `${overHr}j ${overMin}m` : `${overMin}m`;
    status.textContent = `📈 Lebih ${diff} menit (${overStr}) dari target ${target} mnt`;
    status.classList.add("over");
    fill.classList.add("over");
  }
}

// ---------- TARGET HANDLERS ----------
window.onTargetChange = function () {
  const sel = document.getElementById("targetSelect").value;
  const day = ensureDay(currentPeriod, currentDay);
  if (sel === "custom") {
    document.getElementById("customTargetRow").style.display = "block";
    document.getElementById("customTarget").value = day.target || 480;
    document.getElementById("customTarget").focus();
  } else {
    document.getElementById("customTargetRow").style.display = "none";
    day.target = Number(sel);
    saveDB();
    recalcDay();
  }
};

window.onCustomTargetChange = function () {
  const v = Number(document.getElementById("customTarget").value);
  if (!v || v < 0) return;
  const day = ensureDay(currentPeriod, currentDay);
  day.target = v;
  saveDB();
  recalcDay();
};

// ---------- COPY FROM YESTERDAY ----------
window.copyFromYesterday = function (structureOnly) {
  // Find the most recent day with data BEFORE currentDay (in current period)
  const m = ensureMonth(currentPeriod);
  let sourceDay = null;
  for (let d = currentDay - 1; d >= 1; d--) {
    if (m.days[d] && hasDayData(m.days[d])) {
      sourceDay = d;
      break;
    }
  }
  if (!sourceDay) {
    toast("Tidak ada data hari sebelumnya di bulan ini", "error");
    return;
  }

  const day = ensureDay(currentPeriod, currentDay);
  const hasCurrentData = hasDayData(day);
  const action = structureOnly ? "struktur" : "data lengkap";

  const confirmMsg = hasCurrentData
    ? `Hari ini sudah ada data. Replace dengan ${action} dari tanggal ${sourceDay}?`
    : `Copy ${action} dari tanggal ${sourceDay}?`;
  if (!confirm(confirmMsg)) return;

  const src = m.days[sourceDay];
  // Deep copy operations
  day.operations = src.operations.map(p => ({
    projectNumber: p.projectNumber,
    projectName: p.projectName,
    items: structureOnly ? {} : { ...p.items }
  }));
  // Non-operations
  day.nonOperations = structureOnly ? {} : { ...src.nonOperations };

  saveDB();
  renderOpProjects();
  renderNonOpItems();
  recalcDay();
  renderDayTabs();
  toast(`✅ Copy dari tanggal ${sourceDay}`, "success");
};


function openProjectPicker(mode) {
  projectPickerMode = mode;
  document.getElementById("projectSearch").value = "";
  document.getElementById("projectModal").classList.add("show");
  renderProjectPicker();
}
window.openProjectPicker = openProjectPicker;
window.closeModal = function (id) { document.getElementById(id).classList.remove("show"); };

function renderProjectPicker() {
  const q = document.getElementById("projectSearch").value.toLowerCase();
  const wrap = document.getElementById("projectPickerList");
  wrap.innerHTML = "";
  const day = ensureDay(currentPeriod, currentDay);
  const usedNames = new Set(day.operations.map(p => p.projectName));
  const list = DB.masterProjects
    .filter(p => p.name.toLowerCase().includes(q) || (p.number || "").toLowerCase().includes(q));

  if (list.length === 0) {
    wrap.innerHTML = `<div class="empty">Tidak ada project. Tambahkan di Setting.</div>`;
  }
  list.forEach(p => {
    const used = usedNames.has(p.name);
    const btn = document.createElement("button");
    btn.style.cssText = "text-align:left; margin-bottom:6px; background:" + (used ? "#e5e7eb" : "#eff6ff") + "; color:#111827;";
    btn.innerHTML = `
      <div style="font-weight:600; font-size:13px;">${escapeHtml(p.name)} ${used ? '<span class="badge success">✓ ditambahkan</span>' : ''}</div>
      <div class="small">${escapeHtml(p.number || "-")}</div>
    `;
    btn.disabled = used;
    btn.onclick = () => {
      if (used) return;
      const day = ensureDay(currentPeriod, currentDay);
      day.operations.push({
        projectNumber: p.number,
        projectName: p.name,
        items: {}
      });
      saveDB();
      closeModal("projectModal");
      renderOpProjects();
      renderDayTabs();
      toast("Project ditambahkan", "success");
    };
    wrap.appendChild(btn);
  });

  // Add custom
  const custom = document.createElement("button");
  custom.className = "btn-warn";
  custom.style.marginTop = "10px";
  custom.textContent = "+ Custom Project (manual)";
  custom.onclick = () => {
    const name = prompt("Nama Project:");
    if (!name) return;
    const num = prompt("Project Number (boleh kosong):") || "";
    const day = ensureDay(currentPeriod, currentDay);
    day.operations.push({ projectNumber: num, projectName: name, items: {} });
    saveDB();
    closeModal("projectModal");
    renderOpProjects();
    renderDayTabs();
  };
  wrap.appendChild(custom);
}
window.renderProjectPicker = renderProjectPicker;

// ---------- SAVE ----------
function saveCurrentDay() {
  saveDB();
  renderDayTabs();
  toast("✅ Tersimpan", "success");
}
window.saveCurrentDay = saveCurrentDay;

// ---------- RESUME PAGE ----------
function renderResume() {
  const m = ensureMonth(currentPeriod);
  const [y, mn] = currentPeriod.split("-");
  const monthName = new Date(y, mn - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  document.getElementById("resumeHeader").innerHTML = `
    <div><strong>${escapeHtml(DB.profile.name || "-")}</strong> <span class="small">NPK ${escapeHtml(DB.profile.npk || "-")}</span></div>
    <div>${monthName}</div>
  `;

  // Aggregate
  const projectTotals = {};   // projectName -> minutes
  const nonOpTotals = {};
  const dailyTotals = {};     // day -> { op, non }
  let totalOp = 0, totalNon = 0;

  Object.entries(m.days).forEach(([dayStr, day]) => {
    const d = Number(dayStr);
    let opD = 0, nonD = 0;
    day.operations.forEach(p => {
      const sum = Object.values(p.items).reduce((a, b) => a + (Number(b) || 0), 0);
      projectTotals[p.projectName] = (projectTotals[p.projectName] || 0) + sum;
      opD += sum;
    });
    Object.entries(day.nonOperations).forEach(([k, v]) => {
      const n = Number(v) || 0;
      nonOpTotals[k] = (nonOpTotals[k] || 0) + n;
      nonD += n;
    });
    dailyTotals[d] = { op: opD, non: nonD };
    totalOp += opD;
    totalNon += nonD;
  });

  document.getElementById("rTotalOp").textContent = minToHour(totalOp);
  document.getElementById("rTotalNonOp").textContent = minToHour(totalNon);
  document.getElementById("rTotalAll").textContent = minToHour(totalOp + totalNon);
  document.getElementById("rRatio").textContent = (totalOp + totalNon > 0 ? Math.round((totalOp / (totalOp + totalNon)) * 100) : 0) + "%";

  // Project table
  const ptb = document.querySelector("#projectTable tbody");
  ptb.innerHTML = "";
  const projSorted = Object.entries(projectTotals).sort((a, b) => b[1] - a[1]);
  if (projSorted.length === 0) {
    ptb.innerHTML = `<tr><td colspan="3" class="empty">Belum ada data</td></tr>`;
  }
  projSorted.forEach(([n, v]) => {
    ptb.innerHTML += `<tr><td>${escapeHtml(n)}</td><td class="num">${fmtMin(v)}</td><td class="num">${minToHour(v)}</td></tr>`;
  });

  // Non-op table
  const ntb = document.querySelector("#nonOpTable tbody");
  ntb.innerHTML = "";
  Object.entries(nonOpTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).forEach(([n, v]) => {
    ntb.innerHTML += `<tr><td>${escapeHtml(n)}</td><td class="num">${fmtMin(v)}</td><td class="num">${minToHour(v)}</td></tr>`;
  });
  if (ntb.innerHTML === "") ntb.innerHTML = `<tr><td colspan="3" class="empty">Belum ada data</td></tr>`;

  // Daily table
  const dtb = document.querySelector("#dailyTable tbody");
  dtb.innerHTML = "";
  const total = daysInMonth(currentPeriod);
  for (let d = 1; d <= total; d++) {
    const x = dailyTotals[d] || { op: 0, non: 0 };
    const t = x.op + x.non;
    if (t === 0) continue;
    const r = t > 0 ? Math.round((x.op / t) * 100) : 0;
    const dow = dayOfWeek(currentPeriod, d);
    const wk = (dow === 0 || dow === 6) ? "color:#dc2626;" : "";
    dtb.innerHTML += `<tr style="${wk}"><td>${d} ${dayName(currentPeriod, d).substring(0,3)}</td><td class="num">${fmtMin(x.op)}</td><td class="num">${fmtMin(x.non)}</td><td class="num">${fmtMin(t)}</td><td class="num">${r}%</td></tr>`;
  }
  if (dtb.innerHTML === "") dtb.innerHTML = `<tr><td colspan="5" class="empty">Belum ada data</td></tr>`;
}

// ---------- SETTINGS PAGE ----------
function renderSettings() {
  document.getElementById("profName").value = DB.profile.name;
  document.getElementById("profNpk").value = DB.profile.npk;
  renderMasterProjects();
  renderOpItemList();
  renderNonOpItemList();
}

function saveProfile() {
  DB.profile.name = document.getElementById("profName").value.trim();
  DB.profile.npk = document.getElementById("profNpk").value.trim();
  saveDB();
  updateHeader();
  toast("Profil tersimpan", "success");
}
window.saveProfile = saveProfile;

function renderMasterProjects() {
  const wrap = document.getElementById("masterProjectList");
  wrap.innerHTML = "";
  if (DB.masterProjects.length === 0) {
    wrap.innerHTML = `<div class="empty" style="padding:10px 0;">Belum ada project. Tambahkan di bawah.</div>`;
    return;
  }
  DB.masterProjects.forEach((p, i) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid #f3f4f6;";
    row.innerHTML = `
      <div style="flex:1; min-width:0;">
        <div style="font-weight:500; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
        <div style="font-size:11px; color:#6b7280;">${escapeHtml(p.number || "—")}</div>
      </div>
      <button class="btn-danger btn-sm" style="width:auto; flex:0 0 auto;" onclick="removeMasterProject(${i})">✕</button>
    `;
    wrap.appendChild(row);
  });
}
window.addMasterProject = function () {
  const number = document.getElementById("newProjNumber").value.trim();
  const name = document.getElementById("newProjName").value.trim();
  if (!name) { toast("Nama project wajib diisi"); return; }
  DB.masterProjects.push({ number, name });
  saveDB();
  document.getElementById("newProjNumber").value = "";
  document.getElementById("newProjName").value = "";
  renderMasterProjects();
  toast("Project ditambahkan", "success");
};
window.removeMasterProject = function (i) {
  if (!confirm("Hapus project dari master list?")) return;
  DB.masterProjects.splice(i, 1);
  saveDB();
  renderMasterProjects();
};

function renderOpItemList() {
  const wrap = document.getElementById("opItemList");
  wrap.innerHTML = "";
  DB.opItems.forEach((it, i) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; gap:8px; align-items:center; padding:7px 0; border-bottom:1px solid #f3f4f6;";
    row.innerHTML = `
      <div style="flex:1; font-size:13px;">${escapeHtml(it)}</div>
      <button class="btn-danger btn-sm" style="width:auto; flex:0 0 auto;" onclick="removeOpItem(${i})">✕</button>
    `;
    wrap.appendChild(row);
  });
}
window.addOpItem = function () {
  const v = document.getElementById("newOpItem").value.trim();
  if (!v) return;
  DB.opItems.push(v);
  saveDB();
  document.getElementById("newOpItem").value = "";
  renderOpItemList();
};
window.removeOpItem = function (i) {
  if (!confirm("Hapus item ini? Data yang sudah ada tidak akan terhapus.")) return;
  DB.opItems.splice(i, 1);
  saveDB();
  renderOpItemList();
};

function renderNonOpItemList() {
  const wrap = document.getElementById("nonOpItemList");
  wrap.innerHTML = "";
  DB.nonOpItems.forEach((it, i) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; gap:8px; align-items:center; padding:7px 0; border-bottom:1px solid #f3f4f6;";
    row.innerHTML = `
      <div style="flex:1; font-size:13px;">${escapeHtml(it)}</div>
      <button class="btn-danger btn-sm" style="width:auto; flex:0 0 auto;" onclick="removeNonOpItem(${i})">✕</button>
    `;
    wrap.appendChild(row);
  });
}
window.addNonOpItem = function () {
  const v = document.getElementById("newNonOpItem").value.trim();
  if (!v) return;
  DB.nonOpItems.push(v);
  saveDB();
  document.getElementById("newNonOpItem").value = "";
  renderNonOpItemList();
};
window.removeNonOpItem = function (i) {
  if (!confirm("Hapus item ini?")) return;
  DB.nonOpItems.splice(i, 1);
  saveDB();
  renderNonOpItemList();
};

// ---------- DATA PAGE ----------
function renderDataPage() {
  const wrap = document.getElementById("periodList");
  wrap.innerHTML = "";
  const periods = Object.keys(DB.months).sort().reverse();
  if (periods.length === 0) {
    wrap.innerHTML = `<div class="empty">Belum ada bulan tersimpan</div>`;
    return;
  }
  periods.forEach(p => {
    const [y, mn] = p.split("-");
    const monthName = new Date(y, mn - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    const m = DB.months[p];
    const dayCount = Object.keys(m.days).filter(d => hasDayData(m.days[d])).length;
    const isCurr = p === currentPeriod;
    const row = document.createElement("div");
    row.style.cssText = "display:flex; gap:6px; align-items:center; padding:8px 0; border-bottom:1px solid #f3f4f6;";
    row.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight:600;">${monthName} ${isCurr ? '<span class="badge success">aktif</span>' : ''}</div>
        <div class="small">${dayCount} hari terisi</div>
      </div>
      <button class="btn-secondary btn-sm" style="width:auto; flex:0 0 auto;" onclick="loadPeriod('${p}')">Buka</button>
      <button class="btn-danger btn-sm" style="width:auto; flex:0 0 auto;" onclick="deletePeriod('${p}')">✕</button>
    `;
    wrap.appendChild(row);
  });
}
window.loadPeriod = function (p) {
  currentPeriod = p;
  currentDay = 1;
  document.getElementById("periodInput").value = p;
  renderDayTabs();
  renderDayContent();
  updateHeader();
  switchPage("input");
};
window.deletePeriod = function (p) {
  if (!confirm("Hapus seluruh data bulan " + p + "?")) return;
  delete DB.months[p];
  saveDB();
  renderDataPage();
  toast("Bulan dihapus");
};

window.resetCurrentMonth = function () {
  if (!confirm("Hapus semua data bulan " + currentPeriod + "?")) return;
  delete DB.months[currentPeriod];
  saveDB();
  renderDayContent();
  renderDayTabs();
  toast("Bulan ini direset");
};
window.resetAll = function () {
  if (!confirm("HAPUS SEMUA DATA termasuk profil & master? Tidak bisa dibatalkan.")) return;
  if (!confirm("Yakin? Sekali lagi konfirmasi.")) return;
  localStorage.removeItem(STORE_KEY);
  DB = loadDB();
  toast("Semua data dihapus");
  setTimeout(() => location.reload(), 800);
};

// ---------- ESCAPE ----------
function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

// ---------- EXPORT: CSV (Database format) ----------
function exportCSV() {
  // Long format CSV: one row per (period, day, project, item, minutes)
  const rows = [["period", "day", "type", "project_number", "project_name", "item", "minutes", "target", "note"]];
  Object.entries(DB.months).forEach(([period, m]) => {
    Object.entries(m.days).forEach(([d, day]) => {
      const target = day.target || "";
      day.operations.forEach(p => {
        Object.entries(p.items).forEach(([item, min]) => {
          if (Number(min) > 0) {
            rows.push([period, d, "OP", p.projectNumber || "", p.projectName, item, min, target, day.note || ""]);
          }
        });
      });
      Object.entries(day.nonOperations).forEach(([item, min]) => {
        if (Number(min) > 0) {
          rows.push([period, d, "NONOP", "", "", item, min, target, day.note || ""]);
        }
      });
    });
  });
  const csv = rows.map(r => r.map(c => {
    const s = String(c == null ? "" : c);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  download("laporan_database_" + currentPeriod + ".csv", csv, "text/csv;charset=utf-8");
  toast("CSV diunduh", "success");
}
window.exportCSV = exportCSV;

// ---------- EXPORT: TXT (Full backup JSON inside .txt) ----------
function exportTXT() {
  const json = JSON.stringify(DB, null, 2);
  download("laporan_backup_" + new Date().toISOString().slice(0, 10) + ".txt", json, "text/plain;charset=utf-8");
  toast("Backup TXT diunduh", "success");
}
window.exportTXT = exportTXT;

// ---------- IMPORT ----------
function importData(ev) {
  const f = ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    try {
      // Try JSON first (full backup)
      if (text.trim().startsWith("{")) {
        const data = JSON.parse(text);
        if (data.months && data.profile !== undefined) {
          if (!confirm("Replace semua data dengan isi backup? (Cancel = merge bulan-bulan)")) {
            // merge
            Object.keys(data.months || {}).forEach(p => DB.months[p] = data.months[p]);
            if (data.masterProjects && Array.isArray(data.masterProjects)) {
              const seen = new Set(DB.masterProjects.map(p => p.name));
              data.masterProjects.forEach(p => { if (!seen.has(p.name)) DB.masterProjects.push(p); });
            }
          } else {
            DB = data;
          }
          saveDB();
          toast("Data di-import", "success");
          setTimeout(() => location.reload(), 600);
          return;
        }
      }
      // Otherwise: CSV
      importCSV(text);
    } catch (err) {
      console.error(err);
      toast("Format tidak dikenali", "error");
    }
  };
  reader.readAsText(f);
  ev.target.value = "";
}
window.importData = importData;

function importCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { toast("CSV kosong", "error"); return; }
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const idx = {
    period: header.indexOf("period"),
    day: header.indexOf("day"),
    type: header.indexOf("type"),
    pnum: header.indexOf("project_number"),
    pname: header.indexOf("project_name"),
    item: header.indexOf("item"),
    minutes: header.indexOf("minutes"),
    target: header.indexOf("target"),
    note: header.indexOf("note")
  };
  if (idx.period < 0 || idx.day < 0 || idx.item < 0 || idx.minutes < 0) {
    toast("Header CSV tidak valid", "error"); return;
  }
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const period = cells[idx.period];
    const day = Number(cells[idx.day]);
    const type = (cells[idx.type] || "").toUpperCase();
    const pname = cells[idx.pname] || "";
    const pnum = cells[idx.pnum] || "";
    const item = cells[idx.item] || "";
    const min = Number(cells[idx.minutes]) || 0;
    const target = idx.target >= 0 ? Number(cells[idx.target]) : 0;
    const note = idx.note >= 0 ? cells[idx.note] : "";
    if (!period || !day || !item) continue;
    const dayObj = ensureDay(period, day);
    if (note) dayObj.note = note;
    if (target > 0) dayObj.target = target;
    if (type === "OP") {
      let proj = dayObj.operations.find(p => p.projectName === pname);
      if (!proj) {
        proj = { projectNumber: pnum, projectName: pname, items: {} };
        dayObj.operations.push(proj);
      }
      proj.items[item] = (proj.items[item] || 0) + min;
    } else {
      dayObj.nonOperations[item] = (dayObj.nonOperations[item] || 0) + min;
    }
    count++;
  }
  saveDB();
  toast(count + " baris di-import", "success");
  setTimeout(() => location.reload(), 600);
}

function parseCSVLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ""; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// ---------- EXPORT: XLSX (pakai XlsxMini.buildLaporan - lib/xlsx-mini.js) ----------
function exportXLSX() {
  try {
    const bin = XlsxMini.buildLaporan(DB, currentPeriod);
    const [y, mn] = currentPeriod.split("-");
    const mname = new Date(y, mn-1, 1).toLocaleDateString("id-ID", { month: "long" });
    download(`Laporan_${DB.profile.name || "user"}_${mname}_${y}.xlsx`, bin,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    toast("✅ Excel diunduh", "success");
  } catch (e) {
    console.error("XLSX error:", e);
    toast("❌ Gagal: " + e.message, "error");
  }
}
window.exportXLSX = exportXLSX;

// ---------- EXPORT: PDF (pakai PdfPrint - lib/pdf-print.js) ----------
function exportPDF() {
  try {
    PdfPrint.print(DB, currentPeriod);
    toast("🖨️ Dialog cetak terbuka — pilih 'Save as PDF'", "success");
  } catch (e) {
    console.error("PDF error:", e);
    toast("❌ Gagal: " + e.message, "error");
  }
}
window.exportPDF = exportPDF;

// ---------- DOWNLOAD HELPER ----------
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- SERVICE WORKER (for offline) ----------
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ---------- INIT ----------
initInputPage();

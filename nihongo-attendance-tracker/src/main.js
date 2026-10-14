import "./style.css";

const STORAGE_KEY = "nihongoAttendanceTracker.v1";
const LEGACY_KEYS = ["sakuratrack.attendance.v1"];
const BASELINE_DATE = "2026-10-14";
const TRACKING_START = "2026-10-15";
const BASELINE = { attended: 12, absent: 5, total: 17 };

const $ = (selector) => document.querySelector(selector);
const app = $("#app");

function localISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function validISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = fromISO(iso);
  return d.getFullYear() === Number(iso.slice(0, 4)) &&
    d.getMonth() + 1 === Number(iso.slice(5, 7)) &&
    d.getDate() === Number(iso.slice(8, 10));
}
function formatDate(iso, options = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) {
  return fromISO(iso).toLocaleDateString(undefined, options);
}
function isWeekday(iso) {
  const day = fromISO(iso).getDay();
  return day >= 1 && day <= 5;
}
function defaultRecord(iso) {
  if (iso < TRACKING_START || iso > localISO()) return null;
  if (!isWeekday(iso)) return { status: "holiday", source: "weekend" };
  return { status: "present", source: "weekday-default" };
}
function emptyData() {
  return { version: 1, baseline: { ...BASELINE }, records: {} };
}
function normalizeStatus(record) {
  if (!record) return null;
  // Older chat-preview builds called a no-class day "off".
  const status = record.status === "off" ? "holiday" : record.status;
  return ["present", "absent", "holiday"].includes(status) ? status : null;
}
function validStatusRecord(record) {
  return Boolean(normalizeStatus(record));
}
function readData() {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.records !== "object" || !parsed.records) continue;
      const clean = emptyData();
      if (parsed.baseline?.attended === 12 && parsed.baseline?.absent === 5 && parsed.baseline?.total === 17) {
        clean.baseline = { ...BASELINE };
      }
      for (const [date, record] of Object.entries(parsed.records)) {
        if (validISO(date) && date >= TRACKING_START && validStatusRecord(record)) {
          clean.records[date] = {
            status: normalizeStatus(record),
            source: record.source === "weekday-default" ? "weekday-default" : "manual",
            updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString()
          };
        }
      }
      if (key !== STORAGE_KEY) localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      return clean;
    } catch (error) {
      console.warn("Could not read saved attendance data.", error);
    }
  }
  return emptyData();
}

let data = readData();
let selectedDate = localISO() >= TRACKING_START ? localISO() : TRACKING_START;
let shownMonth = fromISO(selectedDate);

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    $("#saveState").textContent = "Saved on this device";
  } catch {
    $("#saveState").textContent = "Could not save — export a backup";
  }
}
function ensureWeekdaysThroughToday() {
  const today = localISO();
  if (today < TRACKING_START) return;
  const date = fromISO(TRACKING_START);
  const end = fromISO(today);
  while (date <= end) {
    const iso = localISO(date);
    if (isWeekday(iso) && !data.records[iso]) {
      data.records[iso] = {
        status: "present",
        source: "weekday-default",
        updatedAt: new Date().toISOString()
      };
    }
    date.setDate(date.getDate() + 1);
  }
  save();
}
function statusFor(iso) {
  if (iso < TRACKING_START) return "baseline";
  if (iso > localISO()) return "future";
  const saved = data.records[iso];
  if (saved) return saved.status;
  if (!isWeekday(iso)) return "holiday";
  return "present";
}
function counts() {
  let attended = BASELINE.attended;
  let absent = BASELINE.absent;
  let total = BASELINE.total;
  for (const [date, record] of Object.entries(data.records)) {
    if (date < TRACKING_START || date > localISO()) continue;
    if (record.status === "present") { attended++; total++; }
    if (record.status === "absent") { absent++; total++; }
  }
  return { attended, absent, total, percentage: total ? attended / total * 100 : 0 };
}
function consecutiveClassesNeeded(c) {
  return Math.max(0, Math.ceil((0.95 * c.total - c.attended) / 0.05 - 1e-9));
}
function setStatus(iso, status) {
  if (!validISO(iso) || iso < TRACKING_START || iso > localISO()) {
    toast("Choose a date from 15 October 2026 through today.");
    return;
  }
  if (!["present", "absent", "holiday"].includes(status)) return;
  if ((status === "present" || status === "absent") && !isWeekday(iso)) {
    toast("Japanese classes are scheduled Monday–Friday. Use Holiday / No class for weekends.");
    return;
  }
  if (status === "holiday" && !isWeekday(iso)) {
    delete data.records[iso];
  } else {
    data.records[iso] = { status, source: "manual", updatedAt: new Date().toISOString() };
  }
  save();
  render();
  toast(status === "present" ? `Marked present: ${formatDate(iso)}`
    : status === "absent" ? `Marked absent: ${formatDate(iso)}`
    : `No class recorded: ${formatDate(iso)}`);
}
function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

app.innerHTML = `
  <div class="shell">
    <header class="hero">
      <div>
        <div class="eyebrow">にほんご · MY JOURNEY</div>
        <h1>Nihongo Attendance Tracker <span aria-hidden="true">🌸</span></h1>
        <p>One class at a time, one step closer.</p>
      </div>
      <div class="flower" aria-hidden="true">🌸</div>
    </header>

    <section class="card overview">
      <div class="overview-top">
        <div><div class="label">YOUR ATTENDANCE</div><div id="percentage" class="percentage">70.59%</div></div>
        <span id="goalBadge" class="badge">🎯 Goal: 95%</span>
      </div>
      <div class="progress"><div id="progressBar"></div></div>
      <p id="goalMessage" class="subtle small"></p>
      <div class="stats">
        <div class="stat present-stat"><span>✓</span><strong id="attended">12</strong><small>Present</small></div>
        <div class="stat absent-stat"><span>×</span><strong id="absent">5</strong><small>Absent</small></div>
        <div class="stat total-stat"><span>▦</span><strong id="total">17</strong><small>Conducted</small></div>
      </div>
      <div id="goalDetail" class="hint"></div>
    </section>

    <section class="card">
      <div class="today-head">
        <div><h2>Today's class ✨</h2><p id="todayLabel" class="subtle"></p></div>
        <span id="todayStatus" class="badge">Checking…</span>
      </div>
      <div class="button-row">
        <button id="todayPresent" class="btn green">✓ Mark present</button>
        <button id="todayAbsent" class="btn red">× Mark absent</button>
      </div>
      <p id="todayHelp" class="subtle small"></p>
    </section>

    <section class="card">
      <div class="section-head">
        <div><h2>Attendance calendar 🗓️</h2><p class="subtle small">Select a date to view or edit it.</p></div>
        <div class="month-buttons"><button id="prevMonth" class="btn pale" aria-label="Previous month">‹</button><button id="nextMonth" class="btn pale" aria-label="Next month">›</button></div>
      </div>
      <div class="legend"><span>🟢 Present</span><span>🔴 Absent</span><span>🟣 No class</span><span>⚪ Future</span></div>
      <h3 id="monthLabel" class="month-label"></h3>
      <div id="calendar" class="calendar"></div>
      <div class="selected-panel">
        <div class="label">SELECTED DATE</div><h3 id="selectedDateLabel"></h3>
        <p id="selectedInfo" class="subtle small"></p>
        <div class="edit-buttons">
          <button id="editPresent" class="btn green">✓ Present</button>
          <button id="editAbsent" class="btn red">× Absent</button>
          <button id="editHoliday" class="btn pale">◇ Holiday / No class</button>
          <button id="editReset" class="btn pale">↶ Reset default</button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <div><h2>Class history 📖</h2><p class="subtle small">Latest dated records</p></div>
        <select id="historyFilter" aria-label="Filter history">
          <option value="all">All records</option><option value="present">Present</option><option value="absent">Absent</option><option value="holiday">No class</option>
        </select>
      </div>
      <div id="historyList"></div><p id="historyEmpty" class="subtle small hidden">No records match this filter.</p>
    </section>

    <section class="card">
      <h2>Settings & backups ⚙️</h2>
      <div class="hint">Baseline as of 14 October 2026: 17 historical classes (12 present, 5 absent). Individual dates for these classes were not provided, so they stay as an aggregate. Dated tracking begins 15 October 2026.</div>
      <div class="form-grid">
        <label>Baseline date<input type="date" value="2026-10-14" disabled></label>
        <label>Open a date<input id="dateJump" type="date" min="2026-10-15"></label>
      </div>
      <button id="jumpBtn" class="btn primary full">Open date</button>
      <div class="backup-buttons">
        <button id="exportBtn" class="btn pale">↓ Export backup (JSON)</button>
        <label for="importFile" class="btn pale file-label">↑ Restore backup (JSON)</label>
        <input id="importFile" class="hidden" type="file" accept=".json,application/json">
      </div>
      <p id="saveState" class="subtle small">Saved on this device</p>
      <button id="resetBtn" class="btn danger-outline full">Reset dated records…</button>
      <p class="subtle small">Back up occasionally. Local records don't automatically sync to another browser or device.</p>
    </section>
    <footer>がんばろう, Deepa! 🌸 Keep showing up for your goals.</footer>
  </div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
`;

function renderStats() {
  const c = counts();
  $("#percentage").textContent = `${c.percentage.toFixed(2)}%`;
  $("#attended").textContent = c.attended;
  $("#absent").textContent = c.absent;
  $("#total").textContent = c.total;
  $("#progressBar").style.width = `${Math.min(100, c.percentage)}%`;
  $("#goalBadge").textContent = c.percentage >= 95 ? "🌸 Goal reached!" : "🎯 Goal: 95%";
  $("#goalMessage").textContent = c.percentage >= 95
    ? "Amazing! You have reached your 95% attendance goal. 🎉"
    : `Attend the next ${consecutiveClassesNeeded(c)} consecutive classes to reach at least 95%, assuming no more absences.`;
  $("#goalDetail").textContent = c.percentage >= 95
    ? "You reached your target! Keep it up!"
    : `You need ${consecutiveClassesNeeded(c)} consecutive attended classes to reach 95%.`;
}
function renderToday() {
  const iso = localISO();
  const status = statusFor(iso);
  $("#todayLabel").textContent = formatDate(iso, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  $("#todayStatus").textContent = iso < TRACKING_START ? "Baseline date"
    : !isWeekday(iso) ? "No class"
    : status === "present" ? "✓ Present" : status === "absent" ? "× Absent" : "◇ No class";
  $("#todayStatus").className = `badge ${status === "present" ? "badge-green" : status === "absent" ? "badge-red" : ""}`;
  const editable = iso >= TRACKING_START && isWeekday(iso);
  $("#todayPresent").disabled = !editable;
  $("#todayAbsent").disabled = !editable;
  $("#todayHelp").textContent = editable ? "Weekdays default to present. Change the status if you were absent." : "No regular Japanese class is scheduled today, or this date is part of the historical baseline.";
}
function renderCalendar() {
  const y = shownMonth.getFullYear(), m = shownMonth.getMonth();
  $("#monthLabel").textContent = shownMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const calendar = $("#calendar");
  calendar.innerHTML = "";
  ["M", "T", "W", "T", "F", "S", "S"].forEach((day) => {
    const el = document.createElement("div"); el.className = "weekday"; el.textContent = day; calendar.append(el);
  });
  const first = new Date(y, m, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) { const blank = document.createElement("div"); blank.className = "day blank"; calendar.append(blank); }
  const lastDay = new Date(y, m + 1, 0, 12).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = statusFor(iso);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day ${status === "present" ? "day-present" : status === "absent" ? "day-absent" : status === "holiday" ? "day-holiday" : "day-future"}${iso === selectedDate ? " selected" : ""}`;
    button.textContent = day;
    button.setAttribute("aria-label", `${formatDate(iso)}: ${status}`);
    button.title = `${formatDate(iso)} — ${status}`;
    if (iso > localISO() || iso < TRACKING_START) button.disabled = true;
    else button.addEventListener("click", () => { selectedDate = iso; renderSelected(); renderCalendar(); });
    calendar.append(button);
  }
  const totalCells = offset + lastDay;
  for (let i = totalCells; i % 7 !== 0; i++) { const blank = document.createElement("div"); blank.className = "day blank"; calendar.append(blank); }
  const current = localISO().slice(0, 7);
  const shown = `${y}-${String(m + 1).padStart(2, "0")}`;
  $("#prevMonth").disabled = shown <= "2026-10";
  $("#nextMonth").disabled = shown >= current;
}
function renderSelected() {
  const status = statusFor(selectedDate);
  $("#selectedDateLabel").textContent = formatDate(selectedDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  $("#selectedInfo").textContent = selectedDate < TRACKING_START
    ? "Historical baseline date. The first 17 classes are stored as a total because their individual dates are unknown."
    : selectedDate > localISO() ? "Future dates are not counted yet."
    : !isWeekday(selectedDate) ? "Weekend — no regular Japanese class is scheduled."
    : status === "present" ? "Marked present. This class counts as attended."
    : status === "absent" ? "Marked absent. This class counts as conducted, but not attended."
    : "No class. This date is excluded from the attendance total.";
  const editable = selectedDate >= TRACKING_START && selectedDate <= localISO() && isWeekday(selectedDate);
  ["editPresent", "editAbsent", "editHoliday", "editReset"].forEach((id) => { $(`#${id}`).disabled = !editable; });
}
function renderHistory() {
  const filter = $("#historyFilter").value;
  const list = $("#historyList");
  list.innerHTML = "";
  const rows = Object.entries(data.records)
    .filter(([date, record]) => date >= TRACKING_START && date <= localISO() && (filter === "all" || record.status === filter))
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 40);
  $("#historyEmpty").classList.toggle("hidden", rows.length > 0);
  for (const [date, record] of rows) {
    const row = document.createElement("div"); row.className = "history-row";
    const info = document.createElement("div");
    const dateText = document.createElement("strong"); dateText.textContent = formatDate(date);
    const source = document.createElement("small"); source.textContent = record.source === "weekday-default" ? "Weekday default" : "Manually edited";
    info.append(dateText, source);
    const actions = document.createElement("div"); actions.className = "history-actions";
    const badge = document.createElement("span");
    badge.className = `mini-badge ${record.status}`;
    badge.textContent = record.status === "present" ? "✓ Present" : record.status === "absent" ? "× Absent" : "◇ No class";
    const edit = document.createElement("button"); edit.className = "btn pale compact"; edit.textContent = "Edit";
    edit.addEventListener("click", () => { selectedDate = date; shownMonth = fromISO(date); render(); $("#selectedDateLabel").scrollIntoView({ behavior: "smooth", block: "center" }); });
    actions.append(badge, edit); row.append(info, actions); list.append(row);
  }
}
function render() { renderStats(); renderToday(); renderCalendar(); renderSelected(); renderHistory(); }

$("#todayPresent").addEventListener("click", () => setStatus(localISO(), "present"));
$("#todayAbsent").addEventListener("click", () => setStatus(localISO(), "absent"));
$("#editPresent").addEventListener("click", () => setStatus(selectedDate, "present"));
$("#editAbsent").addEventListener("click", () => setStatus(selectedDate, "absent"));
$("#editHoliday").addEventListener("click", () => setStatus(selectedDate, "holiday"));
$("#editReset").addEventListener("click", () => {
  if (selectedDate < TRACKING_START || selectedDate > localISO() || !isWeekday(selectedDate)) return;
  delete data.records[selectedDate];
  ensureWeekdaysThroughToday();
  save(); render(); toast(`Reset ${formatDate(selectedDate)} to weekday default.`);
});
$("#prevMonth").addEventListener("click", () => {
  if ($("#prevMonth").disabled) return;
  shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() - 1, 1, 12); renderCalendar();
});
$("#nextMonth").addEventListener("click", () => {
  if ($("#nextMonth").disabled) return;
  shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 1, 12); renderCalendar();
});
$("#historyFilter").addEventListener("change", renderHistory);
$("#jumpBtn").addEventListener("click", () => {
  const date = $("#dateJump").value;
  if (!validISO(date) || date < TRACKING_START || date > localISO()) { toast("Choose a date from 15 October 2026 through today."); return; }
  selectedDate = date; shownMonth = fromISO(date); render();
});
$("#dateJump").min = TRACKING_START;
$("#dateJump").max = localISO();
$("#dateJump").value = selectedDate;
$("#exportBtn").addEventListener("click", () => {
  const payload = { app: "Nihongo Attendance Tracker", version: 1, baselineDate: BASELINE_DATE, baseline: data.baseline, records: data.records };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "nihongo-attendance-tracker-backup.json"; a.click();
  URL.revokeObjectURL(url); toast("Backup exported. Keep the JSON file somewhere safe.");
});
$("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed.records || typeof parsed.records !== "object" || parsed.baseline?.attended !== 12 || parsed.baseline?.absent !== 5 || parsed.baseline?.total !== 17) throw new Error("Invalid backup");
    const clean = {};
    for (const [date, record] of Object.entries(parsed.records)) {
      if (!validISO(date) || date < TRACKING_START || date > localISO() || !validStatusRecord(record)) continue;
      if (!isWeekday(date) && record.status !== "holiday") continue;
      clean[date] = { status: normalizeStatus(record), source: record.source === "weekday-default" ? "weekday-default" : "manual", updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString() };
    }
    data.records = clean; ensureWeekdaysThroughToday(); save(); render(); toast("Backup restored successfully.");
  } catch { toast("Could not read that backup. Choose a valid Nihongo Attendance Tracker JSON file."); }
  event.target.value = "";
});
$("#resetBtn").addEventListener("click", () => {
  if (!confirm("Delete all dated records and rebuild weekdays as present? Your original 17-class baseline will remain. Export a backup first if needed.")) return;
  data.records = {}; ensureWeekdaysThroughToday(); selectedDate = localISO() >= TRACKING_START ? localISO() : TRACKING_START; shownMonth = fromISO(selectedDate);
  $("#dateJump").value = selectedDate; save(); render(); toast("Dated records reset. The baseline is unchanged.");
});

ensureWeekdaysThroughToday();
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Offline support could not be enabled.", error)));
}

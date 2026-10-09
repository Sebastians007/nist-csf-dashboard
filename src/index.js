import { unzipSync } from 'fflate';
import { FUNCTIONS, SOURCE } from './controls.js';
import { FULL_CORE } from './full-core.js';

// Official NIST export of the live CSF 2.0 catalog (Cybersecurity & Privacy Reference Tool).
// The .xlsx NIST generates on each request re-embeds a creation timestamp (in docProps/core.xml
// and sheet1.xml), so hashing the whole file would never match twice even when the CSF content
// is unchanged. xl/sharedStrings.xml holds all of the actual Function/Category/Subcategory/
// Implementation Example text and is byte-identical across requests when the content hasn't
// changed, so we hash only that entry.
const NIST_SOURCE_URL = 'https://csrc.nist.gov/extensions/nudp/services/json/csf/download?olirids=all';
const STATUS_KEY = 'csf-freshness-status';

const ICONS = { GV: '🧭', ID: '🔍', PR: '🔒', DE: '👁️', RS: '🚨', RC: '🔄' };

async function sha256Hex(buf) {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function checkFreshness(env) {
  const res = await fetch(NIST_SOURCE_URL, { headers: { 'User-Agent': 'nist-csf-dashboard/1.0' } });
  if (!res.ok) throw new Error(`NIST source returned ${res.status}`);
  const buf = await res.arrayBuffer();
  const files = unzipSync(new Uint8Array(buf));
  const sharedStrings = files['xl/sharedStrings.xml'];
  if (!sharedStrings) throw new Error('NIST export did not contain xl/sharedStrings.xml');
  const hash = await sha256Hex(sharedStrings);
  const status = {
    hash,
    checkedAt: new Date().toISOString(),
    baselineHash: env.BASELINE_HASH,
    isCurrent: hash === env.BASELINE_HASH,
  };
  if (env.CSF_KV) await env.CSF_KV.put(STATUS_KEY, JSON.stringify(status));
  return status;
}

async function getStatus(env) {
  if (env.CSF_KV) {
    const cached = await env.CSF_KV.get(STATUS_KEY, 'json');
    if (cached) return cached;
  }
  return { hash: null, checkedAt: null, baselineHash: env.BASELINE_HASH, isCurrent: null };
}

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

// ---- View data: "simple" is the 42-item NIST SP 1300 small-business quick-start list;
// "full" is the complete CSF 2.0 Core (106 subcategories) reshaped to the same {id, name,
// summary, controls:[{id, label, text, examples?, references?}]} shape so both views share
// one renderer. "label" is the small-business action phase (Understand/Assess/...) in the
// simple view, and the real CSF Category name (e.g. "Organizational Context") in the full view.
function simpleAsFunctions() {
  return FUNCTIONS.map((fn) => ({
    id: fn.id,
    name: fn.name,
    summary: fn.summary,
    controls: fn.controls.map((c) => ({ id: c.id, label: c.phase, text: c.text })),
  }));
}

function fullCoreAsFunctions() {
  return FULL_CORE.map((fcFn) => {
    const simpleFn = FUNCTIONS.find((f) => f.id === fcFn.id);
    const controls = fcFn.categories.flatMap((cat) =>
      cat.subcategories.map((sc) => ({
        id: sc.id,
        label: cat.name,
        text: sc.text,
        examples: sc.examples,
        references: sc.references,
      }))
    );
    return {
      id: fcFn.id,
      name: simpleFn ? simpleFn.name : fcFn.name,
      summary: fcFn.description,
      controls,
    };
  });
}

const VIEWS = {
  simple: { label: 'Small Business Quick-Start', get: simpleAsFunctions },
  full: { label: 'Full CSF 2.0 Core', get: fullCoreAsFunctions },
};

function resolveView(url) {
  const v = url.searchParams.get('view');
  return v === 'full' ? 'full' : 'simple';
}

function withView(path, view) {
  return view === 'full' ? `${path}${path.includes('?') ? '&' : '?'}view=full` : path;
}

const SHARED_STYLES = `
  :root {
    --bg: #ffffff; --panel: #ffffff; --panel-2: #f2f6ff; --text: #0b1a33; --muted: #5c6b8a;
    --accent: #0a5cff; --accent-dark: #0041c2; --good: #18a957; --good-bg: #e9fbf0;
    --warn: #d98400; --bad: #e0392f; --border: #dde6fb;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  header.top { padding: 28px 32px; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; justify-content: space-between; }
  header.top h1 { font-size: 24px; margin: 0; letter-spacing: -0.01em; }
  header.top .sub { color: var(--muted); font-size: 14px; margin-top: 4px; }
  header.top .disclaimer { color: var(--muted); font-size: 12px; margin-top: 8px; max-width: 540px; }
  .status-bar { display: flex; align-items: center; gap: 12px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
  .dot.good { background: var(--good); box-shadow: 0 0 8px var(--good); }
  .dot.warn { background: var(--warn); box-shadow: 0 0 8px var(--warn); }
  .dot.bad { background: var(--bad); box-shadow: 0 0 8px var(--bad); }
  .status-text { font-size: 13px; color: var(--muted); }
  .status-text strong { color: var(--text); }
  button, .btn { background: var(--accent); color: #ffffff; border: none; border-radius: 10px; padding: 10px 18px; font-weight: 600; cursor: pointer; font-size: 14px; }
  button:hover, .btn:hover { background: var(--accent-dark); text-decoration: none; }
  .btn.secondary { background: var(--panel-2); color: var(--accent); border: 1px solid var(--border); }
  .btn.secondary:hover { background: #e7edff; }
  main { padding: 32px; max-width: 1200px; margin: 0 auto; }
  footer { padding: 32px; text-align: center; color: var(--muted); font-size: 12px; }
  .progress-track { background: var(--panel-2); border-radius: 999px; height: 10px; overflow: hidden; }
  .progress-fill { background: var(--accent); height: 100%; width: 100%; border-radius: 999px; transform: scaleX(0); transform-origin: left; transition: transform 0.3s ease; }
  .progress-fill.complete { background: var(--good); }
  .progress-label { font-size: 13px; color: var(--muted); margin-bottom: 6px; display: flex; justify-content: space-between; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; max-width: 1200px; margin: 0 auto 28px; }
  .view-toggle { display: inline-flex; background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px; padding: 3px; gap: 2px; }
  .view-toggle a { padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--muted); }
  .view-toggle a.active { background: var(--accent); color: #fff; }
  .view-toggle a:hover { text-decoration: none; }
  .toolbar .spacer { flex: 1 1 auto; }
  .ctl-note { width: 100%; margin-top: 10px; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px; color: var(--text); resize: vertical; min-height: 36px; background: var(--panel-2); }
  .ctl-note::placeholder { color: #93a2c2; }
  details.ctl-extra { margin-top: 10px; }
  details.ctl-extra summary { cursor: pointer; font-size: 12px; font-weight: 600; color: var(--accent); }
  details.ctl-extra .ex-block { font-size: 13px; color: var(--muted); margin-top: 6px; white-space: pre-wrap; }
  details.ctl-extra .ex-block + .ex-block { margin-top: 8px; }
  .file-btn { position: relative; overflow: hidden; display: inline-block; }
  .file-btn input[type="file"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  @media print {
    header.top .status-bar, header.top .disclaimer, .toolbar, .back-link, .section-arrow, input[type="checkbox"] { display: none !important; }
    .ctl-row { break-inside: avoid; border: 1px solid #ccc !important; }
    body { color: #000; }
  }
`;

function statusBarHtml() {
  return `
  <div class="status-bar" id="status-bar">
    <span class="dot" id="status-dot"></span>
    <span class="status-text" id="status-text">Checking framework freshness&hellip;</span>
    <button id="check-btn">Check Now</button>
  </div>`;
}

const STATUS_SCRIPT = `
  function renderStatus(s) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    dot.className = 'dot';
    if (s.isCurrent === true) {
      dot.classList.add('good');
      text.innerHTML = '<strong>Up to date</strong> &mdash; matches NIST CSF 2.0 as of ' + new Date(s.checkedAt).toLocaleString();
    } else if (s.isCurrent === false) {
      dot.classList.add('bad');
      text.innerHTML = '<strong>Update available</strong> &mdash; NIST source changed since this was last reviewed (checked ' + new Date(s.checkedAt).toLocaleString() + ')';
    } else {
      dot.classList.add('warn');
      text.innerHTML = '<strong>Unknown</strong> &mdash; no freshness check has run yet';
    }
  }
  async function loadStatus() {
    const r = await fetch('/api/status');
    renderStatus(await r.json());
  }
  document.getElementById('check-btn').addEventListener('click', async () => {
    document.getElementById('status-text').textContent = 'Checking against NIST now…';
    const r = await fetch('/api/refresh', { method: 'POST' });
    renderStatus(await r.json());
  });
  loadStatus();
`;

// Shared state/export helpers injected on every page. State is a flat object keyed
// "<view>:<fnId>:<controlId>" (checked: true/false) and "note:<view>:<fnId>:<controlId>"
// (free-text notes), all stored client-side only, in one localStorage blob.
const STATE_SCRIPT = `
  const STORAGE_KEY = 'csf-progress-v2';
  const LEGACY_KEY = 'csf-progress-v1';
  let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (!state) {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}');
    state = {};
    Object.keys(legacy).forEach((k) => { state['simple:' + k] = legacy[k]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function ckey(view, fn, id) { return view + ':' + fn + ':' + id; }
  function nkey(view, fn, id) { return 'note:' + view + ':' + fn + ':' + id; }

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function exportCsv(view, data) {
    const rows = [['Function', 'Category / Phase', 'Control ID', 'Description', 'Status', 'Notes']];
    data.forEach((fn) => fn.controls.forEach((c) => {
      const done = !!state[ckey(view, fn.id, c.id)];
      const note = state[nkey(view, fn.id, c.id)] || '';
      rows.push([fn.name, c.label, c.id, c.text, done ? 'Done' : 'Not done', note]);
    }));
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\\n');
    downloadBlob('nist-csf-progress-' + view + '.csv', csv, 'text/csv');
  }
  function exportProgressFile() {
    downloadBlob('nist-csf-progress.json', JSON.stringify(state, null, 2), 'application/json');
  }
  function importProgressFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(reader.result);
        state = Object.assign({}, state, incoming);
        save();
        location.reload();
      } catch (e) {
        alert('That file did not look like a valid progress export.');
      }
    };
    reader.readAsText(file);
  }
  function wireToolbar(view, data) {
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => exportCsv(view, data));
    const printBtn = document.getElementById('print-btn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    const saveBtn = document.getElementById('save-progress-btn');
    if (saveBtn) saveBtn.addEventListener('click', exportProgressFile);
    const loadInput = document.getElementById('load-progress-input');
    if (loadInput) loadInput.addEventListener('change', (e) => { if (e.target.files[0]) importProgressFile(e.target.files[0]); });
  }
`;

function toolbarHtml(view, extraRight = '') {
  return `
  <div class="toolbar">
    <div class="view-toggle">
      <a href="${withView('/', 'simple')}" class="${view === 'simple' ? 'active' : ''}">Small Business Guide</a>
      <a href="${withView('/', 'full')}" class="${view === 'full' ? 'active' : ''}">Full CSF 2.0 Core</a>
    </div>
    <div class="spacer"></div>
    <button id="export-csv-btn" class="btn secondary" type="button">Export CSV</button>
    <button id="print-btn" class="btn secondary" type="button">Print / Save as PDF</button>
    <button id="save-progress-btn" class="btn secondary" type="button">Save progress file</button>
    <label class="btn secondary file-btn">Load progress file<input id="load-progress-input" type="file" accept="application/json" /></label>
    ${extraRight}
  </div>`;
}

function pageShell({ title, headerExtra = '', body, script }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${SHARED_STYLES}</style>
</head>
<body>
<header class="top">
  <div>
    <h1>NIST CSF 2.0 &mdash; Small Business Dashboard</h1>
    <div class="sub">Source: ${SOURCE.title} (${SOURCE.publication}, ${SOURCE.published}) &middot; Full Core: NIST CSF 2.0 Reference Tool</div>
    <div class="disclaimer">Not affiliated with or endorsed by NIST. The Small Business Guide is a supplement, not a replacement, for the full CSF 2.0 Core.</div>
    ${headerExtra}
  </div>
  ${statusBarHtml()}
</header>
<main>
${body}
</main>
<footer>
  Small Business controls sourced from NIST SP 1300 (<a href="${SOURCE.doi}" target="_blank" rel="noopener">${SOURCE.doi}</a>).
  Full Core sourced from NIST's CSF 2.0 Reference Tool. Freshness is checked against NIST's live export. Your progress is stored only in this browser.
</footer>
<script>
  ${STATE_SCRIPT}
  ${STATUS_SCRIPT}
  ${script}
</script>
</body>
</html>`;
}

function renderHome(view) {
  const data = VIEWS[view].get();
  const grandTotal = data.reduce((a, fn) => a + fn.controls.length, 0);

  const cards = data.map(
    (fn) => `
    <a class="section-card" href="${withView('/function/' + fn.id, view)}" data-fn="${fn.id}" data-total="${fn.controls.length}">
      <div class="section-icon">${ICONS[fn.id] || ''}</div>
      <div class="section-body">
        <h2>${fn.name}</h2>
        <p>${fn.summary}</p>
        <div class="progress-label"><span data-count="${fn.id}">0 of ${fn.controls.length} done</span><span data-pct-label="${fn.id}">0%</span></div>
        <div class="progress-track"><div class="progress-fill" data-fill="${fn.id}"></div></div>
      </div>
      <div class="section-arrow">View controls &rarr;</div>
    </a>`
  ).join('');

  const body = `
  ${toolbarHtml(view)}
  <div class="overall">
    <div class="progress-label"><span>Overall progress &mdash; ${VIEWS[view].label}</span><span data-pct-label="overall">0%</span></div>
    <div class="progress-track"><div class="progress-fill" data-fill="overall"></div></div>
    <div class="overall-count" data-count="overall">0 of ${grandTotal} controls complete</div>
  </div>
  <div class="grid">${cards}</div>`;

  const extraStyles = `
  <style>
    .overall { max-width: 1200px; margin: 0 auto 28px; }
    .overall-count { color: var(--muted); font-size: 13px; margin-top: 6px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
    .section-card { display: flex; flex-direction: column; gap: 14px; background: var(--panel); border: 1px solid var(--border); border-radius: 18px; padding: 28px; box-shadow: 0 1px 2px rgba(10,30,70,0.04); color: var(--text); }
    .section-card:hover { border-color: var(--accent); box-shadow: 0 4px 16px rgba(10,92,255,0.12); text-decoration: none; }
    .section-icon { font-size: 32px; }
    .section-body h2 { margin: 0 0 6px; font-size: 19px; }
    .section-body p { margin: 0 0 14px; color: var(--muted); font-size: 14px; }
    .section-arrow { font-size: 13px; font-weight: 600; color: var(--accent); }
  </style>`;

  const script = `
  const VIEW = '${view}';
  const DATA = ${JSON.stringify(data)};
  const TOTALS = Object.fromEntries(DATA.map((fn) => [fn.id, fn.controls.length]));
  function countDone(fnId) {
    return Object.keys(state).filter((k) => k.startsWith(VIEW + ':' + fnId + ':') && state[k]).length;
  }
  function renderProgress() {
    let doneAll = 0, totalAll = 0;
    Object.keys(TOTALS).forEach((fnId) => {
      const total = TOTALS[fnId];
      const done = countDone(fnId);
      totalAll += total; doneAll += done;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const fill = document.querySelector('[data-fill="' + fnId + '"]');
      fill.style.transform = 'scaleX(' + (pct / 100) + ')';
      fill.classList.toggle('complete', pct === 100);
      document.querySelector('[data-pct-label="' + fnId + '"]').textContent = pct + '%';
      document.querySelector('[data-count="' + fnId + '"]').textContent = done + ' of ' + total + ' done';
    });
    const overallPct = totalAll ? Math.round((doneAll / totalAll) * 100) : 0;
    const overallFill = document.querySelector('[data-fill="overall"]');
    overallFill.style.transform = 'scaleX(' + (overallPct / 100) + ')';
    overallFill.classList.toggle('complete', overallPct === 100);
    document.querySelector('[data-pct-label="overall"]').textContent = overallPct + '%';
    document.querySelector('[data-count="overall"]').textContent = doneAll + ' of ' + totalAll + ' controls complete';
  }
  renderProgress();
  wireToolbar(VIEW, DATA);
  `;

  return pageShell({ title: 'NIST CSF 2.0 — Small Business Dashboard', headerExtra: extraStyles, body, script });
}

function renderFunctionPage(fn, view) {
  const rows = fn.controls
    .map(
      (c) => `
    <li class="ctl-row" data-row="${c.id}">
      <label>
        <input type="checkbox" data-id="${c.id}" />
        <span class="ctl-main">
          <span class="phase">${c.label}</span>
          <span class="ctl-id">${c.id}</span>
          <span class="ctl-text">${c.text}</span>
          ${c.examples || c.references ? `
          <details class="ctl-extra">
            <summary>Implementation examples &amp; references</summary>
            ${c.examples ? `<div class="ex-block"><strong>Examples:</strong>\n${c.examples}</div>` : ''}
            ${c.references ? `<div class="ex-block"><strong>Informative references:</strong>\n${c.references}</div>` : ''}
          </details>` : ''}
          <textarea class="ctl-note" data-note="${c.id}" placeholder="Notes (e.g. how this is implemented, owner, evidence)&hellip;"></textarea>
        </span>
      </label>
    </li>`
    )
    .join('');

  const body = `
  ${toolbarHtml(view)}
  <a class="back-link" href="${withView('/', view)}">&larr; Back to dashboard</a>
  <div class="fn-head">
    <div class="fn-icon">${ICONS[fn.id] || ''}</div>
    <div>
      <h2>${fn.name} <span class="fn-id">${fn.id}</span></h2>
      <p>${fn.summary}</p>
    </div>
  </div>
  <div class="progress-label"><span data-count="${fn.id}">0 of ${fn.controls.length} done</span><span data-pct-label="${fn.id}">0%</span></div>
  <div class="progress-track"><div class="progress-fill" data-fill="${fn.id}"></div></div>
  <ul class="ctl-list">${rows}</ul>`;

  const extraStyles = `
  <style>
    .back-link { display: inline-block; margin-bottom: 20px; font-size: 14px; font-weight: 600; }
    .fn-head { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 20px; }
    .fn-icon { font-size: 40px; }
    .fn-head h2 { margin: 0 0 6px; font-size: 24px; }
    .fn-id { color: var(--muted); font-size: 14px; font-weight: 400; }
    .fn-head p { margin: 0; color: var(--muted); font-size: 15px; max-width: 640px; }
    .ctl-list { list-style: none; margin: 24px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .ctl-row { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px; transition: background 0.15s, border-color 0.15s; }
    .ctl-row.done { background: var(--good-bg); border-color: var(--good); }
    .ctl-row label { display: flex; align-items: flex-start; gap: 14px; cursor: pointer; }
    .ctl-row input[type="checkbox"] { width: 20px; height: 20px; margin-top: 2px; accent-color: var(--accent); flex-shrink: 0; }
    .ctl-main { display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; min-width: 0; }
    .phase { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); font-weight: 700; }
    .ctl-id { font-size: 12px; color: var(--muted); font-family: ui-monospace, Consolas, monospace; }
    .ctl-text { font-size: 15px; color: var(--text); }
  </style>`;

  const script = `
  const VIEW = '${view}';
  const FN_ID = '${fn.id}';
  const DATA = [${JSON.stringify(fn)}];
  function updateRow(box) {
    box.closest('.ctl-row').classList.toggle('done', box.checked);
  }
  function renderProgress() {
    const boxes = [...document.querySelectorAll('.ctl-list input[type="checkbox"]')];
    const done = boxes.filter((b) => b.checked).length;
    const total = boxes.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const fill = document.querySelector('[data-fill="' + FN_ID + '"]');
    fill.style.transform = 'scaleX(' + (pct / 100) + ')';
    fill.classList.toggle('complete', pct === 100);
    document.querySelector('[data-pct-label="' + FN_ID + '"]').textContent = pct + '%';
    document.querySelector('[data-count="' + FN_ID + '"]').textContent = done + ' of ' + total + ' done';
  }
  document.querySelectorAll('.ctl-list input[type="checkbox"]').forEach((box) => {
    const key = ckey(VIEW, FN_ID, box.dataset.id);
    box.checked = !!state[key];
    updateRow(box);
    box.addEventListener('change', () => {
      state[key] = box.checked;
      save();
      updateRow(box);
      renderProgress();
    });
  });
  document.querySelectorAll('.ctl-note').forEach((ta) => {
    const key = nkey(VIEW, FN_ID, ta.dataset.note);
    ta.value = state[key] || '';
    ta.addEventListener('input', () => { state[key] = ta.value; save(); });
  });
  renderProgress();
  wireToolbar(VIEW, DATA);
  `;

  return pageShell({ title: `${fn.name} — NIST CSF 2.0 Dashboard`, headerExtra: extraStyles, body, script });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const view = resolveView(url);

    if (url.pathname === '/api/status' && request.method === 'GET') {
      return jsonResponse(await getStatus(env));
    }

    if (url.pathname === '/api/refresh' && request.method === 'POST') {
      try {
        return jsonResponse(await checkFreshness(env));
      } catch (err) {
        return jsonResponse({ error: String(err) }, { status: 502 });
      }
    }

    if (url.pathname === '/api/controls' && request.method === 'GET') {
      return jsonResponse(VIEWS[view].get());
    }

    if (url.pathname === '/') {
      return new Response(renderHome(view), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const match = url.pathname.match(/^\/function\/([A-Z]{2})$/);
    if (match) {
      const fn = VIEWS[view].get().find((f) => f.id === match[1]);
      if (fn) {
        return new Response(renderFunctionPage(fn, view), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env) {
    await checkFreshness(env);
  },
};

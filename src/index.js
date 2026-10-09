import { unzipSync } from 'fflate';
import { FUNCTIONS, SOURCE } from './controls.js';

// Official NIST export of the live CSF 2.0 catalog (Cybersecurity & Privacy Reference Tool).
// The .xlsx NIST generates on each request re-embeds a creation timestamp (in docProps/core.xml
// and sheet1.xml), so hashing the whole file would never match twice even when the CSF content
// is unchanged. xl/sharedStrings.xml holds all of the actual Function/Category/Subcategory/
// Implementation Example text and is byte-identical across requests when the content hasn't
// changed, so we hash only that entry.
const NIST_SOURCE_URL = 'https://csrc.nist.gov/extensions/nudp/services/json/csf/download?olirids=all';
const STATUS_KEY = 'csf-freshness-status';

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

function renderPage() {
  const functionCards = FUNCTIONS.map(
    (fn) => `
    <section class="card" data-fn="${fn.id}">
      <header class="card-head">
        <h2>${fn.name} <span class="fn-id">${fn.id}</span></h2>
        <div class="ring" data-ring="${fn.id}"><span data-pct="${fn.id}">0%</span></div>
      </header>
      <p class="summary">${fn.summary}</p>
      <ul class="controls">
        ${fn.controls
          .map(
            (c) => `
          <li>
            <label>
              <input type="checkbox" data-fn="${fn.id}" data-id="${c.id}" />
              <span class="phase">${c.phase}</span>
              <span class="ctl-id">${c.id}</span>
              <span class="ctl-text">${c.text}</span>
            </label>
          </li>`
          )
          .join('')}
      </ul>
    </section>`
  ).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>NIST CSF 2.0 Small Business Dashboard</title>
<style>
  :root {
    --bg: #0b1220; --panel: #121b2e; --panel-2: #0f1830; --text: #e8edf7; --muted: #9fb0cc;
    --accent: #4da3ff; --good: #35c470; --warn: #e8b339; --bad: #ef5a5a; --border: #223253;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  header.top { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; }
  header.top h1 { font-size: 18px; margin: 0; }
  header.top .sub { color: var(--muted); font-size: 13px; }
  header.top .disclaimer { color: var(--muted); font-size: 11px; margin-top: 4px; max-width: 520px; }
  .status-bar { display: flex; align-items: center; gap: 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
  .dot.good { background: var(--good); box-shadow: 0 0 8px var(--good); }
  .dot.warn { background: var(--warn); box-shadow: 0 0 8px var(--warn); }
  .dot.bad { background: var(--bad); box-shadow: 0 0 8px var(--bad); }
  .status-text { font-size: 13px; color: var(--muted); }
  .status-text strong { color: var(--text); }
  button { background: var(--accent); color: #06111f; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; font-size: 13px; }
  button:hover { filter: brightness(1.08); }
  main { padding: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; max-width: 1400px; margin: 0 auto; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
  .card-head { display: flex; justify-content: space-between; align-items: center; }
  .card-head h2 { font-size: 16px; margin: 0; }
  .fn-id { color: var(--muted); font-size: 12px; font-weight: 400; }
  .summary { color: var(--muted); font-size: 13px; margin: 8px 0 12px; }
  .ring { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: conic-gradient(var(--accent) 0deg, var(--border) 0deg); }
  .ring span { background: var(--panel); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  ul.controls { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  ul.controls li { border-top: 1px solid var(--border); padding-top: 6px; }
  ul.controls li:first-child { border-top: none; padding-top: 0; }
  label { display: grid; grid-template-columns: 18px auto; gap: 4px 10px; align-items: baseline; cursor: pointer; font-size: 13px; }
  .phase { grid-column: 2; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); }
  .ctl-id { grid-column: 2; font-size: 11px; color: var(--muted); font-family: ui-monospace, monospace; }
  .ctl-text { grid-column: 2; color: var(--text); }
  footer { padding: 24px; text-align: center; color: var(--muted); font-size: 12px; }
  footer a { color: var(--accent); }
</style>
</head>
<body>
<header class="top">
  <div>
    <h1>NIST CSF 2.0 &mdash; Small Business Control Dashboard</h1>
    <div class="sub">Source: ${SOURCE.title} (${SOURCE.publication}, ${SOURCE.published})</div>
    <div class="disclaimer">This is a supplement based on NIST's Small Business Quick-Start Guide, not a replacement for the full CSF 2.0 Core, and is not affiliated with or endorsed by NIST.</div>
  </div>
  <div class="status-bar" id="status-bar">
    <span class="dot" id="status-dot"></span>
    <span class="status-text" id="status-text">Checking framework freshness&hellip;</span>
    <button id="check-btn">Check Now</button>
  </div>
</header>
<main>
${functionCards}
</main>
<footer>
  Controls sourced from NIST SP 1300 (<a href="${SOURCE.doi}" target="_blank" rel="noopener">${SOURCE.doi}</a>).
  Freshness is checked against NIST's live CSF 2.0 reference export. Progress is stored locally in your browser only.
</footer>
<script>
  const STORAGE_KEY = 'csf-progress-v1';
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function updateRing(fnId) {
    const boxes = [...document.querySelectorAll('input[data-fn="' + fnId + '"]')];
    const done = boxes.filter((b) => b.checked).length;
    const pct = boxes.length ? Math.round((done / boxes.length) * 100) : 0;
    const ring = document.querySelector('[data-ring="' + fnId + '"]');
    const label = document.querySelector('[data-pct="' + fnId + '"]');
    const color = pct === 100 ? 'var(--good)' : pct > 0 ? 'var(--accent)' : 'var(--border)';
    ring.style.background = 'conic-gradient(' + color + ' ' + (pct * 3.6) + 'deg, var(--border) 0deg)';
    label.textContent = pct + '%';
  }

  document.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    const key = box.dataset.fn + ':' + box.dataset.id;
    box.checked = !!state[key];
    box.addEventListener('change', () => {
      state[key] = box.checked;
      save();
      updateRing(box.dataset.fn);
    });
  });
  document.querySelectorAll('[data-ring]').forEach((r) => updateRing(r.dataset.ring));

  function renderStatus(s) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    dot.className = 'dot';
    if (s.isCurrent === true) {
      dot.classList.add('good');
      text.innerHTML = '<strong>Current</strong> &mdash; matches NIST CSF 2.0 source as of ' + new Date(s.checkedAt).toLocaleString();
    } else if (s.isCurrent === false) {
      dot.classList.add('bad');
      text.innerHTML = '<strong>Update available</strong> &mdash; NIST source changed since this dashboard was last reviewed (checked ' + new Date(s.checkedAt).toLocaleString() + ')';
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
    const text = document.getElementById('status-text');
    text.textContent = 'Checking against NIST now…';
    const r = await fetch('/api/refresh', { method: 'POST' });
    renderStatus(await r.json());
  });
  loadStatus();
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
      return jsonResponse(FUNCTIONS);
    }

    if (url.pathname === '/') {
      return new Response(renderPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env) {
    await checkFreshness(env);
  },
};

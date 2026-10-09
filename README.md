# NIST CSF 2.0 Small Business Dashboard

A small Cloudflare Worker that renders the controls from NIST SP 1300
("NIST Cybersecurity Framework 2.0: Small Business Quick-Start Guide") as an
interactive, visual dashboard, and tracks whether its bundled control list is
still in sync with NIST's live CSF 2.0 reference data.

## What it does

- Renders all six CSF 2.0 Functions (Govern, Identify, Protect, Detect,
  Respond, Recover) as cards, each listing its subcategory controls sourced
  from NIST SP 1300.
- Lets you check off controls per business; progress rings update live.
  Progress is stored only in your browser (`localStorage`) — no backend
  database.
- Shows a status indicator (green/red/amber dot) for whether the bundled
  control list matches NIST's current published CSF 2.0 source. A daily
  Cron Trigger re-checks automatically; a "Check Now" button checks on
  demand.

## How freshness-checking works

NIST doesn't expose a small versioned API for CSF 2.0 content, so the Worker
fetches NIST's official CSF 2.0 export from the Cybersecurity and Privacy
Reference Tool (CPRT):

```
https://csrc.nist.gov/extensions/nudp/services/json/csf/download?olirids=all
```

That .xlsx re-embeds a generation timestamp on every request, so hashing the
whole file would never match twice even when nothing changed. The actual
Function/Category/Subcategory/Implementation Example text lives in one zip
entry, `xl/sharedStrings.xml`, which NIST regenerates byte-identical when the
content hasn't changed. The Worker unzips the response in memory (via
`fflate`), hashes (SHA-256) just that entry, and compares it against
`BASELINE_HASH` in `wrangler.toml` — the hash captured the day a human last
reviewed `src/controls.js` against NIST and confirmed it was accurate. If
NIST changes the CSF content, that hash no longer matches and the dashboard
flags "Update available" so you know to re-review `src/controls.js` manually
(NIST publishes no machine-readable diff, so a human check is still required
— this only tells you *when* to look).

To re-baseline after you've reviewed and updated `src/controls.js`:

```
npm run capture-baseline
```

Paste the printed hash into `BASELINE_HASH` in `wrangler.toml`, then
`npm run deploy`.

## Setup

```
npm install
npx wrangler login
npx wrangler kv namespace create CSF_KV
# paste the returned id into wrangler.toml under [[kv_namespaces]]
npm run dev      # local preview
npm run deploy   # deploy to Cloudflare
```

## Source

Controls: NIST SP 1300, https://doi.org/10.6028/NIST.SP.1300 (Feb 2024).
This is a supplement, not a replacement, for the full NIST Cybersecurity
Framework 2.0 — see https://www.nist.gov/cyberframework.

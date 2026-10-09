# NIST CSF 2.0 Small Business Dashboard

A small Cloudflare Worker that renders the controls from NIST SP 1300
("NIST Cybersecurity Framework 2.0: Small Business Quick-Start Guide") as an
interactive, visual dashboard, and tracks whether its bundled control list is
still in sync with NIST's live CSF 2.0 reference data.

## What it does

- Renders all six CSF 2.0 Functions (Govern, Identify, Protect, Detect,
  Respond, Recover) as an overview with per-function progress bars, each
  linking to its own detail page listing that function's controls.
- Two views, toggled from the toolbar: **Small Business Quick-Start**
  (NIST SP 1300's 42 sample actions) and **Full CSF 2.0 Core** (the complete,
  official 106-subcategory Core — see `src/full-core.js`), each with its own
  progress tracked separately.
- Per-control notes (how it's implemented, owner, evidence) alongside the
  checkbox. The full-core view also shows each subcategory's real
  Implementation Examples and Informative References (ISO 27001, SP 800-53,
  PCI DSS, etc.) in a collapsible panel.
- Export the current view as CSV, or print/save as PDF, for handing to an
  insurer, auditor, or vendor. "Save progress file" / "Load progress file"
  round-trips all progress and notes as a JSON file, so you can move between
  browsers/devices or share with an MSSP.
- Everything (checkboxes, notes) is stored only in your browser
  (`localStorage`) — no backend database, no accounts.
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

## Keeping the Full Core in sync

`src/full-core.js` is a generated, checked-in snapshot of the real CSF 2.0
Core (6 Functions, 22 Categories, 106 Subcategories, with Implementation
Examples and Informative References), parsed out of the same NIST export
used for freshness-checking. NIST's raw export also bundles legacy CSF 1.1
categories and "[Withdrawn]" subcategory placeholders from the OLIR
crosswalk data; `scripts/generate-full-core.mjs` filters those out and
sanity-checks the result against the known, stable totals (6/22/106) before
writing the file — it throws rather than write bad data if NIST ever
restructures the export.

When the freshness check flags "Update available," re-run:

```
npm run generate-full-core
```

review the diff in `src/full-core.js`, then re-run `npm run capture-baseline`
and `npm run deploy`.

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

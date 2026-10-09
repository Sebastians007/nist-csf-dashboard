// One-off generator: downloads NIST's live CSF 2.0 export, parses the real
// Function/Category/Subcategory/Implementation-Examples/Informative-References
// table out of it, and writes src/full-core.js. Re-run this after a real
// NIST content change (i.e. after the freshness check flags "Update
// available") to refresh the bundled full-core dataset, then re-run
// `npm run capture-baseline` and redeploy.
import { unzipSync, strFromU8 } from 'fflate';
import { writeFileSync } from 'node:fs';

const SOURCE_URL = 'https://csrc.nist.gov/extensions/nudp/services/json/csf/download?olirids=all';

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`NIST source returned ${res.status}`);
const buf = new Uint8Array(await res.arrayBuffer());
const files = unzipSync(buf);

const sharedStringsXml = strFromU8(files['xl/sharedStrings.xml']);
const sheetXml = strFromU8(files['xl/worksheets/sheet2.xml']);

// Shared strings: each <si>...</si> may contain one or more <t> runs (rich text).
function parseSharedStrings(xml) {
  const strings = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    // Runs can be self-closing (<t/>, an empty run) or normal (<t>...</t>); a regex that
    // only looks for "<t...>...</t>" will treat a self-closed tag's ">" as an opening tag
    // and greedily consume everything up to the *next* real "</t>", corrupting the text.
    const tRe = /<t[^>]*\/>|<t[^>]*>([\s\S]*?)<\/t>/g;
    let text = '';
    let tm;
    while ((tm = tRe.exec(m[1]))) text += tm[1] || '';
    strings.push(decodeXmlEntities(text));
  }
  return strings;
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colToIndex(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1; // 0-based
}

function parseRows(xml, sharedStrings) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const cells = {};
    const cellRe = /<c r="([A-Z]+)\d+"([^>]*)(?:\/>|>(?:<v>([\s\S]*?)<\/v>)?<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(rm[1]))) {
      const col = cm[1];
      const isString = /\bt="s"/.test(cm[2]);
      const raw = cm[3];
      if (raw === undefined) continue;
      const value = isString ? sharedStrings[Number(raw)] : raw;
      cells[colToIndex(col)] = value;
    }
    rows.push(cells);
  }
  return rows;
}

const sharedStrings = parseSharedStrings(sharedStringsXml);
const rows = parseRows(sheetXml, sharedStrings).slice(2); // skip title + header rows

// Columns: A=Function, B=Category, C=Subcategory, D=Implementation Examples, E=Informative References
const functions = [];
let currentFn = null;
let currentCat = null;

const FN_ID_RE = /^([A-Z]+)\s*\(([A-Z]{2})\)\s*:?\s*(.*)$/s; // "GOVERN (GV): description"
const CAT_ID_RE = /^(.*?)\s*\(([A-Z]{2}\.[A-Z]{2})\)\s*:?\s*(.*)$/s; // "Category Name (GV.OC): description"
const SUBCAT_ID_RE = /^([A-Z]{2}\.[A-Z]{2}-\d{2})\s*:?\s*(.*)$/s; // "GV.OC-01: description"

for (const row of rows) {
  const a = row[0]; // Function
  const b = row[1]; // Category
  const c = row[2]; // Subcategory
  const d = row[3]; // Implementation Examples
  const e = row[4]; // Informative References

  if (a) {
    const m = a.match(FN_ID_RE);
    if (m) {
      const existing = functions.find((f) => f.id === m[2]);
      if (existing) {
        currentFn = existing;
      } else {
        currentFn = { id: m[2], name: capitalize(m[1]), description: m[3].trim(), categories: [] };
        functions.push(currentFn);
      }
    }
  }
  if (b) {
    const m = b.match(CAT_ID_RE);
    if (m && currentFn) {
      const existing = currentFn.categories.find((cat) => cat.id === m[2]);
      if (existing) {
        currentCat = existing;
      } else {
        currentCat = { id: m[2], name: m[1].trim(), description: m[3].trim(), subcategories: [] };
        currentFn.categories.push(currentCat);
      }
    }
  }
  if (c) {
    const m = c.match(SUBCAT_ID_RE);
    const isWithdrawn = m && /^\[Withdrawn/i.test(m[2]);
    if (m && currentCat && !isWithdrawn && !currentCat.subcategories.some((s) => s.id === m[1])) {
      currentCat.subcategories.push({
        id: m[1],
        text: m[2].trim(),
        examples: d ? d.trim() : '',
        references: e ? e.trim() : '',
      });
    }
  }
}

function capitalize(s) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

// The OLIR export (olirids=all) interleaves legacy CSF 1.1 category mappings into the same
// columns as the real CSF 2.0 Core, so the raw parse above picks up stale categories like
// PR.AC/PR.IP/ID.BE/DE.DP that no longer exist in CSF 2.0. Filter to the 22 real CSF 2.0
// category codes (stable since the Feb 2024 release) to get only the current Core.
const VALID_CATEGORIES = new Set([
  'GV.OC', 'GV.RM', 'GV.RR', 'GV.PO', 'GV.OV', 'GV.SC',
  'ID.AM', 'ID.RA', 'ID.IM',
  'PR.AA', 'PR.AT', 'PR.DS', 'PR.PS', 'PR.IR',
  'DE.CM', 'DE.AE',
  'RS.MA', 'RS.AN', 'RS.CO', 'RS.MI',
  'RC.RP', 'RC.CO',
]);
for (const fn of functions) {
  fn.categories = fn.categories.filter((cat) => VALID_CATEGORIES.has(cat.id));
}

const totalCat = functions.reduce((acc, f) => acc + f.categories.length, 0);
const totalSub = functions.reduce((acc, f) => acc + f.categories.reduce((a, c) => a + c.subcategories.length, 0), 0);
console.error(`Parsed ${functions.length} functions, ${totalCat} categories, ${totalSub} subcategories.`);
if (functions.length !== 6 || totalCat !== 22 || totalSub !== 106) {
  throw new Error(`Sanity check failed: expected 6 functions, 22 categories, 106 subcategories (the known, stable CSF 2.0 Core totals). Got ${functions.length}/${totalCat}/${totalSub}. NIST sheet layout may have changed — inspect sheet2.xml manually before trusting this output.`);
}

const out = `// GENERATED by scripts/generate-full-core.mjs — do not hand-edit.
// Source: NIST CSF 2.0 Reference Tool export, https://csrc.nist.gov/projects/cprt/catalog
// Regenerate after a real NIST content change (see README "Keeping the full Core in sync").
export const FULL_CORE = ${JSON.stringify(functions, null, 2)};
`;

writeFileSync(new URL('../src/full-core.js', import.meta.url), out);
console.error('Wrote src/full-core.js');

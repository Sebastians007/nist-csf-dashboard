// Re-run this whenever you've re-reviewed src/controls.js against NIST, then paste the
// printed hash into wrangler.toml's BASELINE_HASH.
import { unzipSync } from 'fflate';

const SOURCE_URL = 'https://csrc.nist.gov/extensions/nudp/services/json/csf/download?olirids=all';

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`NIST source returned ${res.status}`);
const buf = await res.arrayBuffer();
const files = unzipSync(new Uint8Array(buf));
const sharedStrings = files['xl/sharedStrings.xml'];
if (!sharedStrings) throw new Error('NIST export did not contain xl/sharedStrings.xml');
const digest = await crypto.subtle.digest('SHA-256', sharedStrings);
const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
console.log(hex);

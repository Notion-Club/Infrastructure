// Canonical build for the NotionClub DS sync. Run from repo root:
//   node .design-sync/build.mjs
// Steps:
//  1. Regenerate entry.mjs + componentSrcMap from the component sources.
//  2. Compile Tailwind v4 (globals.css + brand-font body rule) -> cssEntry.
//  3. Run the converter (package-build.mjs) -> ds-bundle/.
//  4. Escape non-ASCII in _ds_bundle.js (esbuild emits regex/string bytes
//     verbatim; this makes the bundle charset-independent).
//  5. Re-stamp _ds_sync.json's bundleSha12 to match the escaped bundle.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sh = (c) => execSync(c, { stdio: 'inherit' });
sh('node .design-sync/gen.mjs');
sh('npx -y @tailwindcss/cli@4 -i .design-sync/tw-input.css -o .design-sync/styles.compiled.css');
sh('node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle');
// escape non-ASCII
const f = 'ds-bundle/_ds_bundle.js';
const s = readFileSync(f, 'utf8');
let n = 0;
writeFileSync(f, s.replace(/[-￿]/g, (c) => { n++; return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'); }));
console.log(`escaped ${n} non-ASCII char(s) in ${f}`);
// re-stamp anchor bundleSha12
const anchorPath = 'ds-bundle/_ds_sync.json';
const anchor = JSON.parse(readFileSync(anchorPath, 'utf8'));
anchor.bundleSha12 = createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 12);
writeFileSync(anchorPath, JSON.stringify(anchor, null, 2) + '\n');
console.log('re-stamped bundleSha12 =', anchor.bundleSha12);

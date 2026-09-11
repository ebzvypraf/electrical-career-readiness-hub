import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../curriculum/apply-gate-bridge-v1.js', import.meta.url), 'utf8');

assert.match(source, /APPLY_GATE_BRIDGE_VERSION\s*=\s*['"]1\.1\.0['"]/);
assert.match(source, /applicationNotes:\s*''/);
assert.match(source, /applicationEvidence:\s*evidence\s*\|\|\s*null/);
assert.match(source, /if \(ready\(evidence\)\)/);
assert.match(source, /applicationNotes:\s*String\(args\.context\?\.applicationNotes \|\| ''\)\.trim\(\) \|\| '\[structured Apply evidence complete\]'/);

console.log('Apply gate contract: legacy application notes cannot bypass incomplete structured Apply evidence.');

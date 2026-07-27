import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));

const plan = execFileSync(process.execPath, ['semantic-quality-release-check.mjs'], {
  cwd: directory,
  encoding: 'utf8'
});
assert.match(plan, /Real text API rerun triggers:/);
assert.match(plan, /opinion-stable-delivery-001/);
assert.match(plan, /No text API required:/);

const verification = execFileSync(process.execPath, [
  'semantic-quality-release-check.mjs',
  '--verify',
  'semantic-quality-results.baseline.json'
], {
  cwd: directory,
  encoding: 'utf8'
});
assert.match(verification, /Semantic quality release check passed\./);

console.log('Semantic quality release workflow is covered.');

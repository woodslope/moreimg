import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(await readFile(new URL('../fixtures/semantic-quality-baseline.json', import.meta.url), 'utf8'));

assert.equal(fixture.schema_version, 'moreimg-semantic-quality-1');
assert.equal(Array.isArray(fixture.rerun_triggers), true);
assert.equal(Array.isArray(fixture.no_text_api_required_for), true);
assert.equal(fixture.samples.length, 3, '语义黄金样本应覆盖观点、教程、复盘故事三种文体');

const ids = new Set();
for (const sample of fixture.samples) {
  assert.equal(ids.has(sample.id), false, `样本 ID 不得重复: ${sample.id}`);
  ids.add(sample.id);
  assert.ok(sample.genre);
  assert.ok(sample.text.length >= sample.input_char_range[0]);
  assert.ok(sample.text.length <= sample.input_char_range[1]);
  assert.ok(sample.output_char_range[0] < sample.output_char_range[1]);
  assert.ok(sample.page_range[0] <= sample.page_range[1]);
  assert.ok(sample.must_preserve.length > 0);
  assert.ok(sample.fact_boundary.length > 0);
}

assert.deepEqual(
  fixture.samples.map(sample => sample.genre),
  ['观点文', '教程文', '复盘故事文']
);

console.log('Semantic quality baseline fixtures are valid.');

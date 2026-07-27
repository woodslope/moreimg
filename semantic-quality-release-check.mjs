import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const fixture = JSON.parse(await readFile(new URL('./semantic-quality-baseline.json', import.meta.url), 'utf8'));

const printPlan = () => {
  console.log('MoreImg semantic quality release plan');
  console.log('Real text API rerun triggers:');
  fixture.rerun_triggers.forEach(item => console.log(`- ${item}`));
  console.log('\nNo text API required:');
  fixture.no_text_api_required_for.forEach(item => console.log(`- ${item}`));
  console.log('\nGolden samples:');
  fixture.samples.forEach(sample => {
    console.log(`- ${sample.id} | ${sample.genre} | ${sample.text.length} chars | ${sample.page_range[0]}-${sample.page_range[1]} pages`);
  });
  console.log('\nVerify a recorded run:');
  console.log('node semantic-quality-release-check.mjs --verify semantic-quality-results.baseline.json');
};

const assertNoSecrets = (value, path = 'result') => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecrets(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert.doesNotMatch(key, /api.?key|authorization|secret|token/i, `结果文件不得包含敏感字段: ${path}.${key}`);
      assertNoSecrets(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string') {
    assert.doesNotMatch(value, /\bsk-[A-Za-z0-9_-]{8,}\b/, `结果文件疑似包含 API Key: ${path}`);
  }
};

const verifyRun = async resultPath => {
  const result = JSON.parse(await readFile(resolve(resultPath), 'utf8'));
  assert.equal(result.schema_version, 'moreimg-semantic-quality-result-1');
  assert.equal(result.scope, 'text-api-only');
  assertNoSecrets(result);

  const resultById = new Map(result.samples.map(sample => [sample.sample_id, sample]));
  assert.equal(resultById.size, fixture.samples.length, '结果必须且只能覆盖全部黄金样本');

  for (const sample of fixture.samples) {
    const observed = resultById.get(sample.id);
    assert.ok(observed, `缺少黄金样本结果: ${sample.id}`);
    assert.equal(observed.input_chars, sample.text.length, `${sample.id} 输入字数不匹配`);
    assert.ok(observed.article_chars >= sample.output_char_range[0], `${sample.id} 精修正文过短`);
    assert.ok(observed.article_chars <= sample.output_char_range[1], `${sample.id} 精修正文过长`);
    assert.ok(observed.page_count >= sample.page_range[0], `${sample.id} 卡片页数过少`);
    assert.ok(observed.page_count <= sample.page_range[1], `${sample.id} 卡片页数过多`);
    assert.equal(observed.warnings, 0, `${sample.id} 不应出现完整性警告`);
    assert.equal(observed.alerts, 0, `${sample.id} 不应出现阻断错误`);
    assert.equal(observed.empty_cards, 0, `${sample.id} 不应出现空卡片`);
    assert.equal(observed.duplicate_cards, 0, `${sample.id} 不应出现重复卡片`);
    assert.equal(observed.text_api_requests, 1, `${sample.id} 必须保持单次文本 API 请求`);
    assert.equal(observed.image_api_requests, 0, `${sample.id} 语义回归不得调用图片 API`);
    assert.deepEqual(observed.checks, {
      must_preserve: true,
      fact_boundary: true,
      no_invention: true
    }, `${sample.id} 人工语义检查未全部通过`);
  }

  console.log('Semantic quality release check passed.');
};

const [command, value] = process.argv.slice(2);
if (!command) {
  printPlan();
} else if (command === '--verify' && value) {
  await verifyRun(value);
} else {
  throw new Error('Usage: node semantic-quality-release-check.mjs [--verify result.json]');
}

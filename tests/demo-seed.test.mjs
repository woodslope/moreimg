import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 首次启动示例记录（demo.js）的单元回归：物料包 schema 合法、页面标题连续、历史记录结构完整。
// 与 json-package.test.mjs 相同方式：从 src.html 提取浏览器模块源码后隔离求值。

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');

const packageBlock = source.match(/const MOREIMG_SCHEMA_VERSION = [\s\S]*?(?=\n\s*const isResponsesApiEndpoint)/)?.[0];
const demoBlock = source.match(/\/\/ 首次启动示例记录[\s\S]*?\n\s*const loadDemoHistory = async \(\) => \{[\s\S]*?\n\s*\};/)?.[0];

assert.ok(packageBlock, '源码中应存在 moreimg-1.0 JSON 解析与校验入口');
assert.ok(demoBlock, '源码中应存在首次启动示例记录模块');

const helpers = Function(`${packageBlock}\n${demoBlock}\nreturn {
  validateMoreImgPackage,
  demoPackageData,
  demoOriginalText,
  DEMO_SESSION_ID,
  demoPageTitles,
  createDemoSessionRecord,
  loadDemoHistory
};`)();

assert.equal(typeof helpers.loadDemoHistory, 'function', '应提供手动载入示例的 loadDemoHistory（幂等，供「载入示例」按钮使用）');

// 1. 物料包必须通过完整 schema 校验（含正文保留率）
const result = helpers.validateMoreImgPackage(helpers.demoPackageData, helpers.demoOriginalText);
assert.equal(result.isComplete, true, '示例物料包应通过校验');
assert.equal(result.canContinue, true, '示例物料包应允许继续');
assert.equal(result.errors.length, 0, `不应有校验错误: ${result.errors.join('; ')}`);
assert.equal(result.warning, '', `不应有警告: ${result.warning}`);

// 2. 页面结构：封面 + 正文 + 封底，标题连续且与视觉页标签一致
const titles = helpers.demoPageTitles();
assert.deepEqual(titles, ['封面', '正文1/3', '正文2/3', '正文3/3', '封底'], '示例页标题应连续');
assert.equal(helpers.demoPackageData.pages[0].page_id, 'cover');
assert.equal(helpers.demoPackageData.pages.at(-1).page_id, 'closing');

// 3. 历史记录结构完整，能驱动恢复链路
const record = helpers.createDemoSessionRecord();
assert.equal(record.id, helpers.DEMO_SESSION_ID);
assert.equal(record.isDemo, true);
assert.equal(record.sessionData.packageData, helpers.demoPackageData, '记录应携带完整物料包');
assert.equal(record.sessionData.isHalted, false);
assert.equal(record.sessionData.finishReason, 'stop');
assert.ok(record.originalInput.length >= 600, '示例原文应足够长以便展示标准模式');
assert.equal(record.title, '示例：AI 时代如何稳定交付');

// 4. 示例图片生成应为每页提供 visual-only 与 full 两种模式（由 seed 流程使用）
const pageCount = helpers.demoPackageData.pages.length;
assert.equal(titles.length, pageCount);
console.log('demo-seed: 示例物料包合法，页标题连续，历史记录结构完整，共', pageCount, '页。');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./src.html', import.meta.url), 'utf8');
const parserBlock = source.match(/const parseStreamedText = [\s\S]*?\n\s*};(?=\n)/)?.[0];
const retryBlock = source.match(/const PROCESSING_MAX_OUTPUT_TOKENS = [\s\S]*?(?=\n\s*const cleanCardValue)/)?.[0];
const cardParserBlock = source.match(/const cleanCardValue[\s\S]*?(?=\n\s*const HTML_CARD_EXPORT_STYLES)/)?.[0];

assert.ok(parserBlock, '源码中应存在阶段解析器');
assert.ok(retryBlock, '源码中应存在完整性检查逻辑');
assert.ok(cardParserBlock, '源码中应存在卡片解析器');
const helpers = Function(`${parserBlock}\n${retryBlock}\n${cardParserBlock}; return { assessProcessingResult, applyProcessingFinishReason, buildInitialProcessingMessages, formatProcessingError };`)();

const originalArticle = '这是一篇有明确主题、三个分论点和完整案例的长文。'.repeat(100);
const shallowButPackaged = `阶段1\n通过\n阶段2\n无问题\n阶段3\n已精修\n阶段4\n**封面卡片**\n主标题：测试\n**正文卡片 1/1**\n标题：正文\n**封底卡片**\n核心总结：完成\n阶段5\n### [封面]\n提示词\n### [正文1/1]\n提示词\n### [封底]\n提示词\n阶段6\n检查通过`;
const shallowAssessment = helpers.assessProcessingResult(shallowButPackaged, originalArticle);

const mismatchedPackage = `
阶段1
判型结论：通过
阶段2
事实核查：无异常
阶段3
精修版文章
完整正文
阶段4
**封面卡片**
主标题：测试
**正文卡片 1/2**
标题：正文一
**正文卡片 2/2**
标题：正文二
**封底卡片**
核心总结：完成
阶段5
### [封面]
提示词
### [正文1/2]
提示词
### [封底]
提示词
阶段6
检查通过`;
const mismatchedAssessment = helpers.assessProcessingResult(mismatchedPackage);

assert.equal(mismatchedAssessment.canContinue, false);
assert.match(mismatchedAssessment.reason, /卡片与提示词未一一对应/);

const gappedPackage = mismatchedPackage
  .replace('**正文卡片 2/2**', '**正文卡片 3/3**')
  .replace('### [正文1/2]', '### [正文1/3]')
  .replace('### [封底]', '### [正文3/3]\n提示词\n### [封底]');
const gappedAssessment = helpers.assessProcessingResult(gappedPackage);
assert.equal(gappedAssessment.canContinue, false);
assert.match(gappedAssessment.reason, /卡片与提示词未一一对应/);

const duplicatedPackage = mismatchedPackage
  .replace('**正文卡片 2/2**', '**正文卡片 1/2**')
  .replace('### [封底]', '### [正文1/2]\n重复提示词\n### [封底]');
const duplicatedAssessment = helpers.assessProcessingResult(duplicatedPackage);
assert.equal(duplicatedAssessment.canContinue, false);
assert.match(duplicatedAssessment.reason, /卡片与提示词未一一对应/);

const duplicatedPromptPackage = mismatchedPackage
  .replace('### [封底]', '### [正文2/2]\n提示词\n### [正文2/2]\n重复提示词\n### [封底]');
const duplicatedPromptAssessment = helpers.assessProcessingResult(duplicatedPromptPackage);
assert.equal(duplicatedPromptAssessment.canContinue, false);
assert.match(duplicatedPromptAssessment.reason, /卡片与提示词未一一对应/);

assert.equal('shouldRetry' in shallowAssessment, false);
assert.match(shallowAssessment.reason, /阶段1至3内容过于简略/);
assert.match(helpers.buildInitialProcessingMessages(originalArticle, '系统指令')[1].content, /只返回 moreimg-1\.0 JSON/);
assert.match(helpers.buildInitialProcessingMessages(originalArticle, '系统指令')[1].content, /固定包含封面和封底/);
assert.doesNotMatch(source, /ensureCompactStage3Content/);
assert.doesNotMatch(source, /retryCount|自动重试/);
assert.doesNotMatch(source, /mergeSupplementalAnalysis/);
assert.doesNotMatch(source, /buildProcessingDepthRequirement/);
assert.doesNotMatch(source, /const buildProcessingMessages =/);
assert.match(source, /const PROCESSING_MAX_OUTPUT_TOKENS = 12000/);
assert.equal(
  helpers.formatProcessingError(new Error('(HTTP 524)')),
  '上游模型服务响应超时（HTTP 524），请稍后重试或换用响应更快的文本模型。'
);

const truncated = helpers.applyProcessingFinishReason(helpers.assessProcessingResult(shallowButPackaged), 'length');
assert.equal(truncated.canContinue, false);
assert.match(truncated.reason, /输出达到 12000 Token 上限/);

console.log('Single-request processing preserves model output without automatic repair semantics.');

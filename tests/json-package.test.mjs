import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');
const helperBlock = source.match(/const MOREIMG_SCHEMA_VERSION = [\s\S]*?(?=\n\s*const isResponsesApiEndpoint)/)?.[0];

assert.ok(helperBlock, '源码中应存在 moreimg-1.0 JSON 解析与校验入口');

const helpers = Function(`${helperBlock}; return {
  parseMoreImgPackage,
  validateMoreImgPackage,
  buildPageImagePrompt,
  buildInitialProcessingMessages,
  createDefaultProcessingPreferences
};`)();

const createValidPackage = () => ({
  schema_version: 'moreimg-1.0',
  status: 'complete',
  analysis: {
    mode: 'standard',
    topic: '设计师转型',
    core_claim: '把判断力放到更上游',
    independent_units: ['指挥AI'],
    fact_notes: [],
    logic_issues: []
  },
  article: {
    title: '35岁UI设计师的出路',
    subtitle: '潮水换方向，先造船',
    paragraphs: ['这是第一段完整正文。', '这是第二段完整正文。']
  },
  style_lock: {
    style_id: 'navy-orange-flat-vector',
    style_name: '深蓝暖橙扁平叙事',
    card_shell: {
      preset: 'moreimg-clean-v1',
      surface: 'dark',
      accent_color: '#F59E42',
      overlay: 'soft_dark'
    },
    prompt_prefix: '深蓝与暖橙配色的2D扁平矢量视觉，统一航海世界。',
    visual_dna: {
      medium: 'flat_vector',
      visual_world: '统一航海世界',
      shape_language: '简洁几何块面',
      perspective: '轻微等距视角',
      lighting: '柔和均匀光',
      material: '哑光矢量质感',
      recurring_subject: '同一位设计师和同一艘船',
      recurring_elements: ['深蓝海面', '暖橙航线']
    },
    negative: ['文字', 'Logo', '伪文字']
  },
  pages: [
    {
      page_id: 'cover',
      order: 1,
      page_type: 'cover',
      card: { title: '35岁UI设计师', subtitle: '出路在哪里', points: [], summary: '潮水换方向，先造船' },
      semantic: {
        page_goal: '提出问题',
        primary_claim: '设计师需要主动转型',
        primary_concept: '设计师与AI浪潮',
        primary_relation: '环境变化推动主动转型',
        supporting_concepts: [],
        excluded_concepts: [],
        avoid_misread: ['不要表达成必然失业']
      },
      image_prompt: {
        scene: '设计师站在改变方向的潮流前',
        relationship: '潮流变化推动设计师造船',
        composition: '主体位于下半部',
        safe_area: 'top_40',
        continuity: '沿用同一人物和航海世界',
        avoid: ['灾难场景']
      }
    },
    {
      page_id: 'content-01',
      order: 2,
      page_type: 'relationship',
      card: { title: '从执行者到指挥家', subtitle: '', points: ['调度AI', '筛选方案'], summary: '判断比手速重要' },
      semantic: {
        page_goal: '解释第一条路径',
        primary_claim: '设计师应指挥AI',
        primary_concept: '设计师',
        primary_relation: '设计师调度AI能力单元',
        supporting_concepts: ['筛选'],
        excluded_concepts: [],
        avoid_misread: ['不要画成AI指挥设计师']
      },
      image_prompt: {
        scene: '设计师在控制台前调度能力模块',
        relationship: '设计师控制多个AI能力单元',
        composition: '中心人物位于下半部',
        safe_area: 'top_52',
        continuity: '沿用同一人物和航海世界',
        avoid: ['音乐厅']
      }
    },
    {
      page_id: 'closing',
      order: 3,
      page_type: 'quote',
      card: { title: '潮水换方向，先造船', subtitle: '', points: [], summary: '把判断力变成解决方案' },
      semantic: {
        page_goal: '自然收束',
        primary_claim: '主动造船才是出路',
        primary_concept: '设计师的下一步',
        primary_relation: '经验沉淀推动主动转型',
        supporting_concepts: [],
        excluded_concepts: [],
        avoid_misread: ['不要新增关注引导']
      },
      image_prompt: {
        scene: '同一位设计师驾驶完成的船驶向开阔水面',
        relationship: '主动造船通向新海域',
        composition: '船与人物位于下半部',
        safe_area: 'top_36',
        continuity: '沿用同一人物、船和航海世界',
        avoid: ['文字标语']
      }
    }
  ]
});

const originalText = '这是一篇足够长的原文，用于验证标准模式完整正文不会被错误识别为摘要。'.repeat(6);
assert.equal(helpers.createDefaultProcessingPreferences().preserveTitle, true);
const validPackage = createValidPackage();
validPackage.article.paragraphs = [originalText.slice(0, Math.ceil(originalText.length * 0.7))];

const parsed = helpers.parseMoreImgPackage(JSON.stringify(validPackage), originalText);
assert.equal(parsed.packageData.schema_version, 'moreimg-1.0');
assert.equal(parsed.packageData.pages.at(-1).page_id, 'closing');
assert.equal(parsed.isComplete, true);

const longPointPackage = createValidPackage();
longPointPackage.pages[1].card.points = ['这是一条超过二十五个字符但仍然有完整语义的卡片要点内容'];
const longPointResult = helpers.validateMoreImgPackage(longPointPackage, originalText);
assert.equal(longPointResult.isComplete, true, '要点长度不应影响完整结果');
assert.equal(longPointResult.canContinue, true, '要点超出建议长度不应阻断策划结果');
assert.equal(longPointResult.warning, '');

const longSummaryPackage = createValidPackage();
longSummaryPackage.pages[1].card.summary = '这是一条超过二十个字符但仍然有完整语义的卡片总结内容';
const longSummaryResult = helpers.validateMoreImgPackage(longSummaryPackage, originalText);
assert.equal(longSummaryResult.isComplete, true, '总结长度不应影响完整结果');
assert.equal(longSummaryResult.canContinue, true, '总结超出建议长度不应阻断策划结果');
assert.equal(longSummaryResult.warning, '');

const createSourceText = length => '文'.repeat(length);
for (const length of [20, 599]) {
  const sourceText = createSourceText(length);
  const compactPackage = createValidPackage();
  compactPackage.analysis.mode = length === 20 ? 'single_point' : 'short';
  compactPackage.article.paragraphs = [sourceText];
  assert.equal(
    helpers.validateMoreImgPackage(compactPackage, sourceText).isComplete,
    true,
    `${length} 字紧凑内容应通过完整包校验`
  );
}

for (const length of [600, 2000, 5000, 10000]) {
  const sourceText = createSourceText(length);
  const minimumRetainedLength = Math.floor(length * 0.65);
  const completePackage = createValidPackage();
  completePackage.article.paragraphs = ['文'.repeat(minimumRetainedLength)];
  assert.equal(
    helpers.validateMoreImgPackage(completePackage, sourceText).isComplete,
    true,
    `${length} 字标准模式正文达到 65% 保留率时应通过`
  );
  const completeResult = helpers.validateMoreImgPackage(completePackage, sourceText);
  assert.equal(completeResult.canContinue, true);
  assert.equal(completeResult.warning, '');

  const warningPackage = createValidPackage();
  warningPackage.article.paragraphs = ['文'.repeat(Math.floor(length * 0.4))];
  const warningResult = helpers.validateMoreImgPackage(warningPackage, sourceText);
  assert.equal(warningResult.isComplete, false, `${length} 字标准模式正文保留 40% 时应标记未完全通过`);
  assert.equal(warningResult.canContinue, true, `${length} 字标准模式正文保留 40% 时仍应允许继续`);
  assert.match(warningResult.warning, /低于 65%/);

  const minimumWarningPackage = createValidPackage();
  minimumWarningPackage.article.paragraphs = ['文'.repeat(Math.floor(length * 0.3))];
  const minimumWarningResult = helpers.validateMoreImgPackage(minimumWarningPackage, sourceText);
  assert.equal(minimumWarningResult.isComplete, false, `${length} 字标准模式正文保留 30% 时应标记未完全通过`);
  assert.equal(minimumWarningResult.canContinue, true, `${length} 字标准模式正文保留 30% 时仍应允许继续`);
  assert.match(minimumWarningResult.warning, /低于 65%/);

  const blockedPackage = createValidPackage();
  blockedPackage.article.paragraphs = ['文'.repeat(Math.floor(length * 0.29))];
  const blockedResult = helpers.validateMoreImgPackage(blockedPackage, sourceText);
  assert.equal(blockedResult.isComplete, false, `${length} 字标准模式正文低于 30% 时应拒绝`);
  assert.equal(blockedResult.canContinue, false);
  assert.match(blockedResult.reason, /低于 30%/);
}

const missingClosing = createValidPackage();
missingClosing.pages.pop();
const invalidClosing = helpers.validateMoreImgPackage(missingClosing, originalText);
assert.equal(invalidClosing.isComplete, false);
assert.match(invalidClosing.reason, /closing|封底/);

const fencedPackage = helpers.parseMoreImgPackage(`\n模型说明：以下是结果。\n\n\`\`\`json\n${JSON.stringify(validPackage)}\n\`\`\`\n`, originalText);
assert.equal(fencedPackage.packageData.schema_version, 'moreimg-1.0');
const wrappedPackage = helpers.parseMoreImgPackage(`结果如下：${JSON.stringify(validPackage)}\n以上。`, originalText);
assert.equal(wrappedPackage.packageData.schema_version, 'moreimg-1.0');

const modelVariantPackage = createValidPackage();
modelVariantPackage.style_lock.negative = '文字、Logo、水印';
modelVariantPackage.pages[1].card.title = '';
modelVariantPackage.pages[1].card.subtitle = '由语义字段补齐标题';
const normalizedVariant = helpers.parseMoreImgPackage(JSON.stringify(modelVariantPackage), originalText);
assert.equal(normalizedVariant.canContinue, true, '可无损修正的模型格式偏差不应阻断结果');
assert.deepEqual(normalizedVariant.packageData.style_lock.negative, ['文字', 'Logo', '水印']);
assert.equal(normalizedVariant.packageData.pages[1].card.title, '由语义字段补齐标题');
assert.match(normalizedVariant.warning, /style_lock\.negative|card\.title/);

const visualPrompt = helpers.buildPageImagePrompt(validPackage.style_lock, validPackage.pages[0]);
assert.match(visualPrompt, /深蓝与暖橙配色/);
assert.match(visualPrompt, /设计师站在改变方向的潮流前/);
assert.match(visualPrompt, /顶部约40%作为文字承载范围/);
assert.match(visualPrompt, /不能成为纯色留白或空雾占位/);
assert.match(visualPrompt, /主场景轮廓从画面中部开始清晰出现/);
assert.match(visualPrompt, /不得出现任何文字/);

const preferences = helpers.createDefaultProcessingPreferences();
const messages = helpers.buildInitialProcessingMessages('用户原文', '隐藏规则', {
  ...preferences,
  pageCount: '5',
  tone: 'concise',
  customInstruction: '保留第一人称'
});
assert.equal(messages.length, 2, '文本加工仍应只构造一组 system + user 消息');
assert.equal(messages[0].content, '隐藏规则');
assert.match(messages[1].content, /总页数：5页/);
assert.match(messages[1].content, /保留第一人称/);

assert.match(source, /加工偏好/);
assert.match(source, /MoreImg v6/);
assert.doesNotMatch(source, /<textarea\s+value=\{apiConfig\.systemPrompt\}/);
assert.doesNotMatch(source, />内容加工规则</);
assert.match(source, /const getCardShellPresentation =/);
assert.match(source, /styleLock=\{currentSession\.packageData\?\.style_lock\}/);
assert.match(source, /--moreimg-card-accent/);
assert.match(source, /moreimg-card-surface-light/);

console.log('moreimg-1.0 JSON package contract and hidden-rule preferences are covered.');

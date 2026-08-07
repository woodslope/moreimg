import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');
const helperBlock = source.match(/const MOREIMG_SCHEMA_VERSION = [\s\S]*?(?=\n\s*const isResponsesApiEndpoint)/)?.[0];

assert.ok(helperBlock, '应能提取 moreimg-1.0 校验与执行提示词拼合逻辑');

const { buildPageImagePrompt } = Function(`${helperBlock}; return { buildPageImagePrompt };`)();

const styleLock = {
  prompt_prefix: 'STYLE_PREFIX_TOKEN',
  negative: ['GLOBAL_AVOID_TOKEN'],
  visual_dna: {
    medium: 'flat_vector',
    visual_world: 'VISUAL_DNA_ONLY_TOKEN'
  }
};
const page = {
  semantic: {
    primary_relation: 'SEMANTIC_ONLY_TOKEN'
  },
  image_prompt: {
    scene: 'SCENE_TOKEN',
    relationship: 'IMAGE_RELATION_TOKEN',
    composition: 'COMPOSITION_TOKEN',
    safe_area: 'top_40',
    continuity: 'CONTINUITY_TOKEN',
    avoid: ['LOCAL_AVOID_TOKEN']
  }
};

const executionPrompt = buildPageImagePrompt(styleLock, page);
assert.match(executionPrompt, /STYLE_PREFIX_TOKEN/);
assert.match(executionPrompt, /SCENE_TOKEN/);
assert.match(executionPrompt, /IMAGE_RELATION_TOKEN/);
assert.match(executionPrompt, /COMPOSITION_TOKEN/);
assert.match(executionPrompt, /顶部约40%/);
assert.match(executionPrompt, /背景、光影与环境结构仍须连续/);
assert.match(executionPrompt, /CONTINUITY_TOKEN/);
assert.match(executionPrompt, /GLOBAL_AVOID_TOKEN/);
assert.match(executionPrompt, /LOCAL_AVOID_TOKEN/);
assert.doesNotMatch(executionPrompt, /SEMANTIC_ONLY_TOKEN/, '前端拼合器不应伪装成 semantic 到 image_prompt 的推理器');
assert.doesNotMatch(executionPrompt, /VISUAL_DNA_ONLY_TOKEN/, 'visual_dna 当前不会被前端逐项展开');

assert.match(
  source,
  /const packagePageToPromptSection = \(page, styleLock, pages = \[\]\) => \(\{[\s\S]*?text: buildPageImagePrompt\(styleLock, page\)/,
  'JSON 页面应通过 buildPageImagePrompt 形成图片执行提示词'
);
assert.match(
  source,
  /const visualOnlyPrompt = isJsonPackage \? cleanPromptText : buildVisualOnlyPrompt\(cleanPromptText, matchingCard\)/,
  'JSON 路径应直接使用已拼合提示词，旧版路径才执行清洗'
);

const shellBlock = source.match(/const getCardShellPresentation = \(styleLock\) => \{[\s\S]*?(?=\n\s*const HTML_CARD_EXPORT_STYLES)/)?.[0];
assert.ok(shellBlock, '应能提取 HTML 卡片外壳映射逻辑');
const getCardShellPresentation = Function(
  'MOREIMG_OVERLAYS',
  `${shellBlock}; return getCardShellPresentation;`
)(new Set(['none', 'soft_dark', 'soft_light']));

const sharedShell = {
  preset: 'moreimg-clean-v1',
  surface: 'light',
  accent_color: '#237A57',
  overlay: 'soft_light'
};
const firstPresentation = getCardShellPresentation({
  card_shell: sharedShell,
  prompt_prefix: 'FIRST_STYLE_TOKEN',
  visual_dna: { visual_world: 'FIRST_WORLD_TOKEN' }
});
const secondPresentation = getCardShellPresentation({
  card_shell: sharedShell,
  prompt_prefix: 'SECOND_STYLE_TOKEN',
  visual_dna: { visual_world: 'SECOND_WORLD_TOKEN' }
});
assert.deepEqual(
  firstPresentation,
  secondPresentation,
  'HTML 外壳当前只由 card_shell 决定，不应解释自然语言 Style Lock'
);

console.log('Prompt pipeline boundaries are documented and protected.');

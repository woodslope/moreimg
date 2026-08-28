import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');

assert.match(source, /imageApiUrl:/);
assert.match(source, /imageModel:/);
assert.match(source, /imageApiKey:/);
assert.match(source, /imageSize:/);
assert.match(source, /imageSize: DEFAULT_IMAGE_RATIO/);
assert.match(source, /aspect_ratio/);
assert.match(source, /图片比例/);
assert.doesNotMatch(source, /图片尺寸[\s\S]*?实际请求：/);
assert.match(source, /handleGenerateImage/);
assert.match(source, /\/images\/generations/);
assert.match(source, /b64_json/);
assert.match(source, /生成无字主视觉/);
assert.match(source, /生成 AI 整图/);
assert.match(source, /AI 整图用于视觉候选/);
assert.match(source, /const buildVisualOnlyPrompt =/);
assert.match(source, /const buildFullImagePrompt =/);
assert.match(source, /const getCardVisibleText =/);
assert.match(source, /必须包含且只能包含以下文字/);

const visualPromptBlock = source.match(/const buildVisualOnlyPrompt = [\s\S]*?\n\s*};/)?.[0];
assert.ok(visualPromptBlock, '应能提取无字主视觉提示词构造器');
const buildVisualOnlyPrompt = Function(`${visualPromptBlock}; return buildVisualOnlyPrompt;`)();
const visualOnlyPrompt = buildVisualOnlyPrompt(
  '3:4比例，深红色系。用于封面卡片下半部，主体完整且视觉重心下沉，上半部保留干净区域供HTML标题排版。顶部标题「从执行者到指挥家」。中部表现一位指挥家和抽象设计乐团。底部总结「品位比手速重要」。',
  { title: '从执行者到指挥家', points: ['把AI当设计乐团来指挥'], summary: '品位比手速重要' }
);
assert.match(visualOnlyPrompt, /无文字主视觉/);
assert.match(visualOnlyPrompt, /不得出现任何文字/);
assert.match(visualOnlyPrompt, /只保留.*场景|只生成.*插图/);
assert.match(visualOnlyPrompt, /整张 3:4 卡片全幅背景/);
assert.match(visualOnlyPrompt, /背景自然延伸到四边/);
assert.match(visualOnlyPrompt, /不要内嵌图片框/);
assert.match(visualOnlyPrompt, /用于封面卡片下半部/);
assert.match(visualOnlyPrompt, /主体完整且视觉重心下沉/);
assert.doesNotMatch(visualOnlyPrompt, /从执行者到指挥家/);
assert.doesNotMatch(visualOnlyPrompt, /把AI当设计乐团来指挥/);
assert.doesNotMatch(visualOnlyPrompt, /品位比手速重要/);
assert.doesNotMatch(visualOnlyPrompt, /底部总结/);

const bodyVisualOnlyPrompt = buildVisualOnlyPrompt(
  '3:4比例，清新绿色与浅蓝。主关系是AI把反馈分入不同类别。核心主体占画面45%-65%，轮廓清晰。顶部55%保留文字区。',
  { type: 'body', title: '整理客户反馈', points: ['先分类', '再复核'], summary: '人做最终判断' }
);
assert.match(bodyVisualOnlyPrompt, /顶部约50%-52%/);
assert.match(bodyVisualOnlyPrompt, /主视觉重心位于中下部/);
assert.match(bodyVisualOnlyPrompt, /不能处理成大片纯色/);
assert.doesNotMatch(bodyVisualOnlyPrompt, /45%-65%/);
assert.doesNotMatch(bodyVisualOnlyPrompt, /核心比喻/);

const fullPromptBlock = source.match(/const buildFullImagePrompt = [\s\S]*?\n\s*};/)?.[0];
assert.ok(fullPromptBlock, '应能提取 AI 整图提示词构造器');
const buildFullImagePrompt = Function('getCardVisibleText', `${fullPromptBlock}; return buildFullImagePrompt;`)(card => card ? [card.title, card.subtitle, ...(card.points || []), card.summary].filter(Boolean) : []);
const fullPrompt = buildFullImagePrompt('视觉描述', { title: '正文标题', points: ['要点一', '要点二'], summary: '一句总结' });
assert.match(fullPrompt, /「正文标题」/);
assert.match(fullPrompt, /「要点一」/);
assert.match(fullPrompt, /「要点二」/);
assert.match(fullPrompt, /「一句总结」/);
assert.match(fullPrompt, /不要添加任何未提供的文字/);
assert.match(fullPrompt, /垂直列表/);
assert.match(fullPrompt, /细分隔线或独立强调区/);
assert.match(fullPrompt, /统一左对齐/);
assert.match(fullPrompt, /字段名“标题、要点、总结、页标、核心总结、行动号召”等只是排版说明/);
assert.match(fullPrompt, /文字区约占上方 50%-52%/);

const conflictingBackPrompt = buildFullImagePrompt(
  '3:4比例，深海蓝与暖金主色系，无文字视觉素材。画面中不生成任何文字、字母、数字、符号。避免：任何文字、字母、数字、Logo、水印、伪文字纹理、主体过小、低对比度。',
  { type: 'back', title: 'AI推平执行门槛，但推不平判断力', points: [], summary: '开始造自己的船' }
);
assert.match(conflictingBackPrompt, /「AI推平执行门槛，但推不平判断力」/);
assert.match(conflictingBackPrompt, /「开始造自己的船」/);
assert.doesNotMatch(conflictingBackPrompt, /无文字视觉素材/);
assert.doesNotMatch(conflictingBackPrompt, /画面中不生成任何文字/);
assert.doesNotMatch(conflictingBackPrompt, /避免：任何文字/);
assert.match(conflictingBackPrompt, /主体过小/);
assert.match(conflictingBackPrompt, /封底/);
assert.match(source, /AI 整图实际请求/);
assert.match(source, /复制 AI 整图请求/);
assert.doesNotMatch(source, /文字核对/);
assert.doesNotMatch(source, /className="visual-checklist"[\s\S]*type="checkbox"/);
assert.match(source, /className="mi-surface mi-surface-panel mi-surface-raised visual-panel"/);
assert.match(source, /className="mi-button mi-button-standard visual-button visual-button-primary/);
assert.match(source, /复制原始视觉提示词/);
assert.doesNotMatch(source, /复制当前页提示词/);
assert.doesNotMatch(source, /复制全部/);
assert.doesNotMatch(source, /className="visual-checklist"/);
assert.match(source, /const \[activeVisualPage, setActiveVisualPage\] = useState/);
assert.match(source, /const selectedPromptSection =/);
assert.match(source, /className="visual-page-tabs hide-scrollbar" role="tablist"/);
assert.match(source, /role="tab"/);
assert.match(source, /视觉生成与对比/);
assert.match(source, /视觉生成与成品对比/);
assert.match(source, /visual-stage-heading-title/);
assert.match(source, /visual-section-heading/);
assert.match(source, /className="visual-workspace-grid"/);
assert.match(source, /className="visual-results-column"/);
assert.match(source, /className="visual-prompt-column"/);
assert.match(source, /原始视觉提示词/);
assert.doesNotMatch(source, /className="visual-prompt-list"/);
assert.match(source, /className="results-stage-nav hide-scrollbar"/);
assert.doesNotMatch(source, /moreimg-background-blob|bg-indigo-400\/40 blur-\[90px\]/);
assert.match(source, /className="sidebar-brand-mark mr-3"/);
assert.match(source, /className="mi-icon-button mi-icon-button-standard sidebar-icon-button" aria-label="打开设置"/);
assert.match(source, /className="sidebar-input custom-scrollbar/);
assert.match(source, /className="mi-field config-input/);
assert.match(source, /dialogClassName="config-dialog flex flex-col/);
assert.match(source, /className="mi-field config-preference-textarea"/);
assert.doesNotMatch(source, /className="w-full h-11 px-4/);
assert.match(source, /\.sidebar-input \{[^}]*height: 180px/);
assert.match(source, /\.config-input \{[^}]*height:\s*var\(--mi-control-field\)/);
assert.match(source, /\.results-stage-nav \{[^}]*border-radius: 20px/);
assert.doesNotMatch(source, /key=\{i\} className="bg-white rounded-2xl shadow-sm/);
assert.match(source, /当前页成品对比/);
assert.match(source, /1242×1656/);
assert.match(source, /导出 HTML 成品 PNG/);
assert.match(source, /aspect-ratio: 3 \/ 4/);
assert.match(source, /\.visual-preview \{[^}]*position: relative;[^}]*border: 0;/, '生成结果预览边框不得占用 3:4 内容区尺寸');
assert.match(source, /\.visual-preview::after \{[^}]*position: absolute;[^}]*inset: 0;[^}]*border: 1px solid/, '生成结果预览边框应作为覆盖层绘制');
assert.match(source, /className="visual-current-output-body"/);
assert.match(source, /固定对比槽位/);
assert.match(source, /隐藏 AI 整图/);
assert.match(source, /显示 AI 整图/);
assert.match(source, /mode === 'full'/);
assert.match(source, /mode === 'visual-only' \? '无字主视觉'/);
assert.match(source, /const resultKey = `\$\{mode\}:\$\{cardTitle\}`/);
assert.match(source, /imageResults\[`visual-only:\$\{selectedPromptSection\.title\}`\]/);
assert.match(source, /imageResults\[`full:\$\{selectedPromptSection\.title\}`\]/);
assert.match(source, /生成无字主视觉/);
assert.match(source, /旧版主视觉不再用于 HTML 成品卡/);
assert.match(source, /const selectedHtmlCardReady = selectedHtmlImageResult\?\.status === 'success'/);
assert.match(source, /disabled=\{isSelectedHtmlCardExporting\}/);
assert.match(source, /生成主视觉后可导出/);
assert.match(source, /updateImageFocus/);
assert.match(source, /请先生成无字主视觉/);
assert.match(source, /下载主视觉/);
assert.match(source, /下载 AI 整图/);
assert.match(source, /图片生成失败/);
assert.match(source, /indexedDB\.open/);
assert.match(source, /IMAGE_DB_NAME/);
assert.match(source, /saveImageBlob/);
assert.match(source, /loadSessionImages/);
assert.match(source, /URL\.createObjectURL/);
// 响应式布局由 template.html 的 @media (min-width: 1024px) 拥有，
// 不再依赖 styles.css 里并不存在的 lg: 工具类。
assert.match(source, /@media \(min-width: 1024px\)/);
assert.match(source, /\.moreimg-app-shell \{ flex-direction: row; \}/);
assert.match(source, /\.moreimg-sidebar \{[\s\S]*?width: 320px;/);
assert.ok(!/className="[^"]*\blg:/.test(source), '标记中不应再出现未编译的 lg: 工具类');

console.log('Single-image generation controls are present.');

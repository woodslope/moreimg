import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');

assert.match(source, /const SESSION_STORE_NAME = 'sessions'/);
assert.match(source, /const HISTORY_INDEX_KEY = 'moreimg_history_index'/);
assert.match(source, /const LEGACY_HISTORY_KEY = 'agent_history'/);
assert.match(source, /const toHistoryIndex = \(record\) => \(\{[\s\S]*?id: record\.id,[\s\S]*?title: record\.title,[\s\S]*?date: record\.date/);
assert.match(source, /await saveSessionRecord\(newHistoryItem\)/);
assert.match(source, /await migrateLegacyHistory\(JSON\.parse\(legacyValue\)\)/);
assert.match(source, /localStorage\.setItem\(HISTORY_INDEX_KEY, JSON\.stringify\(updatedHistory\)\)/);
assert.match(source, /localStorage\.removeItem\(LEGACY_HISTORY_KEY\)/);
assert.doesNotMatch(source, /localStorage\.setItem\('agent_history', JSON\.stringify\(updatedHistory\)\)/);

assert.match(source, /const ResultsPanel = React\.memo\(/);
assert.match(source, /const parsedSession = useMemo\(/);
assert.match(source, /const Icon = React\.memo\(/);
assert.match(source, /window\.moreimgIcons\?\.\[name\]/, '图标应直接使用构建期子集');
assert.doesNotMatch(source, /window\.lucide\.createIcons/, '图标不应在每次挂载时全局扫描 DOM');
assert.match(source, /<script src="vendor\/lucide-moreimg\.js"><\/script>/, '生产页应使用 Lucide 子集');
assert.doesNotMatch(source, /<script src="vendor\/lucide\.js"><\/script>/, '生产页不应加载完整 Lucide 包');
assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
assert.doesNotMatch(source, /<link rel="stylesheet" href="fonts\/noto-sans-sc\.css">/, '导出字体 CSS 不应阻塞首屏');
assert.match(source, /const loadExportFontStylesheet = \(\) =>/);
assert.match(source, /await loadExportFontStylesheet\(\)/);
assert.doesNotMatch(source, /<script src="vendor\/html2canvas\.js"><\/script>/);
assert.match(source, /await loadHtml2Canvas\(\)/);
assert.match(source, /processing-action-button/);

const mainScrollClass = source.match(/<div ref=\{resultScrollRef\} className=\{`([^`]+)`\}>/)?.[1] || '';
assert.ok(mainScrollClass, '应能定位主滚动容器');
assert.doesNotMatch(mainScrollClass, /transform-gpu/, '主滚动容器不得强制提升为 GPU 图层');
assert.doesNotMatch(source, /moreimg-background-blob/, '静态页面不得保留大尺寸模糊背景图层');
assert.doesNotMatch(source, /\.visual-panel \{[^}]*backdrop-filter/, '视觉面板不得在滚动时实时采样背景');
assert.doesNotMatch(source, /\.content-card-panel \{[^}]*backdrop-filter/, '内容卡片不得在滚动时实时采样背景');
assert.doesNotMatch(source, /className="[^\"]*backdrop-blur-xl[^\"]*"[^>]*>\s*<FormattedContent/, '长文章面板不得使用实时毛玻璃');
assert.doesNotMatch(source, /<div className="animate-fade-in-up pb-20">/, '结果根容器不得保留大面积 transform 动画');
assert.doesNotMatch(source, /<div key=\{sId\} className="animate-fade-in-up">/, '阶段长内容不得保留大面积 transform 动画');
assert.match(source, /\.content-card-panel \{[^}]*content-visibility:\s*auto/, '离屏内容卡片应跳过绘制');
assert.match(source, /\.content-card-panel \{[^}]*contain-intrinsic-size:\s*auto\s+240px/, '离屏卡片应预留稳定高度');
assert.match(source, /\.visual-section \{[^}]*content-visibility:\s*auto/, '下方成品对比区应跳过离屏绘制');
assert.match(source, /\.visual-section \{[^}]*contain-intrinsic-size:\s*auto\s+900px/, '成品对比区应预留稳定高度');
assert.match(source, /<img\s+src=\{imageUrl\}\s+alt=""\s+decoding="async"\s*\/>/, 'HTML 卡片主视觉应异步解码');
assert.match(source, /className="visual-preview-image"[\s\S]*?decoding="async"/, '生成结果预览图应异步解码');
assert.match(source, /<img src=\{fullImageResult\.imageUrl\}[^>]*loading="lazy"[^>]*decoding="async"[^>]*className="visual-comparison-image"/, '下方重复 AI 整图应懒加载并异步解码');
assert.doesNotMatch(source, /className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900\/40 backdrop-blur-sm animate-fade-in"/, '设置弹窗遮罩不得在滚动时实时采样背景');
assert.doesNotMatch(source, /\.config-dialog \{[^}]*backdrop-filter:/, '设置弹窗不得在滚动时实时采样背景');
assert.match(source, /\.config-dialog-body \{[^}]*overscroll-behavior:\s*contain/, '设置弹窗滚动边界应隔离外层回弹');
assert.match(source, /\.config-dialog \{[^}]*background:\s*#fff/, '设置弹窗表面应阻断底层内容透出');
assert.match(source, /\.config-dialog-header \{[^}]*background:\s*#fff/, '设置弹窗头部表面应阻断底层内容透出');
assert.match(source, /--mi-field-bg:\s*#fff/, '配置字段表面应使用不透明背景');
assert.equal((source.match(/className="config-select-shell"/g) || []).length, 5, '配置 Select 应统一使用 5 个包裹器');
assert.equal((source.match(/className="config-select-icon"/g) || []).length, 5, '配置 Select 应统一使用 5 个自定义箭头');
assert.equal((source.match(/className="mi-field config-input config-select"/g) || []).length, 5, '配置 Select 应统一隐藏原生箭头');

console.log('History storage and high-frequency rendering performance contracts are covered.');

import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const source = await readFile(new URL('./src.html', import.meta.url), 'utf8');
const fontCss = await readFile(new URL('./fonts/noto-sans-sc.css', import.meta.url), 'utf8');

await access(new URL('./fonts/LICENSE-NOTO-SANS-SC.txt', import.meta.url));
await access(new URL('./fonts/files/noto-sans-sc-latin-wght-normal.woff2', import.meta.url));
assert.match(fontCss, /font-family: 'Noto Sans SC Variable'/);
assert.match(fontCss, /\.\/files\/noto-sans-sc-/);

assert.match(source, /const parseCardPackage = \(content\) =>/);
assert.match(source, /const HtmlCard = \(\{ card, imageUrl, cardRef, styleLock \}\) =>/);
assert.match(source, /getCardShellPresentation\(styleLock\)/);
assert.match(source, /width:\s*1242px;height:\s*1656px/);
assert.match(source, /width:\s*1242,[\s\S]*?height:\s*1656/);
assert.match(source, /HTML 成品卡/);
assert.match(source, /导出 HTML 成品 PNG/);
assert.match(source, /canvas\.toBlob\(resolve, 'image\/png'/);
assert.match(source, /const createHtmlCardExportClone = \(sourceNode\) =>/);
assert.match(source, /document\.body\.appendChild\(exportRoot\)/);
assert.match(source, /window\.html2canvas\(exportNode/);
assert.match(source, /exportRoot\?\.remove\(\)/);
assert.doesNotMatch(source, /window\.html2canvas\(sourceNode/);
assert.match(source, /vendor\/html2canvas\.js/);
assert.match(source, /fonts\/noto-sans-sc\.css/);
assert.match(source, /font-family:"Noto Sans SC Variable",sans-serif/);
assert.match(source, /document\.fonts\?\.ready/);
assert.match(source, /imageResults\[`visual-only:\$\{card\.imageKey\}`\]/);
assert.doesNotMatch(source, /htmlCards\[selectedPromptIndex\]/, '提示词找不到同名卡片时不得按数组位置错配');
assert.match(source, /moreimg-card-media/);
assert.match(source, /moreimg-card-shade/);
assert.match(source, /object-fit:cover/);
assert.match(source, /moreimg-card-back-copy/);
assert.match(source, /visual-card-count/);
assert.match(source, /background:transparent/);
assert.match(source, /\.moreimg-card-title\{[^}]*font-size:92px/);
assert.match(source, /\.moreimg-card-kicker-mark\{[^}]*width:6px[^}]*height:28px[^}]*border-radius:3px/);
assert.doesNotMatch(source, /\.moreimg-card-kicker:before\{/, '导出标记不得使用 html2canvas 容易错位的伪元素');
assert.equal((source.match(/<span className="moreimg-card-kicker-mark" aria-hidden="true"><\/span>/g) || []).length, 2);
assert.match(source, /\.moreimg-export-render \.moreimg-card-kicker-mark\{transform:translateY\(14px\)\}/);
assert.match(source, /exportNode\.classList\.add\('moreimg-export-render'\)/);
assert.match(source, /\.moreimg-card-body \.moreimg-card-title\{[^}]*font-size:80px/);
assert.match(source, /\.moreimg-card-point\{[^}]*font-size:36px/);
assert.match(source, /\.moreimg-card-points\{margin-top:34px/);
assert.match(source, /\.moreimg-card-back \.moreimg-card-content\{justify-content:flex-start\}/);
assert.match(source, /下半部只展示主视觉，不放任何文字/);
assert.doesNotMatch(source, /\.moreimg-card-points\{margin-top:auto/);
assert.match(source, /\.html-card-preview-frame \{[\s\S]*?width: 400px/);
assert.match(source, /\.html-card-preview-frame \{[^}]*position: relative;[^}]*border: 0;/, '预览边框不得占用 3:4 内容区尺寸');
assert.match(source, /\.html-card-preview-frame::after \{[^}]*position: absolute;[^}]*inset: 0;[^}]*border: 1px solid/, '预览边框应作为覆盖层绘制');
assert.match(source, /\.visual-comparison-preview-frame \{[^}]*border: 1px solid/, 'AI 整图对比框应保留原有边框');
assert.match(source, /const HtmlCardPreview =/);
assert.match(source, /ResizeObserver/);
assert.match(source, /--moreimg-preview-scale/);
assert.doesNotMatch(source, /\.html-card-preview-scale \{[^}]*transform: scale\(0\.322061\)/);
assert.doesNotMatch(source, /@media \(max-width: 420px\)[\s\S]*?html-card-preview-scale[^}]*0\.241546/);
assert.match(source, /background自然延伸到四边|背景自然延伸到四边/);
assert.doesNotMatch(source, /moreimg-card-visual\{/);
assert.doesNotMatch(source, /background:#eef2ff/);
assert.doesNotMatch(source, /rounded-lg bg-indigo-50 px-3 py-1\.5 text-\[11px\] font-bold text-indigo-600">共/);

const parserBlock = source.match(/const cleanCardValue[\s\S]*?(?=\n\s*const HTML_CARD_EXPORT_STYLES)/)?.[0];
assert.ok(parserBlock, '应能提取卡片解析器');
const parseCardPackage = Function(`${parserBlock}; return parseCardPackage;`)();
const cards = parseCardPackage(`
**封面卡片**
- 主标题：把注意力用在刀刃上
- 副标题：真正的效率来自减少切换
- 核心比喻（顶层比喻）：注意力 = 水流

**正文卡片 1/1**
- 标题：集中处理同类任务
- 核心比喻：任务切换 = 分流
- 内容要点：
  - 固定时间回复消息
  - 先完成最重要任务
- 一句话总结：减少切换才能提高效率

**封底卡片**
- 核心总结：效率不是把日程塞满
- 行动号召：让注意力流向重要的事
- 核心比喻（呼应元素）：汇聚的水流
`);

assert.equal(cards.length, 3);
assert.equal(cards[0].imageKey, '封面');
assert.equal(cards[1].imageKey, '正文1/1');
assert.deepEqual(cards[1].points, ['固定时间回复消息', '先完成最重要任务']);
assert.equal(cards[2].summary, '让注意力流向重要的事');

const v4Cards = parseCardPackage(`
**正文卡片 1/1**
- 标题：从执行走向判断
- 要点：
  - AI负责批量生成
  - 设计师负责判断取舍
- 总结：品位成为核心能力
`);

assert.equal(v4Cards.length, 1);
assert.deepEqual(v4Cards[0].points, ['AI负责批量生成', '设计师负责判断取舍']);
assert.equal(v4Cards[0].summary, '品位成为核心能力');

console.log('HTML card composition and PNG export are present.');

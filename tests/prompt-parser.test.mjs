import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');
const parserBlock = source.match(/const parsePromptSections = [\s\S]*?(?=\n\s*const assessProcessingResult)/)?.[0];
assert.ok(parserBlock, '复制、展示与完整性检查应共用提示词解析器');
const parsePromptSections = Function(`${parserBlock}; return parsePromptSections;`)();

const response = `总览内容

### 封面
\`\`\`text
封面提示词
\`\`\`

### [正文1/1]
\`\`\`text
正文提示词
\`\`\`

### 封底
\`\`\`text
封底提示词
\`\`\``;

assert.deepEqual(parsePromptSections(response).map(section => section.title), ['封面', '正文1/1', '封底']);

const looseResponse = `封面提示词\n封面内容\n\n正文1/1提示词\n正文内容\n\n封底提示词\n封底内容`;
assert.deepEqual(parsePromptSections(looseResponse).map(section => section.title), ['封面', '正文1/1', '封底']);

const mixedResponse = `总览代码块
\`\`\`text
[封面]
封面提示词
[正文1/3]
正文一提示词
[正文2/3]
正文二提示词
[正文3/3]
正文三提示词
[封底]
封底提示词
\`\`\`

### 封面卡片
封面拆分提示词

### 封底卡片
封底拆分提示词`;
const mixedSections = parsePromptSections(mixedResponse);
assert.deepEqual(
  mixedSections.map(section => section.title),
  ['封面', '正文1/3', '正文2/3', '正文3/3', '封底'],
  '应优先保留段落数量更完整的总览提示词'
);
assert.equal(mixedSections[4].text, '封底提示词', '总览封底不应吞入后续拆分页内容');

console.log('Prompt parser accepts bracketed and plain headings.');

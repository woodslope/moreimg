import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');
const regexSource = source.match(/const stageRegex = (\/.*?\/[a-z]*);/)?.[1];

assert.ok(regexSource, '源码中应存在 stageRegex');

const stageRegex = Function(`return ${regexSource}`)();
const response = `阶段1
判型通过。

阶段4
**封面卡片**
主标题：测试封面

**正文卡片 1/1**
标题：测试正文

阶段5
### [封面]
封面提示词`;
const stages = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' };
let match;
let lastIndex = 0;
let currentStage = null;

while ((match = stageRegex.exec(response)) !== null) {
  if (currentStage !== null) {
    stages[currentStage] = response.substring(lastIndex, match.index).trim();
  }
  currentStage = Number(match[1]);
  lastIndex = match.index + match[0].length;
}

if (currentStage !== null) {
  stages[currentStage] = response.substring(lastIndex).trim();
}

assert.equal(stages[1], '判型通过。');
assert.match(stages[4], /^\*\*封面卡片\*\*/);
assert.match(stages[4], /\*\*正文卡片 1\/1\*\*/);
assert.match(stages[5], /^### \[封面\]/);

console.log('Stage parser preserves content after stage headings.');

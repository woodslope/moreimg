import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./src.html', import.meta.url), 'utf8');
assert.match(source, /const DEFAULT_SYSTEM_PROMPT = String\.raw`你是 MoreImg v6[\s\S]*moreimg-1\.0 JSON/);
assert.match(source, /只输出一个合法 JSON 对象/);
assert.match(source, /固定结构为封面 \+ 1-7张正文 \+ 封底/);
assert.match(source, /最后一页 page_id 为 "closing"/);
assert.match(source, /原文没有时使用核心结论或中性收束/);
assert.match(source, /不得创建独立 cards 数组或 prompts 数组/);
assert.match(source, /同一页的 card、semantic 和 image_prompt/);
assert.match(source, /整套只能使用一个 Style Lock/);
assert.match(source, /所有规定为数组的字段都必须输出 JSON 数组/);
assert.match(source, /即使没有内容也必须输出空数组 \[\]/);
assert.match(source, /禁止将数组字段输出为字符串、null 或对象/);
assert.match(source, /independent_units、fact_notes、logic_issues[\s\S]*paragraphs/);
assert.match(source, /card\.points、semantic\.supporting_concepts、semantic\.excluded_concepts、semantic\.avoid_misread/);
assert.match(source, /style_lock\.visual_dna\.recurring_elements、style_lock\.negative[\s\S]*image_prompt\.avoid/);
assert.match(source, /const DEFAULT_PROMPT_VERSION = 7/);
assert.match(source, /核心规则不可编辑/);
assert.doesNotMatch(source, />内容加工规则</);
assert.doesNotMatch(source, /升级到新版规则/);

console.log('Hidden MoreImg v6 JSON protocol is present.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');
const responseBlock = source.match(/const extractProcessingResponseText = [\s\S]*?(?=\n\s*const getCardVisibleText)/)?.[0];

assert.ok(responseBlock, '应能提取文本响应解析逻辑');
assert.match(responseBlock, /const readProcessingResponse =/, '应存在统一的缓冲式响应读取器');

const { readProcessingResponse } = Function(`${responseBlock}; return { readProcessingResponse };`)();

const encoder = new TextEncoder();
const createStreamResponse = chunks => new Response(new ReadableStream({
  start(controller) {
    chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
    controller.close();
  }
}), { headers: { 'Content-Type': 'text/event-stream' } });

const chatResponse = createStreamResponse([
  'data: {"choices":[{"delta":{"content":"{\\"schema_version\\":"},"finish_reason":null}]}\n\n',
  'data: {"choices":[{"delta":{"content":"\\"moreimg-1.0\\"}"},"finish_reason":null}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
  'data: [DONE]\n\n'
]);
const chatResult = await readProcessingResponse(chatResponse);

assert.equal(chatResult.text, '{"schema_version":"moreimg-1.0"}');
assert.equal(chatResult.finishReason, 'stop');

const arrayDeltaResult = await readProcessingResponse(createStreamResponse([
  'data: {"choices":[{"delta":{"content":[{"type":"text","text":"数组"},{"type":"text","text":"片段"}]},"finish_reason":null}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
  'data: [DONE]\n\n'
]));
assert.equal(arrayDeltaResult.text, '数组片段');

const responsesApiResult = await readProcessingResponse(createStreamResponse([
  ': keep-alive\n\n',
  'event: response.output_text.delta\ndata: {"type":"response.output_',
  'text.delta","delta":"第一段"}\n\n',
  'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"第二段"}\n\n',
  'event: response.incomplete\ndata: {"type":"response.incomplete","response":{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}}\n\n'
]));
assert.equal(responsesApiResult.text, '第一段第二段');
assert.equal(responsesApiResult.finishReason, 'max_output_tokens');

const jsonResult = await readProcessingResponse(new Response(JSON.stringify({
  choices: [{ message: { content: '普通 JSON 返回' }, finish_reason: 'stop' }]
}), { headers: { 'Content-Type': 'application/json' } }));
assert.deepEqual(jsonResult, { text: '普通 JSON 返回', finishReason: 'stop' });

await assert.rejects(
  readProcessingResponse(createStreamResponse([': keep-alive\n\ndata: [DONE]\n\n'])),
  /未返回任何有效内容/
);
await assert.rejects(
  readProcessingResponse(createStreamResponse([
    'data: {"choices":[{"delta":{"content":"半截 JSON"},"finish_reason":null}]}\n\n'
  ])),
  /中断/
);
await assert.rejects(
  readProcessingResponse(createStreamResponse([
    'data: {not-json}\n\n',
    'data: {"choices":[{"delta":{"content":"完整内容"},"finish_reason":null}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n'
  ])),
  /无法解析的事件/
);

assert.doesNotMatch(responseBlock, /setCurrentSession|setInternalStage|parseMoreImgPackage/);

console.log('Buffered SSE and JSON processing responses are reconstructed without partial UI updates.');

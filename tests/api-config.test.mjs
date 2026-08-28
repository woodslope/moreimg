import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');
const helperBlock = source.match(/const isResponsesApiEndpoint = [\s\S]*?(?=\n\s*const getCardVisibleText)/)?.[0];

assert.ok(helperBlock, '源码中应存在 API 配置辅助函数');

const helpers = Function(`${helperBlock}; return {
  buildProcessingRequestBody,
  deriveModelsEndpoint,
  extractProcessingResponseText,
  extractModelIds,
  getRequestTransport,
  resolveApiEndpoint
};`)();

assert.equal(
  helpers.resolveApiEndpoint('https://api.example.com/v1/', 'text'),
  'https://api.example.com/v1/chat/completions'
);
assert.equal(
  helpers.resolveApiEndpoint('https://api.example.com/v1', 'image'),
  'https://api.example.com/v1/images/generations'
);
assert.equal(
  helpers.resolveApiEndpoint('https://api.example.com/v1/chat/completions', 'text'),
  'https://api.example.com/v1/chat/completions'
);
assert.equal(
  helpers.resolveApiEndpoint('https://api.example.com/v1/responses', 'text'),
  'https://api.example.com/v1/responses'
);

assert.deepEqual(
  helpers.getRequestTransport(
    'https://api.example.com/v1/chat/completions',
    'text',
    { protocol: 'http:', hostname: '127.0.0.1', origin: 'http://127.0.0.1:4187' }
  ),
  {
    url: '/proxy/text',
    headers: { 'X-MoreImg-Upstream': 'https://api.example.com/v1/chat/completions' }
  }
);
assert.deepEqual(
  helpers.getRequestTransport(
    'http://127.0.0.1:4187/v1/chat/completions',
    'text',
    { protocol: 'https:', hostname: 'woodslope.github.io', origin: 'https://woodslope.github.io' }
  ),
  {
    url: 'http://127.0.0.1:4187/v1/chat/completions',
    headers: {},
    blockedLocalService: true
  }
);
assert.deepEqual(
  helpers.getRequestTransport(
    'https://api.example.com/v1/images/generations',
    'image',
    { protocol: 'file:', hostname: '', origin: 'null' }
  ),
  { url: 'https://api.example.com/v1/images/generations', headers: {} }
);

assert.equal(
  helpers.deriveModelsEndpoint('https://api.example.com/v1/responses'),
  'https://api.example.com/v1/models'
);
assert.equal(
  helpers.deriveModelsEndpoint('https://api.example.com/openai/v1/chat/completions?group=1'),
  'https://api.example.com/openai/v1/models'
);
assert.equal(
  helpers.deriveModelsEndpoint('https://api.example.com/v1/images/generations'),
  'https://api.example.com/v1/models'
);

assert.deepEqual(
  helpers.extractModelIds({ data: [{ id: 'gpt-5.4-mini' }, { id: 'gpt-image-2' }, { id: 'gpt-5.4-mini' }] }),
  ['gpt-5.4-mini', 'gpt-image-2']
);
assert.deepEqual(
  helpers.extractModelIds({ models: ['deepseek-chat', { name: 'deepseek-reasoner' }] }),
  ['deepseek-chat', 'deepseek-reasoner']
);

const testMessages = [
  { role: 'system', content: '连接测试' },
  { role: 'user', content: '只回复 OK' }
];
const responsesTestBody = helpers.buildProcessingRequestBody(
  'https://api.example.com/v1/responses',
  'gpt-5.4-mini',
  testMessages,
  64
);
assert.equal(responsesTestBody.max_output_tokens, 64);
assert.equal(responsesTestBody.input[0].content, '只回复 OK');

const chatTestBody = helpers.buildProcessingRequestBody(
  'https://api.example.com/v1/chat/completions',
  'deepseek-chat',
  testMessages,
  64
);
assert.equal(chatTestBody.max_tokens, 64);
assert.deepEqual(chatTestBody.messages, testMessages);
assert.equal(chatTestBody.stream, true);

const connectionTestBody = helpers.buildProcessingRequestBody(
  'https://api.example.com/v1/chat/completions',
  'deepseek-chat',
  testMessages,
  64,
  false
);
assert.equal(connectionTestBody.stream, false);

assert.equal(
  helpers.extractProcessingResponseText({ choices: [{ message: { content: '阶段1\n内容' } }] }),
  '阶段1\n内容'
);
assert.equal(
  helpers.extractProcessingResponseText({ choices: [{ message: { content: [{ type: 'text', text: '阶段1' }, { type: 'text', text: '\n内容' }] } }] }),
  '阶段1\n内容'
);
assert.equal(
  helpers.extractProcessingResponseText({ output: [{ content: [{ type: 'output_text', text: '阶段1\n内容' }] }] }),
  '阶段1\n内容'
);

assert.match(source, /读取模型/);
assert.match(source, /测试接口/);
assert.match(source, /加工偏好/);
assert.match(source, /MoreImg v6/);
assert.doesNotMatch(source, /<textarea\s+value=\{apiConfig\.systemPrompt\}/);
assert.match(source, /textModels\.length > 0 \? \(/);
assert.match(source, /imageModels\.length > 0 \? \(/);
assert.match(source, /aria-label="选择文本模型"/);
assert.match(source, /aria-label="选择图片模型"/);
assert.equal((source.match(/className="config-secret-field"/g) || []).length, 2);
assert.equal((source.match(/name=\{visibleKeys\.(?:text|image) \? 'EyeOff' : 'Eye'\}/g) || []).length, 2);
assert.match(source, /显示文本模型 API Key/);
assert.match(source, /显示图片 API Key/);
assert.match(source, /className="mi-field config-input config-select"/);
assert.match(source, /\.config-select \{[^}]*appearance: none/);
assert.match(source, /\.config-select-icon \{[^}]*right: 16px;[^}]*top: 50%/);
assert.equal((source.match(/className="config-select-shell"/g) || []).length, 5);
assert.equal((source.match(/name="ChevronDown" className="config-select-icon/g) || []).length, 5);
assert.doesNotMatch(source, /<datalist/);

console.log('API model discovery and connection testing are covered.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');
const helperBlock = source.match(/const PROCESSING_MAX_OUTPUT_TOKENS = [\s\S]*?(?=\n\s*const parsePromptSections)/)?.[0];

assert.ok(helperBlock, '源码中应存在统一的请求超时与中止控制器');

const { runWithRequestControl } = Function(`${helperBlock}; return { runWithRequestControl };`)();

let timeoutSignal;
await assert.rejects(
  runWithRequestControl(
    signal => {
      timeoutSignal = signal;
      return new Promise(() => {});
    },
    { timeoutMs: 15, timeoutMessage: '内容生成超时' }
  ),
  /内容生成超时/
);
assert.equal(timeoutSignal?.aborted, true, '超时必须中止底层请求和流读取');

const externalController = new AbortController();
let cancelledSignal;
const cancelledRequest = runWithRequestControl(
  signal => new Promise((resolve, reject) => {
    cancelledSignal = signal;
    signal.addEventListener('abort', () => reject(new Error('底层请求已中止')), { once: true });
  }),
  { timeoutMs: 1000, signal: externalController.signal }
);
externalController.abort();
await assert.rejects(cancelledRequest, /已停止运算/);
assert.equal(cancelledSignal?.aborted, true, '手动停止必须中止底层请求和流读取');

assert.match(source, /const processingAbortRef = useRef\(null\)/);
assert.match(source, /processingAbortRef\.current\.abort\(\)/);
assert.match(source, /停止运算/);
assert.match(source, /blockedLocalService/);
assert.match(source, /buildProcessingRequestBody\(endpoint, apiConfig\.model\.trim\(\), messages, PROCESSING_MAX_OUTPUT_TOKENS, false\)/);
assert.match(source, /const readProcessingResponse = async \(response\)/);
assert.match(source, /response\.body\.getReader\(\)/);
assert.match(source, /await readProcessingResponse\(response\)/);
assert.match(source, /setProcessingUiPhase\('waiting'\)[\s\S]*?setProcessingUiPhase\('validating'\)/, '请求生命周期应显示可证明的等待与校验阶段');
assert.match(source, /setInterval\(\(\) => setProcessingElapsedSeconds/, '等待反馈可显示真实经过时间');
assert.doesNotMatch(source, /STAGE_LOADING_TEXT|setInterval\(\(\) => setInternalStage|internalStage \/ 6/, '请求期间不得用定时器伪装模型内部进度');

console.log('Text requests can time out and be stopped by the user.');

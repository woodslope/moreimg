import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 上游一旦受理生图就会计费，本地放弃不会退款。
// 这条测试守住三件事：不因无关操作取消在途请求、已付费的结果必须落盘、失败必须可对账。
const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');
const server = await readFile(new URL('../server.py', import.meta.url), 'utf8');

// ---- 1. 无关操作不得中止在途生图 ----
assert.doesNotMatch(source, /const abortImageRequests = /, '不得保留“一把全清”的生图中止函数');
assert.match(source, /const abortSessionImageRequests = \(sessionId\)/, '只允许按会话精确中止');
assert.match(source, /const abortAllImageRequests = /, '页面卸载时仍需收尾');

const historyLoader = source.match(/const loadHistoryItem = async \(id\) => \{[\s\S]*?\n {6}\};/)?.[0];
assert.ok(historyLoader, '应能定位 loadHistoryItem');
assert.doesNotMatch(historyLoader, /abort/i, '切换历史记录不得中止在途生图');

const demoLoader = source.match(/const loadDemoRecord = async \(\) => \{[\s\S]*?\n {6}\};/)?.[0];
assert.ok(demoLoader, '应能定位 loadDemoRecord');
assert.doesNotMatch(demoLoader, /abortAllImageRequests|abortImageRequests/, '载入示例不得中止全部生图');
assert.match(demoLoader, /abortSessionImageRequests\(item\.id\)/, '仅被挤出历史的会话才中止');

const processingStarter = source.match(/const handleStartProcessing = async \([\s\S]*?\n {6}\};/)?.[0];
assert.ok(processingStarter, '应能定位 handleStartProcessing');
assert.doesNotMatch(processingStarter, /abortImageRequests|abortAllImageRequests/, '开始新加工不得中止在途生图');
assert.match(processingStarter, /hasInFlightImageRequests\(\)/, '仍有生图在跑时应提示用户');

const deleteHandler = source.match(/const confirmDeleteHistoryItem = async \(\) => \{[\s\S]*?\n {6}\};/)?.[0];
assert.ok(deleteHandler, '应能定位 confirmDeleteHistoryItem');
assert.match(deleteHandler, /abortSessionImageRequests\(id\)/, '删除该会话时才中止它自己的生图');

// ---- 2. 已付费的结果必须落盘 ----
const generateImage = source.match(/const handleGenerateImage = async \([\s\S]*?\n {6}\};/)?.[0];
assert.ok(generateImage, '应能定位 handleGenerateImage');
assert.doesNotMatch(
  generateImage,
  /operationToken !== historyLoadTokenRef\.current/,
  '生成成功后不得用历史 token 提前 return，否则已计费的图片被丢弃'
);
const saveIndex = generateImage.indexOf('await saveImageBlob(');
const guardIndex = generateImage.indexOf('activeHistoryIdRef.current');
assert.ok(saveIndex > 0, '应调用 saveImageBlob');
assert.ok(guardIndex > saveIndex, '会话归属判断必须晚于入库：图片先落盘，再决定是否更新界面');
assert.match(generateImage, /返回该记录即可查看/, '跨会话完成时应告知用户去哪里查看');

// ---- 3. 生成与下载分别计时，且代理超时更长 ----
assert.match(source, /const IMAGE_REQUEST_TIMEOUT_MS = 600000/, '生图超时应放宽到 600 秒');
assert.match(source, /const IMAGE_DOWNLOAD_TIMEOUT_MS = 120000/, '下载应有独立预算');
assert.match(generateImage, /restartTimeoutForPhase\('download', IMAGE_DOWNLOAD_TIMEOUT_MS\)/, '进入下载阶段应重置计时');
assert.match(generateImage, /timedOutPhase === 'request'/, '超时提示应区分生成与下载');
assert.match(generateImage, /timedOutPhase === 'download'/, '超时提示应区分生成与下载');
assert.match(generateImage, /上游可能已出图并计费/, '生成超时必须提醒可能已计费');
assert.match(server, /PROXY_TIMEOUT_SECONDS = 660/, '代理超时必须大于前端 600 秒，避免两侧打平的竞态');

// ---- 4. 尽量取 base64，URL 回退时经同源代理下载 ----
assert.match(source, /response_format: 'b64_json'/, '非 gpt-image 模型应主动要求 base64，避免跨域下载环节');
assert.match(source, /const buildImageRequestBody = /);
assert.match(source, /const getImageDownloadTransport = /, 'URL 回退时应经同源代理下载');
assert.match(generateImage, /getImageDownloadTransport\(remoteUrl\)/);
assert.match(server, /IMAGE_ASSET_PROXY_PATH = "\/proxy\/image-asset"/);
assert.match(server, /def do_GET\(self\)/, '代理需支持图片本体的同源 GET 转发');

// ---- 5. 错误信息保留状态码和上游原文 ----
assert.match(source, /const readImageResponse = async \(response\)/);
assert.doesNotMatch(generateImage, /await response\.json\(\)/, '裸 response.json() 会把 HTML 错误页的真实原因吞掉');
assert.match(source, /接口返回了非 JSON 内容/);
assert.match(source, /throw new Error\(`HTTP \$\{response\.status\}\$\{preview \? `：\$\{preview\}` : ''\}`\)/);

// ---- 6. 尺寸校验与迁移 ----
assert.match(source, /const IMAGE_RATIO_SIZES = Object\.freeze/);
assert.match(source, /const DEFAULT_IMAGE_RATIO = '3:4'/);
assert.match(source, /const isGptImage2Model = /);
assert.match(source, /const normalizeImageSize = /);
assert.match(source, /const getImageSizeWarning = /);
assert.match(source, /normalizeImageRatio\(parsedConfig\.imageSize\)/, '旧版像素尺寸应迁移为比例');

const apiBlock = source.match(/const IMAGE_SIZE_PATTERN = [\s\S]*?(?=\n\s*const isResponsesApiEndpoint)/)?.[0];
assert.ok(apiBlock, '应能提取图片请求辅助函数');
const { normalizeImageSize, getImageSizeWarning, buildImageRequestBody, readImageResponse } =
  Function(`${apiBlock}; return { normalizeImageSize, getImageSizeWarning, buildImageRequestBody, readImageResponse };`)();

assert.equal(normalizeImageSize('768x1024', 'gpt-image-2'), '3:4');
assert.equal(normalizeImageSize('3:4', 'gpt-image-2'), '3:4');
assert.equal(normalizeImageSize('1024x1536', 'gpt-image-2'), '2:3');
assert.equal(normalizeImageSize('3:4', 'seedream-3'), '768x1024', '普通兼容模型应将比例换算为像素尺寸');
assert.equal(normalizeImageSize('', 'seedream-3'), '768x1024');
assert.equal(getImageSizeWarning('3:4', 'gpt-image-2'), '');
assert.match(getImageSizeWarning('5:7', 'gpt-image-2'), /当前只支持/);
assert.match(getImageSizeWarning('5:7', 'seedream-3'), /比例暂不支持/);

// AIXoras gpt-image-2 系列使用 aspect_ratio，并可请求 URL 返回；其他模型继续走像素 size。
assert.deepEqual(buildImageRequestBody('gpt-image-2', '提示词', '768x1024'), {
  model: 'gpt-image-2',
  prompt: '提示词',
  n: 1,
  aspect_ratio: '3:4',
  quality: 'standard',
  response_format: 'url',
  watermark: false
});
assert.deepEqual(buildImageRequestBody('seedream-3', '提示词', '768x1024'), {
  model: 'seedream-3',
  prompt: '提示词',
  size: '768x1024',
  n: 1,
  response_format: 'b64_json'
});

const makeResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body });
await assert.rejects(
  readImageResponse(makeResponse(524, '<html><body>Gateway Timeout</body></html>')),
  /HTTP 524.*Gateway Timeout/s,
  'HTML 错误页应保留状态码和上游原文'
);
await assert.rejects(
  readImageResponse(makeResponse(429, JSON.stringify({ error: { message: '当前分组上游负载已饱和' } }))),
  /HTTP 429：当前分组上游负载已饱和/
);
await assert.rejects(readImageResponse(makeResponse(200, 'not json')), /接口返回了非 JSON 内容/);
await assert.rejects(readImageResponse(makeResponse(200, JSON.stringify({ data: [{}] }))), /未返回 url 或 b64_json/);
assert.deepEqual(
  await readImageResponse(makeResponse(200, JSON.stringify({ data: [{ b64_json: 'AAAA' }] }))),
  { remoteUrl: '', dataUrl: 'data:image/png;base64,AAAA' }
);

// ---- 7. 可对账的请求日志 ----
assert.match(source, /MOREIMG_IMAGE_USAGE_LOG_KEY/);
assert.match(source, /const appendImageUsageLog = /);
assert.match(source, /生图请求记录（可对账）/);
assert.match(source, /可能已计费/);
assert.match(generateImage, /outcome: '成功'/);
assert.match(generateImage, /outcome: isUserCancelled \? '已取消' : '失败'/);
assert.match(generateImage, /mayBeBilled/);

const storageBlock = source.match(/const loadImageUsageLog = [\s\S]*?(?=\n\s*const openImageDatabase)/)?.[0];
assert.ok(storageBlock, '应能提取生图日志辅助函数');
const store = new Map();
const { appendImageUsageLog, loadImageUsageLog, clearImageUsageLog, formatImageUsageLogText, summarizeImageUsageLog } = Function(
  'localStorage',
  'MOREIMG_IMAGE_USAGE_LOG_KEY',
  'IMAGE_USAGE_LOG_LIMIT',
  `${storageBlock}; return { appendImageUsageLog, loadImageUsageLog, clearImageUsageLog, formatImageUsageLogText, summarizeImageUsageLog };`
)(
  {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: key => store.delete(key)
  },
  'moreimg_image_usage_log',
  100
);

appendImageUsageLog({ cardTitle: '封面', mode: 'visual-only', model: 'gpt-image-2', size: '3:4', durationMs: 42000, outcome: '成功', mayBeBilled: true });
appendImageUsageLog({ cardTitle: '正文1/3', mode: 'full', model: 'gpt-image-2', size: '3:4', durationMs: 601000, outcome: '失败', mayBeBilled: true, detail: '图片生成超过 600 秒' });
const log = loadImageUsageLog();
assert.equal(log.length, 2);
assert.equal(log[0].cardTitle, '正文1/3', '最新记录应排在最前');
assert.ok(log[0].at, '每条记录都应带时间戳');
assert.deepEqual(summarizeImageUsageLog(log), { total: 2, success: 1, billedFailures: 1 });
const text = formatImageUsageLogText(log);
assert.match(text, /时间\t模型\t比例\/尺寸/);
assert.match(text, /601\.0/, '耗时应换算成秒便于对账');
assert.equal(clearImageUsageLog().length, 0);
assert.equal(loadImageUsageLog().length, 0);

console.log('Image billing safety contract passed: paid results are kept, cancellations are scoped, failures are auditable.');

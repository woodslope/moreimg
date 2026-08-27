import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixturePackage = {
  schema_version: 'moreimg-1.0',
  status: 'complete',
  analysis: {
    mode: 'single_point',
    topic: '设计复盘',
    core_claim: '记录取舍依据才能复用经验',
    independent_units: ['记录取舍依据'],
    fact_notes: [],
    logic_issues: []
  },
  article: {
    title: '设计复盘要记录取舍',
    subtitle: '让经验能被再次使用',
    paragraphs: ['设计复盘不只展示最终稿，还要记录每次取舍的依据，让经验能在下一个项目中复用。']
  },
  style_lock: {
    style_id: 'e2e-light-green',
    style_name: '浅色绿色工作台',
    card_shell: { preset: 'moreimg-clean-v1', surface: 'light', accent_color: '#237A57', overlay: 'soft_light' },
    prompt_prefix: '浅米白知识卡片，深绿强调色，等距图标风格。',
    visual_dna: {
      medium: 'isometric_icon',
      visual_world: '安静的设计复盘工作台',
      shape_language: '简洁几何线条',
      perspective: '等距俯视',
      lighting: '柔和自然光',
      material: '哑光纸张',
      recurring_subject: '同一组取舍卡片',
      recurring_elements: ['深绿标记', '纸张']
    },
    negative: ['文字', 'Logo', '伪文字']
  },
  pages: [
    {
      page_id: 'cover', order: 1, page_type: 'cover',
      card: { title: '设计复盘，别只展示最终稿', subtitle: '把每一次取舍的依据留下来', points: [], summary: '经验要能被再次使用' },
      semantic: { page_goal: '提出复盘重点', primary_claim: '复盘要记录取舍', primary_concept: '设计复盘', primary_relation: '取舍记录推动经验复用', supporting_concepts: [], excluded_concepts: [], avoid_misread: [] },
      image_prompt: { scene: '工作台上的取舍卡片', relationship: '取舍卡片连接最终设计稿', composition: '主体位于下半部', safe_area: 'top_40', continuity: '沿用工作台世界', avoid: [] }
    },
    {
      page_id: 'content-01', order: 2, page_type: 'relationship',
      card: { title: '留下取舍依据', subtitle: '', points: ['记录选择原因', '记录放弃方案'], summary: '依据比结果更能复用' },
      semantic: { page_goal: '解释记录方式', primary_claim: '取舍依据需被记录', primary_concept: '取舍依据', primary_relation: '选择与放弃共同形成经验', supporting_concepts: [], excluded_concepts: [], avoid_misread: [] },
      image_prompt: { scene: '两类取舍卡片', relationship: '选择卡与放弃卡汇入经验库', composition: '主体位于下半部', safe_area: 'top_52', continuity: '沿用工作台世界', avoid: [] }
    },
    {
      page_id: 'closing', order: 3, page_type: 'quote',
      card: { title: '让经验可以复用', subtitle: '', points: [], summary: '下一个项目不必从零开始' },
      semantic: { page_goal: '收束全文', primary_claim: '记录让经验得以复用', primary_concept: '可复用经验', primary_relation: '取舍记录连接下一个项目', supporting_concepts: [], excluded_concepts: [], avoid_misread: [] },
      image_prompt: { scene: '取舍卡片被收入经验盒', relationship: '经验盒连接新项目', composition: '主体位于下半部', safe_area: 'top_36', continuity: '沿用工作台世界', avoid: [] }
    }
  ]
};
const createFixturePackage = originalText => ({
  ...fixturePackage,
  analysis: {
    ...fixturePackage.analysis,
    mode: originalText.length >= 600 ? 'standard' : 'single_point'
  },
  article: {
    ...fixturePackage.article,
    paragraphs: [originalText.slice(0, originalText.length === 2000 ? Math.floor(originalText.length * 0.4) : originalText.length)]
  }
});

const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLrWQAAAABJRU5ErkJggg==';
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2' };
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const readJsonBody = request => new Promise((resolve, reject) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); }
  });
  request.on('error', reject);
});

const getFreePort = () => new Promise(resolve => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

const findChrome = async () => {
  const candidates = [
    process.env.MOREIMG_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error('未找到 Chrome，可通过 MOREIMG_CHROME_PATH 指定');
};

const createCdpClient = websocketUrl => new Promise((resolve, reject) => {
  const socket = new WebSocket(websocketUrl);
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('open', () => resolve({
    send(method, params = {}) {
      return new Promise((resolveCall, rejectCall) => {
        const id = nextId++;
        pending.set(id, { resolve: resolveCall, reject: rejectCall });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close()
  }));
  socket.addEventListener('error', reject);
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
});

const waitFor = async (check, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await sleep(100);
  }
  throw new Error('浏览器 E2E 等待超时');
};

const tempRoot = await mkdtemp(path.join(tmpdir(), 'moreimg-e2e-'));
const profilePath = path.join(tempRoot, 'profile');
const downloadPath = path.join(tempRoot, 'downloads');
const auditScreenshotDirectory = process.env.MOREIMG_UI_AUDIT_DIR || '';
await Promise.all([
  mkdir(profilePath),
  mkdir(downloadPath),
  ...(auditScreenshotDirectory ? [mkdir(auditScreenshotDirectory, { recursive: true })] : [])
]);
let artifactPath = '';
let imageRequestCount = 0;
const processedInputLengths = [];
const processingStreamFlags = [];
const appPort = await getFreePort();
const debugPort = await getFreePort();
const appUrl = `http://127.0.0.1:${appPort}/`;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${appPort}`);
  if (request.method === 'GET' && url.pathname.endsWith('/models')) {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ data: [{ id: 'fixture-text' }, { id: 'fixture-image' }] }));
    return;
  }
  if (request.method === 'POST' && (url.pathname === '/proxy/text' || url.pathname.endsWith('/chat/completions'))) {
    const body = await readJsonBody(request);
    const userContent = body.messages?.at(-1)?.content || '';
    const originalText = userContent.split('\n\n原文：\n').at(-1) || '';
    processedInputLengths.push(originalText.length);
    processingStreamFlags.push(body.stream);
    const packageText = JSON.stringify(createFixturePackage(originalText));
    if (originalText.length === 5000) {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
      for (let offset = 0; offset < packageText.length; offset += 137) {
        const delta = packageText.slice(offset, offset + 137);
        const event = `data: ${JSON.stringify({ choices: [{ delta: { content: delta }, finish_reason: null }] })}\n\n`;
        const splitAt = Math.max(1, Math.floor(event.length / 2));
        response.write(event.slice(0, splitAt));
        await sleep(1);
        response.write(event.slice(splitAt));
      }
      response.end(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`);
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ choices: [{ message: { content: packageText }, finish_reason: 'stop' }] }));
    return;
  }
  if (request.method === 'POST' && (url.pathname === '/proxy/image' || url.pathname.endsWith('/images/generations'))) {
    imageRequestCount += 1;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ data: [{ b64_json: imageBase64 }] }));
    return;
  }
  if (url.pathname === '/artifact.png' && artifactPath) {
    response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    response.end(await readFile(artifactPath));
    return;
  }
  const requestedPath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(directory, requestedPath);
  if (!filePath.startsWith(`${directory}${path.sep}`) && filePath !== path.join(directory, 'index.html')) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(appPort, '127.0.0.1', resolve));

const chromePath = await findChrome();
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--window-size=1440,1000',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profilePath}`, appUrl
], { stdio: 'ignore' });

let client;
try {
  const target = await waitFor(async () => {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json());
      return targets.find(item => item.type === 'page' && item.url.includes(`127.0.0.1:${appPort}`));
    } catch { return null; }
  });
  client = await createCdpClient(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true });

  const evaluate = async expression => {
    const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(`${detail}\nExpression: ${expression}`);
    }
    return result.result.value;
  };
  const captureAuditScreenshot = async name => {
    if (!auditScreenshotDirectory) return;
    const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(path.join(auditScreenshotDirectory, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
  };
  await client.send('Page.navigate', { url: appUrl });
  await waitFor(() => evaluate(`location.origin === 'http://127.0.0.1:${appPort}' && document.readyState === 'complete'`));
  const config = {
    apiUrl: `http://127.0.0.1:${appPort}/fixture/v1`, model: 'fixture-text', apiKey: 'fixture-key',
    imageApiUrl: `http://127.0.0.1:${appPort}/fixture/v1`, imageModel: 'fixture-image', imageApiKey: 'fixture-key', imageSize: '768x1024',
    promptVersion: 7, processingPreferences: { polishMode: 'standard', pageCount: 'auto', tone: 'preserve', preserveTitle: false, customInstruction: '' }
  };
  await evaluate(`localStorage.setItem('agent_api_config', ${JSON.stringify(JSON.stringify(config))})`);
  await client.send('Page.reload', { ignoreCache: true });
  await waitFor(() => evaluate('document.readyState === "complete"'));
  assert.equal(
    await evaluate(`Boolean(document.querySelector('link[data-moreimg-export-fonts="true"]'))`),
    false,
    '导出字体 CSS 不应进入首屏'
  );
  assert.equal(
    await evaluate(`document.querySelectorAll('svg[aria-hidden="true"]:empty').length`),
    0,
    '首屏 Lucide 子集不应出现缺失图标'
  );
  await evaluate(`(() => { const trigger = document.querySelector('button[aria-label="打开设置"]'); trigger.focus(); trigger.click(); })()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.config-dialog'))`));
  await waitFor(() => evaluate(`document.activeElement?.matches('.config-dialog input[data-dialog-initial-focus="true"]')`));
  const settingsDialogContract = await evaluate(`(() => {
    const dialog = document.querySelector('.config-dialog');
    return {
      role: dialog.getAttribute('role'),
      ariaModal: dialog.getAttribute('aria-modal'),
      labelledBy: dialog.getAttribute('aria-labelledby'),
      titleId: dialog.querySelector('h3')?.id,
      focused: document.activeElement?.className || ''
    };
  })()`);
  assert.deepEqual(
    [settingsDialogContract.role, settingsDialogContract.ariaModal, settingsDialogContract.labelledBy, settingsDialogContract.titleId],
    ['dialog', 'true', 'settings-dialog-title', 'settings-dialog-title'],
    `设置弹窗应消费共享模态语义: ${JSON.stringify(settingsDialogContract)}`
  );
  const modelLoadButtonCount = await evaluate(`document.querySelectorAll('button').length && [...document.querySelectorAll('button')].filter(button => button.textContent.trim() === '读取模型').length`);
  assert.equal(modelLoadButtonCount, 2, '设置弹窗应提供文本和图片两个模型读取入口');
  await evaluate(`([...document.querySelectorAll('button')].filter(button => button.textContent.trim() === '读取模型')[0]).click()`);
  await waitFor(() => evaluate(`document.querySelectorAll('.config-select-shell').length >= 4`));
  await evaluate(`([...document.querySelectorAll('button')].filter(button => button.textContent.trim() === '读取模型')[1]).click()`);
  await waitFor(() => evaluate(`document.querySelectorAll('.config-select-shell').length === 5`));
  const configSelectContract = await evaluate(`(() => [...document.querySelectorAll('.config-dialog select.config-select')].map(select => {
    const shell = select.closest('.config-select-shell');
    const icon = shell?.querySelector('.config-select-icon');
    const selectRect = select.getBoundingClientRect();
    const iconRect = icon?.getBoundingClientRect();
    const style = getComputedStyle(select);
    return {
      appearance: style.appearance,
      webkitAppearance: style.webkitAppearance,
      paddingRight: parseFloat(style.paddingRight),
      rightGap: selectRect.right - iconRect.right,
      centerDelta: iconRect.top + iconRect.height / 2 - (selectRect.top + selectRect.height / 2),
      iconPointerEvents: getComputedStyle(icon).pointerEvents
    };
  }))()`);
  assert.equal(configSelectContract.length, 5, `五个配置 Select 都应进入统一闭合态: ${JSON.stringify(configSelectContract)}`);
  assert.equal(configSelectContract.every(item => item.appearance === 'none' && item.webkitAppearance === 'none'), true, `原生箭头必须隐藏: ${JSON.stringify(configSelectContract)}`);
  assert.equal(configSelectContract.every(item => item.paddingRight >= 44 && Math.abs(item.rightGap - 16) < 0.5), true, `箭头右侧内边距必须稳定: ${JSON.stringify(configSelectContract)}`);
  assert.equal(configSelectContract.every(item => Math.abs(item.centerDelta) < 0.5 && item.iconPointerEvents === 'none'), true, `箭头必须和 Select 垂直居中且不拦截点击: ${JSON.stringify(configSelectContract)}`);
  const configSurfaceContract = await evaluate(`(() => {
    const read = selector => getComputedStyle(document.querySelector(selector)).backgroundColor;
    return { dialog: read('.config-dialog'), header: read('.config-dialog-header'), footer: read('.config-dialog-footer'), field: read('.config-dialog .mi-field') };
  })()`);
  assert.deepEqual(configSurfaceContract, { dialog: 'rgb(255, 255, 255)', header: 'rgb(255, 255, 255)', footer: 'rgb(248, 250, 252)', field: 'rgb(255, 255, 255)' }, `弹窗和字段必须使用不透明表面: ${JSON.stringify(configSurfaceContract)}`);
  const configNoticeContract = await evaluate(`(() => {
    const notice = document.querySelector('.config-preference-note');
    const style = getComputedStyle(notice);
    return {
      borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(parseFloat),
      borderRadius: parseFloat(style.borderRadius),
      boxShadow: style.boxShadow,
      hasIcon: Boolean(notice.querySelector('svg')),
      textLength: notice.textContent.trim().length
    };
  })()`);
  assert.deepEqual(configNoticeContract.borderWidths, [1, 1, 1, 1], `设置说明应使用四边统一细框: ${JSON.stringify(configNoticeContract)}`);
  assert.deepEqual([configNoticeContract.borderRadius, configNoticeContract.boxShadow, configNoticeContract.hasIcon], [10, 'none', true], `设置说明应保持轻量提示层级: ${JSON.stringify(configNoticeContract)}`);
  assert.ok(configNoticeContract.textLength > 0, '设置说明应保留简洁正文');
  await sleep(800);
  const configScrollPerformance = await evaluate(`(async () => {
    const dialog = document.querySelector('.config-dialog');
    const body = document.querySelector('.config-dialog-body');
    const overlay = dialog?.parentElement;
    if (!dialog || !body || !overlay) return null;
    const dialogStyle = getComputedStyle(dialog);
    const bodyStyle = getComputedStyle(body);
    const overlayStyle = getComputedStyle(overlay);
    body.scrollTop = 0;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const startedAt = performance.now();
    let previousAt = startedAt;
    const intervals = [];
    await new Promise(resolve => {
      const tick = now => {
        if (now - startedAt >= 1000) return resolve();
        intervals.push(now - previousAt);
        previousAt = now;
        body.scrollTop = ((now - startedAt) / 1000) * Math.max(0, body.scrollHeight - body.clientHeight);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    body.scrollTop = 0;
    intervals.sort((a, b) => a - b);
    return {
      dialogBackdropFilter: dialogStyle.backdropFilter,
      overlayBackdropFilter: overlayStyle.backdropFilter,
      overscrollBehavior: bodyStyle.overscrollBehavior,
      frames: intervals.length,
      averageMs: Number((intervals.reduce((sum, value) => sum + value, 0) / Math.max(1, intervals.length)).toFixed(2)),
      p95Ms: Number((intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * .95))] || 0).toFixed(2))
    };
  })()`);
  assert.ok(configScrollPerformance, '设置弹窗滚动性能采样应成功');
  assert.equal(configScrollPerformance.dialogBackdropFilter, 'none', '设置弹窗不得实时采样背景');
  assert.equal(configScrollPerformance.overlayBackdropFilter, 'none', '设置弹窗遮罩不得实时采样背景');
  assert.equal(configScrollPerformance.overscrollBehavior, 'contain', '设置弹窗滚动边界应隔离外层回弹');
  console.log(`Modal scroll performance: ${JSON.stringify(configScrollPerformance)}`);
  const configHelperContrast = await evaluate(`(() => {
    const parseRgb = value => (value.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
    const luminance = rgb => {
      const channels = rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (foreground, background) => {
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
    };
    return [...document.querySelectorAll('.config-section-description, .config-hint')].map(element => ({
      text: element.textContent.trim(),
      color: getComputedStyle(element).color,
      ratio: contrast(parseRgb(getComputedStyle(element).color), [255, 255, 255])
    }));
  })()`);
  assert.equal(configHelperContrast.length > 0, true, '设置弹窗应包含必要的辅助说明');
  assert.equal(
    configHelperContrast.every(item => item.ratio >= 4.5),
    true,
    `设置弹窗辅助说明对比度不足: ${JSON.stringify(configHelperContrast)}`
  );
  const configControlContract = await evaluate(`(async () => {
    const inspect = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { height: Math.round(rect.height), borderRadius: parseFloat(style.borderRadius) };
    };
    const helperAction = document.querySelector('.config-action-button');
    const field = document.querySelector('.config-input');
    const saveAction = [...document.querySelectorAll('button')].find(item => item.textContent.includes('保存并应用配置'));
    helperAction.focus();
    await new Promise(requestAnimationFrame);
    const helperFocus = getComputedStyle(helperAction);
    const helperFocusEvidence = { outlineStyle: helperFocus.outlineStyle, outlineWidth: parseFloat(helperFocus.outlineWidth) };
    field.focus();
    await new Promise(requestAnimationFrame);
    const fieldFocus = getComputedStyle(field);
    return {
      helper: inspect(helperAction),
      field: inspect(field),
      save: inspect(saveAction),
      helperFocus: helperFocusEvidence,
      fieldFocus: { focusVisible: field.matches(':focus-visible'), boxShadow: fieldFocus.boxShadow }
    };
  })()`);
  assert.deepEqual(
    [configControlContract.helper.height, configControlContract.field.height, configControlContract.save.height],
    [36, 48, 48],
    `配置控件应遵循 36/48/48px 合同: ${JSON.stringify(configControlContract)}`
  );
  assert.equal(configControlContract.helper.borderRadius, 10, '配置辅助操作应使用 10px 圆角');
  assert.equal(configControlContract.field.borderRadius, 12, '配置字段应使用 12px 圆角');
  assert.equal(configControlContract.save.borderRadius, 12, '保存主操作应使用 12px 圆角');
  assert.equal(configControlContract.helperFocus.outlineStyle, 'solid', '配置辅助操作应显示共享焦点环');
  assert.ok(configControlContract.helperFocus.outlineWidth >= 2, '配置辅助操作焦点环至少为 2px');
  assert.equal(configControlContract.fieldFocus.focusVisible, true, '配置字段应提供键盘焦点状态');
  assert.notEqual(configControlContract.fieldFocus.boxShadow, 'none', '配置字段应显示共享焦点阴影');
  const diagnosticSurfaceContract = await evaluate(`(() => {
    const diagnostic = document.querySelector('.image-diagnostic');
    const style = getComputedStyle(diagnostic);
    diagnostic.open = true;
    return {
      className: diagnostic.className,
      borderRadius: parseFloat(style.borderRadius),
      open: diagnostic.open,
      emptyCopyVisible: Boolean(diagnostic.querySelector('.image-diagnostic-empty'))
    };
  })()`);
  assert.equal(diagnosticSurfaceContract.className.includes('mi-surface-card'), true, '生图诊断应消费共享卡片表面');
  assert.deepEqual(
    [diagnosticSurfaceContract.borderRadius, diagnosticSurfaceContract.open, diagnosticSurfaceContract.emptyCopyVisible],
    [12, true, true],
    '生图诊断应保持 12px 共享圆角并可展开空诊断说明'
  );
  await evaluate(`(() => {
    window.__moreimgOriginalFetch = window.fetch;
    window.fetch = () => new Promise(() => {});
    document.querySelector('.config-action-button').click();
    return true;
  })()`);
  await waitFor(() => evaluate(`document.querySelector('.config-action-button')?.getAttribute('aria-busy') === 'true'`));
  await waitFor(() => evaluate(`Boolean(document.querySelector('.config-status-loading'))`));
  const configFeedbackContract = await evaluate(`(() => {
    const status = document.querySelector('.config-status-loading');
    const style = getComputedStyle(status);
    return {
      className: status.className,
      role: status.getAttribute('role'),
      borderLeftWidth: parseFloat(style.borderLeftWidth),
      borderRadius: parseFloat(style.borderRadius)
    };
  })()`);
  assert.equal(configFeedbackContract.className.includes('mi-feedback-neutral'), true, '配置加载状态应消费共享中性反馈');
  assert.equal(configFeedbackContract.role, 'status', '配置加载状态应暴露 status 语义');
  assert.deepEqual([configFeedbackContract.borderLeftWidth, configFeedbackContract.borderRadius], [1, 10], '配置状态应保持四边统一细框和共享圆角');
  const configLoadingContract = await evaluate(`(() => {
    const action = document.querySelector('.config-action-button');
    const style = getComputedStyle(action);
    return { disabled: action.disabled, ariaBusy: action.getAttribute('aria-busy'), cursor: style.cursor, height: Math.round(action.getBoundingClientRect().height) };
  })()`);
  assert.deepEqual(
    configLoadingContract,
    { disabled: true, ariaBusy: 'true', cursor: 'wait', height: 36 },
    '配置加载状态应保持尺寸稳定并暴露 disabled/aria-busy'
  );
  await evaluate(`(() => { window.fetch = window.__moreimgOriginalFetch; return true; })()`);
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(() => evaluate(`!document.querySelector('.config-dialog')`));
  await waitFor(() => evaluate(`document.activeElement?.getAttribute('aria-label') === '打开设置'`));
  await evaluate(`document.querySelector('button[aria-label="打开设置"]').click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.config-dialog'))`));
  assert.equal(await evaluate(`Boolean(document.querySelector('.config-status-loading'))`), false, '关闭设置应取消模型请求并清理 loading 状态');
  await evaluate(`document.querySelector('button[aria-label="关闭设置"]').click()`);
  assert.equal(
    await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('一键生成 AI 物料包')).disabled`),
    true,
    '空输入时不应允许启动加工'
  );
  await evaluate(`(() => { const input=document.querySelector('textarea'); const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(input,'   '); input.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
  assert.equal(
    await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('一键生成 AI 物料包')).disabled`),
    true,
    '纯空格输入时不应允许启动加工'
  );

  const lengthCases = [
    { length: 20, modeLabel: '单点模式' },
    { length: 600, modeLabel: '标准模式' },
    { length: 2000, modeLabel: '标准模式', warning: true },
    { length: 5000, modeLabel: '标准模式' }
  ].map(testCase => {
    const prefix = `长度${testCase.length}字测试：`;
    return { ...testCase, input: (prefix + '文'.repeat(testCase.length)).slice(0, testCase.length) };
  });

  for (const testCase of lengthCases) {
    const previousRequestCount = processedInputLengths.length;
    await evaluate(`(() => { const input=document.querySelector('textarea'); const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(input,${JSON.stringify(testCase.input)}); input.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    await evaluate(`(() => { const button=[...document.querySelectorAll('button')].find(item=>item.textContent.includes('一键生成 AI 物料包')); button.click(); return true; })()`);
    await waitFor(() => processedInputLengths.length === previousRequestCount + 1);
    const expectedTitle = `${testCase.input.substring(0, 20)}...`;
    await waitFor(() => evaluate(`!document.body.innerText.includes('停止运算') && document.body.innerText.includes(${JSON.stringify(expectedTitle)})`));
    await waitFor(() => evaluate(`JSON.parse(localStorage.getItem('moreimg_history_index') || '[]').some(item => item.title === ${JSON.stringify(expectedTitle)})`));
    assert.equal(await evaluate(`document.body.innerText.includes('流程未完整完成')`), false);
    assert.equal(
      await evaluate(`document.body.innerText.includes('标准模式正文保留率低于 65%')`),
      Boolean(testCase.warning),
      `${testCase.length} 字警告状态应符合正文保留率`
    );
    if (testCase.warning) {
      const warningFeedbackContract = await evaluate(`(() => {
        const notice = document.querySelector('.processing-notice');
        return notice ? { className: notice.className, role: notice.getAttribute('role'), borderLeftWidth: parseFloat(getComputedStyle(notice).borderLeftWidth) } : null;
      })()`);
      assert.ok(warningFeedbackContract, '正文保留率警告应渲染');
      assert.equal(warningFeedbackContract.className.includes('mi-feedback-warning'), true, '流程警告应消费共享警告反馈');
      assert.equal(warningFeedbackContract.role, 'status', '非阻断流程警告应暴露 status 语义');
      assert.equal(warningFeedbackContract.borderLeftWidth, 1, '流程警告应保持四边统一细框');
    }
    await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('理解与核查')).click()`);
    assert.equal(
      await evaluate(`document.body.innerText.includes(${JSON.stringify(`加工模式：${testCase.modeLabel}`)})`),
      true,
      `${testCase.length} 字加工模式应为${testCase.modeLabel}`
    );
  }
  assert.deepEqual(processedInputLengths, lengthCases.map(testCase => testCase.length));
  assert.deepEqual(processingStreamFlags, lengthCases.map(() => true), '核心加工必须保持单次 stream=true 请求');
  await sleep(550);
  const keyboardFocusEvidence = await evaluate(`(() => {
    const inspect = element => {
      element.focus();
      const style = getComputedStyle(element);
      return {
        className: element.className,
        height: Math.round(element.getBoundingClientRect().height),
        ariaSelected: element.getAttribute('aria-selected'),
        focusVisible: element.matches(':focus-visible'),
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth)
      };
    };
    const primaryAction = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === '新建文章');
    const stageTab = document.querySelector('.results-stage-tab');
    return [inspect(primaryAction), inspect(stageTab)];
  })()`);
  assert.equal(
    keyboardFocusEvidence.every(item => item.focusVisible && item.outlineStyle === 'solid' && item.outlineWidth >= 2),
    true,
    `核心操作缺少统一键盘焦点: ${JSON.stringify(keyboardFocusEvidence)}`
  );
  assert.deepEqual(keyboardFocusEvidence.map(item => item.height), [40, 40], '结果态新建入口与阶段标签应遵循 40px 合同');
  assert.equal(keyboardFocusEvidence[1].ariaSelected, 'true', '当前阶段标签应暴露选中语义');
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await waitFor(() => evaluate(`document.querySelector('.results-stage-tab[aria-selected="true"]')?.textContent.includes('文章与卡片')`));
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
  await waitFor(() => evaluate(`document.querySelector('.results-stage-tab[aria-selected="true"]')?.textContent.includes('理解与核查')`));
  const inputText = lengthCases.at(-1).input;
  await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('文章与卡片')).click()`);
  await waitFor(() => evaluate(`document.querySelectorAll('.content-card-panel').length >= 3`));
  const deferredCardStyles = await evaluate(`[...document.querySelectorAll('.content-card-panel')].map(card => {
    const style = getComputedStyle(card);
    return { contentVisibility: style.contentVisibility, containIntrinsicSize: style.containIntrinsicSize };
  })`);
  assert.equal(deferredCardStyles.every(style => style.contentVisibility === 'auto'), true, '离屏内容卡片必须启用 content-visibility');
  assert.equal(deferredCardStyles.every(style => style.containIntrinsicSize.includes('240px')), true, '离屏内容卡片必须预留稳定高度');
  const cardScrollHeightBefore = await evaluate(`document.querySelector('.moreimg-main-scroll').scrollHeight`);
  await evaluate(`(() => { const scroller = document.querySelector('.moreimg-main-scroll'); scroller.scrollTop = scroller.scrollHeight; return scroller.scrollTop; })()`);
  await sleep(100);
  const cardScrollHeightAfter = await evaluate(`document.querySelector('.moreimg-main-scroll').scrollHeight`);
  assert.ok(Math.abs(cardScrollHeightAfter - cardScrollHeightBefore) <= 160, `离屏卡片进入视口时滚动高度变化过大: ${cardScrollHeightBefore} -> ${cardScrollHeightAfter}`);
  await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('视觉生成与对比')).click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('link[data-moreimg-export-fonts="true"]'))`));
  assert.equal(
    await evaluate(`document.querySelectorAll('svg[aria-hidden="true"]:empty').length`),
    0,
    '结果页 Lucide 子集不应出现缺失图标'
  );
  const visualControlContract = await evaluate(`(() => {
    const pageTab = document.querySelector('.visual-page-tab');
    const actions = [...document.querySelectorAll('.visual-button')];
    const panel = document.querySelector('.visual-panel');
    const resultItem = document.querySelector('.visual-result-item');
    return {
      pageTabHeight: Math.round(pageTab.getBoundingClientRect().height),
      pageTabSelected: pageTab.getAttribute('aria-selected'),
      actionHeights: actions.map(action => Math.round(action.getBoundingClientRect().height)),
      panelClassName: panel.className,
      panelRadius: parseFloat(getComputedStyle(panel).borderRadius),
      resultClassName: resultItem.className,
      resultRadius: parseFloat(getComputedStyle(resultItem).borderRadius)
    };
  })()`);
  assert.equal(visualControlContract.pageTabHeight, 40, '视觉页面标签应使用共享 40px 页签');
  assert.equal(visualControlContract.pageTabSelected, 'true', '当前视觉页面标签应暴露选中语义');
  assert.equal(visualControlContract.actionHeights.every(height => height === 40), true, `视觉操作应统一为 40px: ${JSON.stringify(visualControlContract)}`);
  assert.equal(visualControlContract.panelClassName.includes('mi-surface-raised'), true, '视觉工作台应消费共享抬升表面');
  assert.equal(visualControlContract.resultClassName.includes('mi-surface-card'), true, '视觉结果项应消费共享卡片表面');
  assert.deepEqual([visualControlContract.panelRadius, visualControlContract.resultRadius], [16, 12], '面板与结果卡应遵循 16/12px 表面合同');
  const visualEmptyStateContract = await evaluate(`(() => {
    const media = document.querySelector('.visual-result-slot-empty');
    const mediaIcon = media?.querySelector('.mi-empty-state-icon');
    const comparison = document.querySelector('.visual-comparison-empty');
    const mediaRect = media?.getBoundingClientRect();
    const mediaStyle = media && getComputedStyle(media);
    const comparisonStyle = comparison && getComputedStyle(comparison);
    return media && mediaIcon && comparison ? {
      mediaClassName: media.className,
      mediaRatio: mediaRect.height / mediaRect.width,
      mediaRadius: parseFloat(mediaStyle.borderRadius),
      mediaBorderStyle: mediaStyle.borderStyle,
      iconSize: [Math.round(mediaIcon.getBoundingClientRect().width), Math.round(mediaIcon.getBoundingClientRect().height)],
      comparisonClassName: comparison.className,
      comparisonBorderWidth: parseFloat(comparisonStyle.borderWidth),
      comparisonBackground: comparisonStyle.backgroundColor
    } : null;
  })()`);
  assert.ok(visualEmptyStateContract, '视觉结果与对比区应渲染共享空状态');
  assert.equal(visualEmptyStateContract.mediaClassName.includes('mi-empty-state-media'), true, '视觉媒体槽应消费共享媒体空状态');
  assert.ok(Math.abs(visualEmptyStateContract.mediaRatio - (4 / 3)) < 0.01, `视觉媒体空状态应保持 3:4: ${JSON.stringify(visualEmptyStateContract)}`);
  assert.deepEqual(
    [visualEmptyStateContract.mediaRadius, visualEmptyStateContract.mediaBorderStyle, visualEmptyStateContract.iconSize],
    [10, 'dashed', [40, 40]],
    '视觉媒体空状态应保持 10px 圆角、虚线边框和 40px 图标'
  );
  assert.equal(visualEmptyStateContract.comparisonClassName.includes('mi-empty-state-inline'), true, '对比占位应消费共享内嵌空状态');
  assert.deepEqual(
    [visualEmptyStateContract.comparisonBorderWidth, visualEmptyStateContract.comparisonBackground],
    [0, 'rgba(0, 0, 0, 0)'],
    '内嵌空状态不得重复绘制边框或背景'
  );
  await evaluate(`document.querySelector('.visual-page-tab').focus()`);
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await waitFor(() => evaluate(`document.querySelector('.visual-page-tab[aria-selected="true"]') === [...document.querySelectorAll('.visual-page-tab')].at(-1)`));
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
  await waitFor(() => evaluate(`document.querySelector('.visual-page-tab[aria-selected="true"]') === document.querySelector('.visual-page-tab')`));
  const promptDisclosureContract = await evaluate(`(() => [...document.querySelectorAll('.visual-disclosure')].map(item => ({
    open: item.open,
    summary: item.querySelector('summary')?.textContent.trim(),
    copyVisible: item.querySelector('button')?.getClientRects().length > 0
  })))()`);
  assert.equal(promptDisclosureContract.length, 2, '当前视觉页应提供两个提示词 disclosure');
  assert.equal(promptDisclosureContract.every(item => !item.open && !item.copyVisible), true, `提示词应默认折叠并让媒体保持优先: ${JSON.stringify(promptDisclosureContract)}`);
  await evaluate(`document.querySelector('.visual-disclosure summary').click()`);
  await waitFor(() => evaluate(`document.querySelector('.visual-disclosure')?.open === true`));
  await evaluate(`document.querySelector('button[aria-label="复制原始视觉提示词"]').click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.mi-toast'))`));
  await sleep(550);
  const successToastContract = await evaluate(`(() => {
    const toast = document.querySelector('.mi-toast');
    const dismiss = toast.querySelector('button[aria-label="关闭通知"]');
    const style = getComputedStyle(toast);
    return {
      className: toast.className,
      role: toast.getAttribute('role'),
      width: Math.round(toast.getBoundingClientRect().width),
      dismissSize: [Math.round(dismiss.getBoundingClientRect().width), Math.round(dismiss.getBoundingClientRect().height)],
      borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(parseFloat),
      borderRadius: parseFloat(style.borderRadius)
    };
  })()`);
  assert.equal(successToastContract.className.includes('mi-feedback-success'), true, '成功 Toast 应消费共享成功反馈');
  assert.equal(successToastContract.role, 'status', '成功 Toast 应暴露 status 语义');
  assert.equal(successToastContract.width <= 420, true, '桌面 Toast 不应无限拉宽');
  assert.deepEqual(successToastContract.dismissSize, [32, 32], 'Toast 关闭操作应使用共享 32px 图标按钮');
  assert.deepEqual([successToastContract.borderWidths, successToastContract.borderRadius], [[1, 1, 1, 1], 16], `桌面 Toast 应使用完整细框且保持独立圆角: ${JSON.stringify(successToastContract)}`);
  await evaluate(`document.querySelector('button[aria-label="关闭通知"]').click()`);
  await waitFor(() => evaluate(`!document.querySelector('.mi-toast')`));
  const deferredVisualSectionStyle = await evaluate(`(() => { const style = getComputedStyle(document.querySelector('.visual-section')); return { contentVisibility: style.contentVisibility, containIntrinsicSize: style.containIntrinsicSize }; })()`);
  assert.equal(deferredVisualSectionStyle.contentVisibility, 'auto', '下方成品对比区必须启用 content-visibility');
  assert.equal(deferredVisualSectionStyle.containIntrinsicSize.includes('900px'), true, '下方成品对比区必须预留稳定高度');
  const htmlPreviewBounds = await evaluate(`(() => {
    const frame = document.querySelector('.html-card-preview-frame');
    const card = frame?.querySelector('.html-card-preview-scale');
    if (!frame || !card) return null;
    const frameRect = frame.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      leftGap: cardRect.left - frameRect.left,
      topGap: cardRect.top - frameRect.top,
      rightGap: frameRect.right - cardRect.right,
      bottomGap: frameRect.bottom - cardRect.bottom
    };
  })()`);
  assert.ok(htmlPreviewBounds, 'HTML 成品预览应存在');
  assert.equal(
    Object.values(htmlPreviewBounds).every(gap => Math.abs(gap) < 0.1),
    true,
    `HTML 成品预览必须无缝铺满 3:4 预览框: ${JSON.stringify(htmlPreviewBounds)}`
  );
  const pendingHtmlContract = await evaluate(`({
    label: document.querySelector('.visual-comparison-label')?.textContent.trim() || '',
    status: document.querySelector('.visual-output-status')?.textContent.trim() || '',
    placeholder: document.querySelector('.html-card-placeholder-badge')?.textContent.trim() || '',
    hasExportAction: [...document.querySelectorAll('button')].some(item => item.textContent.includes('导出 HTML 成品 PNG'))
  })`);
  assert.deepEqual(
    pendingHtmlContract,
    { label: 'HTML 排版预览', status: '生成主视觉后可导出', placeholder: '等待主视觉', hasExportAction: false },
    '无主视觉时必须诚实呈现排版预览状态，不得冒充可导出的成品'
  );
  await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.trim()==='生成主视觉').click()`);
  try {
    await waitFor(() => evaluate(`Boolean(document.querySelector('button[aria-label="下载主视觉"]')) || Boolean(document.querySelector('.visual-error'))`));
  } catch (error) {
    const imageState = await evaluate(`({
      button: [...document.querySelectorAll('button')].find(item => item.textContent.includes('生成中') || item.textContent.includes('生成主视觉'))?.textContent.trim() || '',
      error: document.querySelector('.visual-error')?.textContent || '',
      diagnostic: localStorage.getItem('moreimg_last_image_diagnostic') || ''
    })`);
    throw new Error(`${error.message}; imageRequests=${imageRequestCount}; state=${JSON.stringify(imageState)}`);
  }
  const generationError = await evaluate(`document.querySelector('.visual-error')?.textContent || ''`);
  assert.equal(generationError, '', generationError);
  assert.equal(await evaluate(`document.querySelector('.visual-comparison-label')?.textContent.trim()`), 'HTML 成品', '主视觉成功后应切换为 HTML 成品');
  assert.equal(await evaluate(`document.querySelector('input[aria-label="调整主视觉纵向焦点"]')?.value`), '58', '封面应使用稳定的默认焦点');
  await evaluate(`(() => {
    const input = document.querySelector('input[aria-label="调整主视觉纵向焦点"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '37');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(`document.querySelector('.moreimg-export-card')?.style.getPropertyValue('--moreimg-card-focus-y') === '37%'`));
  try {
    await waitFor(() => evaluate(`(async () => {
      const history = JSON.parse(localStorage.getItem('moreimg_history_index') || '[]');
      const sessionId = history[0]?.id;
      if (!sessionId) return false;
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('moreimg_images', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const record = await new Promise((resolve, reject) => {
        const request = database.transaction('generated_images', 'readonly').objectStore('generated_images').get(sessionId + ':visual-only:封面');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return record?.focusY === 37;
    })()`));
  } catch (error) {
    const focusState = await evaluate(`(async () => {
      const history = JSON.parse(localStorage.getItem('moreimg_history_index') || '[]');
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('moreimg_images', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const records = await new Promise((resolve, reject) => {
        const request = database.transaction('generated_images', 'readonly').objectStore('generated_images').getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return { history, records: records.map(item => ({ id: item.id, sessionId: item.sessionId, cardTitle: item.cardTitle, mode: item.mode, focusY: item.focusY })) };
    })()`);
    throw new Error(`${error.message}; focusState=${JSON.stringify(focusState)}`);
  }
  assert.equal(await evaluate(`document.querySelector('.visual-preview-image')?.decoding`), 'async', '生成结果预览图必须异步解码');
  const generatedPreviewBounds = await evaluate(`(() => {
    const frame = document.querySelector('.visual-preview');
    const image = frame?.querySelector('.visual-preview-image');
    if (!frame || !image) return null;
    const frameRect = frame.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    return {
      leftGap: imageRect.left - frameRect.left,
      topGap: imageRect.top - frameRect.top,
      rightGap: frameRect.right - imageRect.right,
      bottomGap: frameRect.bottom - imageRect.bottom
    };
  })()`);
  assert.ok(generatedPreviewBounds, '生成结果预览应存在');
  assert.equal(
    Object.values(generatedPreviewBounds).every(gap => Math.abs(gap) < 0.1),
    true,
    `生成结果预览必须无缝铺满 3:4 预览框: ${JSON.stringify(generatedPreviewBounds)}`
  );
  await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.trim()==='生成 AI 整图').click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('button[aria-label="下载 AI 整图"]')) || Boolean(document.querySelector('.visual-error'))`));
  assert.equal(await evaluate(`document.querySelector('.visual-error')?.textContent || ''`), '', 'AI 整图生成不应报错');
  const deferredComparisonImage = await evaluate(`(() => { const image = document.querySelector('.visual-comparison-image'); return image ? { loading: image.loading, decoding: image.decoding } : null; })()`);
  assert.deepEqual(deferredComparisonImage, { loading: 'lazy', decoding: 'async' }, '下方重复 AI 整图必须懒加载并异步解码');
  const legacyWarningTitle = await evaluate(`(async () => {
    const title = [...document.querySelectorAll('.visual-page-tab')].at(-1)?.textContent.trim() || '';
    const history = JSON.parse(localStorage.getItem('moreimg_history_index') || '[]');
    const sessionId = history[0]?.id;
    if (!title || !sessionId) return '';
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('moreimg_images', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('generated_images', 'readwrite');
      transaction.objectStore('generated_images').put({
        id: sessionId + ':visual:' + title,
        sessionId,
        cardTitle: title,
        mode: 'visual',
        blob: new Blob(['legacy fixture'], { type: 'image/png' }),
        updatedAt: Date.now()
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return title;
  })()`);
  assert.ok(legacyWarningTitle, '应能为历史恢复验收准备旧版主视觉状态');

  await client.send('Page.reload', { ignoreCache: true });
  await waitFor(() => evaluate('document.readyState === "complete"'));
  const expectedHistoryTitle = `${inputText.substring(0, 20)}...`;
  try {
    await waitFor(() => evaluate(`document.body.innerText.includes(${JSON.stringify(expectedHistoryTitle)})`));
  } catch (error) {
    const historyState = await evaluate(`({
      expected: ${JSON.stringify(expectedHistoryTitle)},
      empty: document.body.innerText.includes('暂无历史记录'),
      storage: Object.fromEntries(Object.keys(localStorage).filter(key => key.includes('history')).map(key => [key, localStorage.getItem(key)]))
    })`);
    throw new Error(`${error.message}; history=${JSON.stringify(historyState)}`);
  }
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  const historyKeyboardContract = await evaluate(`(() => {
    const mainAction = document.querySelector('.history-item-main');
    const actionRail = document.querySelector('.history-item-actions');
    const retryAction = actionRail?.querySelector('button[aria-label^="再次生成"]');
    const deleteAction = actionRail?.querySelector('button[aria-label^="删除记录"]');
    if (!mainAction || !actionRail || !retryAction || !deleteAction) return null;
    mainAction.focus();
    const mainStyle = getComputedStyle(mainAction);
    const mainOutlineStyle = mainStyle.outlineStyle;
    const mainOutlineWidth = parseFloat(mainStyle.outlineWidth);
    retryAction.focus();
    const retryStyle = getComputedStyle(retryAction);
    const retryRect = retryAction.getBoundingClientRect();
    return {
      mainTag: mainAction.tagName,
      mainOutlineStyle,
      mainOutlineWidth,
      retryOutlineStyle: retryStyle.outlineStyle,
      retryOutlineWidth: parseFloat(retryStyle.outlineWidth),
      retryWidth: retryRect.width,
      retryHeight: retryRect.height,
      retryLabel: retryAction.getAttribute('aria-label'),
      deleteLabel: deleteAction.getAttribute('aria-label')
    };
  })()`);
  assert.ok(historyKeyboardContract, '历史记录应提供独立的键盘主操作和有名称的辅助操作');
  assert.equal(historyKeyboardContract.mainTag, 'BUTTON', '历史记录主操作应使用原生按钮');
  assert.equal(historyKeyboardContract.mainOutlineStyle, 'solid', '历史记录主操作应显示统一焦点环');
  assert.ok(historyKeyboardContract.mainOutlineWidth >= 2, '历史记录主操作焦点环至少为 2px');
  assert.equal(historyKeyboardContract.retryOutlineStyle, 'solid', '历史辅助操作应显示共享焦点环');
  assert.ok(historyKeyboardContract.retryOutlineWidth >= 2, '历史辅助操作焦点环至少为 2px');
  assert.deepEqual(
    [historyKeyboardContract.retryWidth, historyKeyboardContract.retryHeight],
    [32, 32],
    '历史辅助操作应使用共享 32px 紧凑图标按钮'
  );
  assert.ok(historyKeyboardContract.retryLabel && historyKeyboardContract.deleteLabel, '历史记录图标操作应提供可访问名称');
  await waitFor(() => evaluate(`parseFloat(getComputedStyle(document.querySelector('.history-item-actions')).opacity) === 1`), 2000);
  const historyCountBeforeDelete = await evaluate(`JSON.parse(localStorage.getItem('moreimg_history_index') || '[]').length`);
  await evaluate(`document.querySelector('.history-item-actions button[aria-label^="删除记录"]').click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.confirm-dialog'))`));
  await waitFor(() => evaluate(`document.activeElement?.textContent.trim() === '取消'`));
  const deleteConfirmContract = await evaluate(`(() => {
    const dialog = document.querySelector('.confirm-dialog');
    const cancel = [...dialog.querySelectorAll('button')].find(button => button.textContent.trim() === '取消');
    return {
      role: dialog.getAttribute('role'),
      ariaModal: dialog.getAttribute('aria-modal'),
      title: dialog.querySelector('h2')?.textContent.trim(),
      cancelFocused: document.activeElement === cancel,
      copy: dialog.textContent.trim()
    };
  })()`);
  assert.deepEqual(
    [deleteConfirmContract.role, deleteConfirmContract.ariaModal, deleteConfirmContract.title, deleteConfirmContract.cancelFocused],
    ['dialog', 'true', '删除这条记录？', true],
    `危险删除应明确目标且默认聚焦取消: ${JSON.stringify(deleteConfirmContract)}`
  );
  assert.equal(deleteConfirmContract.copy.includes('永久删除') && deleteConfirmContract.copy.includes('无法恢复'), true, '删除确认应解释后果');
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
  assert.equal(await evaluate(`document.activeElement?.textContent.includes('确认删除')`), true, '从首个操作反向 Tab 应回到模态内最后一个操作');
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate(`document.activeElement?.textContent.trim() === '取消'`), true, '从最后一个操作 Tab 应回到模态内首个操作');
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(() => evaluate(`!document.querySelector('.confirm-dialog')`));
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('moreimg_history_index') || '[]').length`), historyCountBeforeDelete, '取消删除不得修改历史记录');
  await evaluate(`document.querySelector('.history-item-main').click()`);
  await waitFor(() => evaluate(`document.body.innerText.includes('视觉生成与对比')`));
  const selectedHistorySurface = await evaluate(`(() => {
    const current = document.querySelector('.history-item-main[aria-current="true"]');
    const item = current?.closest('.history-item');
    return item ? { className: item.className, radius: parseFloat(getComputedStyle(item).borderRadius), ariaCurrent: current.getAttribute('aria-current') } : null;
  })()`);
  assert.ok(selectedHistorySurface, '历史恢复后应标记当前记录');
  assert.equal(selectedHistorySurface.className.includes('mi-surface-selected'), true, '当前历史项应消费共享选中表面');
  assert.deepEqual([selectedHistorySurface.radius, selectedHistorySurface.ariaCurrent], [12, 'true'], '历史选中项应保持共享圆角与当前语义');
  await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('视觉生成与对比')).click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('button[aria-label="下载主视觉"]'))`));
  await evaluate(`[...document.querySelectorAll('.visual-page-tab')].find(item => item.textContent.trim() === ${JSON.stringify(legacyWarningTitle)})?.click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.visual-result-notice'))`));
  const visualWarningContract = await evaluate(`(() => {
    const notice = document.querySelector('.visual-result-notice');
    const icon = notice?.querySelector('.visual-result-notice-icon');
    const copy = document.querySelector('.visual-column-copy');
    const grid = document.querySelector('.visual-result-grid');
    const column = document.querySelector('.visual-results-column');
    if (!notice || !icon || !copy || !grid || !column) return null;
    const noticeRect = notice.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const columnRect = column.getBoundingClientRect();
    const style = getComputedStyle(notice);
    return {
      role: notice.getAttribute('role'),
      ariaLive: notice.getAttribute('aria-live'),
      radius: parseFloat(style.borderRadius),
      iconSize: [Math.round(iconRect.width), Math.round(iconRect.height)],
      noticeWidth: noticeRect.width,
      columnWidth: columnRect.width,
      topGap: copyRect.bottom ? noticeRect.top - copyRect.bottom : 0,
      bottomGap: gridRect.top - noticeRect.bottom,
      borderColor: style.borderColor,
      background: style.backgroundColor
    };
  })()`);
  assert.ok(visualWarningContract, '历史恢复后的旧版视觉警告应真实渲染');
  assert.deepEqual([visualWarningContract.role, visualWarningContract.ariaLive, visualWarningContract.radius, visualWarningContract.iconSize], ['status', 'polite', 10, [16, 16]], `视觉警告应保持状态语义和图标几何: ${JSON.stringify(visualWarningContract)}`);
  assert.equal(visualWarningContract.noticeWidth < visualWarningContract.columnWidth - 1, true, `短提示不应无理由横跨整个结果列: ${JSON.stringify(visualWarningContract)}`);
  assert.equal(Math.abs(visualWarningContract.topGap - 14) < 1, true, `视觉警告与说明文本的上间距应为 14px: ${JSON.stringify(visualWarningContract)}`);
  assert.equal(Math.abs(visualWarningContract.bottomGap - 14) < 1, true, `视觉警告与结果网格的下间距应为 14px: ${JSON.stringify(visualWarningContract)}`);
  await captureAuditScreenshot('1440-results');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  const compactDesktopContract = await evaluate(`(() => {
    const sidebar = document.querySelector('.moreimg-sidebar');
    const trigger = [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label')?.startsWith('打开历史记录'));
    return {
      sidebarWidth: sidebar.getBoundingClientRect().width,
      sidebarHeight: sidebar.getBoundingClientRect().height,
      composerDisplay: getComputedStyle(document.querySelector('.sidebar-composer')).display,
      triggerDisplay: getComputedStyle(trigger).display,
      rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  })()`);
  assert.deepEqual(compactDesktopContract, { sidebarWidth: 320, sidebarHeight: 900, composerDisplay: 'none', triggerDisplay: 'none', rootOverflow: 0 }, `1024px 结果态应使用桌面侧栏并折叠输入区: ${JSON.stringify(compactDesktopContract)}`);
  await evaluate(`document.querySelector('.compact-composer-toggle').click()`);
  await waitFor(() => evaluate(`getComputedStyle(document.querySelector('.sidebar-composer')).display === 'block' && document.querySelector('.compact-composer-toggle').textContent.includes('收起新建文章')`));
  await evaluate(`document.querySelector('.compact-composer-toggle').click()`);
  await waitFor(() => evaluate(`getComputedStyle(document.querySelector('.sidebar-composer')).display === 'none' && document.querySelector('.compact-composer-toggle').textContent.includes('新建文章')`));
  await captureAuditScreenshot('1024-results');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  const tabletLayoutContract = await evaluate(`(() => {
    const sidebar = document.querySelector('.moreimg-sidebar');
    const panel = document.querySelector('.visual-panel');
    const resultItems = [...document.querySelectorAll('.visual-result-item')];
    const composer = document.querySelector('.sidebar-composer');
    const toggle = document.querySelector('.compact-composer-toggle');
    return {
      sidebarWidth: sidebar.getBoundingClientRect().width,
      sidebarHeight: sidebar.getBoundingClientRect().height,
      panelWidth: panel.getBoundingClientRect().width,
      itemWidths: resultItems.map(item => item.getBoundingClientRect().width),
      composerDisplay: getComputedStyle(composer).display,
      toggleDisplay: getComputedStyle(toggle).display,
      rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  })()`);
  assert.equal(tabletLayoutContract.sidebarWidth, 768, `768px 不应提前启用 320px 固定侧栏: ${JSON.stringify(tabletLayoutContract)}`);
  assert.equal(tabletLayoutContract.sidebarHeight < 130, true, `平板结果态顶部壳应保持紧凑: ${JSON.stringify(tabletLayoutContract)}`);
  assert.equal(tabletLayoutContract.panelWidth > 640, true, `平板结果工作台应获得完整内容宽度: ${JSON.stringify(tabletLayoutContract)}`);
  assert.equal(tabletLayoutContract.itemWidths.every(width => width >= 240), true, `视觉结果项不得被压缩到合同最小宽度以下: ${JSON.stringify(tabletLayoutContract)}`);
  assert.deepEqual([tabletLayoutContract.composerDisplay, tabletLayoutContract.toggleDisplay, tabletLayoutContract.rootOverflow], ['none', 'flex', 0], `平板结果态应折叠输入且无横向溢出: ${JSON.stringify(tabletLayoutContract)}`);
  await captureAuditScreenshot('768-results');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  const mobileHistoryTrigger = await evaluate(`(() => {
    const trigger = [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label')?.startsWith('打开历史记录'));
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    return { visible: getComputedStyle(trigger).display !== 'none', width: rect.width, height: rect.height, label: trigger.getAttribute('aria-label') };
  })()`);
  assert.ok(mobileHistoryTrigger?.visible, '窄屏必须提供可见的历史记录入口');
  assert.equal(mobileHistoryTrigger.height, 40, '窄屏历史入口应消费共享 40px 操作合同');
  await captureAuditScreenshot('390-results');
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label')?.startsWith('打开历史记录')).click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.mobile-history-dialog'))`));
  await sleep(550);
  const mobileHistoryContract = await evaluate(`(() => {
    const dialog = document.querySelector('.mobile-history-dialog');
    const overlay = dialog.parentElement;
    const body = dialog.querySelector('.mobile-history-dialog-body');
    const actions = [...dialog.querySelectorAll('.history-item-actions button')];
    const actionRail = dialog.querySelector('.history-item-actions');
    const dialogRect = dialog.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const titleActionClearances = [...dialog.querySelectorAll('.history-item')].map(item => {
      const titleRect = item.querySelector('.history-item-title').getBoundingClientRect();
      const actionRect = item.querySelector('.history-item-actions').getBoundingClientRect();
      return actionRect.left - titleRect.right;
    });
    return {
      role: dialog.getAttribute('role'),
      ariaModal: dialog.getAttribute('aria-modal'),
      overlayZIndex: getComputedStyle(overlay).zIndex,
      bodyBackground: getComputedStyle(body).backgroundColor,
      hitOwned: Boolean(document.elementFromPoint(bodyRect.left + 24, bodyRect.top + 24)?.closest('.mobile-history-dialog')),
      dialogRect: { left: dialogRect.left, right: dialogRect.right, top: dialogRect.top, bottom: dialogRect.bottom },
      rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      actionOpacity: parseFloat(getComputedStyle(actionRail).opacity),
      actionSizes: actions.map(action => [Math.round(action.getBoundingClientRect().width), Math.round(action.getBoundingClientRect().height)]),
      titleActionClearances,
      actionLabels: actions.map(action => action.getAttribute('aria-label')),
      closeLabel: dialog.querySelector('button[aria-label="关闭历史记录"]')?.getAttribute('aria-label') || ''
    };
  })()`);
  assert.deepEqual([mobileHistoryContract.role, mobileHistoryContract.ariaModal], ['dialog', 'true'], '窄屏历史记录应暴露模态语义');
  assert.deepEqual([mobileHistoryContract.overlayZIndex, mobileHistoryContract.bodyBackground, mobileHistoryContract.hitOwned], ['40', 'rgb(248, 250, 252)', true], `窄屏历史弹窗应以不透明内容层覆盖页面: ${JSON.stringify(mobileHistoryContract)}`);
  assert.equal(mobileHistoryContract.rootOverflow, 0, '窄屏历史弹窗不得制造横向溢出');
  assert.equal(mobileHistoryContract.dialogRect.left >= 16 && mobileHistoryContract.dialogRect.right <= 374, true, `窄屏历史弹窗应保留 16px 边距: ${JSON.stringify(mobileHistoryContract)}`);
  assert.equal(mobileHistoryContract.actionOpacity, 1, '触屏历史辅助操作必须直接可见');
  assert.equal(mobileHistoryContract.actionSizes.every(size => size[0] === 32 && size[1] === 32), true, `触屏历史辅助操作应保持 32px 共享几何: ${JSON.stringify(mobileHistoryContract)}`);
  assert.equal(mobileHistoryContract.titleActionClearances.every(clearance => clearance >= 0), true, `历史标题不得进入常显辅助操作区: ${JSON.stringify(mobileHistoryContract)}`);
  assert.equal(mobileHistoryContract.actionLabels.every(Boolean) && Boolean(mobileHistoryContract.closeLabel), true, '窄屏历史操作应提供可访问名称');
  await captureAuditScreenshot('390-history-dialog');
  await evaluate(`document.querySelector('.mobile-history-dialog .history-item-main').click()`);
  await waitFor(() => evaluate(`!document.querySelector('.mobile-history-dialog')`));
  await waitFor(() => evaluate(`document.querySelector('.results-stage-tab[aria-selected="true"]')?.textContent.includes('视觉生成与对比')`));
  await evaluate(`document.querySelector('button[aria-label="复制原始视觉提示词"]').click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.mi-toast'))`));
  await sleep(550);
  const mobileToastContract = await evaluate(`(() => {
    const toast = document.querySelector('.mi-toast');
    const toastRect = toast.getBoundingClientRect();
    const style = getComputedStyle(toast);
    const protectedActions = [...document.querySelectorAll('.sidebar-header-actions button, .processing-action-button')];
    const overlaps = protectedActions.some(action => {
      const rect = action.getBoundingClientRect();
      return toastRect.left < rect.right && toastRect.right > rect.left && toastRect.top < rect.bottom && toastRect.bottom > rect.top;
    });
    return {
      bottomGap: innerHeight - toastRect.bottom,
      leftGap: toastRect.left,
      rightGap: innerWidth - toastRect.right,
      overlaps,
      rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(parseFloat)
    };
  })()`);
  assert.equal(Math.abs(mobileToastContract.bottomGap - 12) < 1, true, `窄屏 Toast 应保留底部 12px 安全距离: ${JSON.stringify(mobileToastContract)}`);
  assert.equal(Math.abs(mobileToastContract.leftGap - 12) < 1 && Math.abs(mobileToastContract.rightGap - 12) < 1, true, `窄屏 Toast 应保留左右 12px 边距: ${JSON.stringify(mobileToastContract)}`);
  assert.deepEqual([mobileToastContract.overlaps, mobileToastContract.rootOverflow], [false, 0], '窄屏 Toast 不得覆盖顶部关键操作或制造横向溢出');
  assert.deepEqual(mobileToastContract.borderWidths, [1, 1, 1, 1], `窄屏 Toast 应保持四边统一细框: ${JSON.stringify(mobileToastContract)}`);
  await evaluate(`document.querySelector('button[aria-label="关闭通知"]').click()`);
  await waitFor(() => evaluate(`!document.querySelector('.mi-toast')`));

  await client.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 500, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  const zoomEquivalentContract = await evaluate(`(() => ({
    sidebarWidth: document.querySelector('.moreimg-sidebar').getBoundingClientRect().width,
    toggleDisplay: getComputedStyle(document.querySelector('.compact-composer-toggle')).display,
    rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }))()`);
  assert.deepEqual(zoomEquivalentContract, { sidebarWidth: 720, toggleDisplay: 'flex', rootOverflow: 0 }, '1440px 在 200% 浏览器缩放的等效宽度下，新建入口应可达且无横向溢出');
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await sleep(100);
  assert.equal(await evaluate(`visualViewport?.scale`), 2, '页面应允许用户放大到 200%');
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });

  await client.send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);
  const desktopResponsiveHistory = await evaluate(`(() => {
    const trigger = [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label')?.startsWith('打开历史记录'));
    const composer = document.querySelector('.sidebar-composer');
    const composerToggle = document.querySelector('.compact-composer-toggle');
    const historyMain = document.querySelector('.history-item-main');
    return {
      triggerDisplay: getComputedStyle(trigger).display,
      desktopHistoryDisplay: getComputedStyle(document.querySelector('.moreimg-history')).display,
      composerDisplay: getComputedStyle(composer).display,
      composerToggleDisplay: getComputedStyle(composerToggle).display,
      historyMainPaddingRight: parseFloat(getComputedStyle(historyMain).paddingRight),
      rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  })()`);
  assert.deepEqual(desktopResponsiveHistory, { triggerDisplay: 'none', desktopHistoryDisplay: 'flex', composerDisplay: 'none', composerToggleDisplay: 'flex', historyMainPaddingRight: 0, rootOverflow: 0 }, '桌面结果态应只显示新建入口，历史标题不应被隐藏操作压缩');
  const desktopWidthContract = await evaluate(`({ width: innerWidth, sidebarWidth: document.querySelector('.moreimg-sidebar').getBoundingClientRect().width })`);
  assert.deepEqual(desktopWidthContract, { width: 1440, sidebarWidth: 320 }, '1440px 桌面应保持固定侧栏与完整工作区');

  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  const forcedLightContract = await evaluate(`({
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    appBackground: getComputedStyle(document.querySelector('.moreimg-app-shell')).backgroundColor
  })`);
  assert.deepEqual(forcedLightContract, { colorScheme: 'light', bodyBackground: 'rgb(248, 250, 252)', appBackground: 'rgb(248, 250, 252)' }, '系统深色偏好下仍应稳定使用项目明确声明的单一浅色主题');
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const reducedMotionContract = await evaluate(`({
    inputBorderAnimation: getComputedStyle(document.querySelector('.sidebar-input-shell'), '::before').animationName,
    resultEntranceAnimation: getComputedStyle(document.querySelector('.animate-fade-in-down')).animationName,
    reducedMotionMatches: matchMedia('(prefers-reduced-motion: reduce)').matches
  })`);
  assert.deepEqual(reducedMotionContract, { inputBorderAnimation: 'none', resultEntranceAnimation: 'none', reducedMotionMatches: true }, '减少动效偏好下应关闭循环与入场动画');
  await client.send('Emulation.setEmulatedMedia', { features: [] });

  await evaluate(`[...document.querySelectorAll('.visual-page-tab')].find(item => item === document.querySelector('.visual-page-tab'))?.click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('button[aria-label="下载主视觉"]'))`));
  assert.equal(await evaluate(`document.querySelector('input[aria-label="调整主视觉纵向焦点"]')?.value`), '37', '历史恢复后应保留用户调整的画面焦点');
  await evaluate(`new Promise((resolve, reject) => {
    if (window.html2canvas) return resolve();
    const script = document.createElement('script');
    script.src = 'vendor/html2canvas.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('测试导出组件加载失败'));
    document.head.appendChild(script);
  })`);
  await evaluate(`(() => {
    window.__moreimgOriginalHtml2Canvas = window.html2canvas;
    window.__moreimgHtml2CanvasCalls = 0;
    window.html2canvas = async () => {
      window.__moreimgHtml2CanvasCalls += 1;
      await new Promise(resolve => setTimeout(resolve, 120));
      throw new Error('fixture render failure');
    };
    return true;
  })()`);
  assert.equal(
    await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('导出 HTML 成品 PNG')).disabled`),
    false,
    '已有主视觉时导出按钮必须可操作'
  );
  await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('导出 HTML 成品 PNG')).click()`);
  try {
    await waitFor(() => evaluate(`document.body.innerText.includes('导出中')`));
  } catch (error) {
    const exportState = await evaluate(`({
      button: [...document.querySelectorAll('button')].find(item=>item.textContent.includes('导出'))?.textContent.trim() || '',
      disabled: [...document.querySelectorAll('button')].find(item=>item.textContent.includes('导出'))?.disabled ?? null,
      error: document.querySelector('.visual-export-error')?.textContent || '',
      calls: window.__moreimgHtml2CanvasCalls
    })`);
    throw new Error(`${error.message}; export=${JSON.stringify(exportState)}`);
  }
  assert.equal(
    await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('导出中')).disabled`),
    true,
    '导出期间必须禁用重复操作'
  );
  const exportLoadingContract = await evaluate(`(() => {
    const action = [...document.querySelectorAll('button')].find(item => item.textContent.includes('导出中'));
    return { ariaBusy: action.getAttribute('aria-busy'), cursor: getComputedStyle(action).cursor, height: Math.round(action.getBoundingClientRect().height) };
  })()`);
  assert.deepEqual(exportLoadingContract, { ariaBusy: 'true', cursor: 'wait', height: 40 }, '导出加载状态应保持共享尺寸并暴露 aria-busy');
  await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('导出中')).click()`);
  await waitFor(() => evaluate(`document.body.innerText.includes('导出失败（渲染卡片）：fixture render failure')`));
  const exportErrorFeedback = await evaluate(`(() => {
    const inlineError = document.querySelector('.visual-export-error');
    const toast = document.querySelector('.mi-toast[role="alert"]');
    return {
      inlineClassName: inlineError?.className || '',
      inlineRole: inlineError?.getAttribute('role') || '',
      toastClassName: toast?.className || '',
      toastRole: toast?.getAttribute('role') || ''
    };
  })()`);
  assert.equal(exportErrorFeedback.inlineClassName.includes('mi-feedback-error'), true, '导出局部错误应消费共享错误反馈');
  assert.equal(exportErrorFeedback.toastClassName.includes('mi-feedback-error'), true, '导出失败 Toast 应消费共享错误反馈');
  assert.deepEqual([exportErrorFeedback.inlineRole, exportErrorFeedback.toastRole], ['alert', 'alert'], '导出错误应在局部与 Toast 暴露 alert 语义');
  assert.equal(await evaluate(`window.__moreimgHtml2CanvasCalls`), 1, '重复点击不得重复渲染导出图');
  assert.equal(
    await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('导出 HTML 成品 PNG')).disabled`),
    false,
    '导出失败后必须恢复操作'
  );
  await evaluate(`(() => { window.html2canvas = window.__moreimgOriginalHtml2Canvas; return true; })()`);
  await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('导出 HTML 成品 PNG')).click()`);
  artifactPath = await waitFor(async () => {
    const files = await readdir(downloadPath);
    const file = files.find(name => name.endsWith('HTML成品.png'));
    return file ? path.join(downloadPath, file) : '';
  });
  assert.ok((await stat(artifactPath)).size > 10000, '导出 PNG 不应为空');

  const historyCountBeforeConfirmedDelete = await evaluate(`JSON.parse(localStorage.getItem('moreimg_history_index') || '[]').length`);
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label')?.startsWith('打开历史记录')).click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.mobile-history-dialog'))`));
  await evaluate(`document.querySelector('.mobile-history-dialog button[aria-label^="删除记录"]').click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.confirm-dialog'))`));
  await evaluate(`[...document.querySelectorAll('.confirm-dialog button')].find(button => button.textContent.includes('确认删除')).click()`);
  await waitFor(() => evaluate(`JSON.parse(localStorage.getItem('moreimg_history_index') || '[]').length === ${historyCountBeforeConfirmedDelete - 1}`));
  await waitFor(() => evaluate(`!document.querySelector('.confirm-dialog')`));

  await client.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/artifact.png` });
  await waitFor(() => evaluate('document.readyState === "complete" && document.querySelector("img")?.complete'));
  const pixels = await evaluate(`(() => { const image=document.querySelector('img'); const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const context=canvas.getContext('2d'); context.drawImage(image,0,0); const data=context.getImageData(0,0,canvas.width,canvas.height).data; let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1; for(let y=0;y<canvas.height;y+=4){ for(let x=0;x<canvas.width;x+=4){ if(data[(y*canvas.width+x)*4+3]>8){ minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y); } } } const sample=(x,y)=>[...data.slice((y*canvas.width+x)*4,(y*canvas.width+x)*4+4)]; return {width:canvas.width,height:canvas.height,contentWidth:maxX-minX+1,contentHeight:maxY-minY+1,shadeTop:sample(1200,40),shadeMiddle:sample(1200,910)}; })()`);
  assert.deepEqual([pixels.width, pixels.height], [1242, 1656]);
  assert.ok(pixels.contentWidth > 1100, `导出内容宽度异常: ${pixels.contentWidth}`);
  assert.ok(pixels.contentHeight > 1500, `导出内容高度异常: ${pixels.contentHeight}`);
  // 主视觉占位图为纯红，soft_light 遮罩生效时顶部应接近浅色、中部仍偏原色；相等则说明遮罩层被导出丢弃。
  assert.ok(pixels.shadeTop[1] > 200, `导出成品缺少背景遮罩（顶部像素 ${pixels.shadeTop}）`);
  assert.ok(pixels.shadeMiddle[1] < 150, `导出成品遮罩渐变失真（中部像素 ${pixels.shadeMiddle}）`);
  console.log('Chrome E2E covers processing, persistence, dialogs, 390/768/1024/1440 layouts, 200% zoom, media preferences, image restore, export, and full-canvas pixels.');
} finally {
  client?.close();
  chrome.kill('SIGTERM');
  if (chrome.exitCode === null) {
    await new Promise(resolve => chrome.once('exit', resolve));
  }
  await new Promise(resolve => server.close(resolve));
  await rm(tempRoot, { recursive: true, force: true });
}

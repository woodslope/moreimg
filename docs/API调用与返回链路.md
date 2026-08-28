# MoreImg API 调用与返回链路

本文是 MoreImg 当前版本的接口事实记录。排查接口问题时，先按本文确定请求是否发出、上游返回了什么，以及失败发生在传输、解析还是本地保存阶段。

## 1. 支持边界

MoreImg 只实现两类稳定协议：

| 能力 | 当前协议 | 返回兼容 | 明确不做 |
| --- | --- | --- | --- |
| 文本加工 | 一次 `POST`，请求体固定 `stream: true` | SSE；也兼容供应商误返回的普通 JSON | 不因失败自动改发非流式请求 |
| 图片生成 | 一次同步 `POST /images/generations` | `data[0].b64_json`、`data[0].url` | 异步任务、`task_id` 轮询、失败后换协议重试 |

“普通 JSON 响应”是对返回格式的兼容，不代表应用会主动发送非流式文本请求。所有失败都不自动重试，原因是上游可能已经受理并计费。

## 2. 配置与地址

设置保存在当前浏览器的 `localStorage`，键名为 `agent_api_config`：

- 文本：`apiUrl`、`model`、`apiKey`
- 图片：`imageApiUrl`、`imageModel`、`imageApiKey`、`imageSize`

接口地址可填写基础地址或完整地址：

- 文本基础地址 `/v1` 会补成 `/v1/chat/completions`
- 文本完整地址也支持 `/responses`
- 图片基础地址 `/v1` 会补成 `/v1/images/generations`
- 模型列表地址由请求 endpoint 去掉业务路径后推导为 `/models`

页面会显示“实际请求”地址。地址解析由 `src/core/api.js` 的 `resolveApiEndpoint` 和 `deriveModelsEndpoint` 负责。

## 3. 页面部署分流

### GitHub Pages

GitHub Pages 是静态页面，浏览器直接请求用户填写的 HTTPS 接口：

```text
GitHub Pages
  -> 供应商文本/图片 endpoint
```

前提是供应商允许该 GitHub Pages 域名的 CORS。API Key 只保存在当前浏览器，但浏览器端代码和请求都能接触到它，这适合个人使用，不适合公开共享密钥。

### 本地 `server.py`

本地页面访问外部 HTTPS 接口时，前端改走同源代理：

```text
浏览器 -> /proxy/text   -> 上游 /chat/completions 或 /responses
浏览器 -> /proxy/image  -> 上游 /images/generations
浏览器 -> /proxy/models -> 上游 /models
浏览器 -> /proxy/image-asset -> 图片 URL 本体
```

固定路径 `/v1/chat/completions` 和 `/v1/images/generations` 仍可转发到服务端配置的默认上游。代理只在请求尚未送达上游的连接故障时尝试直连回退；HTTP 错误、超时和可能已提交的连接不会重发。

## 4. 文本调用链

入口是 `src/app.jsx` 的 `requestProcessingText`：

1. 由 `resolveApiEndpoint` 得到实际 endpoint。
2. 由 `buildProcessingRequestBody` 生成请求体。
3. Chat Completions 请求包含 `model`、`messages`、`stream: true`；`gpt-5`/`o*` 模型使用 `max_completion_tokens`，其他模型使用 `max_tokens`。
4. Responses API 请求包含 `model`、`instructions`、`input`、`stream: true`、`max_output_tokens`。
5. 通过 `fetchTextRequest` 发出一次请求，鉴权为 `Authorization: Bearer <API Key>`。
6. 非 2xx 响应由 `readApiErrorMessage` 读取 JSON、代理 `detail` 或 HTML 原文，保留状态码。
7. `readProcessingResponse` 根据 `Content-Type` 读取 SSE；供应商即使错误地返回普通 JSON，也会按 JSON 解析。
8. SSE 拼接 Chat 的 `delta.content` 或 Responses 的 `response.output_text.delta`，必须收到 `[DONE]` 或完成事件。
9. 完整文本交给 `parseMoreImgPackage`，再做 `moreimg-1.0` 字段、页码、正文保留率和视觉字段校验。

模型如果返回代码块或前后说明文字，解析器会在单一完整 JSON 对象可确定时提取它；如果 JSON 截断、存在无法解析的 SSE 事件或结构校验失败，则停止使用不完整内容，不追加第二次请求。

## 5. 图片调用链

入口是 `src/app.jsx` 的 `handleGenerateImage`：

1. 由 `resolveApiEndpoint` 得到 `/images/generations` endpoint。
2. `buildImageRequestBody` 按模型协议生成请求体。
3. `gpt-image-2` 使用 `aspect_ratio`，其他模型使用像素 `size`；兼容模型优先请求 `response_format: b64_json`，`gpt-image` 系列按其支持能力处理。
4. 发出一次同步 POST，不支持异步 task ID。
5. `readImageResponse` 读取 `data[0].b64_json` 或 `data[0].url`，同时保留 HTTP 状态码和 HTML/JSON 错误。
6. Base64 直接转 Blob；URL 需要再次下载图片本体。
7. 下载成功后写入 IndexedDB：`moreimg_images/generated_images`，之后才更新页面预览。
8. 图片请求、耗时、格式、是否可能计费写入浏览器中的生图记录，便于与供应商账单对照。

GitHub Pages 下，URL 图片二次下载仍受图片 CDN CORS、签名有效期和 403 策略影响。要保证保存和 HTML 导出，供应商应返回 `b64_json`，或者额外提供图片代理；静态页面本身不能绕过 CDN 的 CORS。

## 6. 故障定位

| 现象 | 重点判断 | 证据/处理 |
| --- | --- | --- |
| HTTP 401/403/429 | 上游已返回业务错误 | 看状态码和 `readApiErrorMessage` 原文，先修密钥、权限或额度 |
| HTTP 502 | 代理无法完成通信 | 看 `detail`；不要自动重试，先核对上游是否有提交 |
| HTTP 504/524 | 代理或上游等待超时 | 长文本/图片可能已计费，先对账再决定是否重新发起 |
| 流中断、缺 `[DONE]` | 网关掐断或上游断流 | 使用已收到的错误信息，不使用不完整 JSON |
| 文本返回成功但结构错误 | 生成格式不符合 `moreimg-1.0` | 检查原始返回是否被代码块/说明包裹、是否截断 |
| 图片返回 URL 后失败 | 二次下载的 CORS、过期或 403 | 优先改为 `b64_json` 或增加图片代理 |
| 图片已生成但刷新后没有 | 下载或 IndexedDB 保存阶段失败 | 查看“最近一次生图诊断”和生图请求记录 |

## 7. 回归验证

修改 `src/` 后先运行：

```bash
node build.mjs
node --test "tests/*.test.mjs"
python3 tests/server_performance_test.py
```

重点回归：Chat SSE、Responses SSE、普通 JSON 响应、数组 delta、坏 SSE 事件、模型列表代理、图片 Base64、图片 URL 下载失败、HTTP/HTML 错误，以及 GitHub Pages 的真实 CORS 行为。

## 8. 以后调整原则

- 先判断失败发生在“请求未发出、上游已返回、响应解析、图片下载、IndexedDB 保存”的哪一段。
- 不把普通 JSON 响应误认为非流式请求，也不把 URL 下载失败误认为图片生成失败。
- 不用自动重试掩盖账单状态；新增重试前必须先证明请求未被上游受理。
- 新增供应商协议时，先单独增加适配器和夹具测试，不修改现有协议的默认行为。

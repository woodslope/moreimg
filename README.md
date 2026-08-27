# MoreImg 本地运行版

来源：<https://github.com/woodslope/moreimg>

本目录保留原项目无需脚手架即可运行的静态应用方式，并将 React、ReactDOM、Babel、Lucide 和 Tailwind 的运行时 CDN 依赖改为本地文件，避免公开 CDN 或 GitHub Pages 网络不稳定时无法启动。

可编辑源码位于 `src/`：`template.html` 保存页面外壳，`core/` 保存解析、协议、请求与卡片逻辑，`components/` 保存 React 组件，`app.jsx` 负责应用状态和页面装配。`build.mjs` 会先聚合生成兼容测试与审计工具的 `src.html`，再使用本地 Babel 生成浏览器直接加载的 `index.html` 与 `app.js`。构建时同时从 Lucide 生成项目实际使用的图标子集，运行时页面不再加载 Babel 或完整 Lucide 包。

`src.html`、`index.html`、`app.js` 和 `vendor/lucide-moreimg.js` 均为构建产物，不应直接修改。

`styles.css` 是一次性预编译好的 Tailwind 产物，**构建过程不会重新编译 CSS**。因此新写的 Tailwind 工具类（尤其是 `lg:` 断点和 `styles.css` 里没出现过的间距/颜色）不会有任何规则，页面只是静默不生效。新增样式请写进 `src/template.html` 的 `<style>`，沿用现有 `mi-*` / `moreimg-*` 语义类；响应式断点也由那里的 `@media` 拥有。

`vendor/` 下的第三方运行时是手工下载的，版本与 SHA-256 登记在 [`vendor/DEPENDENCIES.md`](./vendor/DEPENDENCIES.md)。

## 源码结构

```text
src/
├── template.html          # HTML 外壳和页面样式
├── source-files.mjs       # 构建时的模块顺序清单
├── runtime.js             # React hooks 运行时绑定
├── storage.js             # IndexedDB、历史记录和图片存储
├── prompt.js              # MoreImg 默认系统提示词
├── core/
│   ├── processing.js      # 加工阶段、质量判断和请求控制
│   ├── package.js         # moreimg-1.0 校验与提示词拼合
│   ├── api.js             # 接口地址、请求体和流式响应
│   ├── cards.js           # 卡片数据转换与视觉提示词
│   └── config.js          # 配置迁移和导出依赖
├── hooks/
│   └── use-result-content.jsx # 结果阶段内容与操作区装配
├── components/
│   ├── app-view.jsx       # 页面外壳与顶层视图组合
│   ├── sidebar.jsx        # 桌面侧栏与窄屏历史入口
│   ├── main-workspace.jsx # 输入区、进度区和结果工作台
│   ├── history.jsx        # 历史记录列表与弹窗
│   ├── settings-dialog.jsx # 文本和图片接口设置
│   └── …                  # 格式化、卡片和反馈组件
└── app.jsx                # 应用状态、请求和页面控制

tests/                     # Node、Python 和浏览器回归测试
```

本地服务会对 HTML、CSS 和 JavaScript 响应启用 gzip；构建产物中的静态资源带内容哈希，可使用长期不变缓存。导出卡字体样式仅在卡片预览或导出时加载。

提示词相关改动先阅读 [`提示词数据流契约.md`](./docs/提示词数据流契约.md)。该文档区分文本 AI 生成的页面语义、Style Lock、逐页视觉语义，以及前端仅负责的图片执行提示词拼合与 HTML 外壳映射。

模型、系统提示词、Schema、解析或正文质量门变化后，按 [`SEMANTIC_QUALITY_CHECKLIST.md`](./docs/SEMANTIC_QUALITY_CHECKLIST.md) 使用三类黄金样本做发布前语义回归。普通 UI、图片或导出调整不需要重复消耗文本 API。

## 构建

本目录是自包含的，没有 `package.json`，所有命令都直接用 `node` / `python3` 运行：

```bash
node build.mjs
```

`build.mjs` 会重新生成 `src.html`、`index.html`、`app.js` 和 `vendor/lucide-moreimg.js`。修改 `src/` 后必须重新构建，否则 `tests/build-source-contract.test.mjs` 会失败。

## 启动

```bash
python3 server.py
```

然后打开：<http://127.0.0.1:4187/>

## 测试

全部 20 个 Node 测试（含真实 Chrome 端到端，需要引号让 Node 自己展开 glob）：

```bash
node --test "tests/*.test.mjs"
```

本地服务的 gzip、缓存头与跨站代理拒绝：

```bash
python3 tests/server_performance_test.py
```

单独跑 Chrome 端到端验证（使用临时浏览器数据和本地假接口，不读取真实 API Key）：

```bash
node tests/browser-e2e.test.mjs
```

该脚本会在真实 Chrome 中验证空输入拦截，依次加工 20、600、2000、5000 字输入，再执行“生成主视觉 → 刷新恢复 → 导出 HTML PNG”，并检查导出图片为 1242×1656 且内容覆盖整幅画布。JSON 校验测试另外覆盖 599 和 10000 字边界。测试使用本地假接口，不验证真实模型对长文的语义质量。默认寻找本机 Chrome，也可通过 `MOREIMG_CHROME_PATH` 指定其他 Chrome/Chromium 可执行文件。

API Key、加工偏好和历史记录由应用保存在当前浏览器中，不写入本目录。MoreImg v6 的核心加工规则与 `moreimg-1.0` JSON 协议内置在应用里，不再向普通用户开放编辑，避免误改字段后页面无法读取。

文本模型每次加工只发起一次 API 请求，请求内容仍是“内置加工规则 + 用户原文 + 简单加工偏好”。核心加工使用流式传输降低长请求在网关等待期间超时的概率，但页面只在内存中缓冲数据，完整接收后才解析一次 `moreimg-1.0` JSON 并渲染，不会按数据片反复更新页面。接口忽略流式参数并返回普通 JSON 时仍可正常处理。

模型必须一次返回完整 `moreimg-1.0` JSON；页面严格检查完整正文、封面、连续正文页、固定封底、Style Lock 和逐页视觉字段。JSON 非法、字段缺失、页码跳号或输出截断时直接显示错误，不自动补写、不自动转换，也不追加文本请求。

标准模式正文按去空白字符计算保留率：低于 30% 时视为严重摘要化并停止流程；30%-65% 时允许继续查看文章、卡片和视觉提示词，但显示完整性警告；达到 65% 时正常通过。该分层避免模型合理去重后被直接拦截，同时保留对过度摘要的硬保护。

设置页的“加工偏好”只开放精修方式、总页数、标题保留、内容口吻和补充要求。默认页面结构固定为“封面 + 1-7 张正文 + 封底”；原文没有行动建议时，封底使用原文已有结论自然收束，不新增任务、互动问题或关注引导。

## 单张生图

设置面板新增独立的图片接口地址、图片模型、图片尺寸和图片 API Key。当前支持兼容 OpenAI Images API 的 `POST /v1/images/generations` 接口，请求包含 `model`、`prompt`、经合法性校正的 `size` 和 `n: 1`，响应支持：

- `data[0].b64_json`（优先；非 `gpt-image` 模型会显式请求 `response_format: b64_json`）
- `data[0].url`（回退；本地服务模式下经 `/proxy/image-asset` 同源取回，绕开图片 CDN 缺失的 CORS 头）

视觉提示词页可逐张生成、重新生成、预览和下载图片。图片 Blob 保存在浏览器 IndexedDB 的 `moreimg_images/generated_images` 中，不写入 `localStorage`；重新打开对应历史记录时会恢复图片预览，删除历史记录时同步删除对应图片。

### 生图计费安全

上游一旦受理生图就会计费，本地取消不会退款。为避免“扣了费却什么都没留下”：

- 在途生图只在**该会话被删除**时才中止。切换历史记录、载入示例、开始新一轮加工都不再取消它，结果会继续写回发起时的那条会话，切回去即可看到。
- 生成成功后**无条件入库**，再决定是否更新界面。跨会话完成时会提示“返回该记录即可查看”。
- 生成与下载分别计时：生成 600 秒、下载 120 秒，本地代理 660 秒（必须大于前端，否则同一种故障会随机报成 504 或前端超时）。超时提示会明确说明上游可能已计费。
- 尺寸会按模型校正后再发出。`gpt-image` 系列只接受 `1024x1024` / `1024x1536` / `1536x1024` / `auto`，填非法值时宽松的中转站会按自己的默认规格出图并照常计费，设置面板会就此给出警告。旧版默认值 `768x1024` 会在读取配置时自动迁移为 `1024x1536`。
- 接口返回 HTML 错误页时保留状态码与上游原文，不再被 `Unexpected token '<'` 掩盖。
- 设置面板的“生图请求记录（可对账）”按时间记录模型、尺寸、耗时、结果和是否可能已计费，可复制成表格与中转站账单逐条核对。


## HTML 成品卡

JSON 中每页的封面、正文和封底内容会自动合成为固定 1242×1656 的 3:4 HTML 卡片。标题、要点、总结等文字由真实 DOM 排版；图片模型只生成无文字主视觉。`style_lock.card_shell` 会控制 HTML 卡片的明暗表面、强调色和遮罩，`style_lock.prompt_prefix` 与逐页 `image_prompt` 则由前端确定性拼接后发送给图片接口，保持卡片外壳和主视觉属于同一套视觉系统。

视觉提示词页同时提供 `生成主视觉` 与 `生成 AI 整图` 两种模式。前者只生成无文字主视觉并用于 HTML 合成卡；后者要求图片模型直接生成带文字的完整卡片，二者按 `visual` / `full` 分开保存，不会互相覆盖。生成 AI 整图前可展开查看实际请求提示词，生成后可按阶段 4 的准确文字逐项核对。

当前版本只提供单张生图，不包含整套生成队列、暂停、批量重试或 ZIP 下载。

默认生图尺寸为 `1024x1536`（`gpt-image` 系列支持的原生 3:4 值）；HTML 成品卡固定导出为 `1242x1656`。图片接口尺寸必须以具体供应商支持的尺寸列表为准，应用会把生成图作为背景嵌入最终成品卡。

已验证配置示例：

```text
图片接口地址：https://api.aixoras.com/v1/images/generations
图片模型：gpt-image-2
图片尺寸：1024x1536
```

该接口返回 `data[0].b64_json`。模型列表中的名称是 `gpt-image-2`，不是 `image-2`。测试生成的 PNG 为1024×1536、约2.53MB，已通过预览、IndexedDB持久化和下载链路验证。

本地服务同时提供 `/v1/chat/completions` 与 `/v1/images/generations` 同源转发，以及 `/proxy/image-asset` 图片本体转发，解决浏览器直接请求中转站和图片 CDN 时的 CORS 限制；转发过程不记录 API Key 或请求正文。带跨站 `Origin` 的转发请求会被 403 拒绝，避免其他网站的页面借这台机器消耗你的 API 额度；无 `Origin` 的请求（curl、测试脚本）照旧放行。

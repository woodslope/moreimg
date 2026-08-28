# MoreImg

当前 GitHub 分支是可直接运行的发布包，只保留页面入口、构建产物、本地代理服务、字体和页面实际加载的第三方运行库。源码、测试、文档、截图和构建脚本保留在本地维护，不参与发布。

## 运行

```bash
python3 server.py
```

打开 <http://127.0.0.1:4187/>。

运行文件：

- `index.html`：页面入口
- `app.js`：浏览器运行逻辑
- `styles.css`：页面样式
- `server.py`：静态文件服务与同源 API 代理
- `vendor/`：React、ReactDOM、Lucide 图标和 HTML 导出运行库
- `fonts/`：中文导出字体

`server.py` 会将文本和图片请求转发到配置的上游接口，并提供图片资源同源回取。API Key 和历史记录只保存在浏览器本地，不写入仓库。

如需使用本机 HTTP 代理，可设置：

```bash
MOREIMG_UPSTREAM_PROXY=http://127.0.0.1:端口 python3 server.py
```

## 注意

GitHub Pages 只能提供静态文件，无法运行 `server.py` 的 API 代理；需要文本或图片接口时，请使用本地服务或自行提供同源代理。

本地工作区仍保留完整源码，可在 `src/` 中修改后运行 `node build.mjs` 重新生成发布文件。发布分支会通过 `.gitignore` 自动忽略源码、测试和设计资料，避免再次上传非运行文件。

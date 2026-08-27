# 本地第三方依赖清单

本目录的文件都是手工下载的运行时产物，没有 `package.json` 或 lockfile 约束，因此在这里显式登记版本与校验值。

| 文件 | 版本 | 用途 | SHA-256 |
| --- | --- | --- | --- |
| `react.js` | 18.3.1 | 页面 React 运行时 | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` |
| `react-dom.js` | 18.3.1 | React DOM 渲染 | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` |
| `html2canvas.js` | 1.4.1 | HTML 成品卡导出 PNG | `e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb` |
| `lucide.js` | 0.468.0 | 仅构建时读取，用来生成图标子集 | `3411692820cb8d47543f69496aa25fd603a358f4498046f41c508a5a3342210e` |
| `babel.js` | @babel/standalone 8.0.4 | 开发页 `src.html` 现场编译 + `build.mjs` 生成 `app.js` | `9a4b639c5c1e174ec4702ed5ba6cc897dd8dcbbb6faf59c3a4b817a896c8ae2f` |
| `lucide-moreimg.js` | 构建产物 | `build.mjs` 生成的图标子集，勿手改 | 每次构建按内容变化 |

同目录之外还有一个同类文件：

| 文件 | 版本 | 说明 | SHA-256 |
| --- | --- | --- | --- |
| `../styles.css` | Tailwind CSS v3.4.17 预编译产物 | 一次性编译好后提交，**构建不会重新编译 CSS** | `326cae5b02337a556b5e2d1e9594a98b1696f9a7f3406e3edb5639fc0fcf90dc` |

## 已移除：`tailwind.js`

2026-08-27 删除了 407KB 的 `vendor/tailwind.js`（Tailwind Play CDN 版，SHA-256 `176e894661aa9cdc9a5cba6c720044cbbf7b8bd80d1c9a142a7c24b1b6c50d15`）。`index.html`、`src.html`、`src/template.html` 和 `build.mjs` 都没有引用它，`git log -S` 也查不到任何曾引用过它的提交。样式由预编译的 `../styles.css` 提供，运行时不需要 Tailwind 的 JIT。

若确实需要取回：

```bash
git checkout 7f6a7ce -- vendor/tailwind.js
```

但请注意：即使把它加载进页面，Play CDN 的 JIT 也会与已有的 `styles.css` 产生两套规则来源。新样式请写进 `src/template.html` 的 `<style>`。

## 校验方法

```bash
shasum -a 256 vendor/*.js styles.css
```

`lucide-moreimg.js` 的哈希会随构建变化，其余文件的哈希应与上表一致；不一致说明依赖被改动过，需要确认来源。

# MoreImg 语义质量发布前检查

这份清单用于模型、提示词、Schema、解析或质量门变化后的真实文本回归。用户日常提交的每一篇文章仍正常调用文本 API；黄金样本只用于版本验收。

## 1. 判断是否需要真实 API

先运行：

```bash
node scripts/semantic-quality-release-check.mjs
```

仅 CSS、布局、图片生成、历史恢复或 PNG 导出变化时，不运行黄金样本真实文本 API。命令会列出完整触发条件和三篇样本。

## 2. 本地预检

```bash
node tests/semantic-quality-baseline.test.mjs
node tests/semantic-quality-release-check.test.mjs
```

这两项只检查 fixture、结果合同和敏感信息防护，不读取浏览器配置、不调用 API。

## 3. Chrome 真实回归

1. 使用用户当前 Chrome 打开 `http://127.0.0.1:4187/`，沿用已保存的正式配置。
2. 不读取、复制或输出 API Key、`localStorage`、Cookie 或浏览器配置内容。
3. 按 [semantic-quality-baseline.json](../fixtures/semantic-quality-baseline.json) 顺序逐篇提交，每篇只点击一次主加工操作。
4. 前一篇完成后再提交下一篇；出现错误时停止，不自动重试。
5. 本轮只验文本语义，不点击主视觉、AI 整图或导出，确保每篇 `text_api_requests = 1`、`image_api_requests = 0`。

每篇记录：

- 精修正文去空白字符数
- 卡片页数
- 完整性警告和阻断错误数量
- 空卡片与重复卡片数量
- `must_preserve` 是否完整保留
- `fact_boundary` 是否正确表达
- 是否新增原文没有的流程、结论、数据或行动引导

## 4. 结果验证

将本轮结果按 [semantic-quality-results.baseline.json](../fixtures/semantic-quality-results.baseline.json) 的结构记录到一个不含密钥的新 JSON 文件，再运行：

```bash
node scripts/semantic-quality-release-check.mjs --verify <本轮结果.json>
```

只有全部样本通过页数、正文长度、警告、错误、空卡、重复卡、单请求和人工语义检查，才能判定语义质量回归通过。

## 5. 结论边界

- 通过表示三类黄金样本未出现已知退化，不代表所有文章或高风险领域事实都正确。
- 医疗、法律、金融等内容仍需领域专家复核。
- 真实 API 输出存在波动；失败时保存本轮结果和上游错误，先诊断，不通过自动重试挑选有利样本。

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// styles.css 是一次性预编译的 Tailwind 产物，构建不会重新编译 CSS。
// 所以任何新写的工具类如果不在 styles.css 或 template.html 的 <style> 里，
// 就只是静默不生效——页面照样能跑，测试也照样绿。这条测试把那类失效补回可见。
const projectDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readProjectFile = relativePath => readFile(path.join(projectDirectory, relativePath), 'utf8');

const [compiledCss, template] = await Promise.all([
  readProjectFile('styles.css'),
  readProjectFile('src/template.html')
]);

const definedClasses = new Set();
// 从选择器里收类名，并还原 Tailwind 的 `\.` `\:` `\[` 等转义。
const collectSelectors = text => {
  for (const rule of text.matchAll(/(^|[},])([^{}]+)\{/g)) {
    for (const match of rule[2].matchAll(/\.((?:\\.|[-\w -￿])+)/g)) {
      definedClasses.add(match[1].replace(/\\(.)/g, '$1'));
    }
  }
};

const collectFiles = async directory => {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collectFiles(full));
    else if (/\.(jsx|js)$/.test(entry.name)) found.push(full);
  }
  return found;
};

collectSelectors(compiledCss);
collectSelectors((template.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1]);

const sourceFilePaths = await collectFiles(path.join(projectDirectory, 'src'));
const sources = new Map(await Promise.all(sourceFilePaths.map(async filePath => [filePath, await readFile(filePath, 'utf8')])));
// 组件里注入的导出样式（HTML 成品卡）也定义类名。
for (const text of sources.values()) collectSelectors(text);

// 这些类只作为测试与 querySelector 的定位钩子存在，故意没有样式规则。
const styleFreeHooks = new Set([
  'stage-content-panel',
  'history-item-action',
  'visual-result-slot-empty',
  'visual-export-error',
  'visual-comparison-empty',
  'processing-notice-error',
  'mi-tab-page'
]);

const undefinedClasses = new Map();
for (const [filePath, text] of sources) {
  text.split('\n').forEach((line, index) => {
    for (const attribute of line.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      // 模板串里的 ${...} 是运行期拼接，静态判不了，整段挖掉。
      const raw = (attribute[1] || attribute[2] || '').replace(/\$\{[^}]*\}/g, ' ');
      for (const className of raw.split(/\s+/).filter(Boolean)) {
        if (/[<>()?:]/.test(className)) continue;
        if (className.endsWith('-')) continue; // 被挖掉插值后的前缀残片
        if (definedClasses.has(className) || styleFreeHooks.has(className)) continue;
        const site = `${path.relative(projectDirectory, filePath)}:${index + 1}`;
        if (!undefinedClasses.has(className)) undefinedClasses.set(className, []);
        undefinedClasses.get(className).push(site);
      }
    }
  });
}

const report = [...undefinedClasses].map(([className, sites]) => `${className} (${sites.join(', ')})`).join('\n  ');
assert.equal(
  undefinedClasses.size,
  0,
  `以下类名在 styles.css 和 template.html 的 <style> 里都没有规则，页面会静默不生效：\n  ${report}\n` +
  '请改写为 src/template.html 里的 mi-* / moreimg-* 语义类，或把纯定位钩子加入 styleFreeHooks。'
);

// 断点必须由 template.html 的 @media 拥有：预编译的 styles.css 只含 640/768，没有任何 lg: 规则。
assert.ok(!/\blg:/.test([...sources.values()].join('\n')), '标记中不应出现 lg: 工具类，响应式断点写在 template.html 的 @media 里');
assert.match(template, /@media \(min-width: 1024px\)/, 'template.html 应保留桌面断点');

console.log(`Checked ${sources.size} source modules against ${definedClasses.size} defined CSS classes; no dead utility classes.`);

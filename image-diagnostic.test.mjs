import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./src.html', import.meta.url), 'utf8');

assert.match(source, /MOREIMG_IMAGE_DIAGNOSTIC_KEY/);
assert.match(source, /最近一次生图诊断/);
assert.match(source, /请求方式/);
assert.match(source, /实际返回/);
assert.match(source, /保存方式/);
assert.match(source, /刷新恢复/);
assert.match(source, /loadLastImageDiagnostic/);
assert.match(source, /saveLastImageDiagnostic/);
assert.match(source, /getDiagnosticFailureReason/);
assert.doesNotMatch(source, /failureReason:\s*error\.message/);
assert.ok((source.match(/saveLastImageDiagnostic\(/g) || []).length >= 4, '生图响应、保存结果和刷新恢复均应更新诊断');

console.log('MoreImg image diagnostic contract passed');

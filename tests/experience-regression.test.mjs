import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src.html', import.meta.url), 'utf8');
const styleGuide = await readFile(new URL('../docs/UI_STYLE_GUIDE.md', import.meta.url), 'utf8');

assert.match(source, /className="sidebar-brand-name">一文多图<\/span>/, '中文品牌名应保留');
assert.match(source, /className="sidebar-brand-en">MoreImg<\/span>/, '中文品牌名下方应显示规范英文名 MoreImg');
assert.match(source, /\.visual-panel-notice \{[^}]*margin:\s*12px 18px 0[^}]*border:\s*1px solid[^}]*border-radius:\s*8px/, '视觉面板说明应使用四边统一的轻量信息提示框');
assert.doesNotMatch(source, /\.visual-panel-notice \{[^}]*border-left-width:\s*3px/, '信息提示框不应使用左侧粗强调线');

assert.match(source, /const resultScrollRef = useRef\(null\)/);
assert.match(source, /resultScrollRef\.current\.scrollTop = 0/);
assert.match(source, /\[activeStageTab, activeHistoryId, showResults\]/);
assert.match(source, /ref=\{resultScrollRef\}/);

assert.match(source, /const fallbackCopyText = \(text\) =>/);
assert.match(source, /document\.execCommand\('copy'\)/);
assert.match(source, /await navigator\.clipboard\.writeText\(text\)/);
assert.match(source, /复制失败，请手动复制/);
assert.match(source, /暂无可复制内容/);

assert.match(source, /const selectedHtmlCard = matchingCard \|\| null/);
assert.match(source, /className="visual-page-toolbar"/);
assert.match(source, /className="mi-surface mi-surface-panel mi-surface-raised visual-panel visual-output-panel"/);
assert.match(source, /当前页成品对比/);
assert.match(source, /\.sidebar-input-clip \{[^}]*overflow: hidden/);
assert.match(source, /<div className="sidebar-input-clip">\s*<textarea/);
assert.match(source, /\.results-stage-frame \{[^}]*max-width: 1120px/);
assert.doesNotMatch(source, /activeStageTab === 'step3' \? 'max-w-\[1120px\]' : 'max-w-3xl'/);
assert.doesNotMatch(source, /htmlCards\.map\(card =>/);
assert.match(source, /className="mi-surface mi-surface-panel content-card-panel"/);
assert.doesNotMatch(source, /aspect-\[3\/4\]/);
assert.doesNotMatch(source, /flex-1 overflow-y-auto custom-scrollbar pr-2/);

assert.match(source, /const hasSavedApiConfig = \(\) =>/);
assert.match(source, /useState\(\(\) => !hasSavedApiConfig\(\)\)/);
assert.doesNotMatch(source, /const \[isConfigOpen, setIsConfigOpen\] = useState\(true\)/);

const apiConfigHelperBlock = source.match(/const hasSavedApiConfig = [\s\S]*?(?=\n\s*let html2CanvasLoader)/)?.[0];
assert.ok(apiConfigHelperBlock, '应能提取保存配置检测函数');
const hasSavedApiConfig = Function('localStorage', `${apiConfigHelperBlock}; return hasSavedApiConfig;`)({
  getItem: () => JSON.stringify({ apiKey: 'sk-saved', systemPrompt: '' })
});
assert.equal(hasSavedApiConfig(), true, '已保存 API Key 时不应强制弹出设置窗口');

const hasNoSavedApiConfig = Function('localStorage', `${apiConfigHelperBlock}; return hasSavedApiConfig;`)({
  getItem: () => JSON.stringify({ apiKey: '', systemPrompt: '已有指令' })
});
assert.equal(hasNoSavedApiConfig(), false, '未保存 API Key 时应保持设置窗口可见');

assert.match(source, /className=\{`flex-1 px-8 md:px-12 pb-10 custom-scrollbar relative z-10 moreimg-main-scroll/);
assert.doesNotMatch(source, /moreimg-main-scroll[^`]*transform-gpu/);
assert.match(source, /@media \(max-width: 640px\) \{[\s\S]*?\.moreimg-main-scroll \{ padding-bottom: max\(32px, calc\(24px \+ env\(safe-area-inset-bottom\)\)\); \}/);
assert.match(source, /\.moreimg-app-shell \{[^}]*background-image:\s*radial-gradient/, '应用外壳应保留蓝紫氛围色场');
assert.match(source, /\.mi-surface-raised \{[^}]*background:\s*var\(--mi-surface-raised\)/, '视觉面板应保留共享抬升玻璃层次');
assert.match(source, /\.mi-surface-panel \{[^}]*background:\s*var\(--mi-surface-panel\)/, '长内容表面应保留共享半透明层次');
assert.doesNotMatch(source, /\.moreimg-app-shell \{[^}]*filter:|\.moreimg-app-shell \{[^}]*animation:/, '氛围背景不得依赖实时模糊或动画');
assert.match(source, /\.moreimg-empty-icon \{[^}]*backdrop-filter:\s*blur\(16px\)/, '首页机器人底座应保留局部磨砂');
assert.match(source, /\.moreimg-feature-card \{[^}]*background:\s*rgba\(255,255,255,\.58\)[^}]*backdrop-filter:\s*blur\(18px\)/, '首页基础功能卡应保留品牌玻璃变体');
assert.match(source, /className="moreimg-empty-icon /, '首页机器人应使用基础玻璃组件');
assert.match(source, /className="mi-surface mi-surface-panel moreimg-feature-card /, '首页功能卡应使用共享面板表面');
assert.match(source, /\.moreimg-app-shell \{[\s\S]*?--mi-accent:[^;]+;[\s\S]*?--mi-border:[^;]+;[\s\S]*?--mi-control-standard:[^;]+;[\s\S]*?--mi-control-compact:[^;]+;/, '应用壳应集中提供工作台语义 Token');
assert.doesNotMatch(source, /\.visual-workbench \{[^}]*--mi-/, '视觉工作区不应保留平行 Token 真相源');
assert.match(source, /className="mi-icon-button mi-icon-button-standard sidebar-icon-button"/, '侧栏图标操作应消费标准图标按钮');
assert.match(source, /className="mi-icon-button mi-icon-button-compact visual-result-action"/, '视觉结果操作应消费紧凑图标按钮');
assert.match(source, /className="mi-icon-button mi-icon-button-compact history-item-action/, '历史记录操作应消费紧凑图标按钮');
assert.match(source, /\.moreimg-app-shell \{[\s\S]*?--mi-control-action:\s*40px;[\s\S]*?--mi-control-auxiliary:\s*36px;[\s\S]*?--mi-control-primary:\s*48px;[\s\S]*?--mi-control-field:\s*48px;/, '应用壳应集中提供文字操作与配置字段尺寸 Token');
assert.match(source, /\.mi-button \{[^}]*display:\s*inline-flex[^}]*transition:/, '文字按钮应提供共享基础合同');
assert.match(source, /\.mi-button-standard \{[^}]*min-height:\s*var\(--mi-control-action\)/, '普通文字按钮应消费 40px 操作 Token');
assert.match(source, /\.mi-button-compact \{[^}]*min-height:\s*var\(--mi-control-auxiliary\)/, '配置辅助按钮应消费 36px 辅助 Token');
assert.match(source, /\.mi-button-prominent \{[^}]*min-height:\s*var\(--mi-control-primary\)/, '主操作应消费 48px 主操作 Token');
assert.match(source, /\.mi-button:focus-visible \{[^}]*var\(--mi-focus-ring\)/, '文字按钮应共享键盘焦点合同');
assert.match(source, /\.mi-button:disabled,[\s\S]*?\.mi-button:disabled:hover \{[^}]*var\(--mi-disabled-bg\)/, '文字按钮应共享禁用合同');
assert.match(source, /className=\{`mi-button mi-button-prominent processing-action-button/, '左侧主加工操作应消费共享主按钮');
assert.match(source, /className="mi-button mi-button-standard visual-button visual-button-primary"/, '视觉生成主操作应消费共享普通按钮');
assert.match(source, /className="mi-button mi-button-compact config-action-button"/, '配置辅助操作应消费共享紧凑按钮');
assert.match(source, /className="mi-button mi-button-prominent visual-button visual-button-primary/, '配置保存操作应消费共享主按钮');
assert.doesNotMatch(source, /\.processing-action-button:focus-visible|\.visual-button:focus-visible|\.config-action-button:focus-visible/, '业务按钮不得保留平行焦点合同');
assert.doesNotMatch(source, /\.visual-button \{[^}]*min-height:|\.config-action-button \{[^}]*min-height:/, '业务按钮不得私有定义共享高度');

assert.match(source, /\.mi-tab \{[^}]*height:\s*var\(--mi-control-action\)[^}]*transition:/, '页签应共享 40px 导航合同');
assert.match(source, /\.mi-tab:focus-visible \{[^}]*var\(--mi-focus-ring\)/, '页签应共享键盘焦点合同');
assert.match(source, /className=\{`mi-tab mi-tab-page visual-page-tab/, '视觉页面标签应消费共享页签');
assert.match(source, /className=\{`mi-tab mi-tab-stage results-stage-tab/, '阶段导航应消费共享页签');
assert.doesNotMatch(source, /\.visual-page-tab \{[^}]*height:|\.results-stage-tab \{[^}]*height:/, '业务页签不得私有定义共享高度');

assert.match(source, /\.mi-field \{[^}]*border-radius:\s*var\(--mi-radius-field\)[^}]*transition:/, '配置控件应提供共享字段合同');
assert.match(source, /\.mi-field:focus-visible \{[^}]*var\(--mi-focus-shadow\)/, '配置字段应共享键盘焦点合同');
assert.match(source, /\.mi-field:disabled \{[^}]*var\(--mi-disabled-bg\)/, '配置字段应共享禁用合同');
assert.match(source, /className="mi-field config-input/, '文本框和选择框应消费共享字段');
assert.match(source, /className="mi-field config-checkbox"/, '偏好复选控件应消费共享字段表面');
assert.match(source, /className="mi-field config-preference-textarea"/, '偏好文本域应消费共享字段');
assert.doesNotMatch(source, /\.config-input:focus|\.config-preference-textarea:focus|\.config-textarea:focus/, '业务字段不得保留平行焦点合同');
assert.doesNotMatch(source, /\.visual-icon-button|\.config-textarea/, '无消费者的旧控件样式应从合同中移除');

assert.match(source, /\.moreimg-app-shell \{[\s\S]*?--mi-surface-panel:[^;]+;[\s\S]*?--mi-surface-card:[^;]+;[\s\S]*?--mi-feedback-info-bg:[^;]+;[\s\S]*?--mi-feedback-warning-bg:[^;]+;[\s\S]*?--mi-feedback-error-bg:[^;]+;[\s\S]*?--mi-feedback-success-bg:[^;]+;/, '应用壳应集中提供表面与反馈语义 Token');
assert.match(source, /\.mi-surface \{[^}]*border:/, '重复表面应提供共享基础合同');
assert.match(source, /\.mi-surface-panel \{[^}]*border-radius:\s*16px[^}]*var\(--mi-surface-panel\)/, '工作台面板应消费共享面板表面');
assert.match(source, /\.mi-surface-card \{[^}]*border-radius:\s*12px[^}]*var\(--mi-surface-card\)/, '重复卡片应消费共享卡片表面');
assert.match(source, /className="mi-surface mi-surface-panel stage-content-panel/, '长内容面板应消费共享面板表面');
assert.match(source, /className="mi-surface mi-surface-panel content-card-panel"/, '内容卡应消费共享面板表面');
assert.match(source, /className="mi-surface mi-surface-panel mi-surface-raised visual-panel"/, '视觉工作台应消费共享抬升面板表面');
assert.match(source, /className="mi-surface mi-surface-card visual-result-item"/, '视觉结果项应消费共享卡片表面');
assert.match(source, /className=\{`mi-surface mi-surface-list history-item/, '历史项应消费共享列表表面');
assert.match(source, /aria-current=\{activeHistoryId === item\.id && showResults \? 'true' : undefined\}/, '当前历史项应暴露当前语义');
assert.match(source, /const \[isHistoryOpen, setIsHistoryOpen\] = useState\(false\)/, '窄屏历史入口应有独立可控状态');
assert.match(source, /aria-label=\{`打开历史记录，共 \$\{history\.length\} 条`\}/, '窄屏历史入口应提供明确名称和记录数');
assert.match(source, /@media \(min-width: 1024px\) \{[\s\S]*?\.mobile-history-trigger \{ display: none; \}/, '移动历史入口应在具有足够内容宽度的桌面断点隐藏');
assert.match(source, /const ModalFrame = \(\{[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?aria-labelledby=\{titleId\}/, '共享模态 owner 应统一提供 dialog 语义');
assert.match(source, /dialogClassName="mobile-history-dialog flex flex-col animate-fade-in-down"/, '窄屏历史记录应消费共享模态框架');
assert.match(source, /const HistoryItems = \(\{[\s\S]*?closeAfterOpen = false,[\s\S]*?mobile = false[\s\S]*?\}\) =>/, '历史记录列表应集中管理桌面与窄屏交互');
assert.match(source, /<HistoryItems[\s\S]*?closeAfterOpen[\s\S]*?mobile\s*\/>/, '窄屏历史记录应复用统一的历史列表 owner');
assert.match(source, /\.mobile-history-dialog \.history-item-actions \{ opacity: 1; \}/, '触屏历史辅助操作应始终可见');
assert.match(source, /\.history-item-main \{[^}]*padding-right:\s*0 !important/, '桌面历史标题不应为默认隐藏的辅助操作永久让位');
assert.match(source, /\.history-item-date \{[^}]*padding-right:\s*88px/, '桌面历史辅助操作应使用日期元信息行，不覆盖标题');
assert.match(source, /\.mobile-history-dialog \.history-item-main \{[^}]*padding-right:\s*88px !important/, '仅触屏历史弹窗应为常显辅助操作预留空间');
assert.match(source, /\.mobile-history-overlay \{[^}]*position: fixed[^}]*z-index: 40[^}]*background: rgba\(15,23,42,\.4\)/, '窄屏历史遮罩应由稳定层级 owner 覆盖页面内容');
assert.doesNotMatch(source, /history-item relative group p-3\.5 rounded-xl[\s\S]*?bg-white\/30 border-white\/40/, '历史项不得继续由叶子工具类复制表面合同');

assert.match(source, /\.mi-empty-state \{[^}]*display:\s*flex[^}]*border:\s*1px dashed[^}]*text-align:\s*center/, '空状态应提供共享结构与视觉合同');
assert.match(source, /\.mi-empty-state-media \{[^}]*aspect-ratio:\s*3 \/ 4/, '媒体空状态应固定为 3:4');
assert.match(source, /\.mi-empty-state-panel \{[^}]*min-height:\s*260px[^}]*padding:\s*24px/, '面板空状态应提供稳定高度与内边距');
assert.match(source, /\.mi-empty-state-inline \{[^}]*height:\s*100%[^}]*border:\s*0[^}]*background:\s*transparent/, '内嵌空状态不得重复绘制容器表面');
assert.match(source, /\.mi-empty-state-icon \{[^}]*width:\s*40px[^}]*border-radius:\s*10px/, '空状态图标应提供共享基础合同');
assert.match(source, /\.mi-empty-state-icon-large \{[^}]*width:\s*48px[^}]*border-radius:\s*12px/, '面板空状态图标应提供共享大号变体');
assert.match(source, /className="mi-empty-state mi-empty-state-panel animate-fade-in-up"/, '阶段无内容状态应消费共享面板空状态');
assert.match(source, /className="mi-empty-state mi-empty-state-media visual-result-slot-empty"/, '视觉媒体槽应消费共享媒体空状态');
assert.match(source, /className="mi-empty-state mi-empty-state-inline visual-comparison-empty"/, '成品对比占位应消费共享内嵌空状态');
assert.match(source, /className="mi-surface mi-surface-card image-diagnostic"/, '生图诊断应消费共享卡片表面');
assert.doesNotMatch(source, /\.image-diagnostic \{[^}]*border:|\.image-diagnostic \{[^}]*background:|\.image-diagnostic \{[^}]*border-radius:/, '生图诊断业务类不得重定义共享表面');
assert.doesNotMatch(source, /flowing-border-wrapper|flowing-border-inner|visual-empty-result/, '无消费者的旧边框与空状态样式应移除');

assert.match(source, /\.mi-feedback \{[^}]*border:\s*1px solid transparent[^}]*border-radius:\s*10px/, '提示反馈应提供完整细边框的共享结构合同');
assert.doesNotMatch(source, /\.mi-feedback \{[^}]*border-left(?:-width)?:/, '共享提示反馈不应附加左侧粗强调线');
assert.match(styleGuide, /Feedback containers use one complete, uniform border/, '项目样式指南应记录信息提示的完整细边框合同');
assert.match(source, /\.mi-feedback-info \{[^}]*var\(--mi-feedback-info-bg\)/, '信息反馈应消费语义 Token');
assert.match(source, /\.mi-feedback-warning \{[^}]*var\(--mi-feedback-warning-bg\)/, '警告反馈应消费语义 Token');
assert.match(source, /\.mi-feedback-error \{[^}]*var\(--mi-feedback-error-bg\)/, '错误反馈应消费语义 Token');
assert.match(source, /\.mi-feedback-success \{[^}]*var\(--mi-feedback-success-bg\)/, '成功反馈应消费语义 Token');
assert.match(source, /className=\{`mi-toast mi-feedback mi-feedback-\$\{feedbackType\}/, 'Toast 应消费共享反馈语义');
assert.match(source, /role=\{feedbackType === 'error' \? 'alert' : 'status'\}/, 'Toast 应按严重度暴露反馈角色');
assert.match(source, /aria-label="关闭通知"/, 'Toast 应提供明确关闭操作');
assert.match(source, /\.mi-toast \{ top: auto; right: 12px; bottom: calc\(12px \+ env\(safe-area-inset-bottom\)\); left: 12px; width: auto; \}/, '窄屏 Toast 应移到底部并避让安全区');
assert.match(source, /className=\{`mi-feedback mi-feedback-\$\{feedbackType\} config-status/, '配置状态应消费共享反馈语义');
assert.match(source, /className="mi-feedback mi-feedback-info config-preference-note"/, '配置说明应消费共享信息反馈');
assert.match(source, /className="mi-feedback mi-feedback-warning visual-notice/, '视觉警告应消费共享警告反馈');
assert.match(source, /className="mi-feedback mi-feedback-warning visual-notice visual-result-notice" role="status" aria-live="polite"/, '视觉结果警告应提供专用容器和状态语义');
assert.match(source, /<Icon name="CircleAlert" className="visual-result-notice-icon" \/>/, '视觉结果警告应提供稳定的语义图标');
assert.match(source, /\.visual-result-notice \{[^}]*align-self: flex-start[^}]*width: fit-content[^}]*max-width: 100%[^}]*margin-top: 14px[^}]*padding: 10px 12px[^}]*line-height: 1\.55/, '视觉结果警告应拥有内容宽度、内边距和上间距');
assert.match(source, /\.visual-result-notice \+ \.visual-result-grid \{[^}]*margin-top: 14px/, '视觉结果警告与结果网格应保持明确下间距');
assert.match(source, /className="mi-feedback mi-feedback-error visual-error/, '视觉错误应消费共享错误反馈');
assert.match(source, /className="mi-feedback mi-feedback-warning processing-notice"/, '流程警告应消费共享警告反馈');
assert.match(source, /className="mi-feedback mi-feedback-error processing-notice processing-notice-error"/, '流程错误应消费共享错误反馈');
assert.doesNotMatch(source, /\.config-status-loading|\.config-status-success|\.config-status-error|\.config-upgrade-notice/, '反馈业务类不得保留平行语义颜色或无消费者旧样式');

assert.match(source, /const handleTabListKeyDown = \(event\) =>/, '标签组应提供共享键盘导航');
assert.match(source, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/, '标签组应支持方向键与首尾导航');
assert.match(source, /onKeyDown=\{handleTabListKeyDown\}/, '标签消费者应接入共享键盘导航');
assert.match(source, /tabIndex=\{section\.title === selectedPromptSection\.title \? 0 : -1\}/, '视觉标签应使用 roving tabindex');
assert.match(source, /tabIndex=\{isFocusable \? 0 : -1\}/, '阶段标签应使用 roving tabindex');
assert.match(source, /const resultsStageNavRef = useRef\(null\)/, '阶段导航应持有可见性滚动容器引用');
assert.match(source, /querySelector\('\[aria-selected="true"\]'\)\?\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/, '当前阶段应自动滚入可见区');
assert.match(source, /window\.addEventListener\('resize', revealActiveStage\)[\s\S]*?window\.removeEventListener\('resize', revealActiveStage\)/, '窄屏切换应重新显示当前阶段并清理监听');

assert.doesNotMatch(source, /maximum-scale=1\.0|user-scalable=no/, '移动端不得禁用用户缩放');
assert.match(source, /color-scheme:\s*light/, '单一浅色主题应向浏览器声明稳定主题边界');
assert.match(source, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.sidebar-input-shell::before \{[\s\S]*?animation:\s*none !important[\s\S]*?\.animate-fade-in-down,[\s\S]*?animation:\s*none !important/, '减少动效规则应稳定覆盖循环与入场动画');
assert.match(source, /\.visual-result-grid \{[^}]*repeat\(auto-fit, minmax\(240px, 1fr\)\)/, '视觉结果应按实际可用宽度自动换列');
assert.match(source, /\.moreimg-sidebar\.is-result-view:not\(\.is-composer-expanded\) \.sidebar-composer \{ display: none; \}/, '所有尺寸的结果态都应默认折叠输入区');
assert.doesNotMatch(source, /@media \(min-width: 1024px\)[\s\S]*?\.sidebar-composer \{ display: block !important; \}/, '桌面断点不得强制展开结果态输入区');
assert.match(source, /<details className="visual-disclosure">/, '提示词详情应使用原生 disclosure 并默认折叠');
assert.match(source, /setProcessingUiPhase\('waiting'\)[\s\S]*?setProcessingUiPhase\('validating'\)/, '加工反馈应只呈现可证明的等待和校验状态');
assert.doesNotMatch(source, /STAGE_LOADING_TEXT|setInternalStage\(stage =>/, '加工界面不得再用定时器伪装内部进度');
assert.match(source, /<ConfirmDeleteDialog[\s\S]*?pendingDeleteHistoryItem/, '历史删除应经过共享确认弹窗');
assert.match(source, /data-dialog-initial-focus="true"[\s\S]*?>\s*取消/, '危险确认的默认焦点应落在取消操作');
assert.match(source, /localStorage\.setItem\(HISTORY_INDEX_KEY, JSON\.stringify\(updatedHistory\)\);[\s\S]*?await deleteSessionImages\(id\);[\s\S]*?await deleteSessionRecord\(id\);[\s\S]*?setHistory\(updatedHistory\);/, '删除应在文章主记录成功删除后再关闭确认态并更新列表');
assert.match(source, /duration=\{toast\.duration\}/, 'Toast 调用点声明的停留时长应传给共享组件');
assert.match(source, /configRequestControllersRef[\s\S]*?timeoutMessage: '读取模型列表超过 30 秒/, '模型列表请求应提供取消 owner 与明确超时');
assert.match(source, /document\.addEventListener\('keydown', handleDocumentKeyDown\)[\s\S]*?returnTarget\.focus/, '共享模态应支持键盘约束、Escape 和焦点返回');
assert.match(source, /localStorage\.getItem\(HISTORY_INDEX_KEY\) !== savedHistory/, '启动期历史对账不得用旧快照覆盖新写入');
assert.match(source, /if \(!isActive \|\| localStorage\.getItem\(HISTORY_INDEX_KEY\)\) return;/, '示例初始化完成前应复查是否已有用户历史');
assert.match(source, /const persistedHistory = JSON\.parse\(localStorage\.getItem\(HISTORY_INDEX_KEY\) \|\| '\[\]'\)/, '新历史保存应以最新持久化索引合并，避免闭包旧值丢记录');

console.log('Experience interaction regressions are covered.');

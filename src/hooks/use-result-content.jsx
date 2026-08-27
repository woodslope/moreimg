const useResultContent = ({
  activeStageTab,
  currentSession,
  parsedSession,
  activeVisualPage,
  setActiveVisualPage,
  imageResults,
  htmlExportState,
  apiConfig,
  handleGenerateImage,
  downloadImage,
  hiddenFullImages,
  setHiddenFullImages,
  copyToClipboard,
  updateImageFocus,
  exportHtmlCard,
  htmlCardRefs,
  showResults
}) => {
const renderStageContent = () => {
  const currentStageConfig = NEW_STAGES.find(s => s.id === activeStageTab);
  if (!currentStageConfig) return null;

  const isJsonPackage = currentSession.packageData?.status === 'complete';
  const hasContent = currentStageConfig.subStages.some(sId => {
    const content = isJsonPackage ? getPackageStageText(currentSession.packageData, sId) : currentSession.stages[sId];
    return Boolean(content && content.trim());
  });

  if (!hasContent) {
    return (
      <div className="mi-empty-state mi-empty-state-panel animate-fade-in-up">
        <div className="mi-empty-state-icon mi-empty-state-icon-large mb-4">
          <Icon name="Box" />
        </div>
        <p className="text-[15px] font-bold text-slate-500 mb-1">当前阶段暂无内容</p>
        <p className="text-[13px] text-slate-400">大模型输出格式解析异常，或正在等待渲染指令。</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {currentStageConfig.subStages.map(sId => {
        const content = isJsonPackage ? getPackageStageText(currentSession.packageData, sId) : currentSession.stages[sId];
        if (!content || !content.trim()) return null;

        return (
          <div key={sId}>
            <div className="visual-stage-heading">
              <h4 className="visual-stage-heading-title">
                {sId === 1 ? '内容准入与判型' : sId === 2 ? '内容核查与骨架提取' : sId === 3 ? '精修版文章重构' : sId === 4 ? '知识卡片内容包' : sId === 5 ? '视觉生成与成品对比' : ''}
              </h4>
            </div>
            <div>
              {sId === 3 ? (
                <div className="mi-surface mi-surface-panel mi-surface-raised stage-content-panel p-8 md:p-10">
                  <FormattedContent text={content} />
                </div>
              ) : sId === 4 ? (
                (() => {
                  if (isJsonPackage) {
                    return (
                      <div className="content-card-grid grid grid-cols-1 md:grid-cols-2 gap-8">
                        {currentSession.packageData.pages.map((page, index, pages) => (
                          <div key={page.page_id} className="mi-surface mi-surface-panel mi-surface-raised content-card-panel">
                            <h3 className="text-[18px] font-bold text-slate-800 mb-6 flex items-center">
                              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-[14px] mr-3 font-mono shadow-sm border border-indigo-100">{index + 1}</span>
                              <span className="truncate">{getPageDisplayName(page, pages.length - 2)}</span>
                            </h3>
                            <div className="content-card-body">
                              <div>
                                <div className="font-extrabold text-slate-900 text-[16px]">{page.card.title}</div>
                                {page.card.subtitle && <div className="content-card-heading-sub">{page.card.subtitle}</div>}
                              </div>
                              {page.card.points.length > 0 && (
                                <div className="content-card-points">
                                  {page.card.points.map((point, pointIndex) => <div key={pointIndex} className="content-card-point"><span className="content-card-point-mark">•</span><span>{point}</span></div>)}
                                </div>
                              )}
                              {page.card.summary && <div className="content-card-summary">{page.card.summary}</div>}
                              <div className="content-card-meta">
                                <div>页面目标：{page.semantic.page_goal}</div>
                                <div>主关系：{page.semantic.primary_relation}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  const { cardBlocks, cardHeaders } = parsedSession;
                  if (cardBlocks.length > 0 && cardHeaders.length === cardBlocks.length) {
                    return (
                      <div className="content-card-grid grid grid-cols-1 md:grid-cols-2 gap-8">
                        {cardBlocks.map((block, i) => (
                          <div key={i} className="mi-surface mi-surface-panel mi-surface-raised content-card-panel">
                            <h3 className="text-[18px] font-bold text-slate-800 mb-6 flex items-center">
                              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-[14px] mr-3 font-mono shadow-sm border border-indigo-100">{i+1}</span>
                              <span className="truncate">{cardHeaders[i].replace(/\*\*/g, '')}</span>
                            </h3>
                            <div>
                              <FormattedContent text={block.trim()} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div className="mi-surface mi-surface-panel mi-surface-raised stage-content-panel p-8">
                      <FormattedContent text={content} />
                    </div>
                  );
                })()
              ) : sId === 5 ? (
                (() => {
                  const { promptSections, htmlCards } = parsedSession;
                  const isBuiltInDemo = Boolean(currentSession.isDemo);

                  if (promptSections.length > 0) {
                    const selectedPromptSection = promptSections.find(section => section.title === activeVisualPage) || promptSections[0];
                    const selectedPromptIndex = promptSections.findIndex(section => section.title === selectedPromptSection.title);
                    const cleanPromptText = selectedPromptSection.text.replace(/```[^\n]*\n?/g, '').replace(/```/g, '').trim();
                    const imageResult = imageResults[`visual-only:${selectedPromptSection.title}`];
                    const legacyVisualResult = imageResults[`visual:${selectedPromptSection.title}`];
                    const fullImageResult = imageResults[`full:${selectedPromptSection.title}`];
                    const matchingCard = htmlCards.find(card => card.imageKey === selectedPromptSection.title);
                    const selectedHtmlCard = matchingCard || null;
                    const selectedHtmlImageResult = selectedHtmlCard ? imageResults[`visual-only:${selectedHtmlCard.imageKey}`] : null;
                    const selectedHtmlLegacyResult = selectedHtmlCard ? imageResults[`visual:${selectedHtmlCard.imageKey}`] : null;
                    const selectedHtmlResultKey = selectedHtmlCard ? `visual-only:${selectedHtmlCard.imageKey}` : '';
                    const selectedHtmlCardReady = selectedHtmlImageResult?.status === 'success';
                    const selectedHtmlFocusY = selectedHtmlCard ? selectedHtmlImageResult?.focusY ?? getDefaultCardFocus(selectedHtmlCard) : 50;
                    const isSelectedHtmlCardExporting = Boolean(selectedHtmlCard && htmlExportState.cardId === selectedHtmlCard.id && htmlExportState.status === 'pending');
                    const selectedHtmlCardExportError = selectedHtmlCard && htmlExportState.cardId === selectedHtmlCard.id && htmlExportState.status === 'error' ? htmlExportState.error : '';
                    const visualOnlyPrompt = isJsonPackage ? cleanPromptText : buildVisualOnlyPrompt(cleanPromptText, matchingCard);
                    const fullImagePrompt = matchingCard ? buildFullImagePrompt(cleanPromptText, matchingCard) : '';
                    return (
                      <div className="visual-workbench">
                        <section className="mi-surface mi-surface-panel mi-surface-raised visual-panel">
                          <div className="visual-page-toolbar">
                            <div className="visual-page-tabs hide-scrollbar" role="tablist" aria-label="选择卡片页面">
                              {promptSections.map(section => (
                                <button
                                  key={section.title}
                                  type="button"
                                  role="tab"
                                  aria-selected={section.title === selectedPromptSection.title}
                                  tabIndex={section.title === selectedPromptSection.title ? 0 : -1}
                                  onKeyDown={handleTabListKeyDown}
                                  onClick={() => setActiveVisualPage(section.title)}
                                  className={`mi-tab mi-tab-page visual-page-tab ${section.title === selectedPromptSection.title ? 'visual-page-tab-active' : ''}`}
                                >
                                  {section.title}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="visual-panel-header">
                            <div className="visual-panel-title-group">
                              <div className="visual-panel-title"><Icon name="Image" className="mr-2 h-4 w-4 text-indigo-600" />{selectedPromptSection.title}</div>
                              <div className="visual-panel-meta">第 {selectedPromptIndex + 1} 页，共 {promptSections.length} 页</div>
                            </div>
                            <div className="visual-panel-actions">
                              <button
                                onClick={() => handleGenerateImage(selectedPromptSection.title, visualOnlyPrompt, 'visual-only')}
                                disabled={isBuiltInDemo || imageResult?.status === 'loading'}
                                aria-busy={imageResult?.status === 'loading'}
                                className="mi-button mi-button-standard visual-button visual-button-primary"
                              >
                                <Icon name={imageResult?.status === 'loading' ? 'LoaderCircle' : 'Sparkles'} className={`mr-2 h-4 w-4 ${imageResult?.status === 'loading' ? 'animate-spin' : ''}`} />
                                {imageResult?.status === 'loading' ? '生成中' : imageResult ? '重生成主视觉' : '生成主视觉'}
                              </button>
                              <button
                                onClick={() => handleGenerateImage(selectedPromptSection.title, fullImagePrompt, 'full')}
                                disabled={isBuiltInDemo || !matchingCard || fullImageResult?.status === 'loading'}
                                aria-busy={fullImageResult?.status === 'loading'}
                                className="mi-button mi-button-standard visual-button"
                              >
                                <Icon name={fullImageResult?.status === 'loading' ? 'LoaderCircle' : 'LayoutTemplate'} className={`mr-2 h-4 w-4 ${fullImageResult?.status === 'loading' ? 'animate-spin' : ''}`} />
                                {fullImageResult?.status === 'loading' ? '生成中' : fullImageResult ? '重生成整图' : '生成 AI 整图'}
                              </button>
                            </div>
                          </div>
                          <div className="mi-feedback mi-feedback-info visual-notice visual-panel-notice"><Icon name="Info" className="h-3.5 w-3.5 shrink-0" /><span>{isBuiltInDemo ? '内置示例仅用于查看流程；图片为本地占位图，不调用图片 API。' : 'HTML 成品卡用于准确中文交付；AI 整图用于视觉候选，生成后仍需核对文字。'}</span></div>

                          <div className="visual-workspace-grid">
                            <div className="visual-results-column">
                              <div className="visual-column-title">生成结果</div>
                              <div className="visual-column-copy">固定 3:4 检查框：上方快速确认素材，底部再进行成品对比。</div>

                              {legacyVisualResult?.status === 'success' && imageResult?.status !== 'success' && <div className="mi-feedback mi-feedback-warning visual-notice visual-result-notice" role="status" aria-live="polite"><Icon name="CircleAlert" className="visual-result-notice-icon" /><span>旧版主视觉不能用于 HTML 成品卡，请重新生成主视觉。</span></div>}
                              {imageResult?.status === 'error' && <div className="mi-feedback mi-feedback-error visual-error" role="alert">图片生成失败：{imageResult.error}</div>}
                              {fullImageResult?.status === 'error' && <div className="mi-feedback mi-feedback-error visual-error" role="alert">AI 整图生成失败：{fullImageResult.error}</div>}

                              <div className="visual-result-grid">
                                {imageResult?.status === 'success' ? (
                                  <div className="mi-surface mi-surface-card visual-result-item">
                                    <div className="visual-result-item-header">
                                      <span>{isBuiltInDemo ? '内置示例占位图' : 'HTML 主视觉'}</span>
                                      <button type="button" onClick={() => downloadImage(selectedPromptSection.title, imageResult.imageUrl)} className="mi-icon-button mi-icon-button-compact visual-result-action" aria-label="下载主视觉" title="下载主视觉"><Icon name="Download" className="h-3.5 w-3.5" /></button>
                                    </div>
                                    <VisualPreview imageUrl={imageResult.imageUrl} alt={`${selectedPromptSection.title} 生成结果`} />
                                  </div>
                                ) : (
                                  <div className="mi-surface mi-surface-card visual-result-item">
                                    <div className="visual-result-item-header"><span>{isBuiltInDemo ? '内置示例占位图' : 'HTML 主视觉'}</span></div>
                                    <div className="mi-empty-state mi-empty-state-media visual-result-slot-empty">
                                      <div className="mi-empty-state-icon"><Icon name={imageResult?.status === 'loading' ? 'LoaderCircle' : 'ImagePlus'} className={`h-5 w-5 ${imageResult?.status === 'loading' ? 'animate-spin' : ''}`} /></div>
                                      <span className="mi-empty-state-hint">{imageResult?.status === 'loading' ? '生成中' : '等待生成'}</span>
                                    </div>
                                    <div className="visual-preview-meta"><span><strong>预览框 3:4</strong> · 固定卡片槽位</span></div>
                                  </div>
                                )}
                                {fullImageResult?.status === 'success' && !hiddenFullImages[selectedPromptSection.title] ? (
                                  <div className="mi-surface mi-surface-card visual-result-item">
                                    <div className="visual-result-item-header">
                                      <span>{isBuiltInDemo ? '内置示例占位图' : 'AI 整图'}</span>
                                      <div className="visual-result-actions">
                                        <button type="button" onClick={() => downloadImage(`${selectedPromptSection.title}-AI整图`, fullImageResult.imageUrl)} className="mi-icon-button mi-icon-button-compact visual-result-action" aria-label="下载 AI 整图" title="下载 AI 整图"><Icon name="Download" className="h-3.5 w-3.5" /></button>
                                        <button type="button" onClick={() => setHiddenFullImages(prev => ({ ...prev, [selectedPromptSection.title]: true }))} className="mi-icon-button mi-icon-button-compact visual-result-action" aria-label="隐藏 AI 整图" title="隐藏 AI 整图"><Icon name="EyeOff" className="h-3.5 w-3.5" /></button>
                                      </div>
                                    </div>
                                    <VisualPreview imageUrl={fullImageResult.imageUrl} alt={`${selectedPromptSection.title} AI 整图`} />
                                  </div>
                                ) : (
                                  <div className="mi-surface mi-surface-card visual-result-item">
                                    <div className="visual-result-item-header">
                                      <span>{isBuiltInDemo ? '内置示例占位图' : 'AI 整图'}</span>
                                      {fullImageResult?.status === 'success' && hiddenFullImages[selectedPromptSection.title] && <button type="button" onClick={() => setHiddenFullImages(prev => ({ ...prev, [selectedPromptSection.title]: false }))} className="mi-icon-button mi-icon-button-compact visual-result-action" aria-label="显示 AI 整图" title="显示 AI 整图"><Icon name="Eye" className="h-3.5 w-3.5" /></button>}
                                    </div>
                                    <div className="mi-empty-state mi-empty-state-media visual-result-slot-empty">
                                      <div className="mi-empty-state-icon"><Icon name={fullImageResult?.status === 'loading' ? 'LoaderCircle' : 'LayoutTemplate'} className={`h-5 w-5 ${fullImageResult?.status === 'loading' ? 'animate-spin' : ''}`} /></div>
                                      <span className="mi-empty-state-hint">{fullImageResult?.status === 'loading' ? '生成中' : fullImageResult?.status === 'success' ? '已隐藏' : '等待生成'}</span>
                                    </div>
                                    <div className="visual-preview-meta"><span><strong>预览框 3:4</strong> · 固定卡片槽位</span></div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <aside key={selectedPromptSection.title} className="visual-prompt-column" aria-label="当前页面提示词详情">
                              <details className="visual-disclosure">
                                <summary><span>原始视觉提示词</span><Icon name="ChevronDown" className="visual-disclosure-icon" /></summary>
                                <div className="visual-disclosure-body">
                                  <div className="visual-prompt-block-header">
                                    <span className="visual-prompt-label">实际请求内容</span>
                                    <button type="button" onClick={() => copyToClipboard(cleanPromptText, `[${selectedPromptSection.title}] 原始视觉提示词`)} className="mi-icon-button mi-icon-button-compact visual-result-action" aria-label="复制原始视觉提示词" title="复制原始视觉提示词"><Icon name="Copy" className="h-3.5 w-3.5" /></button>
                                  </div>
                                  <pre className="visual-prompt-copy font-mono"><code>{cleanPromptText}</code></pre>
                                </div>
                              </details>
                              <details className="visual-disclosure">
                                <summary><span>AI 整图实际请求</span><Icon name="ChevronDown" className="visual-disclosure-icon" /></summary>
                                <div className="visual-disclosure-body">
                                  <div className="visual-prompt-block-header">
                                    <span className="visual-prompt-label">带卡片文字的完整请求</span>
                                    <button type="button" disabled={!matchingCard} onClick={() => copyToClipboard(fullImagePrompt, `[${selectedPromptSection.title}] AI 整图请求`)} className="mi-icon-button mi-icon-button-compact visual-result-action" aria-label="复制 AI 整图请求" title="复制 AI 整图请求"><Icon name="Copy" className="h-3.5 w-3.5" /></button>
                                  </div>
                                  <pre className="visual-prompt-copy font-mono"><code>{fullImagePrompt}</code></pre>
                                </div>
                              </details>
                            </aside>
                          </div>
                        </section>

                        {htmlCards.length > 0 && (
                          <section className="visual-section">
                            <div className="visual-section-header">
                              <div>
                                <div className="visual-section-heading">
                                  <h4 className="visual-section-title">当前页成品对比</h4>
                                </div>
                                <p className="visual-section-description">HTML 成品与 AI 整图统一按 3:4 预览，导出仅包含左侧 HTML 成品。</p>
                              </div>
                              <span className="visual-card-count">{selectedPromptIndex + 1} / {htmlCards.length}</span>
                            </div>
                            <style>{HTML_CARD_EXPORT_STYLES}</style>
                            <div className="mi-surface mi-surface-panel mi-surface-raised visual-panel visual-output-panel">
                              {!selectedHtmlCard && <div className="mi-feedback mi-feedback-error visual-error" role="alert">未找到与「{selectedPromptSection.title}」同名的卡片内容，已停止成品合成，请重新生成完整物料包。</div>}
                              {selectedHtmlCard && (
                                <div className="visual-output-card">
                                  <div className="visual-current-output-header">
                                    <span className="text-[13px] font-bold text-slate-800">{selectedHtmlCard.label}</span>
                                    <div className="visual-current-output-actions">
                                      {selectedHtmlCardReady && (
                                        <label className="visual-focus-control">
                                          <span>画面焦点</span>
                                          <input
                                            type="range"
                                            min="30"
                                            max="75"
                                            step="1"
                                            value={selectedHtmlFocusY}
                                            onChange={(event) => updateImageFocus(selectedHtmlResultKey, selectedHtmlCard.imageKey, event.target.value)}
                                            aria-label="调整主视觉纵向焦点"
                                          />
                                          <span className="visual-focus-value">{selectedHtmlFocusY}%</span>
                                        </label>
                                      )}
                                      {selectedHtmlCardReady ? (
                                        <button
                                          onClick={() => exportHtmlCard(selectedHtmlCard)}
                                          disabled={isSelectedHtmlCardExporting}
                                          aria-busy={isSelectedHtmlCardExporting}
                                          title={isSelectedHtmlCardExporting ? '正在导出 HTML 成品' : '导出左侧 HTML 成品 PNG（1242×1656）'}
                                          className="mi-button mi-button-standard visual-button visual-export-button"
                                        >
                                          <Icon name={isSelectedHtmlCardExporting ? 'Loader' : 'Download'} className={`mr-2 h-3.5 w-3.5 ${isSelectedHtmlCardExporting ? 'animate-spin' : ''}`} /> {isSelectedHtmlCardExporting ? '导出中' : '导出 HTML 成品 PNG'}
                                        </button>
                                      ) : (
                                        <span className="visual-output-status">生成主视觉后可导出</span>
                                      )}
                                    </div>
                                  </div>
                                  {selectedHtmlCardExportError && <div className="mi-feedback mi-feedback-error visual-error visual-export-error" role="alert">{selectedHtmlCardExportError}</div>}
                                  <div className="visual-current-output-body">
                                    <div className="mi-surface mi-surface-card visual-comparison-item">
                                      <div className="visual-comparison-label">{selectedHtmlCardReady ? 'HTML 成品' : 'HTML 排版预览'}</div>
                                      <HtmlCardPreview>
                                        <HtmlCard
                                          card={selectedHtmlCard}
                                          imageUrl={selectedHtmlCardReady ? selectedHtmlImageResult.imageUrl : ''}
                                          cardRef={node => { if (node) htmlCardRefs.current[selectedHtmlCard.id] = node; }}
                                          styleLock={currentSession.packageData?.style_lock}
                                          focusY={selectedHtmlFocusY}
                                        />
                                        {!selectedHtmlCardReady && <span className="html-card-placeholder-badge">等待主视觉</span>}
                                      </HtmlCardPreview>
                                      <div className="visual-comparison-meta"><span><strong>预览框 3:4</strong> · {isBuiltInDemo ? '内置示例占位图' : selectedHtmlCardReady ? 'HTML 成品' : '排版占位'}</span><span>{isBuiltInDemo ? '本地演示素材' : selectedHtmlCardReady ? '导出 1242×1656' : '待生成主视觉'}</span></div>
                                      {selectedHtmlImageResult?.status !== 'success' && <p className={`visual-comparison-hint ${selectedHtmlLegacyResult?.status === 'success' ? 'is-stale' : ''}`}>{selectedHtmlLegacyResult?.status === 'success' ? '旧版主视觉不再用于 HTML 成品卡，请重新生成无字主视觉。' : '当前使用视觉占位，生成无字主视觉后会自动替换。'}</p>}
                                    </div>
                                    <div className="mi-surface mi-surface-card visual-comparison-item">
                                      <div className="visual-comparison-label">{isBuiltInDemo ? '内置示例占位图' : 'AI 整图'}</div>
                                      {fullImageResult?.status === 'success' && !hiddenFullImages[selectedPromptSection.title] ? (
                                        <>
                                        <div className="visual-comparison-preview-frame"><img src={fullImageResult.imageUrl} alt={`${selectedHtmlCard.label} AI 整图对比`} loading="lazy" decoding="async" className="visual-comparison-image" /></div>
                                        <div className="visual-comparison-meta"><span><strong>预览框 3:4</strong> · {isBuiltInDemo ? '内置示例占位图' : 'AI 整图'}</span><span>{isBuiltInDemo ? '本地演示素材' : '模型排版输出'}</span></div>
                                        </>
                                      ) : (
                                        <>
                                          <div className="visual-comparison-preview-frame">
                                            <div className="mi-empty-state mi-empty-state-inline visual-comparison-empty">
                                              <Icon name={fullImageResult?.status === 'loading' ? 'LoaderCircle' : 'LayoutTemplate'} className={`h-5 w-5 ${fullImageResult?.status === 'loading' ? 'animate-spin' : ''}`} />
                                              <span className="mi-empty-state-hint">{fullImageResult?.status === 'loading' ? 'AI 整图生成中' : fullImageResult?.status === 'success' ? 'AI 整图已隐藏' : '尚未生成 AI 整图'}</span>
                                            </div>
                                          </div>
                                          <div className="visual-comparison-meta"><span><strong>预览框 3:4</strong> · {isBuiltInDemo ? '内置示例占位图' : 'AI 整图'}</span><span>固定对比槽位</span></div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </section>
                        )}
                      </div>
                    );
                  }

                  const fullCleanText = content.replace(/```[^\n]*\n?/g, '').replace(/```/g, '').trim();
                  return (
                    <div className="mi-surface mi-surface-panel mi-surface-raised stage-content-panel p-8">
                       <FormattedContent text={fullCleanText} />
                    </div>
                  );
                })()
              ) : (
                <div className="mi-surface mi-surface-panel mi-surface-raised stage-content-panel p-8 md:p-10">
                  <FormattedContent text={content} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const resultContent = useMemo(() => {
  if (!showResults) return null;
  return (
    <div className="pb-20">
      {currentSession.isHalted && (
        <div className="mi-feedback mi-feedback-error processing-notice processing-notice-error" role="alert">
          <div className="processing-notice-icon">
            <Icon name="AlertTriangle" className="h-4 w-4" />
          </div>
          <div className="processing-notice-copy">
            <div className="processing-notice-header">
              <div className="processing-notice-title">流程未完整完成</div>
              <div className="processing-notice-status">需要重试</div>
            </div>
            <p className="processing-notice-message">{currentSession.stopReason || '缺少必要阶段，请检查模型输出限制后重试。'}</p>
          </div>
        </div>
      )}
      {!currentSession.isHalted && currentSession.warning && (
        <div className="mi-feedback mi-feedback-warning processing-notice" role="status" aria-live="polite">
          <div className="processing-notice-icon">
            <Icon name="CircleAlert" className="h-4 w-4" />
          </div>
          <div className="processing-notice-copy">
            <div className="processing-notice-header">
              <div className="processing-notice-title">内容深度待复核</div>
              <div className="processing-notice-status">结果可继续使用</div>
            </div>
            <p className="processing-notice-message">{currentSession.warning}</p>
          </div>
        </div>
      )}
      {renderStageContent()}
    </div>
  );
}, [showResults, currentSession, activeStageTab, activeVisualPage, imageResults, hiddenFullImages, apiConfig, htmlExportState]);
  return resultContent;
};

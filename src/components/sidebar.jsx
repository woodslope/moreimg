const AppSidebar = ({ history, isProcessing, activeHistoryId, showResults, setIsHistoryOpen, setIsConfigOpen, inputText, setInputText, handleProcessingAction, processingActionMode, processingActionLabel, processingActionHint, isComposerExpanded, setIsComposerExpanded, loadHistoryItem, retryHistoryItem, requestDeleteHistoryItem, loadDemoRecord }) => (
<div className={`moreimg-sidebar w-full lg:w-[320px] h-auto lg:h-full flex-shrink-0 flex flex-col bg-white/60 lg:bg-white/40 backdrop-blur-3xl border-b lg:border-b-0 lg:border-r border-white/60 shadow-sm lg:shadow-[8px_0_32px_rgba(31,38,135,0.05)] z-20 p-4 lg:p-6 relative ${showResults ? 'is-result-view' : ''} ${isComposerExpanded ? 'is-composer-expanded' : ''}`}>

  <div className="sidebar-brand-row z-10 shrink-0">
    <h1 className="flex min-w-0 items-center">
      <div className="sidebar-brand-mark mr-3">
        <Icon name="Sparkles" className="w-5 h-5 text-white" strokeWidth={2} />
      </div>
      <span className="sidebar-brand-copy">
        <span className="sidebar-brand-name">一文多图</span>
        <span className="sidebar-brand-en">MoreImg</span>
      </span>
    </h1>
    <div className="sidebar-header-actions">
      <button
        type="button"
        onClick={() => setIsHistoryOpen(true)}
        disabled={isProcessing}
        className="mi-button mi-button-standard mobile-history-trigger"
        aria-label={`打开历史记录，共 ${history.length} 条`}
        title="历史记录"
      >
        <Icon name="History" className="h-4 w-4" />
        <span>历史</span>
        {history.length > 0 && <span className="mobile-history-count" aria-hidden="true">{history.length}</span>}
      </button>
      <button type="button" onClick={() => setIsConfigOpen(true)} className="mi-icon-button mi-icon-button-standard sidebar-icon-button" aria-label="打开设置" title="打开设置">
        <Icon name="Settings" className="w-5 h-5" strokeWidth={2} />
      </button>
    </div>
  </div>

  {showResults && !isProcessing && (
    <button
      type="button"
      onClick={() => setIsComposerExpanded(expanded => !expanded)}
      className="mi-button mi-button-standard compact-composer-toggle"
      aria-expanded={isComposerExpanded}
      aria-controls="moreimg-composer"
    >
      <Icon name={isComposerExpanded ? 'ChevronUp' : 'Plus'} className="h-4 w-4" />
      {isComposerExpanded ? '收起新建文章' : '新建文章'}
    </button>
  )}

  <div id="moreimg-composer" className="sidebar-composer">
    <div className="sidebar-input-shell">
      <div className="sidebar-input-clip">
        <textarea
          className="sidebar-input custom-scrollbar placeholder-slate-400 focus:placeholder-slate-300"
          placeholder="粘贴需要加工的文章或文案..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isProcessing}
          spellCheck="false"
        />
      </div>
    </div>

    <button
      onClick={handleProcessingAction}
      disabled={processingActionMode === 'empty'}
      aria-describedby={processingActionHint ? 'processing-action-hint' : undefined}
      className={`mi-button mi-button-prominent processing-action-button w-full shrink-0 font-bold text-[14px] relative overflow-hidden z-10 backdrop-blur-sm is-${processingActionMode}`}
    >
      {isProcessing ? (
         <><Icon name="Square" className="w-4 h-4 mr-2 text-white" fill="currentColor" /> {processingActionLabel}</>
      ) : (
         <><Icon name={processingActionMode === 'needs-config' ? 'Settings' : 'Zap'} className={`w-4 h-4 mr-2 ${processingActionMode === 'empty' ? 'text-slate-400' : 'text-white'}`} strokeWidth={2} />{processingActionLabel}</>
      )}
    </button>
    {processingActionHint && <p id="processing-action-hint" className="processing-action-hint">{processingActionHint}</p>}
  </div>

  <div className="moreimg-history hidden lg:flex mt-10 flex-1 relative shrink-0 flex-col min-h-0">
    <div className="flex items-center justify-between mb-4 shrink-0">
      <div className="text-[12px] font-bold text-amber-600 tracking-wide uppercase">历史记录</div>
      <button
        type="button"
        onClick={loadDemoRecord}
        disabled={isProcessing}
        className="text-[11px] font-bold text-slate-400 hover:text-slate-500 transition-colors disabled:opacity-40"
        aria-label="载入示例记录，查看应用完整能力"
        title="载入示例记录（含视觉生成与对比），不消耗 API"
      >
        载入示例
      </button>
    </div>
    <div className="history-list space-y-3 overflow-y-auto custom-scrollbar flex-1 pb-4">
      <HistoryItems {...{ history, isProcessing, activeHistoryId, showResults, setIsHistoryOpen, loadHistoryItem, retryHistoryItem, requestDeleteHistoryItem }} />
    </div>
  </div>

  <div className="moreimg-brand brand-attribution hidden lg:block" aria-label="项目归属与版权">
    <div className="brand-attribution-name">MoreImg · LINPO LAB</div>
    <div>© 2026 LINPO LAB. All rights reserved.</div>
  </div>

</div>
);

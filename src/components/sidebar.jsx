const AppSidebar = ({ history, isProcessing, activeHistoryId, showResults, setIsHistoryOpen, setIsConfigOpen, inputText, setInputText, handleStopProcessing, handleStartProcessing, isButtonDisabled, loadHistoryItem, retryHistoryItem, deleteHistoryItem }) => (
<div className="moreimg-sidebar w-full md:w-[320px] h-auto md:h-full flex-shrink-0 flex flex-col bg-white/60 md:bg-white/40 backdrop-blur-3xl border-b md:border-b-0 md:border-r border-white/60 shadow-sm md:shadow-[8px_0_32px_rgba(31,38,135,0.05)] z-20 p-4 md:p-6 relative">

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

  <div className="sidebar-input-shell">
    <div className="sidebar-input-clip">
      <textarea
        className="sidebar-input custom-scrollbar placeholder-slate-400 focus:placeholder-slate-300"
        placeholder="在此注入原始长文，唤醒 AI 重塑引擎..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        disabled={isProcessing}
        spellCheck="false"
      />
    </div>
  </div>

  <button
    onClick={isProcessing ? handleStopProcessing : handleStartProcessing}
    disabled={isButtonDisabled}
    className={`mi-button mi-button-prominent processing-action-button w-full shrink-0 font-bold text-[14px] relative overflow-hidden z-10 backdrop-blur-sm
      ${isButtonDisabled ? 'is-disabled' : isProcessing ? 'is-running' : 'is-ready'}`}
  >
    {isProcessing ? (
       <><Icon name="Square" className="w-4 h-4 mr-2 text-white" fill="currentColor" /> 停止运算</>
    ) : (
       <><Icon name="Zap" className={`w-4 h-4 mr-2 ${isButtonDisabled ? 'text-slate-400' : 'text-white'}`} strokeWidth={2} />一键提取提示词物料包</>
    )}
  </button>

  <div className="moreimg-history hidden md:flex mt-10 flex-1 relative shrink-0 flex-col min-h-0">
    <div className="flex items-center text-[12px] font-bold text-slate-400 mb-4 tracking-wide uppercase shrink-0">
      历史记录
    </div>
    <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pb-4 pr-1">
      <HistoryItems {...{ history, isProcessing, activeHistoryId, showResults, setIsHistoryOpen, loadHistoryItem, retryHistoryItem, deleteHistoryItem }} />
    </div>
  </div>

  <div className="moreimg-brand brand-attribution hidden md:block" aria-label="项目归属与版权">
    <div className="brand-attribution-name">MoreImg · LINPO LAB</div>
    <div>© 2026 LINPO LAB. All rights reserved.</div>
  </div>

</div>
);

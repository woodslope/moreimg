const HistoryItems = ({ history, isProcessing, activeHistoryId, showResults, setIsHistoryOpen, loadHistoryItem, retryHistoryItem, requestDeleteHistoryItem, closeAfterOpen = false, mobile = false }) => (
  <>
    {history.length === 0 && (
      mobile ? (
        <div className="mobile-history-empty">
          <Icon name="History" className="h-8 w-8 text-slate-300" />
          <span className="text-[13px]">暂无历史记录</span>
        </div>
      ) : (
        <div className="mt-6 text-center text-[13px] italic text-slate-400">暂无历史记录</div>
      )
    )}
    {history.map(item => (
      <div
        key={item.id}
        className={`mi-surface mi-surface-list history-item relative group backdrop-blur-sm shrink-0
          ${isProcessing ? 'mi-surface-disabled' : ''}
          ${activeHistoryId === item.id && showResults ? 'mi-surface-selected' : ''}`}
      >
        <button
          type="button"
          className="history-item-main"
          onClick={() => {
            if (isProcessing) return;
            if (closeAfterOpen) setIsHistoryOpen(false);
            loadHistoryItem(item.id);
          }}
          disabled={isProcessing}
          aria-current={activeHistoryId === item.id && showResults ? 'true' : undefined}
          aria-label={`打开历史记录：${item.title || '未命名'}`}
        >
          <div className={`history-item-title text-[13px] font-bold ${activeHistoryId === item.id && showResults ? 'text-indigo-600' : 'text-slate-700'}`}>
            {item.title || '未命名'}
          </div>
          <div className="history-item-date mt-1.5 font-mono text-[11px] text-slate-400">{item.date}</div>
        </button>
        {!isProcessing && (
          <div className="history-item-actions flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (closeAfterOpen) setIsHistoryOpen(false);
                retryHistoryItem(item.id);
              }}
              className="mi-icon-button mi-icon-button-compact history-item-action bg-indigo-50/80 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-600 shadow-sm border border-indigo-100/50"
              aria-label={`再次生成：${item.title || '未命名'}`}
              title="再次生成"
            >
              <Icon name="RefreshCw" className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (closeAfterOpen) setIsHistoryOpen(false);
                requestDeleteHistoryItem(item.id);
              }}
              className="mi-icon-button mi-icon-button-compact history-item-action bg-red-50/80 text-red-500 hover:bg-red-100 hover:text-red-600 shadow-sm border border-red-100/50"
              aria-label={`删除记录：${item.title || '未命名'}`}
              title="删除记录"
            >
              <Icon name="Trash2" className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    ))}
  </>
);


const MobileHistoryDialog = ({ isHistoryOpen, setIsHistoryOpen, history, isProcessing, activeHistoryId, showResults, loadHistoryItem, retryHistoryItem, requestDeleteHistoryItem, loadDemoRecord }) => (
  <ModalFrame
    isOpen={isHistoryOpen}
    onRequestClose={() => setIsHistoryOpen(false)}
    titleId="mobile-history-title"
    overlayClassName="mobile-history-overlay animate-fade-in"
    dialogClassName="mobile-history-dialog flex flex-col animate-fade-in-down"
  >
      <div className="mobile-history-dialog-header">
        <div>
          <h2 id="mobile-history-title" className="flex items-center text-[16px] font-extrabold text-slate-800">
            <Icon name="History" className="mr-2 h-5 w-5 text-indigo-600" /> 历史记录
          </h2>
          <div className="mobile-history-subrow">
            <p className="text-[11px] text-slate-500">恢复、再次生成或删除本机记录</p>
            <button
              type="button"
              onClick={loadDemoRecord}
              disabled={isProcessing}
              className="moreimg-history-demo-action"
              aria-label="载入示例记录，查看应用完整能力"
              title="载入示例记录（含视觉生成与对比），不消耗 API"
            >
              载入示例
            </button>
          </div>
        </div>
        <button type="button" onClick={() => setIsHistoryOpen(false)} data-dialog-initial-focus="true" className="mi-icon-button mi-icon-button-standard sidebar-icon-button" aria-label="关闭历史记录" title="关闭历史记录">
          <Icon name="X" className="h-5 w-5" />
        </button>
      </div>
      <div className="mobile-history-dialog-body custom-scrollbar">
        <div className="space-y-3">
          <HistoryItems {...{ history, isProcessing, activeHistoryId, showResults, setIsHistoryOpen, loadHistoryItem, retryHistoryItem, requestDeleteHistoryItem }} closeAfterOpen mobile />
        </div>
      </div>
  </ModalFrame>
);

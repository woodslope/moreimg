const MainWorkspace = ({ isProcessing, showResults, processingUiPhase, processingElapsedSeconds, activeStageTab, currentSession, setActiveStageTab, resultsStageNavRef, resultScrollRef, resultContent, messagesEndRef }) => (
<div className="flex-1 min-h-0 flex flex-col relative h-full z-10 overflow-hidden">

  {isProcessing && !showResults && (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-50/60 backdrop-blur-xl animate-fade-in">
      <div className="processing-spinner relative w-40 h-40 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-slate-200/60 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]"></div>
        <div className="absolute inset-0 rounded-full border-t-[3px] border-indigo-600 animate-spin" style={{ animationDuration: '2s' }}></div>
        <div className="absolute inset-4 rounded-full border-b-[2px] border-sky-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }}></div>
        <div className="relative z-10 bg-white/90 shadow-xl rounded-2xl w-16 h-16 flex items-center justify-center border border-white/80 backdrop-blur-md">
           <Icon name={processingUiPhase === 'validating' ? 'ListChecks' : 'LoaderCircle'} className={`w-8 h-8 text-indigo-600 ${processingUiPhase === 'validating' ? 'animate-pulse-slow' : 'animate-spin'}`} strokeWidth={1.5} />
        </div>
      </div>

      <div className="text-center space-y-3">
        <h3 className="text-[18px] font-extrabold text-slate-800 tracking-tight transition-all duration-300">
          {processingUiPhase === 'validating' ? '已收到结果，正在校验内容完整性' : '已发送请求，正在等待模型返回'}
        </h3>
        <p className="processing-status-copy" role="status" aria-live="polite">
          {processingUiPhase === 'validating'
            ? '正在检查 JSON、文章和卡片字段，完成后会进入结果页。'
            : `已等待 ${processingElapsedSeconds} 秒，最长约 5 分钟；你可以随时停止本次加工。`}
        </p>
        <div className="processing-progress-track" aria-hidden="true">
          <div className="processing-progress-indicator"></div>
        </div>
      </div>
    </div>
  )}

  {showResults && (
    <div className="w-full pl-8 pr-[calc(2rem+5px)] md:pl-12 md:pr-[calc(3rem+5px)] pt-8 pb-4 z-20 shrink-0 relative animate-fade-in-down">
      <div className="results-stage-frame flex flex-col sm:flex-row sm:items-center justify-between gap-6">

        <div ref={resultsStageNavRef} className="results-stage-nav hide-scrollbar" role="tablist" aria-label="结果阶段">
          {NEW_STAGES.map((stage) => {
            const isActive = activeStageTab === stage.id;
            const isClickable = !currentSession.isHalted || stage.id === 'step1';
            const isFocusable = isClickable && (isActive || (currentSession.isHalted && stage.id === 'step1'));

            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={!isClickable}
                tabIndex={isFocusable ? 0 : -1}
                onKeyDown={handleTabListKeyDown}
                onClick={() => { if(isClickable) setActiveStageTab(stage.id); }}
                className={`mi-tab mi-tab-stage results-stage-tab
                  ${isActive
                    ? 'results-stage-tab-active'
                    : ''}
                `}
              >
                <Icon name={stage.icon} className={`w-4 h-4 mr-2 transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="text-[13px] font-bold tracking-wide">{stage.name}</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  )}

  <div ref={resultScrollRef} className={`flex-1 px-8 md:px-12 pb-10 custom-scrollbar relative z-10 moreimg-main-scroll ${showResults ? 'overflow-y-scroll pt-2' : 'overflow-y-auto pt-8'}`}>
    <div className="results-stage-frame h-full">

      {!isProcessing && !showResults && (
        <div className="moreimg-empty-state h-full flex flex-col items-center justify-center animate-fade-in -mt-10">
          <div className="moreimg-empty-icon w-20 h-20 rounded-[1.5rem] border border-white/80 flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 bg-indigo-50/50 rounded-[1.5rem] opacity-50 blur"></div>
            <Icon name="Bot" className="w-10 h-10 text-indigo-500 relative z-10" strokeWidth={1.5} />
          </div>
          <h2 className="text-[28px] font-extrabold text-slate-900 mb-4 tracking-tight">内容精炼与结构化 <span className="text-indigo-600">Agent</span></h2>
          <p className="text-[15px] text-slate-500 mb-12 max-w-lg text-center leading-relaxed">精修文章结构，拆分知识卡片，并生成可直接使用的视觉提示词与图片成品。</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {[{ icon: 'ListChecks', title: '内容理解与核查', desc: '识别主题、核心论点和明显矛盾，便于继续人工核对。' }, { icon: 'Cpu', title: '文章与卡片重构', desc: '整理文章层次，生成封面、正文和封底内容。' }, { icon: 'Image', title: '视觉生成与导出', desc: '生成 3:4 视觉提示词、主视觉与图片成品。' }].map((feature, idx) => (
              <div key={idx} className="mi-surface mi-surface-panel moreimg-feature-card p-6">
                <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center mb-4 border border-white/80 shadow-sm"><Icon name={feature.icon} className="w-5 h-5 text-indigo-600" /></div>
                <h4 className="text-[15px] font-bold text-slate-800 mb-2">{feature.title}</h4>
                <p className="text-[13px] text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ResultsPanel content={resultContent} />
      <div ref={messagesEndRef} />
    </div>
  </div>
</div>
);

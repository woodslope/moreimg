const MainWorkspace = ({ isProcessing, showResults, internalStage, activeStageTab, currentSession, setActiveStageTab, resultsStageNavRef, resultScrollRef, resultContent, messagesEndRef }) => (
<div className="flex-1 min-h-0 flex flex-col relative h-full z-10 overflow-hidden">

  {isProcessing && !showResults && (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-50/60 backdrop-blur-xl animate-fade-in">
      <div className="relative w-40 h-40 mb-12 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-slate-200/60 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]"></div>
        <div className="absolute inset-0 rounded-full border-t-[3px] border-indigo-600 animate-spin" style={{ animationDuration: '2s' }}></div>
        <div className="absolute inset-4 rounded-full border-b-[2px] border-sky-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }}></div>
        <div className="relative z-10 bg-white/90 shadow-xl rounded-2xl w-16 h-16 flex items-center justify-center border border-white/80 backdrop-blur-md">
           <Icon name={internalStage >= 5 ? "Image" : internalStage >= 3 ? "Cpu" : "Database"} className="w-8 h-8 text-indigo-600 animate-pulse-slow" strokeWidth={1.5} />
        </div>
      </div>

      <div className="text-center space-y-3">
        <h3 className="text-[18px] font-extrabold text-slate-800 tracking-tight transition-all duration-300">{STAGE_LOADING_TEXT[internalStage] || "连接核心计算引擎..."}</h3>
        <div className="w-64 h-1.5 bg-slate-200/50 rounded-full overflow-hidden mx-auto mt-6 backdrop-blur-sm">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-500 ease-out" style={{ width: `${(internalStage / 6) * 100}%` }}></div>
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
          <p className="text-[15px] text-slate-500 mb-12 max-w-lg text-center leading-relaxed">深度重构长文逻辑，后台运算完毕后，一键交付结构化卡片与生产级 Midjourney 视觉指令。</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {[{ icon: 'ListChecks', title: '深度事实核查', desc: '全网交叉验证，剔除过时与错误信息。' }, { icon: 'Cpu', title: '逻辑精炼重构', desc: '提炼分论点与核心比喻，生成卡片物料包。' }, { icon: 'Image', title: '视觉指令映射', desc: '色彩、构图全量生成 3:4 画面生图提示词。' }].map((feature, idx) => (
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

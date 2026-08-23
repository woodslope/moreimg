const SettingsDialog = ({ isConfigOpen, onRequestClose, apiConfig, setApiConfig, configTools, handleLoadModels, handleTestTextConnection, handleModelSelection, textModels, imageModels, lastImageDiagnostic, handleSaveConfig }) => (
  <ModalFrame
    isOpen={isConfigOpen}
    onRequestClose={onRequestClose}
    titleId="settings-dialog-title"
    overlayClassName="modal-overlay modal-overlay-settings animate-fade-in"
    dialogClassName="config-dialog flex flex-col animate-fade-in-down"
  >

      {/* 弹窗 Header */}
      <div className="config-dialog-header">
        <h3 id="settings-dialog-title" className="text-[16px] font-extrabold text-slate-800 flex items-center">
          <Icon name="Settings" className="w-5 h-5 mr-2 text-indigo-600" /> 私有引擎及技能配置
        </h3>
        <button type="button" onClick={onRequestClose} className="mi-icon-button mi-icon-button-standard sidebar-icon-button" aria-label="关闭设置" title="关闭设置">
          <Icon name="X" className="w-5 h-5" />
        </button>
      </div>

      {/* 弹窗 Body (可滚动) */}
      <div className="config-dialog-body custom-scrollbar">

        <section className="config-section">
          <div className="config-section-header">
            <div>
              <h4 className="config-section-title"><Icon name="MessageSquareText" className="h-4 w-4 text-indigo-600" /> 文本模型</h4>
              <p className="config-section-description">用于文章分析、内容重构和提示词生成。系统会根据 Endpoint 自动识别 Responses API 或 Chat Completions。</p>
            </div>
            <div className="config-section-actions">
              <button type="button" onClick={() => handleLoadModels('text')} disabled={configTools.textModels.status === 'loading'} aria-busy={configTools.textModels.status === 'loading'} className="mi-button mi-button-compact config-action-button">
                <Icon name={configTools.textModels.status === 'loading' ? 'LoaderCircle' : 'ListFilter'} className={`h-3.5 w-3.5 ${configTools.textModels.status === 'loading' ? 'animate-spin' : ''}`} />
                {configTools.textModels.status === 'loading' ? '读取中' : '读取模型'}
              </button>
              <button type="button" onClick={handleTestTextConnection} disabled={configTools.textTest.status === 'loading'} aria-busy={configTools.textTest.status === 'loading'} className="mi-button mi-button-compact config-action-button">
                <Icon name={configTools.textTest.status === 'loading' ? 'LoaderCircle' : 'PlugZap'} className={`h-3.5 w-3.5 ${configTools.textTest.status === 'loading' ? 'animate-spin' : ''}`} />
                {configTools.textTest.status === 'loading' ? '测试中' : '测试接口'}
              </button>
            </div>
          </div>
          <div className="config-grid">
            <div className="config-field config-span-2">
              <label className="config-label">接口地址（可填至 /v1）</label>
              <input
                type="text"
                value={apiConfig.apiUrl}
                onChange={(e) => setApiConfig({...apiConfig, apiUrl: e.target.value})}
                data-dialog-initial-focus="true"
                className="mi-field config-input placeholder-slate-400"
              />
              <div className="config-hint">实际请求：{resolveApiEndpoint(apiConfig.apiUrl, 'text') || '请填写地址'}；当前协议：{isResponsesApiEndpoint(resolveApiEndpoint(apiConfig.apiUrl, 'text')) ? 'Responses API' : 'Chat Completions'}</div>
            </div>
            <div className="config-field">
              <label className="config-label">模型名称 (Model)</label>
              {textModels.length > 0 ? (
                <div className="config-select-shell">
                  <select value={apiConfig.model} onChange={(e) => handleModelSelection('text', e.target.value)} aria-label="选择文本模型" className="mi-field config-input config-select">
                    {apiConfig.model && !textModels.includes(apiConfig.model) && <option value={apiConfig.model}>{apiConfig.model}</option>}
                    {textModels.map(model => <option key={model} value={model}>{model}</option>)}
                    <option value="__manual__">手动填写...</option>
                  </select>
                  <Icon name="ChevronDown" className="config-select-icon" />
                </div>
              ) : (
                <input
                  type="text"
                  value={apiConfig.model}
                  onChange={(e) => setApiConfig({...apiConfig, model: e.target.value})}
                  className="mi-field config-input placeholder-slate-400"
                />
              )}
            </div>
            <div className="config-field">
              <label className="config-label">密钥 (API Key)</label>
              <input
                type="password"
                value={apiConfig.apiKey}
                onChange={(e) => setApiConfig({...apiConfig, apiKey: e.target.value})}
                placeholder="sk-..."
                className="mi-field config-input placeholder-slate-400"
              />
            </div>
          </div>
          <ConfigStatus state={configTools.textModels} />
          <ConfigStatus state={configTools.textTest} />
        </section>

        <section className="config-section">
          <div className="config-section-header">
            <div>
              <h4 className="config-section-title"><Icon name="SlidersHorizontal" className="h-4 w-4 text-indigo-600" /> 加工偏好</h4>
              <p className="config-section-description">MoreImg v6 核心规则和 JSON 协议已内置。这里仅调整内容表达，不会破坏页面读取。</p>
            </div>
          </div>
          <div className="mi-feedback mi-feedback-info config-preference-note">
            <Icon name="ShieldCheck" className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <span>每次加工仍只请求一次文本 API；固定生成封面、正文和封底。核心规则不可编辑。</span>
          </div>
          <div className="config-grid">
            <div className="config-field">
              <label className="config-label">精修方式</label>
              <div className="config-select-shell">
                <select value={apiConfig.processingPreferences?.refinement || 'standard'} onChange={(e) => setApiConfig(prev => ({ ...prev, processingPreferences: { ...createDefaultProcessingPreferences(), ...prev.processingPreferences, refinement: e.target.value } }))} className="mi-field config-input config-select">
                  <option value="standard">标准精修</option>
                  <option value="light">轻度整理</option>
                </select>
                <Icon name="ChevronDown" className="config-select-icon" />
              </div>
            </div>
            <div className="config-field">
              <label className="config-label">卡片总页数</label>
              <div className="config-select-shell">
                <select value={apiConfig.processingPreferences?.pageCount || 'auto'} onChange={(e) => setApiConfig(prev => ({ ...prev, processingPreferences: { ...createDefaultProcessingPreferences(), ...prev.processingPreferences, pageCount: e.target.value } }))} className="mi-field config-input config-select">
                  <option value="auto">自动决定</option>
                  {[3,4,5,6,7,8,9].map(count => <option key={count} value={String(count)}>{count} 页</option>)}
                </select>
                <Icon name="ChevronDown" className="config-select-icon" />
              </div>
            </div>
            <div className="config-field">
              <label className="config-label">内容口吻</label>
              <div className="config-select-shell">
                <select value={apiConfig.processingPreferences?.tone || 'preserve'} onChange={(e) => setApiConfig(prev => ({ ...prev, processingPreferences: { ...createDefaultProcessingPreferences(), ...prev.processingPreferences, tone: e.target.value } }))} className="mi-field config-input config-select">
                  <option value="preserve">尽量保留原文</option>
                  <option value="concise">更简洁克制</option>
                  <option value="conversational">更口语自然</option>
                </select>
                <Icon name="ChevronDown" className="config-select-icon" />
              </div>
            </div>
            <div className="config-field">
              <label className="config-label">标题处理</label>
              <label className="mi-field config-checkbox">
                <input type="checkbox" checked={Boolean(apiConfig.processingPreferences?.preserveTitle)} onChange={(e) => setApiConfig(prev => ({ ...prev, processingPreferences: { ...createDefaultProcessingPreferences(), ...prev.processingPreferences, preserveTitle: e.target.checked } }))} />
                <span>优先保留原文标题</span>
              </label>
            </div>
            <div className="config-field config-span-2">
              <label className="config-label">补充要求（可选）</label>
              <textarea value={apiConfig.processingPreferences?.customInstruction || ''} onChange={(e) => setApiConfig(prev => ({ ...prev, processingPreferences: { ...createDefaultProcessingPreferences(), ...prev.processingPreferences, customInstruction: e.target.value } }))} className="mi-field config-preference-textarea" placeholder="例如：保留第一人称；标题不要太营销；正文尽量克制。" spellCheck="false" />
            </div>
          </div>
          <p className="config-hint">API Key 和加工偏好仅保存在当前浏览器 localStorage，不会上传到作者服务器。</p>
        </section>

        <section className="config-section">
          <div className="config-section-header">
            <div>
              <h4 className="config-section-title"><Icon name="Image" className="h-4 w-4 text-indigo-600" /> 图片模型</h4>
              <p className="config-section-description">用于无字主视觉和 AI 整图。读取模型失败时仍可手动填写，正式生图就是最终接口验证。</p>
            </div>
            <div className="config-section-actions">
              <button type="button" onClick={() => handleLoadModels('image')} disabled={configTools.imageModels.status === 'loading'} aria-busy={configTools.imageModels.status === 'loading'} className="mi-button mi-button-compact config-action-button">
                <Icon name={configTools.imageModels.status === 'loading' ? 'LoaderCircle' : 'ListFilter'} className={`h-3.5 w-3.5 ${configTools.imageModels.status === 'loading' ? 'animate-spin' : ''}`} />
                {configTools.imageModels.status === 'loading' ? '读取中' : '读取模型'}
              </button>
            </div>
          </div>
          <div className="config-grid">
            <div className="config-field config-span-2">
              <label className="config-label">图片接口地址（可填至 /v1）</label>
              <input type="text" value={apiConfig.imageApiUrl} onChange={(e) => setApiConfig({...apiConfig, imageApiUrl: e.target.value})} placeholder="https://api.openai.com/v1 或完整图片地址" className="mi-field config-input" />
              <div className="config-hint">实际请求：{resolveApiEndpoint(apiConfig.imageApiUrl, 'image') || '请填写地址'}</div>
            </div>
            <div className="config-field">
              <label className="config-label">图片模型</label>
              {imageModels.length > 0 ? (
                <div className="config-select-shell">
                  <select value={apiConfig.imageModel} onChange={(e) => handleModelSelection('image', e.target.value)} aria-label="选择图片模型" className="mi-field config-input config-select">
                    {apiConfig.imageModel && !imageModels.includes(apiConfig.imageModel) && <option value={apiConfig.imageModel}>{apiConfig.imageModel}</option>}
                    {imageModels.map(model => <option key={model} value={model}>{model}</option>)}
                    <option value="__manual__">手动填写...</option>
                  </select>
                  <Icon name="ChevronDown" className="config-select-icon" />
                </div>
              ) : (
                <input type="text" value={apiConfig.imageModel} onChange={(e) => setApiConfig({...apiConfig, imageModel: e.target.value})} placeholder="gpt-image-1" className="mi-field config-input" />
              )}
            </div>
            <div className="config-field">
              <label className="config-label">图片尺寸</label>
              <input type="text" value={apiConfig.imageSize} onChange={(e) => setApiConfig({...apiConfig, imageSize: e.target.value})} placeholder="768x1024" className="mi-field config-input" />
            </div>
            <div className="config-field config-span-2">
              <label className="config-label">图片 API Key</label>
              <input type="password" value={apiConfig.imageApiKey} onChange={(e) => setApiConfig({...apiConfig, imageApiKey: e.target.value})} placeholder="sk-..." className="mi-field config-input" />
            </div>
          </div>
          <ConfigStatus state={configTools.imageModels} />
        </section>

        <section className="config-section">
          <details className="mi-surface mi-surface-card image-diagnostic">
            <summary>最近一次生图诊断<span>{lastImageDiagnostic?.updatedAt ? new Date(lastImageDiagnostic.updatedAt).toLocaleString() : '暂无记录'}</span></summary>
            {lastImageDiagnostic ? (
              <dl className="image-diagnostic-grid">
                {[
                  ['请求方式', lastImageDiagnostic.requestMode],
                  ['请求接口', lastImageDiagnostic.endpointPath],
                  ['请求格式', lastImageDiagnostic.requestedFormat],
                  ['实际返回', lastImageDiagnostic.actualFormat],
                  ['图片来源', lastImageDiagnostic.imageHost],
                  ['保存方式', lastImageDiagnostic.storageBackend],
                  ['保存结果', lastImageDiagnostic.storageStatus],
                  ['刷新恢复', lastImageDiagnostic.restoreStatus],
                  ['失败原因', lastImageDiagnostic.failureReason || '无']
                ].map(([label, value]) => <div className="image-diagnostic-item" key={label}><dt>{label}</dt><dd>{value || '未记录'}</dd></div>)}
              </dl>
            ) : <p className="image-diagnostic-empty">完成一次生图后，这里会显示脱敏后的请求与保存结果。</p>}
          </details>
        </section>

      </div>

      {/* 弹窗 Footer */}
      <div className="config-dialog-footer">
        <button
          onClick={handleSaveConfig}
          className="mi-button mi-button-prominent visual-button visual-button-primary w-full"
        >
          保存并应用配置
        </button>
      </div>

  </ModalFrame>
);

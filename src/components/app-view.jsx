const AppView = ({
  activeHistoryId,
  activeStageTab,
  apiConfig,
  cancelDeleteHistoryItem,
  configTools,
  confirmDeleteHistoryItem,
  currentSession,
  handleLoadModels,
  handleModelSelection,
  handleProcessingAction,
  handleSaveConfig,
  handleTestTextConnection,
  history,
  imageModels,
  inputText,
  isComposerExpanded,
  isConfigOpen,
  isDeletingHistory,
  isHistoryOpen,
  isProcessing,
  lastImageDiagnostic,
  loadDemoRecord,
  loadHistoryItem,
  messagesEndRef,
  onRequestCloseConfig,
  pendingDeleteHistoryItem,
  processingActionHint,
  processingActionLabel,
  processingActionMode,
  processingElapsedSeconds,
  processingUiPhase,
  requestDeleteHistoryItem,
  resultContent,
  resultScrollRef,
  resultsStageNavRef,
  retryHistoryItem,
  setActiveStageTab,
  setApiConfig,
  setInputText,
  setIsComposerExpanded,
  setIsConfigOpen,
  setIsHistoryOpen,
  setToast,
  showResults,
  textModels,
  toast
}) => (
  <div className="moreimg-app-shell flex flex-col lg:flex-row h-screen overflow-hidden font-sans text-slate-800 relative bg-transparent">
    {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => setToast(null)} />}
    <AppSidebar {...{
      history,
      isProcessing,
      activeHistoryId,
      showResults,
      setIsHistoryOpen,
      setIsConfigOpen,
      inputText,
      setInputText,
      handleProcessingAction,
      processingActionMode,
      processingActionLabel,
      processingActionHint,
      isComposerExpanded,
      setIsComposerExpanded,
      loadHistoryItem,
      retryHistoryItem,
      requestDeleteHistoryItem,
      loadDemoRecord
    }} />
    <MainWorkspace {...{
      isProcessing,
      showResults,
      processingUiPhase,
      processingElapsedSeconds,
      activeStageTab,
      currentSession,
      setActiveStageTab,
      resultsStageNavRef,
      resultScrollRef,
      resultContent,
      messagesEndRef
    }} />
    <MobileHistoryDialog {...{
      isHistoryOpen,
      setIsHistoryOpen,
      history,
      isProcessing,
      activeHistoryId,
      showResults,
      loadHistoryItem,
      retryHistoryItem,
      requestDeleteHistoryItem,
      loadDemoRecord
    }} />
    <SettingsDialog {...{
      isConfigOpen,
      apiConfig,
      setApiConfig,
      configTools,
      handleLoadModels,
      handleTestTextConnection,
      handleModelSelection,
      textModels,
      imageModels,
      lastImageDiagnostic,
      handleSaveConfig
    }} onRequestClose={onRequestCloseConfig} />
    <ConfirmDeleteDialog
      item={pendingDeleteHistoryItem}
      isDeleting={isDeletingHistory}
      onCancel={cancelDeleteHistoryItem}
      onConfirm={confirmDeleteHistoryItem}
    />
  </div>
);

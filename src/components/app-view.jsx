const AppView = ({
  activeHistoryId,
  activeStageTab,
  apiConfig,
  configTools,
  currentSession,
  deleteHistoryItem,
  handleLoadModels,
  handleModelSelection,
  handleSaveConfig,
  handleStartProcessing,
  handleStopProcessing,
  handleTestTextConnection,
  history,
  imageModels,
  inputText,
  internalStage,
  isButtonDisabled,
  isConfigOpen,
  isHistoryOpen,
  isProcessing,
  lastImageDiagnostic,
  loadHistoryItem,
  messagesEndRef,
  resultContent,
  resultScrollRef,
  resultsStageNavRef,
  retryHistoryItem,
  setActiveStageTab,
  setApiConfig,
  setInputText,
  setIsConfigOpen,
  setIsHistoryOpen,
  setToast,
  showResults,
  textModels,
  toast
}) => (
  <div className="moreimg-app-shell flex flex-col md:flex-row h-screen overflow-hidden font-sans text-slate-800 relative bg-transparent">
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    <AppSidebar {...{ history, isProcessing, activeHistoryId, showResults, setIsHistoryOpen, setIsConfigOpen, inputText, setInputText, handleStopProcessing, handleStartProcessing, isButtonDisabled, loadHistoryItem, retryHistoryItem, deleteHistoryItem }} />
    <MainWorkspace {...{ isProcessing, showResults, internalStage, activeStageTab, currentSession, setActiveStageTab, resultsStageNavRef, resultScrollRef, resultContent, messagesEndRef }} />
    <MobileHistoryDialog {...{ isHistoryOpen, setIsHistoryOpen, history, isProcessing, activeHistoryId, showResults, loadHistoryItem, retryHistoryItem, deleteHistoryItem }} />
    <SettingsDialog {...{ isConfigOpen, setIsConfigOpen, apiConfig, setApiConfig, configTools, handleLoadModels, handleTestTextConnection, handleModelSelection, textModels, imageModels, lastImageDiagnostic, handleSaveConfig }} />
  </div>
);

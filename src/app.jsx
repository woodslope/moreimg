    function App() {
      // API 由用户配置；MoreImg v6 核心规则固定内置，普通用户只调整加工偏好。
      const [apiConfig, setApiConfig] = useState({
        apiUrl: '',
        model: '',
        apiKey: '',
        promptVersion: DEFAULT_PROMPT_VERSION,
        processingPreferences: createDefaultProcessingPreferences(),
        imageApiUrl: 'https://api.aixoras.com/v1/images/generations',
        imageModel: 'gpt-image-2',
        imageApiKey: '',
        imageSize: DEFAULT_IMAGE_RATIO,
        imageRatioVersion: IMAGE_RATIO_CONFIG_VERSION
      });
      const [isConfigOpen, setIsConfigOpen] = useState(() => !hasSavedApiConfig());
      const [isHistoryOpen, setIsHistoryOpen] = useState(false);
      const [history, setHistory] = useState([]);
      const [activeHistoryId, setActiveHistoryId] = useState(null);
      const [inputText, setInputText] = useState('');
      const [isProcessing, setIsProcessing] = useState(false);
      const [showResults, setShowResults] = useState(false);
      const [processingUiPhase, setProcessingUiPhase] = useState('idle');
      const [processingElapsedSeconds, setProcessingElapsedSeconds] = useState(0);
      const [isComposerExpanded, setIsComposerExpanded] = useState(false);
      const [internalStage, setInternalStage] = useState(0);
      const [activeStageTab, setActiveStageTab] = useState('step1');
      const [activeVisualPage, setActiveVisualPage] = useState('');
      const [toast, setToast] = useState(null);
      const [imageResults, setImageResults] = useState({});
      const [lastImageDiagnostic, setLastImageDiagnostic] = useState(loadLastImageDiagnostic);
      const [imageUsageLog, setImageUsageLog] = useState(loadImageUsageLog);
      const [htmlExportState, setHtmlExportState] = useState({ cardId: '', status: 'idle', error: '' });
      const [hiddenFullImages, setHiddenFullImages] = useState({});
      const [textModels, setTextModels] = useState([]);
      const [imageModels, setImageModels] = useState([]);
      const [pendingDeleteHistoryId, setPendingDeleteHistoryId] = useState(null);
      const [isDeletingHistory, setIsDeletingHistory] = useState(false);
      const [configTools, setConfigTools] = useState({
        textModels: { status: 'idle', message: '' },
        imageModels: { status: 'idle', message: '' },
        textTest: { status: 'idle', message: '' }
      });

      const [currentSession, setCurrentSession] = useState({
        rawText: '',
        packageData: null,
        stages: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
        isHalted: false,
        stopReason: '',
        warning: ''
      });
      const messagesEndRef = useRef(null);
      const processingAbortRef = useRef(null);
      const historyLoadTokenRef = useRef(0);
      const imageAbortControllersRef = useRef(new Map());
      // 生图可能跨越会话切换才结束，回调里必须读“当前真正激活的会话”，
      // 闭包捕获的 activeHistoryId 在那时已经过期。
      const activeHistoryIdRef = useRef(null);
      const configRequestControllersRef = useRef(new Map());
      const demoLoadInFlightRef = useRef(false);
      const imageObjectUrlsRef = useRef([]);
      const htmlCardRefs = useRef({});
      const htmlExportInFlightRef = useRef(false);
      const resultScrollRef = useRef(null);
      const resultsStageNavRef = useRef(null);
      const parsedSession = useMemo(() => {
        if (currentSession.packageData?.status === 'complete') {
          const pages = currentSession.packageData.pages || [];
          return {
            cardBlocks: [],
            cardHeaders: [],
            htmlCards: pages.map(packagePageToCard),
            promptSections: pages.map(page => packagePageToPromptSection(page, currentSession.packageData.style_lock, pages))
          };
        }
        const cardContent = currentSession.stages[4] || '';
        return {
          cardBlocks: cardContent.split(/\*\*.*?卡片.*?\*\*/g).filter(block => block.trim() !== ''),
          cardHeaders: cardContent.match(/\*\*.*?卡片.*?\*\*/g) || [],
          htmlCards: parseCardPackage(cardContent),
          promptSections: parsePromptSections(currentSession.stages[5] || '')
        };
      }, [currentSession.packageData, currentSession.stages[4], currentSession.stages[5]]);

      const updateConfigTool = (key, nextState) => {
        setConfigTools(prev => ({ ...prev, [key]: { ...prev[key], ...nextState } }));
      };

      const saveLastImageDiagnostic = (patch) => {
        setLastImageDiagnostic(previous => {
          const next = { ...(previous || {}), ...patch, updatedAt: new Date().toISOString() };
          localStorage.setItem(MOREIMG_IMAGE_DIAGNOSTIC_KEY, JSON.stringify(next));
          return next;
        });
      };

      useEffect(() => {
        activeHistoryIdRef.current = activeHistoryId;
      }, [activeHistoryId]);

      const recordImageUsage = (entry) => setImageUsageLog(appendImageUsageLog(entry));

      useEffect(() => {
        if (!showResults || !resultScrollRef.current) return;
        resultScrollRef.current.scrollTop = 0;
      }, [activeStageTab, activeHistoryId, showResults]);

      useEffect(() => {
        if (!showResults || !resultsStageNavRef.current) return;
        const revealActiveStage = () => {
          resultsStageNavRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        };
        revealActiveStage();
        window.addEventListener('resize', revealActiveStage);
        return () => window.removeEventListener('resize', revealActiveStage);
      }, [activeStageTab, activeHistoryId, showResults]);

      useEffect(() => {
        if (!isProcessing || showResults) return;
        setProcessingElapsedSeconds(0);
        const timer = setInterval(() => setProcessingElapsedSeconds(seconds => seconds + 1), 1000);
        return () => clearInterval(timer);
      }, [isProcessing, showResults]);

      const replaceImageResults = (nextResults) => {
        imageObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        imageObjectUrlsRef.current = Object.values(nextResults).map(item => item.imageUrl).filter(url => url?.startsWith('blob:'));
        setImageResults(nextResults);
      };

      const updateImageFocus = (resultKey, cardTitle, focusY) => {
        const normalizedFocus = Math.max(30, Math.min(75, Number(focusY) || 50));
        setImageResults(prev => ({
          ...prev,
          [resultKey]: { ...prev[resultKey], focusY: normalizedFocus }
        }));
        saveImageFocus(activeHistoryId || 'current', cardTitle, 'visual-only', normalizedFocus)
          .catch(error => setToast({ message: `画面焦点保存失败: ${error.message}`, type: 'error' }));
      };

      // 只有该会话被真正删除时才中止在途生图。切换历史记录或开始新加工都不再取消：
      // 上游一旦受理就会计费，本地放弃等于白花钱，结果还拿不到。
      const abortSessionImageRequests = (sessionId) => {
        imageAbortControllersRef.current.forEach((entry, resultKey) => {
          if (entry.sessionId !== sessionId) return;
          entry.controller.abort();
          imageAbortControllersRef.current.delete(resultKey);
        });
      };

      const hasInFlightImageRequests = () => imageAbortControllersRef.current.size > 0;

      // 页面卸载时才无条件收尾：这时已经没有任何界面能承接结果。
      const abortAllImageRequests = () => {
        imageAbortControllersRef.current.forEach(entry => entry.controller.abort());
        imageAbortControllersRef.current.clear();
      };

      const abortConfigRequests = (resetState = true) => {
        configRequestControllersRef.current.forEach(controller => controller.abort());
        configRequestControllersRef.current.clear();
        if (resetState) {
          setConfigTools(previous => Object.fromEntries(Object.entries(previous).map(([key, state]) => [
            key,
            state.status === 'loading' ? { status: 'idle', message: '' } : state
          ])));
        }
      };

      const closeConfigDialog = () => {
        abortConfigRequests();
        setIsConfigOpen(false);
      };

      const restoreSessionImages = async (sessionId, requestToken) => {
        try {
          const storedImages = await loadSessionImages(sessionId);
          if (requestToken !== historyLoadTokenRef.current) return;
          const nextResults = {};
          storedImages.forEach(item => {
            const imageUrl = URL.createObjectURL(item.blob);
            nextResults[`${item.mode || 'visual'}:${item.cardTitle}`] = { status: 'success', imageUrl, error: '', mode: item.mode || 'visual', focusY: item.focusY };
          });
          replaceImageResults(nextResults);
          if (loadLastImageDiagnostic()?.sessionId === sessionId) {
            saveLastImageDiagnostic({
              restoreStatus: storedImages.length ? '成功' : '失败',
              failureReason: storedImages.length ? '' : '未找到可恢复的本地图片'
            });
          }
        } catch (error) {
          if (requestToken !== historyLoadTokenRef.current) return;
          if (loadLastImageDiagnostic()?.sessionId === sessionId) {
            saveLastImageDiagnostic({ restoreStatus: '失败', failureReason: getDiagnosticFailureReason(error, 'restore') });
          }
          setToast({ message: `图片记录读取失败: ${error.message}`, type: 'error' });
        }
      };

      useEffect(() => {
        let isActive = true;
        const loadHistory = async () => {
          const savedHistory = localStorage.getItem(HISTORY_INDEX_KEY);
          if (savedHistory) {
            try {
              const parsedHistory = JSON.parse(savedHistory);
              if (!Array.isArray(parsedHistory)) throw new Error('历史索引格式无效');
              const candidateHistory = parsedHistory.filter(item => item?.id && item?.title !== undefined).slice(0, HISTORY_LIMIT);
              const reconciledHistory = await filterExistingHistoryIndex(candidateHistory);
              if (isActive) {
                // IndexedDB 对账可能比用户首次加工更慢；不要用启动时的旧快照覆盖新写入。
                if (localStorage.getItem(HISTORY_INDEX_KEY) !== savedHistory) return;
                setHistory(reconciledHistory);
                if (reconciledHistory.length !== candidateHistory.length) {
                  localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(reconciledHistory));
                }
              }
              return;
            } catch {
              localStorage.removeItem(HISTORY_INDEX_KEY);
            }
          }

          const legacyValue = localStorage.getItem(LEGACY_HISTORY_KEY);
          if (!legacyValue) {
            // 首次启动：预置一条示例记录，让第一次使用的人直接查看完整能力（含视觉生成与成品对比）
            try {
              const existingDemo = await loadSessionRecord(DEMO_SESSION_ID).catch(() => null);
              if (existingDemo?.isDemo) {
                const demoIndex = [toHistoryIndex(existingDemo)];
                if (!isActive || localStorage.getItem(HISTORY_INDEX_KEY)) return;
                setHistory(demoIndex);
                localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(demoIndex));
              } else if (shouldSeedDemo() && !(await hasAnySessionRecords())) {
                const demoRecord = await seedDemoHistory();
                if (isActive && !localStorage.getItem(HISTORY_INDEX_KEY)) {
                  const demoIndex = [toHistoryIndex(demoRecord)];
                  setHistory(demoIndex);
                  localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(demoIndex));
                }
              }
            } catch (error) {
              if (isActive) setToast({ message: `示例记录初始化失败: ${error.message}`, type: 'error', duration: 5000 });
            }
            return;
          }
          try {
            const migratedHistory = await migrateLegacyHistory(JSON.parse(legacyValue));
            if (!isActive) return;
            // 迁移期间若已有新索引，以新写入为准。
            if (localStorage.getItem(HISTORY_INDEX_KEY)) return;
            localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(migratedHistory));
            localStorage.removeItem(LEGACY_HISTORY_KEY);
            setHistory(migratedHistory);
          } catch (error) {
            if (isActive) setToast({ message: `历史记录迁移失败: ${error.message}`, type: 'error', duration: 5000 });
          }
        };

        const savedConfig = localStorage.getItem('agent_api_config');
        if (savedConfig) {
          let parsedConfig = null;
          try {
            parsedConfig = JSON.parse(savedConfig);
            if (!parsedConfig || typeof parsedConfig !== 'object' || Array.isArray(parsedConfig)) throw new Error('配置格式无效');
          } catch {
            localStorage.removeItem('agent_api_config');
            setIsConfigOpen(true);
            setToast({ message: '本地配置已损坏，请重新填写接口设置', type: 'error', duration: 5000 });
          }
          if (parsedConfig) {
            const savedImageRatioVersion = Number(parsedConfig.imageRatioVersion || 0);
            delete parsedConfig.systemPrompt;
            parsedConfig.promptVersion = DEFAULT_PROMPT_VERSION;
            parsedConfig.processingPreferences = {
              ...createDefaultProcessingPreferences(),
              ...(parsedConfig.processingPreferences || {})
            };
            parsedConfig.imageApiUrl = parsedConfig.imageApiUrl || 'https://api.aixoras.com/v1/images/generations';
            parsedConfig.imageModel = parsedConfig.imageModel || 'gpt-image-2';
            parsedConfig.imageApiKey = parsedConfig.imageApiKey || '';
            // 旧版默认尺寸是 1024x1536；早期比例迁移也曾把它写成 2:3。
            // 无迁移标记的配置按旧默认值处理；用户重新保存后可继续使用自己选择的比例。
            const legacyImageSize = String(parsedConfig.imageSize || '').trim().toLowerCase();
            parsedConfig.imageSize = savedImageRatioVersion < IMAGE_RATIO_CONFIG_VERSION
              && (legacyImageSize === '1024x1536' || legacyImageSize === '2:3')
              ? DEFAULT_IMAGE_RATIO
              : normalizeImageRatio(parsedConfig.imageSize);
            parsedConfig.imageRatioVersion = IMAGE_RATIO_CONFIG_VERSION;
            localStorage.setItem('agent_api_config', JSON.stringify(parsedConfig));
            setApiConfig(parsedConfig);
            if (parsedConfig.apiKey?.trim()) {
              setIsConfigOpen(false);
            }
          }
        } else {
          setIsConfigOpen(true);
        }
        loadHistory();
        return () => { isActive = false; };
      }, []);

      useEffect(() => () => {
        processingAbortRef.current?.abort();
        abortConfigRequests(false);
        abortAllImageRequests();
        imageObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      }, []);

      const handleSaveConfig = () => {
        const nextConfig = {
          ...apiConfig,
          promptVersion: DEFAULT_PROMPT_VERSION,
          processingPreferences: {
            ...createDefaultProcessingPreferences(),
            ...(apiConfig.processingPreferences || {})
          },
          imageRatioVersion: IMAGE_RATIO_CONFIG_VERSION
        };
        localStorage.setItem('agent_api_config', JSON.stringify(nextConfig));
        setApiConfig(nextConfig);
        setToast({ message: 'AI 引擎及技能配置已保存', type: 'success' });
        closeConfigDialog();
      };

      const handleLoadModels = async (kind) => {
        const isImage = kind === 'image';
        const endpoint = resolveApiEndpoint(isImage ? apiConfig.imageApiUrl : apiConfig.apiUrl, isImage ? 'image' : 'text');
        const apiKey = isImage ? apiConfig.imageApiKey.trim() : apiConfig.apiKey.trim();
        const stateKey = isImage ? 'imageModels' : 'textModels';
        const setModels = isImage ? setImageModels : setTextModels;
        if (!endpoint || !apiKey) {
          updateConfigTool(stateKey, { status: 'error', message: '请先填写接口地址和 API Key。' });
          return;
        }

        configRequestControllersRef.current.get(stateKey)?.abort();
        const requestController = new AbortController();
        configRequestControllersRef.current.set(stateKey, requestController);
        updateConfigTool(stateKey, { status: 'loading', message: '正在读取模型列表...' });
        try {
          const modelsEndpoint = deriveModelsEndpoint(endpoint);
          const response = await runWithRequestControl(signal => fetch(modelsEndpoint, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal
          }), {
            timeoutMs: 30000,
            signal: requestController.signal,
            timeoutMessage: '读取模型列表超过 30 秒，请检查接口地址或稍后重试。'
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
          if (requestController.signal.aborted || configRequestControllersRef.current.get(stateKey) !== requestController) return;
          const modelIds = extractModelIds(data);
          if (modelIds.length === 0) throw new Error('接口未返回可用模型');
          setModels(modelIds);
          updateConfigTool(stateKey, { status: 'success', message: `已读取 ${modelIds.length} 个模型，可继续手动输入或从建议中选择。` });
        } catch (error) {
          if (requestController.signal.aborted) return;
          updateConfigTool(stateKey, { status: 'error', message: `读取失败：${error.message}。不影响手动填写。` });
        } finally {
          if (configRequestControllersRef.current.get(stateKey) === requestController) {
            configRequestControllersRef.current.delete(stateKey);
          }
        }
      };

      const handleModelSelection = (kind, value) => {
        if (value === '__manual__') {
          if (kind === 'image') setImageModels([]);
          else setTextModels([]);
          return;
        }
        const configKey = kind === 'image' ? 'imageModel' : 'model';
        setApiConfig(prev => ({ ...prev, [configKey]: value }));
      };

      const handleTestTextConnection = async () => {
        const endpoint = resolveApiEndpoint(apiConfig.apiUrl, 'text');
        const model = apiConfig.model.trim();
        const apiKey = apiConfig.apiKey.trim();
        if (!endpoint || !model || !apiKey) {
          updateConfigTool('textTest', { status: 'error', message: '请先填写接口地址、模型和 API Key。' });
          return;
        }

        configRequestControllersRef.current.get('textTest')?.abort();
        const requestController = new AbortController();
        configRequestControllersRef.current.set('textTest', requestController);
        updateConfigTool('textTest', { status: 'loading', message: '正在发送最小测试请求...' });
        const startedAt = Date.now();
        try {
          const messages = [
            { role: 'system', content: '这是连接测试。' },
            { role: 'user', content: '只回复 OK' }
          ];
          const data = await runWithRequestControl(async signal => {
            const response = await fetchTextRequest(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify(buildProcessingRequestBody(endpoint, model, messages, 64, false)),
              signal
            });
            const responseData = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(responseData?.error?.message || responseData?.message || `HTTP ${response.status}`);
            return responseData;
          }, {
            timeoutMs: TEXT_TEST_TIMEOUT_MS,
            signal: requestController.signal,
            timeoutMessage: '接口测试超过 30 秒，请检查接口地址、模型或服务状态。'
          });
          if (requestController.signal.aborted || configRequestControllersRef.current.get('textTest') !== requestController) return;
          const responseText = extractProcessingResponseText(data).trim();
          if (!responseText) throw new Error('接口成功响应，但没有可解析文本');
          const elapsedMs = Date.now() - startedAt;
          const preview = responseText.replace(/\s+/g, ' ').slice(0, 48);
          updateConfigTool('textTest', { status: 'success', message: `连接成功，耗时 ${elapsedMs} ms，返回：${preview}` });
        } catch (error) {
          if (requestController.signal.aborted) return;
          updateConfigTool('textTest', { status: 'error', message: `测试失败：${error.message}` });
        } finally {
          if (configRequestControllersRef.current.get('textTest') === requestController) {
            configRequestControllersRef.current.delete('textTest');
          }
        }
      };

      const handleGenerateImage = async (cardTitle, prompt, mode = 'visual') => {
        if (currentSession.isDemo) {
          setToast({ message: '内置示例仅用于查看流程，不调用图片 API。请输入自己的文章开始加工。', type: 'success', duration: 5000 });
          return;
        }
        if (!apiConfig.imageApiUrl.trim() || !apiConfig.imageModel.trim() || !apiConfig.imageApiKey.trim()) {
          setToast({ message: '请先配置图片接口、模型和密钥', type: 'error' });
          setIsConfigOpen(true);
          return;
        }

        const resultKey = `${mode}:${cardTitle}`;
        imageAbortControllersRef.current.get(resultKey)?.controller.abort();
        const requestController = new AbortController();
        // 生图请求绑定发起时的会话，切换历史记录不再取消它：
        // 上游已经受理并会计费，本地放弃只会白花钱。
        const sessionId = activeHistoryId || 'current';
        imageAbortControllersRef.current.set(resultKey, { controller: requestController, sessionId });
        const imageModel = apiConfig.imageModel.trim();
        const requestedSize = normalizeImageSize(apiConfig.imageSize, imageModel);
        const requestedRatio = normalizeImageRatio(apiConfig.imageSize);
        const startedAt = Date.now();
        let generationCompletedAt = 0;
        let requestPhase = 'request';
        let timedOutPhase = '';
        let phaseTimeout = setTimeout(() => {
          timedOutPhase = 'request';
          requestController.abort();
        }, IMAGE_REQUEST_TIMEOUT_MS);
        const restartTimeoutForPhase = (phase, timeoutMs) => {
          clearTimeout(phaseTimeout);
          phaseTimeout = setTimeout(() => {
            timedOutPhase = phase;
            requestController.abort();
          }, timeoutMs);
        };
        const imageEndpoint = resolveApiEndpoint(apiConfig.imageApiUrl, 'image');
        const imageTransport = getRequestTransport(imageEndpoint, 'image');
        const previousFocusY = imageResults[resultKey]?.focusY;
        setImageResults(prev => ({ ...prev, [resultKey]: { status: 'loading', imageUrl: '', error: '', mode, focusY: prev[resultKey]?.focusY } }));
        saveLastImageDiagnostic({
          sessionId,
          requestMode: '同步',
          endpointPath: getDiagnosticEndpointPath(imageEndpoint),
          requestedFormat: isGptImage2Model(imageModel) ? 'url（请求指定）' : isGptImageModel(imageModel) ? 'b64_json（模型默认）' : 'b64_json',
          actualFormat: '等待响应',
          imageHost: '等待响应',
          storageBackend: 'IndexedDB',
          storageStatus: '等待保存',
          restoreStatus: '尚未验证',
          failureReason: ''
        });

        try {
          const response = await fetch(imageTransport.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiConfig.imageApiKey.trim()}`,
              ...imageTransport.headers
            },
            body: JSON.stringify(buildImageRequestBody(imageModel, prompt, requestedSize)),
            signal: requestController.signal
          });

          const { remoteUrl, dataUrl } = await readImageResponse(response);
          // 到这里上游已经出图并计费，后续任何失败都必须让用户看见，不能静默 return。
          generationCompletedAt = Date.now();
          requestPhase = 'download';
          restartTimeoutForPhase('download', IMAGE_DOWNLOAD_TIMEOUT_MS);
          saveLastImageDiagnostic({
            actualFormat: dataUrl ? 'Base64' : 'URL',
            imageHost: dataUrl ? 'API 响应' : getDiagnosticImageHost(remoteUrl),
            storageStatus: '保存中'
          });

          let imageBlob;
          if (dataUrl) {
            imageBlob = dataUrlToBlob(dataUrl);
          } else {
            const downloadTransport = getImageDownloadTransport(remoteUrl);
            const imageResponse = await fetch(downloadTransport.url, {
              headers: downloadTransport.headers,
              signal: requestController.signal
            });
            if (!imageResponse.ok) throw new Error(`图片下载失败 HTTP ${imageResponse.status}`);
            imageBlob = await imageResponse.blob();
          }
          requestPhase = 'storage';
          // 无条件入库：即使用户已经切走，图片也要落盘，切回来能看到。
          await saveImageBlob(sessionId, cardTitle, imageBlob, mode, previousFocusY);
          saveLastImageDiagnostic({ storageBackend: 'IndexedDB', storageStatus: '成功', restoreStatus: '尚未验证', failureReason: '' });
          recordImageUsage({
            sessionId,
            cardTitle,
            mode,
            model: imageModel,
            size: isGptImage2Model(imageModel) ? requestedRatio : requestedSize,
            durationMs: Date.now() - startedAt,
            outcome: '成功',
            mayBeBilled: true,
            detail: dataUrl ? 'Base64 直接入库' : '经 URL 下载后入库'
          });

          const generationLabel = mode === 'full' ? 'AI 整图' : mode === 'visual-only' ? '无字主视觉' : '主视觉';
          if (sessionId !== (activeHistoryIdRef.current || 'current')) {
            setToast({ message: `[${cardTitle}] ${generationLabel}已生成并保存，返回该记录即可查看`, type: 'success', duration: 5000 });
            return;
          }
          const imageUrl = URL.createObjectURL(imageBlob);
          setImageResults(prev => {
            const previousUrl = prev[resultKey]?.imageUrl;
            if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl);
            const nextResults = { ...prev, [resultKey]: { status: 'success', imageUrl, error: '', mode, size: requestedSize, focusY: prev[resultKey]?.focusY } };
            imageObjectUrlsRef.current = Object.values(nextResults).map(item => item.imageUrl).filter(url => url?.startsWith('blob:'));
            return nextResults;
          });
          setToast({ message: `[${cardTitle}] ${generationLabel}生成完成`, type: 'success' });
        } catch (error) {
          const isUserCancelled = requestController.signal.aborted && !timedOutPhase;
          let failureError = error;
          if (timedOutPhase === 'request') {
            failureError = new Error(`图片生成超过 ${Math.round(IMAGE_REQUEST_TIMEOUT_MS / 1000)} 秒，已停止等待。上游可能已出图并计费，请先核对账单再重试。`);
          } else if (timedOutPhase === 'download') {
            failureError = new Error(`图片下载超过 ${Math.round(IMAGE_DOWNLOAD_TIMEOUT_MS / 1000)} 秒，已停止等待。本次生成已计费，请重试下载或换用返回 b64_json 的接口。`);
          } else if (isUserCancelled) {
            failureError = new Error('已取消生图。若上游已受理，本次仍可能计费。');
          }
          const mayBeBilled = Boolean(generationCompletedAt) || requestPhase !== 'request' || timedOutPhase === 'request' || isUserCancelled;
          recordImageUsage({
            sessionId,
            cardTitle,
            mode,
            model: imageModel,
            size: isGptImage2Model(imageModel) ? requestedRatio : requestedSize,
            durationMs: Date.now() - startedAt,
            outcome: isUserCancelled ? '已取消' : '失败',
            mayBeBilled,
            detail: failureError.message
          });
          saveLastImageDiagnostic({
            storageStatus: requestPhase === 'storage' ? '失败' : '未开始',
            failureReason: getDiagnosticFailureReason(failureError, requestPhase === 'request' ? 'request' : requestPhase)
          });
          if (sessionId === (activeHistoryIdRef.current || 'current')) {
            setImageResults(prev => ({ ...prev, [resultKey]: { status: 'error', imageUrl: '', error: failureError.message, mode } }));
          }
          setToast({
            message: `${cardTitle} 生图${isUserCancelled ? '已取消' : '失败'}：${failureError.message}`,
            type: isUserCancelled ? 'neutral' : 'error',
            duration: 8000
          });
        } finally {
          clearTimeout(phaseTimeout);
          if (imageAbortControllersRef.current.get(resultKey)?.controller === requestController) {
            imageAbortControllersRef.current.delete(resultKey);
          }
        }
      };

    const downloadImage = (cardTitle, imageUrl) => {
      const link = document.createElement('a');
      link.href = imageUrl;
        link.download = `${cardTitle.replace(/[^\w\u4e00-\u9fa5-]+/g, '-')}.png`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
      link.remove();
    };

    const createHtmlCardExportClone = (sourceNode) => {
      const exportRoot = document.createElement('div');
      Object.assign(exportRoot.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '1242px',
        height: '1656px',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: '-2147483647'
      });
      const exportNode = sourceNode.cloneNode(true);
      exportNode.classList.add('moreimg-export-render');
      exportNode.style.width = '1242px';
      exportNode.style.height = '1656px';
      exportNode.style.transform = 'none';
      exportNode.style.transformOrigin = 'top left';
      exportRoot.appendChild(exportNode);
      document.body.appendChild(exportRoot);
      return { exportRoot, exportNode };
    };

    const exportHtmlCard = async (card) => {
        if (htmlExportInFlightRef.current) return;
        const visualResult = imageResults[`visual-only:${card.imageKey}`];
        if (visualResult?.status !== 'success') {
          setToast({ message: '请先生成无字主视觉', type: 'error' });
          return;
        }
        const sourceNode = htmlCardRefs.current[card.id];
        if (!sourceNode) {
          const errorMessage = formatHtmlExportError(new Error('导出区域未就绪，请刷新页面后重试'), 'clone');
          setHtmlExportState({ cardId: card.id, status: 'error', error: errorMessage });
          setToast({ message: errorMessage, type: 'error', duration: 8000 });
          return;
        }
        htmlExportInFlightRef.current = true;
        setHtmlExportState({ cardId: card.id, status: 'pending', error: '' });
        let exportRoot = null;
        let exportPhase = 'loader';
        try {
          await loadHtml2Canvas();
          exportPhase = 'fonts';
          await loadExportFontStylesheet();
          if (document.fonts?.ready) await document.fonts.ready;
          exportPhase = 'clone';
          const exportClone = createHtmlCardExportClone(sourceNode);
          exportRoot = exportClone.exportRoot;
          const exportNode = exportClone.exportNode;
          exportPhase = 'render';
          const canvas = await window.html2canvas(exportNode, {
            width: 1242,
            height: 1656,
            scale: 1,
            backgroundColor: null,
            useCORS: true,
            allowTaint: false,
            logging: false
          });
          exportPhase = 'encode';
          const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
          if (!pngBlob) throw new Error('PNG 编码失败');
          const pngUrl = URL.createObjectURL(pngBlob);
          exportPhase = 'download';
          downloadImage(`${card.label}-HTML成品`, pngUrl);
          setTimeout(() => URL.revokeObjectURL(pngUrl), 60000);
          setHtmlExportState({ cardId: card.id, status: 'success', error: '' });
          setToast({ message: `[${card.label}] HTML 成品已导出`, type: 'success' });
        } catch (error) {
          const errorMessage = formatHtmlExportError(error, exportPhase);
          setHtmlExportState({ cardId: card.id, status: 'error', error: errorMessage });
          setToast({ message: errorMessage, type: 'error', duration: 8000 });
        } finally {
          htmlExportInFlightRef.current = false;
          exportRoot?.remove();
        }
      };

      const requestDeleteHistoryItem = (id) => {
        if (isProcessing || isDeletingHistory) return;
        setPendingDeleteHistoryId(id);
      };

      const cancelDeleteHistoryItem = () => {
        if (!isDeletingHistory) setPendingDeleteHistoryId(null);
      };

      const confirmDeleteHistoryItem = async () => {
        const id = pendingDeleteHistoryId;
        if (!id || isDeletingHistory) return;
        setIsDeletingHistory(true);
        historyLoadTokenRef.current += 1;
        abortSessionImageRequests(id);
        const previousHistory = history;
        const updatedHistory = history.filter(item => item.id !== id);
        try {
          localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(updatedHistory));
          // 先删图片、再删文章主记录；中途失败时仍能保留可恢复的文章。
          await deleteSessionImages(id);
          await deleteSessionRecord(id);
          setHistory(updatedHistory);
          if (activeHistoryId === id) {
            setActiveHistoryId(null);
            setShowResults(false);
            setIsComposerExpanded(false);
            setCurrentSession({ rawText: '', packageData: null, stages: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }, isHalted: false, stopReason: '', warning: '' });
            replaceImageResults({});
          }
          setToast({ message: '已删除该条记录', type: 'success' });
        } catch (error) {
          try { localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(previousHistory)); } catch {}
          setToast({ message: `历史记录删除失败: ${error.message}`, type: 'error', duration: 5000 });
        } finally {
          setIsDeletingHistory(false);
          setPendingDeleteHistoryId(null);
        }
      };

      // 手动载入示例记录：老用户 / 已删示例的人也能随时查看应用完整能力（含视觉生成与对比）
      const loadDemoRecord = async () => {
        if (isProcessing || demoLoadInFlightRef.current) return;
        demoLoadInFlightRef.current = true;
        historyLoadTokenRef.current += 1;
        try {
          const demoRecord = await loadDemoHistory();
          const demoIndex = toHistoryIndex(demoRecord);
          const updatedHistory = [demoIndex, ...history.filter(item => item.id !== demoIndex.id)].slice(0, HISTORY_LIMIT);
          const removedHistory = history.filter(historyItem => !updatedHistory.some(item => item.id === historyItem.id));
          setHistory(updatedHistory);
          localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(updatedHistory));
          removedHistory.forEach(item => {
            abortSessionImageRequests(item.id);
            deleteSessionRecord(item.id).catch(() => {});
            deleteSessionImages(item.id).catch(() => {});
          });
          setToast({ message: '示例记录已载入，点击即可查看完整流程', type: 'success' });
        } catch (error) {
          setToast({ message: `示例记录载入失败: ${error.message}`, type: 'error' });
        } finally {
          demoLoadInFlightRef.current = false;
        }
      };

      const requestProcessingText = (messages, externalSignal) => runWithRequestControl(async signal => {
        let fullResponseText = '';
        let finishReason = '';
        const endpoint = resolveApiEndpoint(apiConfig.apiUrl, 'text');
        const response = await fetchTextRequest(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey.trim()}`
          },
          body: JSON.stringify(buildProcessingRequestBody(endpoint, apiConfig.model.trim(), messages, PROCESSING_MAX_OUTPUT_TOKENS, false)),
          signal
        });

        if (!response.ok) {
          const responseText = await response.text();
          let errorMsg = response.statusText;
          try {
            const errorData = JSON.parse(responseText);
            if (errorData.error?.message) errorMsg = errorData.error.message;
            else if (errorData.message) errorMsg = errorData.message;
          } catch (e) {}
          throw new Error(`(HTTP ${response.status}) ${errorMsg}`);
        }

        const processingResponse = await readProcessingResponse(response);
        fullResponseText = processingResponse.text;
        finishReason = processingResponse.finishReason;

        if (!fullResponseText.trim()) throw new Error('大模型未返回任何有效内容，请检查接口配置或稍后重试。');
        return { text: fullResponseText, finishReason };
      }, {
        timeoutMs: TEXT_REQUEST_TIMEOUT_MS,
        signal: externalSignal,
        timeoutMessage: '内容生成超过 300 秒，已自动停止。请先测试接口，或换用响应更快的文本模型。'
      });

      const handleStopProcessing = () => {
        if (!processingAbortRef.current || processingAbortRef.current.signal.aborted) return;
        processingAbortRef.current.abort();
        setToast({ message: '正在停止本次加工...', type: 'neutral' });
      };

      const handleStartProcessing = async (overrideText = null) => {
        const textToProcess = (typeof overrideText === 'string' ? overrideText : inputText).trim();

        if (!apiConfig.apiUrl?.trim() || !apiConfig.model?.trim() || !apiConfig.apiKey?.trim()) {
          setToast({ message: '请先完成文本模型配置', type: 'error', duration: 5000 });
          setIsConfigOpen(true);
          return;
        }
        if (!textToProcess) { setToast({ message: '请输入需加工的文章或文案', type: 'error' }); return; }

        setInputText(textToProcess);
        historyLoadTokenRef.current += 1;
        // 在途生图不再随新加工取消：它会继续写入原会话，返回那条记录即可查看。
        if (hasInFlightImageRequests()) {
          setToast({ message: '仍有生图在后台进行，完成后会保存到原记录，不会因本次加工被取消。', type: 'neutral', duration: 5000 });
        }
        setIsProcessing(true);
        setShowResults(false);
        setProcessingUiPhase('waiting');
        setProcessingElapsedSeconds(0);
        setInternalStage(1);
        setActiveStageTab('step1');
        setCurrentSession({ rawText: '', packageData: null, stages: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }, isHalted: false, stopReason: '', warning: '' });
        replaceImageResults({});

        const newSessionId = Date.now().toString();
        const processingController = new AbortController();
        processingAbortRef.current = processingController;
        let shouldShowResults = false;

        try {
          const initialMessages = buildInitialProcessingMessages(textToProcess, DEFAULT_SYSTEM_PROMPT, apiConfig.processingPreferences);
          const processingResult = await requestProcessingText(initialMessages, processingController.signal);
          setProcessingUiPhase('validating');
          await new Promise(resolve => setTimeout(resolve, 0));
          const fullResponseText = processingResult.text;
          const normalizedFinishReason = String(processingResult.finishReason || '').trim().toLowerCase();
          if (['length', 'max_tokens', 'max_output_tokens'].includes(normalizedFinishReason)) {
            throw new Error(`输出达到 ${PROCESSING_MAX_OUTPUT_TOKENS} Token 上限，JSON 不完整`);
          }
          const assessment = parseMoreImgPackage(fullResponseText, textToProcess);
          const isHalted = !assessment.canContinue;
          const stopReason = assessment.isRejected ? assessment.reason || '文章暂不适合加工' : isHalted ? assessment.reason || 'JSON 物料包不完整' : '';
          const warning = assessment.warning || '';
          const sessionData = { rawText: fullResponseText, packageData: assessment.packageData, stages: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }, isHalted, stopReason, warning, finishReason: normalizedFinishReason };
          setCurrentSession(sessionData);
          setInternalStage(isHalted ? 1 : 5);

          const newHistoryItem = {
            id: newSessionId,
            title: textToProcess.substring(0, 20) + '...',
            date: new Date().toLocaleString(),
            sessionData,
            originalInput: textToProcess
          };
          try {
            await saveSessionRecord(newHistoryItem);
            let historyBeforeSave = history;
            try {
              const persistedHistory = JSON.parse(localStorage.getItem(HISTORY_INDEX_KEY) || '[]');
              if (Array.isArray(persistedHistory)) historyBeforeSave = persistedHistory;
            } catch {}
            const updatedHistory = [
              toHistoryIndex(newHistoryItem),
              ...historyBeforeSave.filter(item => item.id !== newSessionId)
            ].slice(0, HISTORY_LIMIT);
            setHistory(updatedHistory);
            localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(updatedHistory));
            historyBeforeSave.slice(HISTORY_LIMIT - 1).forEach(item => {
              deleteSessionRecord(item.id).catch(() => {});
              deleteSessionImages(item.id).catch(() => {});
            });
          } catch (storageError) {
            setToast({ message: `结果已生成，但历史记录保存失败: ${storageError.message}`, type: 'error', duration: 5000 });
          }
          setActiveHistoryId(newSessionId);

          setToast({
            message: assessment.isRejected ? '文章暂不适合加工，流程已停止' : isHalted ? `物料包不完整：${assessment.reason || 'JSON 字段缺失'}` : 'JSON 物料包生成完毕！',
            type: isHalted ? 'error' : 'success',
            duration: isHalted ? 6000 : 3000
          });
          shouldShowResults = true;
          setIsComposerExpanded(false);
        } catch (error) {
          const isCancelled = error.message === '已停止运算';
          const errorMessage = isCancelled ? '已停止本次运算' : formatProcessingError(error);
          if (!isCancelled) {
            setCurrentSession(prev => ({ ...prev, isHalted: true, stopReason: errorMessage, warning: '' }));
          }
          setToast({
            message: errorMessage,
            type: isCancelled ? 'neutral' : 'error',
            duration: isCancelled ? 3000 : 8000
          });
          shouldShowResults = !isCancelled;
        } finally {
          if (processingAbortRef.current === processingController) processingAbortRef.current = null;
          setIsProcessing(false);
          setProcessingUiPhase('idle');
          setShowResults(shouldShowResults);
        }
      };

      const loadHistoryItem = async (id) => {
        const requestToken = ++historyLoadTokenRef.current;
        // 切换记录不中止在途生图：结果会写回它自己的会话。
        let item = null;
        try {
          item = await loadSessionRecord(id);
        } catch (error) {
          if (requestToken === historyLoadTokenRef.current) setToast({ message: `历史记录读取失败: ${error.message}`, type: 'error' });
          return;
        }
        if (requestToken !== historyLoadTokenRef.current) return;
        if (item) {
          // 兼容旧版本：曾因卡片建议字数超限而暂停的完整 JSON，按当前规则重新评估。
          // 只有结构性错误仍会保持暂停，避免历史记录被旧规则永久锁死。
          const restoredSessionData = { ...item.sessionData };
          if (restoredSessionData.packageData?.status === 'complete') {
            const restoredAssessment = validateMoreImgPackage(restoredSessionData.packageData, item.originalInput || '');
            if (restoredAssessment.canContinue) {
              restoredSessionData.isHalted = false;
              restoredSessionData.stopReason = '';
              restoredSessionData.warning = restoredAssessment.warning || '';
            }
          }
          setActiveHistoryId(id);
          setIsComposerExpanded(false);
          setCurrentSession({ ...restoredSessionData, isDemo: Boolean(item.isDemo) });
          restoreSessionImages(id, requestToken);
          if (restoredSessionData.packageData?.status === 'complete') {
            setInternalStage(5);
            setShowResults(true);
            replaceImageResults({});
            setActiveStageTab('step3');
            return;
          }
          let highest = 1;
          for (let i = 6; i >= 1; i--) { if (restoredSessionData.stages[i]?.trim()) { highest = i; break; } }
          setInternalStage(highest);
          setShowResults(true);
          replaceImageResults({});
          if (highest >= 5) setActiveStageTab('step3');
          else if (highest >= 3) setActiveStageTab('step2');
          else setActiveStageTab('step1');
        } else {
          setToast({ message: '该历史记录不存在或已被清理', type: 'error' });
        }
      };

      const retryHistoryItem = async (id) => {
        const item = await loadSessionRecord(id);
        if (item?.isDemo) {
          setToast({ message: '示例记录仅用于查看应用能力，不会调用真实接口。粘贴原文后点击「开始加工」即可体验完整流程。', type: 'success', duration: 5000 });
          return;
        }
        if (!item?.originalInput) {
          setToast({ message: '该记录缺少原文备份，无法重试', type: 'error' });
          return;
        }
        setToast({ message: '将基于原文新建记录，原记录会保留', type: 'neutral', duration: 3500 });
        handleStartProcessing(item.originalInput);
      };

      const fallbackCopyText = (text) => {
        const copyTarget = document.createElement('textarea');
        copyTarget.value = text;
        copyTarget.setAttribute('readonly', '');
        copyTarget.style.position = 'fixed';
        copyTarget.style.opacity = '0';
        document.body.appendChild(copyTarget);
        copyTarget.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(copyTarget);
        return copied;
      };

      const copyToClipboard = async (text, label) => {
        if (!text) {
          setToast({ message: `${label} 暂无可复制内容`, type: 'error' });
          return;
        }
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
          await navigator.clipboard.writeText(text);
          setToast({ message: `${label} 已复制到剪贴板`, type: 'success' });
        } catch (error) {
          try {
            if (!fallbackCopyText(text)) throw new Error('Fallback copy failed');
            setToast({ message: `${label} 已复制到剪贴板`, type: 'success' });
          } catch (fallbackError) {
            setToast({ message: `${label} 复制失败，请手动复制`, type: 'error' });
          }
        }
      };

      const copyImageUsageLog = () => copyToClipboard(formatImageUsageLogText(imageUsageLog), '生图请求记录');

      const handleClearImageUsageLog = () => {
        setImageUsageLog(clearImageUsageLog());
        setToast({ message: '生图请求记录已清空', type: 'neutral' });
      };

      const resultContent = useResultContent({
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
      });

      const hasTextConfig = Boolean(apiConfig.apiUrl?.trim() && apiConfig.model?.trim() && apiConfig.apiKey?.trim());
      const processingActionMode = isProcessing
        ? 'running'
        : !inputText.trim()
          ? 'empty'
          : !hasTextConfig
            ? 'needs-config'
            : 'ready';
      const processingActionLabel = processingActionMode === 'running'
        ? '停止本次加工'
        : processingActionMode === 'needs-config'
          ? '配置文本模型后开始'
          : '一键生成 AI 物料包';
      const processingActionHint = processingActionMode === 'needs-config'
        ? '还需填写文本接口地址、模型和 API Key。'
        : '';
      const handleProcessingAction = () => {
        if (isProcessing) {
          handleStopProcessing();
          return;
        }
        if (!inputText.trim()) return;
        if (!hasTextConfig) {
          setIsConfigOpen(true);
          setToast({ message: '完成文本模型配置后即可开始加工', type: 'error', duration: 5000 });
          return;
        }
        handleStartProcessing();
      };
      const pendingDeleteHistoryItem = history.find(item => item.id === pendingDeleteHistoryId) || null;

      return <AppView {...{
        activeHistoryId,
        activeStageTab,
        apiConfig,
        cancelDeleteHistoryItem,
        configTools,
        confirmDeleteHistoryItem,
        copyImageUsageLog,
        currentSession,
        handleClearImageUsageLog,
        handleLoadModels,
        handleModelSelection,
        handleProcessingAction,
        handleSaveConfig,
        handleTestTextConnection,
        history,
        imageModels,
        imageUsageLog,
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
        onRequestCloseConfig: closeConfigDialog,
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
      }} />;
    }
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);

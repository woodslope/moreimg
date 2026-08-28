    const NEW_STAGES = [
      { id: 'step1', name: '理解与核查', icon: 'ListChecks', subStages: [1, 2] },
      { id: 'step2', name: '文章与卡片', icon: 'Cpu', subStages: [3, 4] },
      { id: 'step3', name: '视觉生成与对比', icon: 'Image', subStages: [5] }
    ];

    const parseStreamedText = (fullText) => {
      const stages = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' };

      // 核心修复：宽容度极高的正则，捕捉 [阶段1]、### 阶段1、**阶段1**、阶段1： 等各种变体，只要位于行首即可
      const stageRegex = /(?:^|\n)[ \t#*\[【]*阶段[ \t]*([1-6])[ \t]*[\]】#*]*[ \t]*[：:]?[ \t]*/g;
      let match;
      let lastIndex = 0;
      let currentStage = null;

      while ((match = stageRegex.exec(fullText)) !== null) {
        if (currentStage !== null) {
          stages[currentStage] = fullText.substring(lastIndex, match.index).trim();
        }
        currentStage = parseInt(match[1]);
        lastIndex = match.index + match[0].length;
      }

      if (currentStage !== null) {
        stages[currentStage] = fullText.substring(lastIndex).trim();
      } else if (fullText.trim()) {
        // 兜底机制：如果没有任何标准格式输出，强制渲染在阶段1中
        stages[1] = fullText.trim();
      }
      return { stages, latestStage: currentStage || 1 };
    };

    const PROCESSING_MAX_OUTPUT_TOKENS = 12000;
    const TEXT_REQUEST_TIMEOUT_MS = 300000;
    const TEXT_TEST_TIMEOUT_MS = 30000;
    // 生图和下载分别计时：旧实现用一个 300 秒预算覆盖“生成 + 下载 + 入库”，
    // 生成用掉 280 秒后下载再被掐断，上游其实已经出图并计费。
    // 这两个值必须小于 server.py 的 PROXY_TIMEOUT_SECONDS，否则代理先断、前端拿不到真实状态码。
    const IMAGE_REQUEST_TIMEOUT_MS = 600000;
    const IMAGE_DOWNLOAD_TIMEOUT_MS = 120000;

    const runWithRequestControl = (task, options = {}) => {
      const {
        timeoutMs = TEXT_REQUEST_TIMEOUT_MS,
        signal: externalSignal,
        timeoutMessage = `接口请求超过 ${Math.round(timeoutMs / 1000)} 秒，请检查接口或稍后重试。`
      } = options;
      const controller = new AbortController();

      return new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId;
        let externalAbortHandler;

        const finish = (handler, value) => {
          if (settled) return;
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          if (externalSignal && externalAbortHandler) externalSignal.removeEventListener('abort', externalAbortHandler);
          handler(value);
        };

        const abortRequest = (message) => {
          if (!controller.signal.aborted) controller.abort();
          finish(reject, new Error(message));
        };

        timeoutId = setTimeout(() => abortRequest(timeoutMessage), timeoutMs);
        externalAbortHandler = () => abortRequest('已停止运算');
        if (externalSignal) {
          if (externalSignal.aborted) externalAbortHandler();
          else externalSignal.addEventListener('abort', externalAbortHandler, { once: true });
        }

        Promise.resolve()
          .then(() => task(controller.signal))
          .then(value => finish(resolve, value))
          .catch(error => {
            if (externalSignal?.aborted) finish(reject, new Error('已停止运算'));
            else finish(reject, error);
          });
      });
    };

    const parsePromptSections = (content = '') => {
      const source = String(content || '');
      const headingSections = [];
      const headingRegex = /###\s*\[?((?:封面|正文\d+\/\d+|封底))\]?\s*([\s\S]*?)(?=###|$)/g;
      let match;
      while ((match = headingRegex.exec(source)) !== null) {
        headingSections.push({ title: match[1].trim(), text: match[2].trim() });
      }

      const parseBracketSections = (value) => {
        const items = [];
        const bracketRegex = /\[((?:封面|正文\d+\/\d+|封底))\]\s*([\s\S]*?)(?=\[(?:封面|正文\d+\/\d+|封底)\]|$)/g;
        while ((match = bracketRegex.exec(value)) !== null) {
          items.push({ title: match[1].trim(), text: match[2].trim() });
        }
        return items;
      };
      const codeBlockSources = [...source.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(block => block[1]);
      const bracketCandidates = [...codeBlockSources.map(parseBracketSections), parseBracketSections(source)];

      const plainHeaderRegex = /(?:^|\n)\s*(?:#{1,6}\s*)?(封面|正文\d+\/\d+|封底)(?:提示词)?\s*[：:]?\s*(?=\n|$)/g;
      const headers = [...source.matchAll(plainHeaderRegex)];
      const plainSections = headers.map((header, index) => {
        const blockStart = header.index + header[0].length;
        const blockEnd = headers[index + 1]?.index ?? source.length;
        return { title: header[1].trim(), text: source.slice(blockStart, blockEnd).trim() };
      });

      const dedupeSections = (items) => {
        const seen = new Set();
        return items.filter(section => {
          if (!section.title || !section.text || seen.has(section.title)) return false;
          seen.add(section.title);
          return true;
        });
      };

      return [headingSections, ...bracketCandidates, plainSections]
        .map(dedupeSections)
        .sort((left, right) => right.length - left.length)[0] || [];
    };

    const assessAnalysisDepth = (parsed, originalText = '') => {
      const inputLength = String(originalText || '').replace(/\s+/g, '').length;
      if (!inputLength) return { isAdequate: true, requiredStage3Length: 0 };
      const stageLengths = [1, 2, 3].map(stage => String(parsed.stages[stage] || '').replace(/\s+/g, '').length);
      const isCompactSource = inputLength < 600;
      const requiredStage3Length = isCompactSource
        ? Math.max(60, Math.floor(inputLength * 0.45))
        : Math.min(1200, Math.max(360, Math.floor(inputLength * 0.5)));
      const requiredStage1Length = isCompactSource ? 40 : 60;
      const requiredStage2Length = isCompactSource ? 60 : 180;
      return {
        isAdequate: stageLengths[0] >= requiredStage1Length && stageLengths[1] >= requiredStage2Length && stageLengths[2] >= requiredStage3Length,
        requiredStage3Length,
        stageLengths
      };
    };

    const assessProcessingResult = (fullText, originalText = '') => {
      const text = String(fullText || '').trim();
      const parsed = parseStreamedText(text);
      const isRejected = parsed.latestStage === 1 && /(不适合|不通过|不足以|建议提供|暂不适合)/.test(parsed.stages[1] || '');
      const hasStage4 = Boolean(parsed.stages[4]?.trim());
      const hasStage5 = Boolean(parsed.stages[5]?.trim());
      const parsedCards = parseCardPackage(parsed.stages[4]);
      const parsedPrompts = parsePromptSections(parsed.stages[5]);
      const cardTypes = new Set(parsedCards.map(card => card.type));
      const cardPageKeys = parsedCards.map(card => card.imageKey);
      const promptHeadingKeys = [...String(parsed.stages[5] || '').matchAll(/(?:^|\n)\s*#{1,6}\s*\[?((?:封面|正文\d+\/\d+|封底))\]?\s*(?=\n|$)/g)]
        .map(match => match[1]);
      const promptPageKeys = promptHeadingKeys.length > 0
        ? promptHeadingKeys
        : parsedPrompts.map(section => section.title);
      const promptTitles = new Set(promptPageKeys);
      const hasUsableCards = cardTypes.has('cover') && cardTypes.has('body') && cardTypes.has('back');
      const hasUsablePrompts = promptTitles.has('封面') && [...promptTitles].some(title => /^正文\d+\/\d+$/.test(title)) && promptTitles.has('封底');
      const isValidPageSequence = (pageKeys) => {
        if (pageKeys.length < 3 || pageKeys[0] !== '封面' || pageKeys.at(-1) !== '封底') return false;
        if (new Set(pageKeys).size !== pageKeys.length) return false;
        const bodyKeys = pageKeys.slice(1, -1);
        return bodyKeys.length > 0 && bodyKeys.every((pageKey, index) => {
          const match = pageKey.match(/^正文(\d+)\/(\d+)$/);
          return Boolean(match) && Number(match[1]) === index + 1 && Number(match[2]) === bodyKeys.length;
        });
      };
      const hasExactPageMapping = isValidPageSequence(cardPageKeys)
        && isValidPageSequence(promptPageKeys)
        && cardPageKeys.length === promptPageKeys.length
        && cardPageKeys.every((pageKey, index) => pageKey === promptPageKeys[index]);
      const hasFormatError = text.includes('接口返回格式异常');
      const analysisDepth = assessAnalysisDepth(parsed, originalText);
      const isComplete = hasUsableCards && hasUsablePrompts && hasExactPageMapping && analysisDepth.isAdequate && !hasFormatError;
      const canContinue = hasStage4 && hasStage5 && hasUsableCards && hasUsablePrompts && hasExactPageMapping && !hasFormatError;
      const warning = canContinue && !analysisDepth.isAdequate
        ? '阶段1至3内容仍过于简略，已保留卡片和提示词，建议换用指令遵循能力更强的文本模型重试。'
        : canContinue && !isComplete ? '内容已生成，但部分卡片或提示词格式不标准，请在生图前检查。' : '';
      return {
        parsed,
        analysisDepth,
        isComplete,
        canContinue,
        warning,
        isRejected,
        reason: hasFormatError ? '接口返回格式异常' : !hasStage4 ? '尚未生成阶段4卡片内容' : !hasStage5 ? '尚未生成阶段5提示词内容' : !hasUsableCards ? '阶段4卡片格式不完整' : !hasUsablePrompts ? '阶段5提示词格式不完整' : !hasExactPageMapping ? '卡片与提示词未一一对应' : !analysisDepth.isAdequate ? '阶段1至3内容过于简略' : ''
      };
    };

    const applyProcessingFinishReason = (assessment, finishReason = '') => {
      const normalizedFinishReason = String(finishReason || '').trim().toLowerCase();
      const isTruncated = ['length', 'max_tokens', 'max_output_tokens'].includes(normalizedFinishReason);
      if (!isTruncated || assessment.isRejected) return { ...assessment, finishReason: normalizedFinishReason };
      return {
        ...assessment,
        isComplete: false,
        canContinue: false,
        warning: '',
        reason: `输出达到 ${PROCESSING_MAX_OUTPUT_TOKENS} Token 上限`,
        finishReason: normalizedFinishReason
      };
    };

    const formatProcessingError = (error) => {
      const message = String(error?.message || error || '未知错误').trim();
      if (/\bHTTP 524\b/.test(message)) {
        return '上游模型服务响应超时（HTTP 524），请稍后重试或换用响应更快的文本模型。';
      }
      // 502/504 来自本机代理，说明请求已经离开浏览器：中转站后台可能已经收到并计费，
      // 只是响应没能回到页面。提示必须让用户知道该去对账，而不是无脑重试。
      if (/\bHTTP 504\b/.test(message)) {
        return `本机代理等待上游响应超时（HTTP 504）。中转站后台可能已受理本次请求，请先核对用量再重试。${message.replace(/^\(HTTP 504\)\s*/, '详情：')}`;
      }
      if (/\bHTTP 502\b/.test(message)) {
        return `本机代理无法与上游完成通信（HTTP 502）。若中转站后台已有提交记录，说明响应在回传途中中断，请先核对用量再重试。${message.replace(/^\(HTTP 502\)\s*/, '详情：')}`;
      }
      return `引擎连接失败：${message}`;
    };

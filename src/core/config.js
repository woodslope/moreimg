    const DEFAULT_PROMPT_VERSION = 9;

    const normalizeSystemPrompt = (prompt = '') => String(prompt).replace(/\s+/g, ' ').trim();

    const isLegacyDefaultPrompt = (prompt, currentDefaultPrompt = DEFAULT_SYSTEM_PROMPT) => {
      const normalized = normalizeSystemPrompt(prompt);
      if (!normalized || normalized === normalizeSystemPrompt(currentDefaultPrompt)) return false;
      const hasDefaultStructure = normalized.includes('阶段1：原料接收与判型')
        && normalized.includes('阶段6：交付后质量自检')
        && normalized.includes('激活指令：');
      const knownDefaultFamily = normalized.includes('核心工作流')
        || (normalized.includes('交付总原则')
          && normalized.includes('每张卡只输出一次提示词')
          && normalized.includes('不要再输出总览副本'));
      const previousDefaultMarkers = [
        '篇幅是否足以支撑' + '至少3张正文卡片',
        '阶段3必须输出可独立发布的' + '完整文章',
        '核心比喻（用' + '“A = B”概括）',
        '核心主体必须占整个画面' + '的45%-65%'
      ];
      return hasDefaultStructure && knownDefaultFamily && previousDefaultMarkers.some(marker => normalized.includes(marker))
        || hasDefaultStructure && knownDefaultFamily;
    };

    const shouldOfferDefaultPromptUpgrade = (config = {}) => (
      Number(config.promptVersion || 0) < DEFAULT_PROMPT_VERSION
      && isLegacyDefaultPrompt(config.systemPrompt)
    );

    const hasSavedApiConfig = () => {
      try {
        const savedConfig = localStorage.getItem('agent_api_config');
        if (!savedConfig) return false;
        const parsedConfig = JSON.parse(savedConfig);
        return Boolean(parsedConfig.apiKey);
      } catch {
        return false;
      }
    };

    let html2CanvasLoader = null;
    let exportFontStylesheetLoader = null;

    const loadExportFontStylesheet = () => {
      if (exportFontStylesheetLoader) return exportFontStylesheetLoader;

      exportFontStylesheetLoader = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'fonts/noto-sans-sc.css';
        link.dataset.moreimgExportFonts = 'true';
        link.onload = () => resolve(link);
        link.onerror = () => reject(new Error('导出字体样式加载失败'));
        document.head.appendChild(link);
      }).catch(error => {
        document.querySelector('link[data-moreimg-export-fonts="true"]')?.remove();
        exportFontStylesheetLoader = null;
        throw error;
      });
      return exportFontStylesheetLoader;
    };

    const loadHtml2Canvas = () => {
      if (window.html2canvas) return Promise.resolve(window.html2canvas);
      if (html2CanvasLoader) return html2CanvasLoader;

      html2CanvasLoader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/html2canvas.js';
        script.onload = () => window.html2canvas
          ? resolve(window.html2canvas)
          : reject(new Error('导出组件加载失败'));
        script.onerror = () => reject(new Error('导出组件加载失败'));
        document.head.appendChild(script);
      }).catch(error => {
        html2CanvasLoader = null;
        throw error;
      });
      return html2CanvasLoader;
    };

    const HTML_EXPORT_PHASE_LABELS = Object.freeze({
      loader: '加载导出组件',
      fonts: '等待导出字体',
      clone: '准备卡片',
      render: '渲染卡片',
      encode: '编码 PNG',
      download: '触发下载'
    });

    const formatHtmlExportError = (error, phase) => {
      const phaseLabel = HTML_EXPORT_PHASE_LABELS[phase] || '处理导出';
      return `导出失败（${phaseLabel}）：${error?.message || '未知错误'}`;
    };

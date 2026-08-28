    const IMAGE_SIZE_PATTERN = /^\d{3,5}x\d{3,5}$/;
    const IMAGE_RATIO_PATTERN = /^\d{1,3}\s*:\s*\d{1,3}$/;
    const IMAGE_RATIO_SIZES = Object.freeze({
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:3': '1024x768',
      '3:4': '768x1024',
      '3:2': '1536x1024',
      '2:3': '1024x1536',
      '21:9': '1344x576'
    });
    const DEFAULT_IMAGE_RATIO = '3:4';
    const IMAGE_RATIO_CONFIG_VERSION = 1;
    const DEFAULT_IMAGE_SIZE = IMAGE_RATIO_SIZES[DEFAULT_IMAGE_RATIO];
    const GPT_IMAGE_2_RATIOS = Object.freeze(Object.keys(IMAGE_RATIO_SIZES));

    const isGptImageModel = (model = '') => /^gpt-image/i.test(String(model || '').trim());
    const isGptImage2Model = (model = '') => /^gpt-image-2(?:-|$)/i.test(String(model || '').trim());

    const normalizeRatioText = value => String(value || '').trim().replace(/：/g, ':').replace(/\s+/g, '').toLowerCase();

    const imageSizeToRatio = size => {
      const value = String(size || '').trim().toLowerCase();
      const directRatio = Object.entries(IMAGE_RATIO_SIZES).find(([, imageSize]) => imageSize === value)?.[0];
      if (directRatio) return directRatio;
      const match = value.match(/^(\d{3,5})x(\d{3,5})$/);
      if (!match) return '';
      const width = Number(match[1]);
      const height = Number(match[2]);
      const gcd = (a, b) => b ? gcd(b, a % b) : a;
      const ratio = `${width / gcd(width, height)}:${height / gcd(width, height)}`;
      return IMAGE_RATIO_SIZES[ratio] ? ratio : '';
    };

    const normalizeImageRatio = (ratio, fallback = DEFAULT_IMAGE_RATIO) => {
      const value = normalizeRatioText(ratio);
      if (IMAGE_RATIO_SIZES[value]) return value;
      return imageSizeToRatio(value) || fallback;
    };

    const ratioToImageSize = (ratio, model = '') => {
      const normalizedRatio = normalizeImageRatio(ratio, '');
      const candidate = IMAGE_RATIO_SIZES[normalizedRatio] || '';
      return candidate;
    };

    const normalizeImageSize = (size, model = '') => {
      const rawValue = String(size || '').trim().toLowerCase();
      if (isGptImage2Model(model)) return normalizeImageRatio(rawValue);
      const ratioSize = ratioToImageSize(rawValue, model);
      const value = ratioSize || rawValue;
      return IMAGE_SIZE_PATTERN.test(value) ? value : DEFAULT_IMAGE_SIZE;
    };

    const getImageSizeWarning = (size, model = '') => {
      const value = normalizeRatioText(size);
      if (!value) return '';
      if (isGptImage2Model(model)) {
        const normalizedRatio = IMAGE_RATIO_SIZES[value] ? value : imageSizeToRatio(value);
        return GPT_IMAGE_2_RATIOS.includes(normalizedRatio)
          ? ''
          : `比例格式应为“宽:高”，例如 ${DEFAULT_IMAGE_RATIO}；当前只支持 ${GPT_IMAGE_2_RATIOS.join(' / ')}。`;
      }
      const ratioSize = IMAGE_RATIO_SIZES[value];
      if (ratioSize) {
        return '';
      }
      if (IMAGE_RATIO_PATTERN.test(value)) {
        return `比例暂不支持“${value}”，当前只支持 ${Object.keys(IMAGE_RATIO_SIZES).join(' / ')}。`;
      }
      if (!IMAGE_SIZE_PATTERN.test(value) && !IMAGE_RATIO_PATTERN.test(value)) {
        return `比例格式应为“宽:高”，例如 ${DEFAULT_IMAGE_RATIO}；当前只支持 ${Object.keys(IMAGE_RATIO_SIZES).join(' / ')}。`;
      }
      return '';
    };

    // AIXoras 的 gpt-image-2 系列通过 CLIProxyAPI 转发，使用 aspect_ratio 控制比例，
    // 输出像素由上游决定；其他 OpenAI Images 兼容模型仍使用 size 像素参数。
    const buildImageRequestBody = (model, prompt, size) => isGptImage2Model(model)
      ? {
          model,
          prompt,
          n: 1,
          aspect_ratio: normalizeImageRatio(size),
          quality: 'standard',
          response_format: 'url',
          watermark: false
        }
      : {
          model,
          prompt,
          size: normalizeImageSize(size, model),
          n: 1,
          ...(isGptImageModel(model) ? {} : { response_format: 'b64_json' })
        };

    // 中转站在 5xx / 网关超时时返回的是 HTML 错误页，裸 response.json() 会抛
    // "Unexpected token '<'"，把真实状态码和上游提示全部吞掉。
    const readImageResponse = async (response) => {
      const rawText = await response.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch {}
      if (!response.ok) {
        const upstreamMessage = data?.error?.message || data?.message || '';
        const preview = upstreamMessage || rawText.replace(/\s+/g, ' ').trim().slice(0, 200);
        throw new Error(`HTTP ${response.status}${preview ? `：${preview}` : ''}`);
      }
      if (!data) {
        throw new Error(`接口返回了非 JSON 内容：${rawText.replace(/\s+/g, ' ').trim().slice(0, 200) || '空响应'}`);
      }
      const firstImage = data?.data?.[0];
      const remoteUrl = firstImage?.url || '';
      const base64 = firstImage?.b64_json || '';
      if (!remoteUrl && !base64) throw new Error('接口未返回 url 或 b64_json 图片数据');
      return { remoteUrl, dataUrl: base64 ? `data:image/png;base64,${base64}` : '' };
    };

    const isResponsesApiEndpoint = (apiUrl = '') => /\/responses(?:[/?#]|$)/i.test(String(apiUrl).trim());

    const resolveApiEndpoint = (apiUrl = '', kind = 'text') => {
      const rawUrl = String(apiUrl || '').trim();
      if (!rawUrl) return '';
      try {
        const url = new URL(rawUrl);
        const pathname = url.pathname.replace(/\/+$/, '');
        const isCompleteTextEndpoint = /\/(?:chat\/completions|responses)$/i.test(pathname);
        const isCompleteImageEndpoint = /\/images\/generations$/i.test(pathname);
        if ((kind === 'text' && isCompleteTextEndpoint) || (kind === 'image' && isCompleteImageEndpoint)) return rawUrl;
        if (/\/v\d+(?:\.\d+)?$/i.test(pathname)) {
          url.pathname = `${pathname}${kind === 'image' ? '/images/generations' : '/chat/completions'}`;
          return url.toString();
        }
      } catch {
        return rawUrl;
      }
      return rawUrl;
    };

    const getRequestTransport = (endpoint, kind, pageLocation = window.location) => {
      const isLocalService = pageLocation?.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(pageLocation?.hostname);
      try {
        const endpointUrl = new URL(endpoint, pageLocation.origin);
        const isLoopbackEndpoint = ['127.0.0.1', 'localhost'].includes(endpointUrl.hostname);
        if (!isLocalService && isLoopbackEndpoint) return { url: endpoint, headers: {}, blockedLocalService: true };
      } catch {}
      if (!isLocalService) return { url: endpoint, headers: {} };
      try {
        const target = new URL(endpoint, pageLocation.origin);
        if (target.origin === pageLocation.origin) return { url: endpoint, headers: {} };
        return {
          url: `/proxy/${kind === 'image' ? 'image' : 'text'}`,
          headers: { 'X-MoreImg-Upstream': target.toString() }
        };
      } catch {
        return { url: endpoint, headers: {} };
      }
    };

    const fetchTextRequest = async (endpoint, options = {}, pageLocation = window.location, fetchImpl = fetch) => {
      const transport = getRequestTransport(endpoint, 'text', pageLocation);
      if (transport.blockedLocalService) {
        throw new Error('当前是线上页面，不能使用本机代理地址。请在设置中改为可跨域访问的 HTTPS 接口。');
      }

      const send = (url, extraHeaders = {}) => fetchImpl(url, {
        ...options,
        headers: { ...(options.headers || {}), ...extraHeaders }
      });

      return send(transport.url, transport.headers);
    };

    // 图片 CDN 通常不带 CORS 头，浏览器直连会在“已计费”之后失败。
    // 本地服务模式下改走同源代理下载；纯静态部署时只能直连，失败即回退到人工另存。
    const getImageDownloadTransport = (imageUrl, pageLocation = window.location) => {
      const isLocalService = pageLocation?.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(pageLocation?.hostname);
      if (!isLocalService) return { url: imageUrl, headers: {} };
      try {
        const target = new URL(imageUrl, pageLocation.origin);
        if (target.origin === pageLocation.origin) return { url: imageUrl, headers: {} };
        if (!/^https?:$/.test(target.protocol)) return { url: imageUrl, headers: {} };
        return { url: '/proxy/image-asset', headers: { 'X-MoreImg-Upstream': target.toString() } };
      } catch {
        return { url: imageUrl, headers: {} };
      }
    };

    const deriveModelsEndpoint = (apiUrl = '') => {
      const normalizedUrl = String(apiUrl || '').trim();
      if (!normalizedUrl) return '';
      const url = new URL(normalizedUrl);
      const suffixes = ['/chat/completions', '/images/generations', '/responses'];
      const matchingSuffix = suffixes.find(suffix => url.pathname.replace(/\/$/, '').endsWith(suffix));
      if (matchingSuffix) {
        url.pathname = `${url.pathname.replace(/\/$/, '').slice(0, -matchingSuffix.length)}/models`;
      } else {
        url.pathname = `${url.pathname.replace(/\/$/, '')}/models`;
      }
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    };

    const extractModelIds = (data = {}) => {
      const rawModels = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
      return [...new Set(rawModels
        .map(item => typeof item === 'string' ? item : item?.id || item?.name || '')
        .map(item => String(item).trim())
        .filter(Boolean))];
    };

    const buildProcessingRequestBody = (apiUrl, model, messages, maxOutputTokens = PROCESSING_MAX_OUTPUT_TOKENS, stream = true) => {
      if (isResponsesApiEndpoint(apiUrl)) {
        const instructions = messages
          .filter(message => message.role === 'system')
          .map(message => String(message.content || '').trim())
          .filter(Boolean)
          .join('\n\n');
        const input = messages
          .filter(message => message.role !== 'system')
          .map(message => ({ role: message.role, content: String(message.content || '') }));
        return {
          model,
          ...(instructions ? { instructions } : {}),
          input,
          stream,
          max_output_tokens: maxOutputTokens
        };
      }

      const requestBody = { model, messages, stream, temperature: 0.7 };
      const usesCompletionTokenLimit = /^(?:gpt-5|o\d)/i.test(String(model || '').trim());
      if (usesCompletionTokenLimit) requestBody.max_completion_tokens = maxOutputTokens;
      else requestBody.max_tokens = maxOutputTokens;
      return requestBody;
    };

    const extractProcessingResponseText = (data = {}) => {
      if (typeof data.output_text === 'string') return data.output_text;
      if (typeof data.response?.output_text === 'string') return data.response.output_text;

      const choiceContent = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.delta?.content;
      if (typeof choiceContent === 'string') return choiceContent;
      if (Array.isArray(choiceContent)) {
        return choiceContent.map(item => item?.text?.value || item?.text || '').join('');
      }

      const output = data.output || data.response?.output || [];
      return output.flatMap(item => item?.content || [])
        .map(content => content?.text?.value || content?.text || '')
        .filter(Boolean)
        .join('');
    };

    const extractProcessingFinishReason = (data = {}) => {
      const chatReason = data.choices?.[0]?.finish_reason;
      if (chatReason) return chatReason;
      const responseData = data.response || data;
      if (responseData.incomplete_details?.reason) return responseData.incomplete_details.reason;
      if (responseData.status === 'incomplete') return 'max_output_tokens';
      return '';
    };

    const extractProcessingStreamDelta = (data = {}) => {
      const chatDelta = data.choices?.[0]?.delta?.content;
      if (typeof chatDelta === 'string') return chatDelta;
      if (data.type === 'response.output_text.delta' && typeof data.delta === 'string') return data.delta;
      return '';
    };

    const readProcessingResponse = async (response) => {
      const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
      if (!contentType.includes('text/event-stream')) {
        const responseText = await response.text();
        try {
          const data = JSON.parse(responseText);
          return {
            text: extractProcessingResponseText(data),
            finishReason: extractProcessingFinishReason(data)
          };
        } catch {
          return { text: responseText, finishReason: '' };
        }
      }

      if (!response.body || typeof response.body.getReader !== 'function') {
        throw new Error('接口返回了不可读取的流，请检查接口或更换文本模型。');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let streamBuffer = '';
      let fullResponseText = '';
      let finishReason = '';
      let streamCompleted = false;

      const consumeLine = (rawLine) => {
        const line = String(rawLine || '').trim();
        if (!line.startsWith('data:')) return;
        const payload = line.slice(5).trim();
        if (!payload) return;
        if (payload === '[DONE]') {
          streamCompleted = true;
          return;
        }
        try {
          const data = JSON.parse(payload);
          fullResponseText += extractProcessingStreamDelta(data);
          const eventFinishReason = extractProcessingFinishReason(data);
          finishReason = eventFinishReason || finishReason;
          if (eventFinishReason || ['response.completed', 'response.incomplete', 'response.failed'].includes(data.type)) {
            streamCompleted = true;
          }
        } catch {}
      };

      while (true) {
        const { done, value } = await reader.read();
        streamBuffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = streamBuffer.split(/\r?\n/);
        streamBuffer = lines.pop() || '';
        lines.forEach(consumeLine);
        if (done) break;
      }
      consumeLine(streamBuffer);

      if (!streamCompleted) {
        throw new Error('流式响应提前结束，未收到完成标记，请稍后重试或检查上游服务。');
      }
      if (!fullResponseText.trim()) {
        throw new Error('大模型未返回任何有效内容，请检查接口配置或稍后重试。');
      }
      return { text: fullResponseText, finishReason };
    };

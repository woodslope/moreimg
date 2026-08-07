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

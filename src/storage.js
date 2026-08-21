    const IMAGE_DB_NAME = 'moreimg_images';
    const IMAGE_STORE_NAME = 'generated_images';
    const SESSION_STORE_NAME = 'sessions';
    const MOREIMG_IMAGE_DIAGNOSTIC_KEY = 'moreimg_last_image_diagnostic';
    const HISTORY_INDEX_KEY = 'moreimg_history_index';
    const LEGACY_HISTORY_KEY = 'agent_history';
    const HISTORY_LIMIT = 50;

    const loadLastImageDiagnostic = () => {
      try {
        const value = JSON.parse(localStorage.getItem(MOREIMG_IMAGE_DIAGNOSTIC_KEY) || 'null');
        return value && typeof value === 'object' ? value : null;
      } catch {
        return null;
      }
    };

    const getDiagnosticEndpointPath = (value) => {
      try {
        return new URL(value).pathname || '/';
      } catch {
        return value ? '自定义接口' : '未记录';
      }
    };

    const getDiagnosticImageHost = (value) => {
      try {
        return new URL(value).host || 'API 响应';
      } catch {
        return 'API 响应';
      }
    };

    const getDiagnosticFailureReason = (error, phase = 'request') => {
      const message = String(error?.message || '').toLowerCase();
      if (phase === 'restore') return 'IndexedDB 图片记录读取失败';
      if (/未返回 url|未返回可识别|未返回图片/.test(message)) return 'API 未返回可识别的图片数据';
      if (/fetch|network|cors|图片下载|failed to fetch/.test(message)) return '图片 URL 无法读取（CORS、网络或链接失效）';
      if (phase === 'storage') return 'IndexedDB 图片写入失败';
      return '生图请求失败';
    };

    const openImageDatabase = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(IMAGE_DB_NAME, 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          const store = database.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
        }
        if (!database.objectStoreNames.contains(SESSION_STORE_NAME)) {
          database.createObjectStore(SESSION_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const saveImageBlob = async (sessionId, cardTitle, blob, mode = 'visual', focusY) => {
      const database = await openImageDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readwrite');
        transaction.objectStore(IMAGE_STORE_NAME).put({ id: `${sessionId}:${mode}:${cardTitle}`, sessionId, cardTitle, mode, blob, focusY, updatedAt: Date.now() });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    };

    const saveImageFocus = async (sessionId, cardTitle, mode, focusY) => {
      const database = await openImageDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IMAGE_STORE_NAME);
        const request = store.get(`${sessionId}:${mode}:${cardTitle}`);
        request.onsuccess = () => {
          if (request.result) store.put({ ...request.result, focusY, updatedAt: Date.now() });
        };
        request.onerror = () => reject(request.error);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    };

    const loadSessionImages = async (sessionId) => {
      if (!sessionId) return [];
      const database = await openImageDatabase();
      const images = await new Promise((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readonly');
        const request = transaction.objectStore(IMAGE_STORE_NAME).index('sessionId').getAll(sessionId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return images;
    };

    const deleteSessionImages = async (sessionId) => {
      const database = await openImageDatabase();
      const images = await new Promise((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readonly');
        const request = transaction.objectStore(IMAGE_STORE_NAME).index('sessionId').getAll(sessionId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IMAGE_STORE_NAME);
        images.forEach(item => store.delete(item.id));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    };

    const toHistoryIndex = (record) => ({
      id: record.id,
      title: record.title,
      date: record.date,
      isDemo: Boolean(record.isDemo)
    });

    const saveSessionRecord = async (record) => {
      const database = await openImageDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(SESSION_STORE_NAME, 'readwrite');
        transaction.objectStore(SESSION_STORE_NAME).put(record);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    };

    const loadSessionRecord = async (id) => {
      const database = await openImageDatabase();
      const record = await new Promise((resolve, reject) => {
        const transaction = database.transaction(SESSION_STORE_NAME, 'readonly');
        const request = transaction.objectStore(SESSION_STORE_NAME).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return record;
    };

    const filterExistingHistoryIndex = async (historyIndex) => {
      const entries = Array.isArray(historyIndex) ? historyIndex.filter(item => item?.id) : [];
      if (!entries.length) return [];
      const database = await openImageDatabase();
      const records = await new Promise((resolve, reject) => {
        const transaction = database.transaction(SESSION_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SESSION_STORE_NAME);
        const results = [];
        let completed = 0;
        entries.forEach((entry, index) => {
          const request = store.get(entry.id);
          request.onsuccess = () => {
            results[index] = request.result || null;
            completed += 1;
            if (completed === entries.length) resolve(results);
          };
          request.onerror = () => reject(request.error);
        });
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
      return entries.filter((_, index) => records[index]);
    };

    const hasAnySessionRecords = async () => {
      const database = await openImageDatabase();
      const count = await new Promise((resolve, reject) => {
        const transaction = database.transaction(SESSION_STORE_NAME, 'readonly');
        const request = transaction.objectStore(SESSION_STORE_NAME).count();
        request.onsuccess = () => resolve(request.result || 0);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return count > 0;
    };

    const deleteSessionRecord = async (id) => {
      const database = await openImageDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(SESSION_STORE_NAME, 'readwrite');
        transaction.objectStore(SESSION_STORE_NAME).delete(id);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    };

    const migrateLegacyHistory = async (legacyHistory) => {
      const records = Array.isArray(legacyHistory) ? legacyHistory.filter(item => item?.id && item?.sessionData).slice(0, HISTORY_LIMIT) : [];
      await Promise.all(records.map(saveSessionRecord));
      return records.map(toHistoryIndex);
    };

    const dataUrlToBlob = (dataUrl) => {
      const [header, encoded] = dataUrl.split(',');
      const mimeType = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      return new Blob([bytes], { type: mimeType });
    };

    // MoreImg v6 核心规则属于应用协议，不向普通用户开放编辑。

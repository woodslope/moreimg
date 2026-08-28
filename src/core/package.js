    const MOREIMG_SCHEMA_VERSION = 'moreimg-1.0';
    const MOREIMG_PAGE_TYPES = new Set(['cover', 'process', 'timeline', 'relationship', 'comparison', 'checklist', 'framework', 'quote']);
    const MOREIMG_MODES = new Set(['standard', 'short', 'single_point']);
    const MOREIMG_MEDIA = new Set(['3d_model', 'geometric_silhouette', 'hand_drawn_line', 'isometric_icon', 'flat_vector', 'wireframe_perspective']);
    const MOREIMG_SURFACES = new Set(['light', 'dark']);
    const MOREIMG_OVERLAYS = new Set(['none', 'soft_dark', 'soft_light']);

    const createDefaultProcessingPreferences = () => ({
      refinement: 'standard',
      pageCount: 'auto',
      preserveTitle: true,
      tone: 'preserve',
      customInstruction: ''
    });

    const requireObject = (value, path, errors) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path} 必须是对象`);
        return false;
      }
      return true;
    };

    const requireString = (value, path, errors, options = {}) => {
      const { allowEmpty = false, maxLength = 0 } = options;
      if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
        errors.push(`${path} 必须是${allowEmpty ? '' : '非空'}字符串`);
        return false;
      }
      if (maxLength && value.length > maxLength) errors.push(`${path} 不能超过 ${maxLength} 个字符`);
      return true;
    };

    const requireStringArray = (value, path, errors, options = {}) => {
      const { min = 0, max = Infinity, itemMaxLength = 0 } = options;
      if (!Array.isArray(value)) {
        errors.push(`${path} 必须是数组`);
        return false;
      }
      if (value.length < min || value.length > max) errors.push(`${path} 数量必须为 ${min}-${max} 项`);
      value.forEach((item, index) => requireString(item, `${path}[${index}]`, errors, { maxLength: itemMaxLength }));
      return true;
    };

    const validateMoreImgPackage = (packageData, originalText = '') => {
      const errors = [];
      const warnings = [];
      if (!requireObject(packageData, '根对象', errors)) return { packageData, isComplete: false, canContinue: false, isRejected: false, reason: errors[0], warning: '', errors, warnings };
      if (packageData.schema_version !== MOREIMG_SCHEMA_VERSION) errors.push(`schema_version 必须是 ${MOREIMG_SCHEMA_VERSION}`);
      if (!['complete', 'rejected'].includes(packageData.status)) errors.push('status 必须是 complete 或 rejected');

      if (packageData.status === 'rejected') {
        requireString(packageData.reason, 'reason', errors);
        return {
          packageData,
          isComplete: false,
          canContinue: false,
          isRejected: errors.length === 0,
          reason: errors[0] || packageData.reason,
          warning: '',
          errors,
          warnings
        };
      }

      if (requireObject(packageData.analysis, 'analysis', errors)) {
        if (!MOREIMG_MODES.has(packageData.analysis.mode)) errors.push('analysis.mode 必须是 standard、short 或 single_point');
        requireString(packageData.analysis.topic, 'analysis.topic', errors);
        requireString(packageData.analysis.core_claim, 'analysis.core_claim', errors);
        requireStringArray(packageData.analysis.independent_units, 'analysis.independent_units', errors, { min: 1 });
        if (!Array.isArray(packageData.analysis.fact_notes)) errors.push('analysis.fact_notes 必须是数组');
        if (!Array.isArray(packageData.analysis.logic_issues)) errors.push('analysis.logic_issues 必须是数组');
      }

      if (requireObject(packageData.article, 'article', errors)) {
        requireString(packageData.article.title, 'article.title', errors);
        requireString(packageData.article.subtitle, 'article.subtitle', errors, { allowEmpty: true });
        if (requireStringArray(packageData.article.paragraphs, 'article.paragraphs', errors, { min: 1 })) {
          const sourceLength = String(originalText || '').replace(/\s+/g, '').length;
          const articleLength = packageData.article.paragraphs.join('').replace(/\s+/g, '').length;
          if (packageData.analysis?.mode === 'standard' && sourceLength >= 600) {
            const retentionRatio = articleLength / sourceLength;
            if (retentionRatio < 0.3) {
              errors.push('article.paragraphs 过短，标准模式正文保留率低于 30%');
            } else if (retentionRatio < 0.65) {
              warnings.push('标准模式正文保留率低于 65%，可能已去重或压缩，请核对完整性');
            }
          }
        }
      }

      if (requireObject(packageData.style_lock, 'style_lock', errors)) {
        const styleLock = packageData.style_lock;
        requireString(styleLock.style_id, 'style_lock.style_id', errors);
        requireString(styleLock.style_name, 'style_lock.style_name', errors);
        requireString(styleLock.prompt_prefix, 'style_lock.prompt_prefix', errors);
        requireStringArray(styleLock.negative, 'style_lock.negative', errors, { min: 1 });
        if (requireObject(styleLock.card_shell, 'style_lock.card_shell', errors)) {
          if (styleLock.card_shell.preset !== 'moreimg-clean-v1') errors.push('style_lock.card_shell.preset 必须是 moreimg-clean-v1');
          if (!MOREIMG_SURFACES.has(styleLock.card_shell.surface)) errors.push('style_lock.card_shell.surface 必须是 light 或 dark');
          if (!/^#[0-9A-F]{6}$/i.test(styleLock.card_shell.accent_color || '')) errors.push('style_lock.card_shell.accent_color 必须是 #RRGGBB 色值');
          if (!MOREIMG_OVERLAYS.has(styleLock.card_shell.overlay)) errors.push('style_lock.card_shell.overlay 不受支持');
        }
        if (requireObject(styleLock.visual_dna, 'style_lock.visual_dna', errors)) {
          const dna = styleLock.visual_dna;
          if (!MOREIMG_MEDIA.has(dna.medium)) errors.push('style_lock.visual_dna.medium 不受支持');
          ['visual_world', 'shape_language', 'perspective', 'lighting', 'material', 'recurring_subject'].forEach(field => requireString(dna[field], `style_lock.visual_dna.${field}`, errors));
          requireStringArray(dna.recurring_elements, 'style_lock.visual_dna.recurring_elements', errors, { min: 1 });
        }
      }

      if (!Array.isArray(packageData.pages)) {
        errors.push('pages 必须是数组');
      } else {
        if (packageData.pages.length < 3 || packageData.pages.length > 9) errors.push('pages 必须包含封面、1-7张正文和封底');
        const pageIds = new Set();
        packageData.pages.forEach((page, index) => {
          const path = `pages[${index}]`;
          if (!requireObject(page, path, errors)) return;
          requireString(page.page_id, `${path}.page_id`, errors);
          if (pageIds.has(page.page_id)) errors.push(`${path}.page_id 重复`);
          pageIds.add(page.page_id);
          if (page.order !== index + 1) errors.push(`${path}.order 必须是 ${index + 1}`);
          if (!MOREIMG_PAGE_TYPES.has(page.page_type)) errors.push(`${path}.page_type 不受支持`);
          if (index === 0 && (page.page_id !== 'cover' || page.page_type !== 'cover')) errors.push('第1页必须是 cover 封面');
          if (index > 0 && index < packageData.pages.length - 1 && page.page_id !== `content-${String(index).padStart(2, '0')}`) errors.push(`${path}.page_id 必须连续编号`);

          if (requireObject(page.card, `${path}.card`, errors)) {
            requireString(page.card.title, `${path}.card.title`, errors);
            requireString(page.card.subtitle, `${path}.card.subtitle`, errors, { allowEmpty: true });
            requireStringArray(page.card.points, `${path}.card.points`, errors, { max: 5 });
            requireString(page.card.summary, `${path}.card.summary`, errors, { allowEmpty: true });
          }
          if (requireObject(page.semantic, `${path}.semantic`, errors)) {
            ['page_goal', 'primary_claim', 'primary_concept', 'primary_relation'].forEach(field => requireString(page.semantic[field], `${path}.semantic.${field}`, errors));
            ['supporting_concepts', 'excluded_concepts', 'avoid_misread'].forEach(field => requireStringArray(page.semantic[field], `${path}.semantic.${field}`, errors));
          }
          if (requireObject(page.image_prompt, `${path}.image_prompt`, errors)) {
            ['scene', 'relationship', 'composition', 'continuity'].forEach(field => requireString(page.image_prompt[field], `${path}.image_prompt.${field}`, errors));
            const expectedSafeArea = index === 0 ? 'top_40' : index === packageData.pages.length - 1 ? 'top_36' : 'top_52';
            if (page.image_prompt.safe_area !== expectedSafeArea) errors.push(`${path}.image_prompt.safe_area 必须是 ${expectedSafeArea}`);
            requireStringArray(page.image_prompt.avoid, `${path}.image_prompt.avoid`, errors);
          }
        });
        const closing = packageData.pages.at(-1);
        if (!closing || closing.page_id !== 'closing' || closing.page_type !== 'quote') errors.push('最后一页必须是 closing 封底');
      }

      return {
        packageData,
        isComplete: errors.length === 0 && warnings.length === 0,
        canContinue: errors.length === 0,
        isRejected: false,
        reason: errors[0] || '',
        warning: warnings[0] || '',
        errors,
        warnings
      };
    };

    const findBalancedJsonObjects = (source) => {
      const candidates = [];
      for (let start = 0; start < source.length; start += 1) {
        if (source[start] !== '{') continue;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let index = start; index < source.length; index += 1) {
          const character = source[index];
          if (inString) {
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === '"') inString = false;
            continue;
          }
          if (character === '"') {
            inString = true;
          } else if (character === '{') {
            depth += 1;
          } else if (character === '}') {
            depth -= 1;
            if (depth === 0) {
              candidates.push(source.slice(start, index + 1));
              break;
            }
          }
        }
      }
      return candidates;
    };

    const parseMoreImgPackage = (rawText, originalText = '') => {
      const source = String(rawText || '').trim();
      if (!source) throw new Error('接口必须返回合法 JSON');

      const fencedSource = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim() || '';
      const candidates = [...new Set([
        ...(fencedSource ? [fencedSource] : []),
        source,
        ...findBalancedJsonObjects(fencedSource || source)
      ])];
      let lastError = null;
      for (const candidate of candidates) {
        try {
          const packageData = JSON.parse(candidate);
          return validateMoreImgPackage(packageData, originalText);
        } catch (error) {
          lastError = error;
        }
      }
      throw new Error(`接口未返回合法 JSON：${lastError?.message || '找不到完整 JSON 对象'}`);
    };

    const buildPageImagePrompt = (styleLock, page) => {
      if (!styleLock || !page?.image_prompt) return '';
      const localAvoid = Array.isArray(page.image_prompt.avoid) ? page.image_prompt.avoid : [];
      const globalAvoid = Array.isArray(styleLock.negative) ? styleLock.negative : [];
      const safeAreaLabels = {
        top_36: '顶部约36%作为文字承载范围',
        top_40: '顶部约40%作为文字承载范围',
        top_52: '顶部约52%作为文字承载范围'
      };
      const safeArea = safeAreaLabels[page.image_prompt.safe_area] || safeAreaLabels.top_52;
      const compositionBridge = page.page_id === 'closing'
        ? '收束主体、路径或结构走势必须进入画面中部，与上方结论自然衔接'
        : page.page_id === 'cover'
          ? '主场景轮廓从画面中部开始清晰出现，与标题区域形成连续叙事'
          : '弱化后的环境结构延伸到文字区，主关系在画面中部开始建立';
      return `无文字主视觉，3:4全幅连续背景。画面气质：${styleLock.prompt_prefix}。场景：${page.image_prompt.scene}。主关系：${page.image_prompt.relationship}。构图：${page.image_prompt.composition}；${safeArea}，只降低细节和对比，背景、光影与环境结构仍须连续，不能成为纯色留白或空雾占位；${compositionBridge}。系列连续性：${page.image_prompt.continuity}。避免：${[...globalAvoid, ...localAvoid].filter(Boolean).join('、')}。不得出现任何文字、字母、数字、符号、Logo、水印、UI标签、卡片框架或伪文字纹理。`;
    };

    const PROCESSING_PREFERENCE_LABELS = {
      refinement: { standard: '标准精修', light: '轻度整理' },
      tone: { preserve: '尽量保留原文语气', concise: '更简洁克制', conversational: '更口语自然' }
    };

    const buildInitialProcessingMessages = (originalText, systemPrompt = '', preferences = createDefaultProcessingPreferences()) => {
      const pageCountText = preferences.pageCount === 'auto' ? '自动决定，固定包含封面和封底' : `总页数：${preferences.pageCount}页，固定包含封面和封底`;
      const preferenceLines = [
        `精修方式：${PROCESSING_PREFERENCE_LABELS.refinement[preferences.refinement] || PROCESSING_PREFERENCE_LABELS.refinement.standard}`,
        `卡片页数：${pageCountText}`,
        `原文标题：${preferences.preserveTitle ? '必须优先保留，除非原文没有可用标题' : '允许优化但不得改变核心命名'}`,
        `内容口吻：${PROCESSING_PREFERENCE_LABELS.tone[preferences.tone] || PROCESSING_PREFERENCE_LABELS.tone.preserve}`,
        preferences.customInstruction?.trim() ? `补充要求：${preferences.customInstruction.trim()}` : ''
      ].filter(Boolean);
      return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请按内置规则处理以下原文，并只返回 moreimg-1.0 JSON。\n\n加工偏好：\n${preferenceLines.join('\n')}\n\n原文：\n${originalText}` }
      ];
    };

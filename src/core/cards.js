    const getCardVisibleText = (card) => card ? [card.title, card.subtitle, ...(card.points || []), card.summary].filter(Boolean) : [];

    const buildVisualOnlyPrompt = (visualPrompt, card) => {
      const visibleText = card ? [card.title, card.subtitle, ...(card.points || []), card.summary].filter(Boolean) : [];
      let sanitizedPrompt = String(visualPrompt || '')
        .replace(/```[^\n]*\n?/g, '')
        .replace(/```/g, '')
        .replace(/「[^」]*」|“[^”]*”|"[^"]*"/g, '')
        .replace(/(?:核心)?主体(?:必须)?占(?:整个)?画面(?:的)?45%-65%[^。；\n]*[。；]?/g, '')
        .replace(/顶部55%[^。；\n]*[。；]?/g, '')
        .trim();

      visibleText.forEach(text => {
        sanitizedPrompt = sanitizedPrompt.split(String(text)).join('');
      });

      const textLayoutInstruction = /(?:主标题|副标题|标题|要点|总结|行动号召|信息条|文字排版|文本排版|字体|字号|字重|文案|准确绘制|逐字|写上|标注|页码|署名|二维码)/;
      const sceneDescription = sanitizedPrompt
        .split(/[。！？；\n]+/)
        .map(sentence => sentence
          .split(/[，,]+/)
          .map(part => part.trim().replace(/^[、:：\s]+|[、:：\s]+$/g, ''))
          .filter(part => part && !textLayoutInstruction.test(part))
          .join('，'))
        .filter(part => part && !textLayoutInstruction.test(part))
        .join('。');

      const safeArea = card?.type === 'cover'
        ? '顶部约38%-42%作为文字承载范围'
        : card?.type === 'back'
          ? '顶部约34%-38%作为文字承载范围'
          : '顶部约50%-52%作为文字承载范围';
      const compositionBridge = card?.type === 'back'
        ? '收束主体、路径、视线或结构走势从下方向上进入画面中部，与上方结论形成联系；'
        : card?.type === 'cover'
          ? '主场景轮廓从画面中部开始清晰出现，与标题区形成连续叙事；'
          : '主关系从画面中部开始建立，弱化后的环境结构继续延伸到文字区；';
      return `无文字主视觉。生成一张可作为整张 3:4 卡片全幅背景的连续画面，背景自然延伸到四边，空间、光影和结构保持连贯，不要内嵌图片框、海报边框或独立卡片容器。主视觉重心位于中下部并占据足够面积，${safeArea}，但这里只降低细节和对比，不能处理成大片纯色、空雾、无内容墙面或空台面；${compositionBridge}避免上下割裂或中间出现无意义空白。底部只展示主视觉，不预留文字位置。只保留并生成以下场景或插图元素：${sceneDescription || '围绕卡片主关系设计一个主体明确、构图简洁的视觉场景'}。不得出现任何文字、字母、数字、符号、Logo、水印、卡片框架、UI、信息条或伪文字纹理；不要绘制标题、要点、总结和按钮标签。`;
    };

    const buildFullImagePrompt = (visualPrompt, card) => {
      const visibleText = getCardVisibleText(card);
      const sanitizedVisualPrompt = String(visualPrompt || '')
        .replace(/无文字主视觉|无文字视觉素材/g, '完整卡片视觉')
        .replace(/画面中不生成任何文字[^。；\n]*[。；]?/g, '')
        .replace(/不得出现任何文字[^。；\n]*[。；]?/g, '')
        .replace(/不要绘制标题[^。；\n]*[。；]?/g, '')
        .replace(/(?:核心)?主体(?:必须)?占(?:整个)?画面(?:的)?45%-65%[^。；\n]*[。；]?/g, '')
        .replace(/避免：([^。；\n]*)/g, (_, items) => {
          const keptItems = items.split(/[、，,]/)
            .map(item => item.trim())
            .filter(item => item && !/(文字|字母|数字|符号|Logo|水印|标签|代码字符|伪文字)/i.test(item));
          return keptItems.length > 0 ? `避免：${keptItems.join('、')}` : '';
        })
        .replace(/[。；]{2,}/g, '。')
        .trim();
      const layoutInstruction = card?.type === 'back'
        ? '这是封底。请按严格的三段层级排版：页标置于最上方，核心总结作为醒目的主标题，行动号召紧随其下并与主标题形成清晰层级；三者在上半部沿同一左对齐轴排列，保持明确的上下间距。下半部只展示主视觉，不放任何文字。'
        : card?.type === 'cover'
          ? '这是封面。请按严格的标题组排版：主标题作为最大字号的唯一视觉焦点，允许自然换行但必须保持完整；副标题紧跟主标题下方，字号明显小一级、颜色弱一级；标题组固定在上半部同一左对齐轴内，主视觉从中部向下承接。'
          : '这是正文页。请按严格的内容卡片结构排版：标题作为上半部第一层级的醒目主标题；所有要点作为同一组垂直列表，逐条换行并保持统一左对齐，使用连续的圆点或编号标记；总结单独放在要点列表下方，与列表之间留出明显间距，并用细分隔线或独立强调区与要点区分开。标题、要点列表、总结必须按此顺序排列，不能横向散落、重叠或穿插在主视觉中；下半部只展示主视觉，不放任何文字。';
      const typographyInstruction = '版式执行要求：画布为竖版 3:4，文字区约占上方 50%-52%，主视觉区从画面中部向下连续展开。所有文字放在同一清晰的文字承载区域内，建立明确的字号层级、字重层级、行距和段间距；优先使用现代无衬线字体，文字颜色与背景保持高对比，左右留出安全边距。仅将下列文本作为可见文字，字段名“标题、要点、总结、页标、核心总结、行动号召”等只是排版说明，不得绘制出来。';
      return `生成一张完整的小红书知识卡片成品图，直接完成3:4排版。本页必须包含且只能包含以下文字：${visibleText.map(text => `「${text}」`).join('、')}。${layoutInstruction}${typographyInstruction}所有文字必须清晰可读、逐字保持不变，不能省略、改写、拆散或替换；禁止生成无文字版本，不要添加任何未提供的文字。\n\n视觉背景参考：${sanitizedVisualPrompt}。AI 整图为实验性输出，优先保证文字与卡片结构对应。`;
    };

    const cleanCardValue = (value = '') => value
      .replace(/^\s*[-*•]\s*/, '')
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/^[「“\"]|[」”\"]$/g, '')
      .trim();

    const readCardField = (block, fieldNames) => {
      const names = (Array.isArray(fieldNames) ? fieldNames : [fieldNames])
        .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      const match = block.match(new RegExp(`(?:^|\\n)\\s*(?:[-*•]\\s*)?(?:\\*\\*)?(?:${names})(?:\\*\\*)?\\s*[：:]\\s*(.+)`, 'm'));
      return cleanCardValue(match?.[1] || '');
    };

    const readCardPoints = (block) => {
      const lines = block.split('\n');
      const points = [];
      let collecting = false;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (/^(?:[-*•]\s*)?(?:\*\*)?(?:内容要点|要点)(?:\*\*)?\s*[：:]/.test(line)) {
          collecting = true;
          const inlineValue = line.replace(/^(?:[-*•]\s*)?(?:\*\*)?(?:内容要点|要点)(?:\*\*)?\s*[：:]\s*/, '');
          if (inlineValue) points.push(...inlineValue.split(/[；;]/).map(cleanCardValue).filter(Boolean));
          continue;
        }
        if (collecting && /^(?:[-*•]\s*)?(?:\*\*)?(?:一句话总结|总结|核心总结|行动号召|核心比喻)(?:\*\*)?\s*[：:]/.test(line)) break;
        if (collecting && /^[-*•]\s+/.test(line)) points.push(cleanCardValue(line));
      }
      return points;
    };

    const parseCardPackage = (content) => {
      if (!content) return [];
      const headerRegex = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?(封面卡片|正文卡片\s*\d+\/\d+|封底卡片)(?:\*\*)?\s*[：:]?\s*(?=\n|$)/g;
      const headers = [...content.matchAll(headerRegex)];
      return headers.map((header, index) => {
        const label = header[1].replace(/\s+/g, ' ').trim();
        const blockStart = header.index + header[0].length;
        const blockEnd = headers[index + 1]?.index ?? content.length;
        const block = content.slice(blockStart, blockEnd).trim();
        const isCover = label === '封面卡片';
        const isBack = label === '封底卡片';
        const bodyMatch = label.match(/正文卡片\s*(\d+\/\d+)/);
        const imageKey = isCover ? '封面' : isBack ? '封底' : `正文${bodyMatch?.[1] || index}`;
        return {
          id: `${imageKey}-${index}`,
          label: isCover ? '封面' : isBack ? '封底' : `正文 ${bodyMatch?.[1] || ''}`,
          imageKey,
          type: isCover ? 'cover' : isBack ? 'back' : 'body',
          title: isCover ? readCardField(block, '主标题') : isBack ? readCardField(block, '核心总结') : readCardField(block, '标题'),
          subtitle: isCover ? readCardField(block, '副标题') : '',
          points: isCover || isBack ? [] : readCardPoints(block),
          summary: isBack ? readCardField(block, '行动号召') : readCardField(block, ['一句话总结', '总结'])
        };
      }).filter(card => card.title || card.subtitle || card.points.length || card.summary);
    };

    const getPageDisplayName = (page, contentCount = 0) => {
      if (page.page_id === 'cover') return '封面';
      if (page.page_id === 'closing') return '封底';
      const match = page.page_id.match(/^content-(\d+)$/);
      return `正文${Number(match?.[1] || page.order - 1)}/${contentCount || '?'}`;
    };

    const packagePageToCard = (page, index, pages = []) => {
      const contentCount = Math.max(0, pages.length - 2);
      const type = page.page_id === 'cover' ? 'cover' : page.page_id === 'closing' ? 'back' : 'body';
      const imageKey = getPageDisplayName(page, contentCount);
      return {
        id: `${page.page_id}-${index}`,
        label: imageKey === '封面' || imageKey === '封底' ? imageKey : imageKey.replace('正文', '正文 '),
        imageKey,
        pageId: page.page_id,
        type,
        title: page.card.title,
        subtitle: page.card.subtitle || '',
        points: Array.isArray(page.card.points) ? page.card.points : [],
        summary: page.card.summary || ''
      };
    };

    const packagePageToPromptSection = (page, styleLock, pages = []) => ({
      title: getPageDisplayName(page, Math.max(0, pages.length - 2)),
      pageId: page.page_id,
      text: buildPageImagePrompt(styleLock, page)
    });

    const getPackageStageText = (packageData, stageId) => {
      if (!packageData || packageData.status !== 'complete') return '';
      if (stageId === 1) {
        const modeLabels = { standard: '标准模式', short: '短文模式', single_point: '单点模式' };
        return [
          `## 判型结论`,
          `- 加工模式：${modeLabels[packageData.analysis.mode] || packageData.analysis.mode}`,
          `- 主题：${packageData.analysis.topic}`,
          `- 核心观点：${packageData.analysis.core_claim}`,
          `- 独立信息单元：${packageData.analysis.independent_units.join('；')}`
        ].join('\n');
      }
      if (stageId === 2) {
        const factLines = packageData.analysis.fact_notes.length
          ? packageData.analysis.fact_notes.map(item => `- ${item.claim || '未命名信息'}：${item.note || item.status || '未说明'}`)
          : ['- 原文没有需要单独提示的事实边界'];
        const logicLines = packageData.analysis.logic_issues.length
          ? packageData.analysis.logic_issues.map(item => `- ${typeof item === 'string' ? item : item.note || item.issue || JSON.stringify(item)}`)
          : ['- 未发现需要单独提示的逻辑问题'];
        return [`## 事实边界`, ...factLines, `## 逻辑检查`, ...logicLines].join('\n');
      }
      if (stageId === 3) {
        return [`# ${packageData.article.title}`, packageData.article.subtitle ? `## ${packageData.article.subtitle}` : '', ...packageData.article.paragraphs].filter(Boolean).join('\n\n');
      }
      if (stageId === 4) return 'JSON 卡片页面';
      if (stageId === 5) return 'JSON 视觉页面';
      return '';
    };

    const getCardShellPresentation = (styleLock) => {
      const shell = styleLock?.card_shell || {};
      const surface = shell.surface === 'light' ? 'light' : 'dark';
      const overlay = MOREIMG_OVERLAYS.has(shell.overlay) ? shell.overlay : surface === 'light' ? 'soft_light' : 'soft_dark';
      const accentColor = /^#[0-9A-F]{6}$/i.test(shell.accent_color || '') ? shell.accent_color : '#F59E42';
      return {
        className: `moreimg-card-surface-${surface} moreimg-card-overlay-${overlay}`,
        style: { '--moreimg-card-accent': accentColor }
      };
    };

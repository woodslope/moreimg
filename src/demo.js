    // 首次启动示例记录：让第一次使用的人无需配置即可查看完整能力（历史恢复、物料包、视觉生成与成品对比）。
    // 示例图片为浏览器端 Canvas 程序化生成的示意主视觉，不代表真实 AI 生图质量。

    const DEMO_SESSION_ID = 'demo-seed-001';
    const DEMO_SEEDED_KEY = 'moreimg_demo_seeded';

    const demoOriginalText = [
      '# AI 时代，速度提升不等于稳定交付',
      '',
      '很多团队把引入 AI 的第一目标定成“把出图时间缩短一半”。这个目标很容易量化，也容易在汇报里展示，但它未必能带来更好的交付。出图只是设计流程中的一个环节，真正消耗时间的往往是需求没有说清、判断标准不一致、版本之间缺少记录。工具把生产速度提高以后，这些问题不会消失，只会让错误版本更快地出现。',
      '',
      '设计工作不是图片数量竞赛。用户看到的是最终信息是否准确、层级是否清楚、操作是否顺畅，而不是团队一天生成了多少方案。如果一个页面同时出现三个主按钮，模型可以在几分钟内给出十种配色，但决定哪个按钮更重要的判断仍然要由人来完成。速度解决的是“做得快”，稳定解决的是“做得对”，两者不能互相替代。',
      '',
      '要让交付稳定，前提是需求、标准、记录与验收这四个环节提前对齐。需求说清楚要解决什么问题，标准说清楚什么算完成，记录说清楚每个版本改了什么、为什么改，验收说清楚谁在什么时候检查。四者缺一，速度越快，返工成本越高。',
      '',
      '验收应该前置而不是压到最后。越早把验收标准放进工作流，越能避免在最后一刻推翻整版。人的角色不是被工具替代，而是负责目标、约束与取舍：工具负责把想法快速变成候选，人负责判断哪些候选值得留下。',
      '',
      '所以，把目标从“更快”改成“又快又稳”，团队要做的不是停止引入 AI，而是把 AI 放进一个有边界的工作流里：明确目标、定好标准、记录取舍、前置验收。速度是杠杆，稳定才是结果。'
    ].join('\n');

    const demoPackageData = {
      schema_version: 'moreimg-1.0',
      status: 'complete',
      analysis: {
        mode: 'standard',
        topic: 'AI 时代的稳定交付',
        core_claim: '速度提升不等于稳定交付，需求、标准、记录与验收必须前置对齐',
        independent_units: ['速度不等于稳定', '判断仍由人负责', '四个前置环节', '验收前置', '人负责目标与取舍'],
        fact_notes: [],
        logic_issues: []
      },
      article: {
        title: 'AI 时代，速度提升不等于稳定交付',
        subtitle: '把目标从「更快」改成「又快又稳」',
        paragraphs: [
          '很多团队把引入 AI 的第一目标定成“把出图时间缩短一半”。这个目标容易量化，也容易展示，但它未必能带来更好的交付。出图只是设计流程中的一个环节，真正消耗时间的往往是需求没有说清、判断标准不一致、版本之间缺少记录。工具把生产速度提高以后，这些问题不会消失，只会让错误版本更快地出现。',
          '设计工作不是图片数量竞赛。用户看到的是最终信息是否准确、层级是否清楚、操作是否顺畅，而不是团队一天生成了多少方案。速度解决的是“做得快”，稳定解决的是“做得对”，两者不能互相替代。',
          '要让交付稳定，前提是需求、标准、记录与验收这四个环节提前对齐：需求说清楚解决什么问题，标准说清楚什么算完成，记录说清楚每次改了什么，验收说清楚谁在什么时候检查。四者缺一，速度越快，返工成本越高。',
          '验收应该前置而不是压到最后。越早把验收标准放进工作流，越能避免在最后一刻推翻整版。人的角色不是被工具替代，而是负责目标、约束与取舍：工具负责把想法快速变成候选，人负责判断哪些候选值得留下。',
          '所以，把目标从“更快”改成“又快又稳”，团队要做的不是停止引入 AI，而是把 AI 放进一个有边界的工作流里：明确目标、定好标准、记录取舍、前置验收。速度是杠杆，稳定才是结果。'
        ]
      },
      style_lock: {
        style_id: 'demo-amber-blue',
        style_name: '示例：琥珀蓝工作台',
        card_shell: { preset: 'moreimg-clean-v1', surface: 'light', accent_color: '#2563EB', overlay: 'soft_light' },
        prompt_prefix: '奶油白知识卡片，琥珀点缀，靛蓝强调，等距图标风格。',
        visual_dna: {
          medium: 'isometric_icon',
          visual_world: '安静的产品交付工作台',
          shape_language: '简洁几何线条',
          perspective: '等距俯视',
          lighting: '柔和自然光',
          material: '哑光纸张',
          recurring_subject: '同一组交付流程卡片',
          recurring_elements: ['琥珀标记', '流程卡片']
        },
        negative: ['文字', 'Logo', '伪文字', '水印', 'UI 标签']
      },
      pages: [
        {
          page_id: 'cover', order: 1, page_type: 'cover',
          card: { title: 'AI 时代，速度不等于稳定交付', subtitle: '把目标从「更快」改成「又快又稳」', points: [], summary: '速度是杠杆，稳定是结果' },
          semantic: { page_goal: '提出核心矛盾', primary_claim: '速度提升不等于稳定交付', primary_concept: '稳定交付', primary_relation: '速度与稳定相互独立', supporting_concepts: [], excluded_concepts: [], avoid_misread: [] },
          image_prompt: { scene: '工作台上的交付流程卡片', relationship: '速度箭头与稳定基座并置', composition: '主体位于下半部', safe_area: 'top_40', continuity: '沿用工作台世界', avoid: [] }
        },
        {
          page_id: 'content-01', order: 2, page_type: 'process',
          card: { title: '交付四环节', subtitle: '', points: ['需求对齐', '标准一致', '版本记录', '前置验收'], summary: '四者缺一，速度越快越返工' },
          semantic: { page_goal: '列出稳定交付的四个前提', primary_claim: '四环节缺一不可', primary_concept: '交付四环节', primary_relation: '四环节共同支撑稳定交付', supporting_concepts: [], excluded_concepts: [], avoid_misread: [] },
          image_prompt: { scene: '四张流程卡片依次排列', relationship: '四张卡片汇入稳定基座', composition: '主体位于下半部', safe_area: 'top_52', continuity: '沿用工作台世界', avoid: [] }
        },
        {
          page_id: 'content-02', order: 3, page_type: 'comparison',
          card: { title: '速度 ≠ 稳定', subtitle: '', points: ['快解决「做得快」', '稳解决「做得对」'], summary: '两者不能互相替代' },
          semantic: { page_goal: '区分速度与稳定', primary_claim: '速度与稳定不能互相替代', primary_concept: '速度与稳定', primary_relation: '速度与稳定相对独立', supporting_concepts: [], excluded_concepts: [], avoid_misread: [] },
          image_prompt: { scene: '并排的天平两侧', relationship: '速度与稳定分别占据天平两端', composition: '主体位于下半部', safe_area: 'top_52', continuity: '沿用工作台世界', avoid: [] }
        },
        {
          page_id: 'content-03', order: 4, page_type: 'checklist',
          card: { title: '验收前置清单', subtitle: '', points: ['谁在什么时间检查', '什么算完成', '每一版改了什么'], summary: '越早验收，返工越少' },
          semantic: { page_goal: '给出验收前置的行动清单', primary_claim: '验收前置能减少返工', primary_concept: '前置验收', primary_relation: '验收前置连接低返工结果', supporting_concepts: [], excluded_concepts: [], avoid_misread: [] },
          image_prompt: { scene: '清单上的三行勾选项', relationship: '勾选项连接向低返工结果', composition: '主体位于下半部', safe_area: 'top_52', continuity: '沿用工作台世界', avoid: [] }
        },
        {
          page_id: 'closing', order: 5, page_type: 'quote',
          card: { title: '速度是杠杆，稳定才是结果', subtitle: '', points: [], summary: '又快又稳，而不是只快' },
          semantic: { page_goal: '收束全文', primary_claim: '稳定才是最终结果', primary_concept: '又快又稳', primary_relation: '速度杠杆连接稳定结果', supporting_concepts: [], excluded_concepts: [], avoid_misread: [] },
          image_prompt: { scene: '流程卡片被收入交付基座', relationship: '基座连接稳定交付结果', composition: '主体位于下半部', safe_area: 'top_36', continuity: '沿用工作台世界', avoid: [] }
        }
      ]
    };

    const createDemoSessionRecord = () => ({
      id: DEMO_SESSION_ID,
      title: '示例：AI 时代如何稳定交付',
      date: '内置示例 · 首次启动',
      isDemo: true,
      sessionData: {
        rawText: JSON.stringify(demoPackageData),
        packageData: demoPackageData,
        stages: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
        isHalted: false,
        stopReason: '',
        warning: '',
        finishReason: 'stop'
      },
      originalInput: demoOriginalText
    });

    const demoPageTitles = () => {
      const contentCount = Math.max(0, demoPackageData.pages.length - 2);
      return demoPackageData.pages.map(page => page.page_id === 'cover' ? '封面' : page.page_id === 'closing' ? '封底' : `正文${Number(page.page_id.match(/^content-(\d+)$/)?.[1] || page.order - 1)}/${contentCount}`);
    };

    const drawDemoImage = (accentColor, mode, seed) => {
      const canvas = document.createElement('canvas');
      canvas.width = 768;
      canvas.height = 1024;
      const context = canvas.getContext('2d');
      const accent = accentColor || '#2563EB';

      // 背景渐变：奶油白到浅靛蓝，模拟浅色卡片表面
      const background = context.createLinearGradient(0, 0, 768, 1024);
      background.addColorStop(0, '#FDF8F2');
      background.addColorStop(0.6, '#F5F1EA');
      background.addColorStop(1, '#EAF0FB');
      context.fillStyle = background;
      context.fillRect(0, 0, 768, 1024);

      // 柔和环境光斑
      const ambient = context.createRadialGradient(560, 180, 40, 560, 180, 320);
      ambient.addColorStop(0, 'rgba(245,158,66,0.18)');
      ambient.addColorStop(1, 'rgba(245,158,66,0)');
      context.fillStyle = ambient;
      context.fillRect(0, 0, 768, 1024);

      const random = (() => {
        let value = seed * 9301 + 49297;
        return () => {
          value = (value * 233280 + 9301) % 233280;
          return value / 233280;
        };
      })();

      // 等距风格几何元素：圆形 + 方块 + 连线，模拟无文字主视觉
      for (let index = 0; index < 14; index += 1) {
        const x = 90 + random() * 580;
        const y = 300 + random() * 620;
        const size = 16 + random() * 46;
        const alpha = 0.5 + random() * 0.35;
        context.globalAlpha = alpha;
        context.fillStyle = index % 3 === 0 ? '#F59E42' : index % 3 === 1 ? accent : '#94A3B8';
        context.beginPath();
        if (index % 2 === 0) {
          context.arc(x, y, size / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.save();
          context.translate(x, y);
          context.rotate(random() * Math.PI);
          context.fillRect(-size / 2, -size / 2, size, size);
          context.restore();
        }
        context.fill();
      }
      context.globalAlpha = 0.25;
      context.strokeStyle = '#64748B';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(120, 880);
      context.lineTo(648, 880);
      context.stroke();
      context.globalAlpha = 1;

      if (mode === 'full') {
        // AI 整图示意：在顶部叠加半透明文字区占位块，表示模型排版输出的成品卡
        context.fillStyle = 'rgba(255,255,255,0.82)';
        context.beginPath();
        context.roundRect(90, 110, 588, 300, 28);
        context.fill();
        context.fillStyle = accent;
        context.globalAlpha = 0.9;
        context.beginPath();
        context.roundRect(130, 170, 340, 26, 13);
        context.fill();
        context.globalAlpha = 0.45;
        context.fillStyle = '#64748B';
        [226, 270, 314].forEach(y => {
          context.beginPath();
          context.roundRect(130, y, 460, 16, 8);
          context.fill();
        });
        context.globalAlpha = 1;
      }

      return canvas;
    };

    const canvasToBlob = (canvas) => new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('示例图片生成失败')), 'image/png');
    });

    // 首次启动 seed：写入示例 session 记录 + 每页示意主视觉与 AI 整图
    const seedDemoHistory = async () => {
      const record = createDemoSessionRecord();
      const titles = demoPageTitles();
      const accentColor = demoPackageData.style_lock.card_shell.accent_color;
      const images = [];
      try {
        // 先生成完整的内置素材，再写入存储，避免半成品被当作可恢复历史。
        for (let index = 0; index < titles.length; index += 1) {
          const title = titles[index];
          const visualBlob = await canvasToBlob(drawDemoImage(accentColor, 'visual', index + 1));
          images.push({ title, blob: visualBlob, mode: 'visual-only' });
          const fullBlob = await canvasToBlob(drawDemoImage(accentColor, 'full', index + 10));
          images.push({ title, blob: fullBlob, mode: 'full' });
        }
        await saveSessionRecord(record);
        for (const image of images) {
          await saveImageBlob(DEMO_SESSION_ID, image.title, image.blob, image.mode, 50);
        }
        localStorage.setItem(DEMO_SEEDED_KEY, '1');
        return record;
      } catch (error) {
        await deleteSessionRecord(DEMO_SESSION_ID).catch(() => {});
        await deleteSessionImages(DEMO_SESSION_ID).catch(() => {});
        localStorage.removeItem(DEMO_SEEDED_KEY);
        throw error;
      }
    };

    const shouldSeedDemo = () => !localStorage.getItem(DEMO_SEEDED_KEY);

    // 手动载入示例（幂等）：先清理旧示例记录与图片，再重新生成，供「载入示例」按钮使用
    const loadDemoHistory = async () => {
      await deleteSessionRecord(DEMO_SESSION_ID).catch(() => {});
      await deleteSessionImages(DEMO_SESSION_ID).catch(() => {});
      return seedDemoHistory();
    };

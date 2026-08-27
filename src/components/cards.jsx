    const HTML_CARD_EXPORT_STYLES = `
      .moreimg-export-card{--moreimg-card-accent:#F59E42;box-sizing:border-box;position:relative;isolation:isolate;width:1242px;height:1656px;overflow:hidden;background:#121417;color:#f7f7f2;font-family:"Noto Sans SC Variable",sans-serif;padding:0;letter-spacing:0}
      .moreimg-export-card *{box-sizing:border-box}
      /* 背景层用正 z-index 叠放：html2canvas 会丢弃负 z-index 的绝对定位子层，导出成品会缺遮罩与噪点。 */
      .moreimg-card-media{position:absolute;inset:0;z-index:0;background:#15171a;overflow:hidden}
      .moreimg-card-media img{width:100%;height:100%;object-fit:cover;object-position:center var(--moreimg-card-focus-y,58%);display:block;transform:scale(1.012)}
      .moreimg-card-visual-placeholder{position:absolute;inset:0;background:radial-gradient(circle at 62% 66%,rgba(239,232,216,.25),transparent 24%),linear-gradient(155deg,#313842 0%,#15181d 56%,#08090b 100%)}
      .moreimg-card-shade{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(7,9,12,.9) 0%,rgba(7,9,12,.66) 24%,rgba(7,9,12,.08) 58%,rgba(7,9,12,.44) 100%)}
      .moreimg-card-body .moreimg-card-shade{background:linear-gradient(180deg,rgba(5,8,12,.9) 0%,rgba(5,8,12,.72) 28%,rgba(5,8,12,.38) 48%,rgba(5,8,12,.08) 66%,rgba(5,8,12,.04) 100%)}
      .moreimg-card-back .moreimg-card-shade{background:linear-gradient(180deg,rgba(7,9,12,.9) 0%,rgba(7,9,12,.68) 30%,rgba(7,9,12,.28) 50%,rgba(7,9,12,.06) 68%,rgba(7,9,12,.03) 100%)}
      .moreimg-card-noise{position:absolute;inset:0;z-index:2;opacity:.1;background-image:radial-gradient(rgba(255,255,255,.38) .7px,transparent .8px);background-size:8px 8px;mix-blend-mode:soft-light;pointer-events:none}
      .moreimg-card-content{position:relative;z-index:3;width:1080px;height:1440px;padding:78px;display:flex;flex-direction:column;transform:scale(1.15,1.152778);transform-origin:top left}
      .moreimg-card-header{max-width:890px}
      .moreimg-card-kicker{display:flex;align-items:center;gap:14px;color:rgba(255,255,255,.76);font-size:29px;line-height:1;font-weight:780;letter-spacing:.06em}
      .moreimg-card-kicker-mark{display:block;width:6px;height:28px;border-radius:3px;background:var(--moreimg-card-accent);flex:none}
      /* html2canvas 的中文字形基线比 Chrome 布局低，仅在导出克隆中做视觉对齐。 */
      .moreimg-export-render .moreimg-card-kicker-mark{transform:translateY(14px)}
      .moreimg-card-title{margin:44px 0 0;font-size:92px;line-height:1.08;font-weight:920;letter-spacing:0;color:#f8f7f2;max-width:930px;overflow-wrap:anywhere;text-wrap:balance;text-shadow:0 2px 12px rgba(0,0,0,.3)}
      .moreimg-card-subtitle{margin-top:26px;max-width:840px;font-size:38px;line-height:1.42;font-weight:660;color:rgba(255,255,255,.82);text-shadow:0 1px 8px rgba(0,0,0,.26)}
      .moreimg-card-points{margin-top:34px;padding:0 6px;background:transparent}
      .moreimg-card-point{min-height:88px;padding:22px 0;display:flex;align-items:center;border-bottom:0;font-size:36px;line-height:1.34;font-weight:740;color:#f7f6f1;text-shadow:0 1px 8px rgba(0,0,0,.3)}
      .moreimg-card-point:last-child{border-bottom:0}
      .moreimg-card-point-index{width:62px;margin-right:20px;flex:none;color:var(--moreimg-card-accent);font-size:23px;font-variant-numeric:tabular-nums;letter-spacing:.08em}
      .moreimg-card-summary{margin-top:20px;padding:24px 6px 0;border-top:2px solid rgba(255,255,255,.4);font-size:37px;line-height:1.36;font-weight:840;color:#fbfaf5;text-shadow:0 1px 8px rgba(0,0,0,.3)}
      .moreimg-card-cover .moreimg-card-summary,.moreimg-card-back .moreimg-card-summary{border-top:0;padding-top:0}
      .moreimg-card-cover .moreimg-card-summary{margin-top:26px}
      .moreimg-card-back .moreimg-card-summary{margin-top:30px}
      .moreimg-card-cover .moreimg-card-summary:before,.moreimg-card-back .moreimg-card-summary:before{display:block;width:42%;height:2px;margin-bottom:18px;background:var(--moreimg-card-accent);content:""}
      .moreimg-card-body .moreimg-card-title{margin-top:38px;font-size:80px;line-height:1.08;max-width:900px}
      .moreimg-card-body .moreimg-card-header{max-width:850px}
      .moreimg-card-body .moreimg-card-summary{border-top-width:0;max-width:620px;padding-top:8px}
      .moreimg-card-body .moreimg-card-summary:before{display:block;width:28%;height:2px;margin-bottom:16px;background:var(--moreimg-card-accent);content:""}
      .moreimg-card-density-dense .moreimg-card-title{margin-top:34px;font-size:76px;line-height:1.1}
      .moreimg-card-density-dense .moreimg-card-subtitle{margin-top:20px;font-size:34px}
      .moreimg-card-density-dense .moreimg-card-points{margin-top:26px}
      .moreimg-card-density-dense .moreimg-card-point{min-height:78px;padding:17px 0;font-size:32px;line-height:1.32}
      .moreimg-card-density-dense .moreimg-card-summary{margin-top:16px;padding-top:18px;font-size:31px}
      .moreimg-card-density-extra-dense .moreimg-card-title{margin-top:30px;font-size:68px;line-height:1.1}
      .moreimg-card-density-extra-dense .moreimg-card-subtitle{margin-top:18px;font-size:31px;line-height:1.36}
      .moreimg-card-density-extra-dense .moreimg-card-points{margin-top:20px}
      .moreimg-card-density-extra-dense .moreimg-card-point{min-height:68px;padding:13px 0;font-size:29px;line-height:1.3}
      .moreimg-card-density-extra-dense .moreimg-card-point-index{width:54px;margin-right:16px;font-size:21px}
      .moreimg-card-density-extra-dense .moreimg-card-summary{margin-top:14px;padding-top:16px;font-size:29px;line-height:1.36}
      .moreimg-card-back .moreimg-card-content{justify-content:flex-start}
      .moreimg-card-back-copy{max-width:900px;margin-top:58px;padding-bottom:8px}
      .moreimg-card-back .moreimg-card-title{margin:0;font-size:80px;line-height:1.13}
      .moreimg-card-back .moreimg-card-summary{margin-top:30px;padding:26px 0 0;font-size:40px;max-width:860px;color:rgba(255,255,255,.84)}
      .moreimg-card-back.moreimg-card-density-dense .moreimg-card-title{font-size:70px;line-height:1.16}
      .moreimg-card-back.moreimg-card-density-dense .moreimg-card-summary{font-size:33px}
      .moreimg-card-overlay-none .moreimg-card-shade{background:transparent}
      .moreimg-card-surface-light{background:#f2f5f3;color:#14202b}
      .moreimg-card-surface-light .moreimg-card-media{background:#e8eeec}
      .moreimg-card-surface-light .moreimg-card-visual-placeholder{background:radial-gradient(circle at 62% 66%,rgba(245,158,66,.22),transparent 25%),linear-gradient(155deg,#f8faf9 0%,#e8efec 56%,#dbe5e1 100%)}
      .moreimg-card-surface-light.moreimg-card-overlay-soft_light .moreimg-card-shade{background:linear-gradient(180deg,rgba(248,250,249,.96) 0%,rgba(248,250,249,.86) 28%,rgba(248,250,249,.34) 55%,rgba(248,250,249,.08) 100%)}
      .moreimg-card-surface-light .moreimg-card-kicker{color:rgba(20,32,43,.68)}
      .moreimg-card-surface-light .moreimg-card-title{color:#14202b;text-shadow:0 1px 8px rgba(255,255,255,.72)}
      .moreimg-card-surface-light .moreimg-card-subtitle{color:rgba(20,32,43,.72);text-shadow:0 1px 6px rgba(255,255,255,.68)}
      .moreimg-card-surface-light .moreimg-card-point{border-bottom-color:rgba(20,32,43,.18);color:#1c2b36;text-shadow:none}
      .moreimg-card-surface-light .moreimg-card-summary{border-top-color:var(--moreimg-card-accent);color:#14202b;text-shadow:none}
      .moreimg-card-surface-light.moreimg-card-overlay-soft_dark .moreimg-card-shade{background:linear-gradient(180deg,rgba(20,29,36,.82) 0%,rgba(20,29,36,.58) 28%,rgba(20,29,36,.12) 62%,transparent 100%)}
      .moreimg-card-surface-light.moreimg-card-overlay-soft_dark .moreimg-card-kicker,.moreimg-card-surface-light.moreimg-card-overlay-soft_dark .moreimg-card-title,.moreimg-card-surface-light.moreimg-card-overlay-soft_dark .moreimg-card-subtitle,.moreimg-card-surface-light.moreimg-card-overlay-soft_dark .moreimg-card-point,.moreimg-card-surface-light.moreimg-card-overlay-soft_dark .moreimg-card-summary{color:#f8faf7;text-shadow:0 1px 8px rgba(0,0,0,.3)}
    `;

    const getCardTextDensity = (card) => {
      const titleLength = [...String(card?.title || '')].length;
      const subtitleLength = [...String(card?.subtitle || '')].length;
      const points = Array.isArray(card?.points) ? card.points : [];
      const pointLength = points.reduce((total, point) => total + [...String(point || '')].length, 0);
      const summaryLength = [...String(card?.summary || '')].length;
      const longestPoint = points.reduce((longest, point) => Math.max(longest, [...String(point || '')].length), 0);
      const score = titleLength * 2 + subtitleLength + pointLength + summaryLength + points.length * 8;

      if (card?.type === 'body' && (score > 126 || titleLength > 18 || points.length >= 5 && longestPoint > 21)) return 'extra-dense';
      if (card?.type === 'body' && (score > 92 || titleLength > 14 || points.length >= 5 || longestPoint > 24)) return 'dense';
      if (card?.type === 'cover' && titleLength + subtitleLength + summaryLength > 54) return 'dense';
      if (card?.type === 'back' && titleLength + summaryLength > 34) return 'dense';
      return 'standard';
    };

    const getDefaultCardFocus = (card) => card?.type === 'back' ? 42 : card?.type === 'body' ? 54 : 58;

    const HtmlCard = ({ card, imageUrl, cardRef, styleLock, focusY }) => {
      const presentation = getCardShellPresentation(styleLock);
      const density = getCardTextDensity(card);
      const resolvedFocusY = Number.isFinite(Number(focusY)) ? Number(focusY) : getDefaultCardFocus(card);
      return (
      <div ref={cardRef} style={{ ...presentation.style, '--moreimg-card-focus-y': `${resolvedFocusY}%` }} className={`moreimg-export-card moreimg-card-${card.type} moreimg-card-density-${density} ${presentation.className}`}>
        <div className="moreimg-card-media">
          {imageUrl ? <img src={imageUrl} alt="" decoding="async" /> : <div className="moreimg-card-visual-placeholder"></div>}
        </div>
        <div className="moreimg-card-shade"></div>
        <div className="moreimg-card-noise"></div>
        <div className="moreimg-card-content">
          {card.type === 'back' ? (
            <>
              <div className="moreimg-card-kicker"><span className="moreimg-card-kicker-mark" aria-hidden="true"></span>{card.label}</div>
              <div className="moreimg-card-back-copy">
                <h3 className="moreimg-card-title">{card.title || '未识别到总结'}</h3>
                {card.summary && <div className="moreimg-card-summary">{card.summary}</div>}
              </div>
            </>
          ) : (
            <>
              <div className="moreimg-card-header">
                <div className="moreimg-card-kicker"><span className="moreimg-card-kicker-mark" aria-hidden="true"></span>{card.label}</div>
                <h3 className="moreimg-card-title">{card.title || '未识别到标题'}</h3>
                {card.subtitle && <div className="moreimg-card-subtitle">{card.subtitle}</div>}
              </div>
              {card.points.length > 0 && (
                <div className="moreimg-card-points">
                  {card.points.map((point, index) => (
                    <div key={index} className="moreimg-card-point"><span className="moreimg-card-point-index">{String(index + 1).padStart(2, '0')}</span>{point}</div>
                  ))}
                </div>
              )}
              {card.summary && <div className="moreimg-card-summary">{card.summary}</div>}
            </>
          )}
        </div>
      </div>
      );
    };

    const HtmlCardPreview = ({ children }) => {
      const frameRef = useRef(null);
      useEffect(() => {
        loadExportFontStylesheet().catch(() => {});
        const frame = frameRef.current;
        if (!frame) return undefined;
        const updateScale = (width) => {
          if (!width) return;
          frame.style.setProperty('--moreimg-preview-scale', String(Math.min(1, width / 1242)));
        };
        updateScale(frame.clientWidth);
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(entries => updateScale(entries[0]?.contentRect?.width));
        observer.observe(frame);
        return () => observer.disconnect();
      }, []);
      return (
        <div ref={frameRef} className="html-card-preview-frame">
          <div className="html-card-preview-scale">{children}</div>
        </div>
      );
    };

    const VisualPreview = ({ imageUrl, alt }) => {
      const [naturalSize, setNaturalSize] = useState(null);
      const isThreeByFour = naturalSize && Math.abs((naturalSize.width / naturalSize.height) - (3 / 4)) < 0.01;

      useEffect(() => setNaturalSize(null), [imageUrl]);

      return (
        <>
          <div className="visual-preview">
            <img
              src={imageUrl}
              alt={alt}
              className="visual-preview-image"
              decoding="async"
              onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            />
          </div>
          <div className="visual-preview-meta">
            <span><strong>预览框 3:4</strong> · 原图等比显示</span>
            {naturalSize && (
              <span className={isThreeByFour ? '' : 'visual-preview-meta-warning'}>
                原图 {naturalSize.width}×{naturalSize.height}{isThreeByFour ? '' : ' · 尺寸不匹配'}
              </span>
            )}
          </div>
        </>
      );
    };

    const handleTabListKeyDown = (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabList = event.currentTarget.closest('[role="tablist"]');
      if (!tabList) return;
      const tabs = [...tabList.querySelectorAll('[role="tab"]')].filter(tab => !tab.disabled);
      const currentIndex = tabs.indexOf(event.currentTarget);
      if (currentIndex < 0 || tabs.length < 2) return;

      event.preventDefault();
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : event.key === 'ArrowRight'
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    };

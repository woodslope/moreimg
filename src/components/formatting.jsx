    const Icon = React.memo(({ name, className = "", strokeWidth = 2, fill = "none", ...props }) => {
      const nodes = window.moreimgIcons?.[name] || [];
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={fill}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          data-icon-name={name}
          className={`shrink-0 ${className}`}
          {...props}
        >
          {nodes.map(([tag, attrs], index) => React.createElement(tag, { ...attrs, key: attrs.key || index }))}
        </svg>
      );
    });

    // =========================================================================
    // 全局统一 Markdown 渲染组件
    // =========================================================================
    const FormattedContent = ({ text }) => {
      if (!text) return null;
      const lines = text.split('\n');
      let isFirstNonEmpty = true;
      const isHeadingLine = (line = '') => /^#{1,4}\s+/.test(line.trimStart());
      const getAdjacentNonEmptyLine = (startIndex, direction) => {
        for (let index = startIndex + direction; index >= 0 && index < lines.length; index += direction) {
          if (lines[index].trim()) return lines[index];
        }
        return '';
      };

      return (
        <div className="text-slate-700 leading-relaxed">
          {lines.map((line, i) => {
            // 新增：过滤无用的 AI 过程话术与过渡文本
            const cleanLineForCheck = line.replace(/[*_]/g, '').trim();
            if (
              /^进入阶段\d[。.]?$/.test(cleanLineForCheck) ||
              /^卡片内容包生成完毕[，,]待转入视觉指令生产[。.]?$/.test(cleanLineForCheck) ||
              /^核查与精修说明[：:]/.test(cleanLineForCheck)
            ) {
              return null; // 直接静默拦截，不渲染到前端
            }

            const previousNonEmptyLine = getAdjacentNonEmptyLine(i, -1);
            const nextNonEmptyLine = getAdjacentNonEmptyLine(i, 1);

            // 标题自身已经拥有上下间距，相邻空行不再重复占位。
            if (line.trim() === '') {
              if (isHeadingLine(previousNonEmptyLine) || isHeadingLine(nextNonEmptyLine)) return null;
              return <div key={i} className="h-3"></div>;
            }

            // 修复：同时支持 **加粗** 和 *斜体* 解析
            const formatInline = (str) => {
              const parts = str.split(/(\*\*.*?\*\*|\*[^*]+\*)/g);
              return parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                  return <em key={index} className="italic text-slate-500">{part.slice(1, -1)}</em>;
                }
                return part;
              });
            };

            const isFirst = isFirstNonEmpty;
            isFirstNonEmpty = false;
            const trimmedLine = line.trimStart();
            const followsPrimaryTitle = /^#\s+/.test(previousNonEmptyLine.trimStart());
            const precedesSubtitle = /^##\s+/.test(nextNonEmptyLine.trimStart());

            // 新增：处理一级标题 #
            if (trimmedLine.startsWith('# ')) {
              return (
                <h1 key={i} className={`text-[24px] font-black text-slate-900 tracking-tight ${precedesSubtitle ? 'mb-3' : 'mb-5'} ${isFirst ? 'mt-0' : 'mt-10'}`}>
                  {formatInline(trimmedLine.replace('# ', ''))}
                </h1>
              );
            }

            if (trimmedLine.startsWith('## ')) {
              return (
                <h2 key={i} className={`text-[20px] font-extrabold text-slate-900 ${followsPrimaryTitle ? 'mb-6' : 'mb-4'} ${isFirst || followsPrimaryTitle ? 'mt-0' : 'mt-8'}`}>
                  {formatInline(trimmedLine.replace('## ', ''))}
                </h2>
              );
            }

            if (trimmedLine.startsWith('### ')) {
              return (
                <h3 key={i} className={`text-[16px] font-bold text-slate-800 mb-3 ${isFirst ? 'mt-0' : 'mt-6'}`}>
                  {formatInline(trimmedLine.replace('### ', ''))}
                </h3>
              );
            }

            if (trimmedLine.startsWith('#### ')) {
              return (
                <h4 key={i} className={`text-[15px] font-semibold text-slate-800 mb-2.5 ${isFirst ? 'mt-0' : 'mt-5'}`}>
                  {formatInline(trimmedLine.replace('#### ', ''))}
                </h4>
              );
            }

            if (trimmedLine.match(/^[-•*]\s+/)) {
              return (
                <div key={i} className="flex mb-2.5 items-start">
                  <span className="mr-2.5 text-indigo-400 font-bold mt-[1px] shrink-0 text-[14px]">•</span>
                  <span className="text-[14px] leading-relaxed flex-1">
                    {formatInline(trimmedLine.replace(/^[-•*]\s+/, ''))}
                  </span>
                </div>
              );
            }

            const olMatch = trimmedLine.match(/^(\d+\.)\s+(.*)/);
            if (olMatch) {
              return (
                <div key={i} className="flex mb-2.5 items-start">
                  <span className="mr-2 text-indigo-500 font-mono font-bold text-[13px] mt-[2px] shrink-0 w-4 text-right">
                    {olMatch[1]}
                  </span>
                  <span className="text-[14px] leading-relaxed flex-1">
                    {formatInline(olMatch[2])}
                  </span>
                </div>
              );
            }

            if (trimmedLine.match(/^[-*_]{3,}$/)) {
              return <hr key={i} className="my-6 border-slate-200/60" />;
            }

            return (
              <p key={i} className="mb-3 text-[14px] leading-relaxed last:mb-0">
                {formatInline(trimmedLine)}
              </p>
            );
          })}
        </div>
      );
    };

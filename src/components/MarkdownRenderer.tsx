import React, { useMemo, useRef } from 'react';
import { marked } from 'marked';
import { getLanguageTheme } from '../utils/languageThemes';
import { renderHighlightedCodeToHtml } from '../utils/codeHighlighter';
import { parseAndRenderMath } from '../utils/mathRenderer';
import { cleanGeminiReply } from '../utils/geminiClient';

interface MarkdownRendererProps {
  content: string;
  darkMode?: boolean;
  className?: string;
  isUser?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  darkMode = true,
  className = '',
  isUser = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rawHtml = useMemo(() => {
    try {
      // Step 0: Pre-process and intercept any raw JSON action or image generation responses
      const sanitizedContent = cleanGeminiReply(content);

      // Step 1: Pre-process and render KaTeX math formulas (equations, inline math, and formulations)
      const mathResult = parseAndRenderMath(sanitizedContent);
      const textToParse = mathResult.html || sanitizedContent;

      const renderer = new marked.Renderer();

      // Custom image renderer with frosted frame, lazy loading, and error fallback
      renderer.image = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
        const altText = text || title || 'Visual asset';
        return `<div class="my-3 rounded-2xl overflow-hidden border ${
          darkMode ? 'border-white/10 bg-slate-950/60 shadow-2xl' : 'border-slate-200 bg-white/80 shadow-md'
        } p-1.5 transition-all duration-200 group"><div class="relative overflow-hidden rounded-xl flex items-center justify-center ${
          darkMode ? 'bg-slate-900/60' : 'bg-slate-100/80'
        }"><img src="${href}" alt="${altText}" loading="lazy" class="w-full max-h-[520px] object-contain rounded-xl transition duration-300 hover:scale-[1.01]" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'p-4 text-xs text-amber-400 bg-amber-950/20 rounded-xl border border-amber-500/30 flex items-center gap-2\\'><span>⚠️</span><span>Visual asset could not be loaded.</span></div>';" /></div>${
          altText ? `<div class="px-3 py-1.5 text-[11px] font-mono text-center truncate ${darkMode ? 'text-slate-400' : 'text-slate-600'}">${altText}</div>` : ''
        }</div>`;
      };

      // Custom code block renderer with clean top bar, OneNote palette, and VS Code syntax highlighting
      renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
        const escapedCode = encodeURIComponent(text);
        const langTheme = getLanguageTheme(lang);
        const languageLabel = (lang ? langTheme.name : 'CODE').toUpperCase();
        const highlightedHtml = renderHighlightedCodeToHtml(text, lang || 'python', darkMode);
        return `<div class="code-block-container my-2.5 rounded-xl overflow-hidden border ${
          darkMode
            ? 'bg-[#141722] border-slate-700/80 shadow-lg shadow-black/40'
            : 'bg-white border-slate-300 shadow-md shadow-slate-200/60'
        }"><div class="code-block-header px-3 py-1.5 flex items-center justify-between text-[11px] font-mono border-b ${
          darkMode ? 'border-white/5 bg-[#181d2a] text-slate-300' : 'border-slate-200 bg-slate-100/90 text-slate-700'
        }"><div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full inline-block" style="background-color: ${langTheme.dotColor}; box-shadow: 0 0 6px ${langTheme.dotColor};"></span><span class="font-bold tracking-wider text-[10px]" style="color: ${langTheme.dotColor};">${languageLabel}</span></div><button type="button" data-copy-code="${escapedCode}" class="copy-code-btn px-2 py-0.5 rounded text-[10px] ${
          darkMode ? 'bg-white/5 hover:bg-white/15 text-slate-300' : 'bg-black/5 hover:bg-black/10 text-slate-700'
        } transition cursor-pointer flex items-center gap-1 font-mono"><span>Copy</span></button></div><pre class="p-3.5 text-xs font-mono overflow-x-auto leading-relaxed m-0" style="tab-size: 4;"><code>${highlightedHtml}</code></pre></div>`;
      };

      const parsed = marked.parse(textToParse, {
        gfm: true,
        breaks: true,
        async: false,
        renderer,
      }) as string;
      return parsed;
    } catch {
      return content;
    }
  }, [content, darkMode]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('[data-copy-code]') as HTMLElement | null;
    if (target) {
      const encoded = target.getAttribute('data-copy-code');
      if (encoded) {
        const text = decodeURIComponent(encoded);
        navigator.clipboard.writeText(text);
        const originalText = target.innerText;
        target.innerText = 'Copied!';
        target.classList.add('text-emerald-400');
        setTimeout(() => {
          target.innerText = originalText;
          target.classList.remove('text-emerald-400');
        }, 2000);
      }
    }
  };

  if (isUser) {
    return (
      <div
        ref={containerRef}
        onClick={handleClick}
        className={`markdown-body user-bubble text-xs sm:text-sm leading-relaxed text-white !text-white ${className}`}
        style={{ color: '#ffffff' }}
        dangerouslySetInnerHTML={{ __html: rawHtml }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`markdown-body ${
        darkMode ? 'markdown-dark' : 'markdown-light'
      } text-xs sm:text-sm leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: rawHtml }}
    />
  );
};

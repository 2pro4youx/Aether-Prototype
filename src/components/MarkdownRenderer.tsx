import React, { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import { getLanguageTheme } from '../utils/languageThemes';
import { renderHighlightedCodeToHtml } from '../utils/codeHighlighter';
import { renderKatex, normalizeMathExpression } from '../utils/mathRenderer';
import { cleanGeminiReply } from '../utils/geminiClient';

interface MarkdownRendererProps {
  content: string;
  darkMode?: boolean;
  className?: string;
  isUser?: boolean;
}

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'button',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const DROP_WITH_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'textarea',
  'select',
  'option',
  'meta',
  'link',
  'base',
  'noscript',
  'template',
  'svg',
  'math',
  'frame',
  'frameset',
]);

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(rawUrl: string | null | undefined, allowRasterDataImage = false): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  // Strip ASCII control characters and whitespace tricks (e.g. java\tscript:)
  const cleaned = rawUrl.replace(/[\u0000-\u001F\u007F]+/g, '').trim();
  if (!cleaned) return '';

  // Allow relative paths and anchors
  if (cleaned.startsWith('/') || cleaned.startsWith('#') || cleaned.startsWith('./') || cleaned.startsWith('../')) {
    return cleaned;
  }

  if (allowRasterDataImage) {
    if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-zA-Z0-9+/=\s]+$/i.test(cleaned)) {
      return cleaned;
    }
  }

  try {
    const parsed = new URL(cleaned, 'https://aether.local');
    if (
      parsed.protocol === 'https:' ||
      parsed.protocol === 'http:' ||
      (!allowRasterDataImage && parsed.protocol === 'mailto:')
    ) {
      return cleaned;
    }
  } catch {
    return '';
  }

  return '';
}

function sanitizeInlineStyle(styleValue: string): string {
  const lower = styleValue.toLowerCase();
  if (
    lower.includes('url(') ||
    lower.includes('expression(') ||
    lower.includes('javascript:') ||
    lower.includes('@import') ||
    lower.includes('behavior:')
  ) {
    return '';
  }
  return styleValue;
}

function sanitizeRenderedHtml(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const walkAndSanitize = (root: ParentNode) => {
    const children = Array.from(root.childNodes);
    for (const node of children) {
      if (node.nodeType === Node.COMMENT_NODE) {
        node.parentNode?.removeChild(node);
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (DROP_WITH_CONTENT_TAGS.has(tag)) {
        el.remove();
        continue;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap unknown tags safely into their sanitized text/children
        walkAndSanitize(el);
        const frag = doc.createDocumentFragment();
        while (el.firstChild) {
          frag.appendChild(el.firstChild);
        }
        el.replaceWith(frag);
        continue;
      }

      // Only allow our internal copy-code button; strip arbitrary buttons
      if (tag === 'button' && !el.hasAttribute('data-copy-code')) {
        el.remove();
        continue;
      }

      // Inspect and sanitize attributes
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value;

        // Strip all inline event handlers (onclick, onerror, onload, etc.)
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }

        if (name === 'href') {
          const safeHref = sanitizeUrl(val, false);
          if (!safeHref) {
            el.removeAttribute(attr.name);
          } else {
            el.setAttribute('href', safeHref);
            if (/^https?:/i.test(safeHref)) {
              el.setAttribute('target', '_blank');
              el.setAttribute('rel', 'noopener noreferrer nofollow');
            }
          }
          continue;
        }

        if (name === 'src') {
          if (tag !== 'img') {
            el.removeAttribute(attr.name);
            continue;
          }
          const safeSrc = sanitizeUrl(val, true);
          if (!safeSrc) {
            el.remove();
            break;
          } else {
            el.setAttribute('src', safeSrc);
          }
          continue;
        }

        if (name === 'style') {
          const safeStyle = sanitizeInlineStyle(val);
          if (safeStyle) {
            el.setAttribute('style', safeStyle);
          } else {
            el.removeAttribute('style');
          }
          continue;
        }

        // Strict attribute allowlist
        const isAllowedAttr =
          name === 'class' ||
          name === 'title' ||
          name === 'alt' ||
          name === 'loading' ||
          name === 'target' ||
          name === 'rel' ||
          name === 'type' ||
          name === 'colspan' ||
          name === 'rowspan' ||
          name === 'align' ||
          name === 'start' ||
          name === 'open' ||
          name === 'data-copy-code' ||
          name === 'data-md-img' ||
          name === 'aria-label' ||
          name === 'aria-hidden';

        if (!isAllowedAttr) {
          el.removeAttribute(attr.name);
        }
      }

      if (el.isConnected) {
        walkAndSanitize(el);
      }
    }
  };

  walkAndSanitize(doc.body);
  return doc.body.innerHTML;
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

      // Step 1: Protect math blocks ($$...$$ and $...$) with placeholders so marked parses markdown cleanly
      const mathBlocks: string[] = [];
      const mathInlines: string[] = [];

      let textToParse = sanitizedContent;

      // Extract block math: $$...$$
      textToParse = textToParse.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
        const normalized = normalizeMathExpression(math);
        const rendered = renderKatex(normalized, true);
        mathBlocks.push(`<div class="katex-block-wrapper my-2.5 flex justify-center overflow-x-auto py-1 select-text">${rendered}</div>`);
        return `\n\nKATEXBLOCKPLACEHOLDER${mathBlocks.length - 1}TOKEN\n\n`;
      });

      // Extract inline math: $...$
      textToParse = textToParse.replace(/(?<!\\)\$(?!\s)([^\$\n]+?)(?<!\s)\$(?!\$)/g, (_, math) => {
        const normalized = normalizeMathExpression(math);
        const rendered = renderKatex(normalized, false);
        mathInlines.push(`<span class="katex-inline-wrapper mx-0.5 select-text">${rendered}</span>`);
        return `KATEXINLINEPLACEHOLDER${mathInlines.length - 1}TOKEN`;
      });

      const renderer = new marked.Renderer();

      // Custom link renderer enforcing safe URL protocols and noopener/noreferrer
      renderer.link = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
        const safeHref = sanitizeUrl(href, false);
        if (!safeHref) {
          return `<span>${text}</span>`;
        }
        const safeTitle = title ? ` title="${escapeHtml(title)}"` : '';
        const isExternal = /^https?:/i.test(safeHref);
        const externalAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer nofollow"' : '';
        return `<a href="${escapeHtml(safeHref)}"${safeTitle}${externalAttrs}>${text}</a>`;
      };

      // Custom image renderer with frosted frame, lazy loading, safe URL validation, and zero inline scripts
      renderer.image = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
        const safeHref = sanitizeUrl(href, true);
        const altText = escapeHtml(text || title || 'Visual asset');
        if (!safeHref) {
          return `<div class="my-3 p-3 text-xs text-amber-400 bg-amber-950/20 rounded-xl border border-amber-500/30">Visual asset URL blocked for security.</div>`;
        }
        return `<div class="my-3 rounded-2xl overflow-hidden border ${
          darkMode ? 'border-white/10 bg-slate-950/60 shadow-2xl' : 'border-slate-200 bg-white/80 shadow-md'
        } p-1.5 transition-all duration-200 group"><div class="relative overflow-hidden rounded-xl flex items-center justify-center ${
          darkMode ? 'bg-slate-900/60' : 'bg-slate-100/80'
        }"><img data-md-img="1" src="${escapeHtml(safeHref)}" alt="${altText}" loading="lazy" class="w-full max-h-[520px] object-contain rounded-xl transition duration-300 hover:scale-[1.01]" /></div>${
          altText ? `<div class="px-3 py-1.5 text-[11px] font-mono text-center truncate ${darkMode ? 'text-slate-400' : 'text-slate-600'}">${altText}</div>` : ''
        }</div>`;
      };

      // Custom code block renderer with clean top bar, OneNote palette, and VS Code syntax highlighting
      renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
        const escapedCode = escapeHtml(encodeURIComponent(text));
        const langTheme = getLanguageTheme(lang);
        const languageLabel = escapeHtml((lang ? langTheme.name : 'CODE').toUpperCase());
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

      const parsedRaw = marked.parse(textToParse, {
        gfm: true,
        breaks: true,
        async: false,
        renderer,
      }) as string;

      // Step 2: Sanitize all Markdown-produced HTML before restoring trusted KaTeX tokens
      let parsed = sanitizeRenderedHtml(parsedRaw);

      // Step 3: Restore KaTeX HTML (rendered with trust: false) from placeholders
      parsed = parsed.replace(/<p>\s*KATEXBLOCKPLACEHOLDER(\d+)TOKEN\s*<\/p>/g, (_, idx) => {
        const i = parseInt(idx, 10);
        return mathBlocks[i] || '';
      });
      parsed = parsed.replace(/KATEXBLOCKPLACEHOLDER(\d+)TOKEN/g, (_, idx) => {
        const i = parseInt(idx, 10);
        return mathBlocks[i] || '';
      });
      parsed = parsed.replace(/KATEXINLINEPLACEHOLDER(\d+)TOKEN/g, (_, idx) => {
        const i = parseInt(idx, 10);
        return mathInlines[i] || '';
      });

      return parsed;
    } catch {
      return escapeHtml(content).replace(/\n/g, '<br />');
    }
  }, [content, darkMode]);

  // Attach CSP-safe image error fallback handlers without inline JS attributes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const images = Array.from(container.querySelectorAll<HTMLImageElement>('img[data-md-img]'));
    const handlers: Array<{ img: HTMLImageElement; fn: () => void }> = [];

    for (const img of images) {
      const onError = () => {
        const parent = img.parentElement;
        if (!parent) return;
        const fallback = document.createElement('div');
        fallback.className =
          'p-4 text-xs text-amber-400 bg-amber-950/20 rounded-xl border border-amber-500/30 flex items-center gap-2';
        fallback.textContent = 'Visual asset could not be loaded.';
        parent.replaceChildren(fallback);
      };
      img.addEventListener('error', onError, { once: true });
      handlers.push({ img, fn: onError });
    }

    return () => {
      for (const { img, fn } of handlers) {
        img.removeEventListener('error', fn);
      }
    };
  }, [rawHtml]);

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

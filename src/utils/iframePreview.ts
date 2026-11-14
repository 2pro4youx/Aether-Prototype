/**
 * Utilities for converting base64 data URLs to Blob URLs and building themed iframe documents
 * so uploaded PDFs, images, and generated NotebookLM studio documents render cleanly inside <iframe>.
 */

export function dataUrlToBlobUrl(dataUrl?: string): string | null {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith('data:')) return dataUrl;
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function buildImageIframeDoc(
  src: string,
  title: string,
  darkMode: boolean
): string {
  const safeTitle = escapeHtml(title);
  const bg = darkMode ? '#090d16' : '#f1f5f9';
  const grid = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background-color: ${bg};
    background-image: linear-gradient(45deg, ${grid} 25%, transparent 25%),
      linear-gradient(-45deg, ${grid} 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, ${grid} 75%),
      linear-gradient(-45deg, transparent 75%, ${grid} 75%);
    background-size: 24px 24px;
    background-position: 0 0, 0 12px, 12px -12px, -12px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
  }
  img {
    max-width: 96%;
    max-height: 96%;
    object-fit: contain;
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  }
</style>
</head>
<body>
  <img src="${src}" alt="${safeTitle}" />
</body>
</html>`;
}

export function buildGeneratedMarkdownIframeDoc(
  title: string,
  markdown: string,
  darkMode: boolean,
  accentHex: string
): string {
  const safeTitle = escapeHtml(title);
  const bodyHtml = simpleMarkdownToHtml(markdown);
  const bg = darkMode ? '#0b1120' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#0f172a';
  const muted = darkMode ? '#94a3b8' : '#475569';
  const surface = darkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc';
  const border = darkMode ? 'rgba(255,255,255,0.12)' : '#e2e8f0';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: ${bg};
    color: ${text};
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.7;
    font-size: 14px;
  }
  .page {
    max-width: 800px;
    margin: 0 auto;
    padding: 28px 32px 48px;
  }
  .doc-header {
    border-bottom: 1px solid ${border};
    padding-bottom: 14px;
    margin-bottom: 22px;
  }
  .doc-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 999px;
    background: ${accentHex}22;
    color: ${accentHex};
    border: 1px solid ${accentHex}55;
    margin-bottom: 8px;
  }
  h1.doc-title {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: ${text};
  }
  h1, h2, h3, h4 {
    color: ${text};
    margin-top: 1.4em;
    margin-bottom: 0.5em;
    line-height: 1.3;
  }
  h2 { font-size: 17px; border-bottom: 1px solid ${border}; padding-bottom: 4px; color: ${accentHex}; }
  h3 { font-size: 15px; }
  p { margin: 0.7em 0; }
  ul, ol { padding-left: 1.5em; margin: 0.7em 0; }
  li { margin: 0.3em 0; }
  blockquote {
    margin: 1em 0;
    padding: 10px 14px;
    border-left: 3px solid ${accentHex};
    background: ${surface};
    color: ${muted};
    border-radius: 0 8px 8px 0;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    background: ${surface};
    padding: 2px 6px;
    border-radius: 5px;
    border: 1px solid ${border};
  }
  pre {
    background: ${surface};
    padding: 14px;
    border-radius: 10px;
    border: 1px solid ${border};
    overflow-x: auto;
  }
  pre code { border: none; padding: 0; background: none; }
  hr { border: none; border-top: 1px solid ${border}; margin: 1.5em 0; }
  strong { color: ${darkMode ? '#ffffff' : '#020617'}; font-weight: 700; }
</style>
</head>
<body>
  <article class="page">
    <header class="doc-header">
      <div class="doc-badge">NotebookLM Generated Document</div>
      <h1 class="doc-title">${safeTitle}</h1>
    </header>
    ${bodyHtml}
  </article>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(line: string): string {
  let out = escapeHtml(line);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

function simpleMarkdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const html: string[] = [];
  let inCode = false;
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine;
    if (line.trim().startsWith('```')) {
      closeLists();
      if (!inCode) {
        inCode = true;
        html.push('<pre><code>');
      } else {
        inCode = false;
        html.push('</code></pre>');
      }
      continue;
    }
    if (inCode) {
      html.push(escapeHtml(line) + '\n');
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      closeLists();
      html.push('<hr />');
      continue;
    }
    const hMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (hMatch) {
      closeLists();
      const level = hMatch[1].length;
      html.push(`<h${level}>${formatInlineMarkdown(hMatch[2])}</h${level}>`);
      continue;
    }
    if (trimmed.startsWith('> ')) {
      closeLists();
      html.push(`<blockquote>${formatInlineMarkdown(trimmed.slice(2))}</blockquote>`);
      continue;
    }
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${formatInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${formatInlineMarkdown(olMatch[1])}</li>`);
      continue;
    }
    closeLists();
    html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
  }

  closeLists();
  if (inCode) html.push('</code></pre>');
  return html.join('\n');
}

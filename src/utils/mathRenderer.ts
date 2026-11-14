import katex from 'katex';

export interface MathPreset {
  name: string;
  category: string;
  latex: string;
  description: string;
}

export const MATH_PRESETS: MathPreset[] = [
  {
    name: 'Attention Mechanism',
    category: 'Deep Learning',
    latex: '\\operatorname{Attention}(Q, K, V) = \\operatorname{Softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V',
    description: 'Scaled Dot-Product Attention from Attention Is All You Need',
  },
  {
    name: 'Cross-Entropy Loss',
    category: 'Deep Learning',
    latex: '\\mathcal{L}_{\\mathrm{CE}} = -\\sum_{i=1}^C y_i \\log(\\hat{y}_i)',
    description: 'Multi-class classification loss function',
  },
  {
    name: 'Normal Distribution',
    category: 'Probability',
    latex: 'f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} \\exp\\left( -\\frac{(x - \\mu)^2}{2\\sigma^2} \\right)',
    description: 'Gaussian probability density function',
  },
  {
    name: 'Quadratic Formula',
    category: 'Algebra',
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    description: 'Solutions to standard quadratic equation ax^2 + bx + c = 0',
  },
  {
    name: "Euler's Identity",
    category: 'Complex Analysis',
    latex: 'e^{i\\pi} + 1 = 0',
    description: 'Profound link between 5 fundamental mathematical constants',
  },
  {
    name: 'Fourier Transform',
    category: 'Calculus',
    latex: '\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\, e^{-2\\pi i x \\xi} \\, dx',
    description: 'Continuous spectral frequency decomposition',
  },
  {
    name: 'Gradient Descent Update',
    category: 'Optimization',
    latex: '\\theta_{t+1} = \\theta_t - \\eta \\, \\nabla_\\theta \\mathcal{L}(\\theta_t)',
    description: 'First-order iterative parameter optimization',
  },
];

/**
 * Normalizes user-friendly math input into KaTeX-compatible LaTeX.
 * Handles conversions like sqrt(x) -> \sqrt{x}, Softmax -> \operatorname{Softmax}, * -> \cdot.
 */
export function normalizeMathExpression(raw: string): string {
  let tex = raw.trim();
  if (!tex) return '';

  // If already full LaTeX, do minimal cleanup
  if (tex.includes('\\frac') || tex.includes('\\sum') || tex.includes('\\int')) {
    return tex;
  }

  // Handle sqrt(...)
  tex = tex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');

  // Convert * to \cdot
  tex = tex.replace(/\s*\*\s*/g, ' \\cdot ');

  // Common function names that should not be rendered as product of variables
  const mathFunctions = [
    'Attention',
    'attention',
    'Softmax',
    'softmax',
    'Sigmoid',
    'sigmoid',
    'ReLU',
    'relu',
    'GELU',
    'gelu',
    'argmax',
    'argmin',
    'Var',
    'Cov',
    'diag',
  ];

  for (const fn of mathFunctions) {
    const regex = new RegExp(`\\b${fn}\\b`, 'g');
    tex = tex.replace(regex, `\\operatorname{${fn}}`);
  }

  // Convert simple fractions (A) / (B) or A / B
  tex = tex.replace(/\(([^()]+)\)\s*\/\s*(\([^)()]+\)|\\sqrt\{[^}]+\}|\w+)/g, '\\frac{$1}{$2}');

  return tex;
}

/**
 * Safely renders LaTeX to HTML using KaTeX.
 */
export function renderKatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'htmlAndMathml',
    });
  } catch (err) {
    const escaped = (latex || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<span class="katex-error font-mono text-xs text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded">${escaped}</span>`;
  }
}

/**
 * Parses markdown/plain-text containing inline $math$ or block $$math$$
 * and replaces with rendered KaTeX HTML.
 */
export function parseAndRenderMath(text: string): { hasMath: boolean; html: string } {
  if (!text) return { hasMath: false, html: '' };

  let hasMath = false;

  // 1. Process block math: $$...$$
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    hasMath = true;
    const normalized = normalizeMathExpression(math);
    return `<div class="katex-block-wrapper my-2.5 flex justify-center overflow-x-auto py-1 select-text">${renderKatex(normalized, true)}</div>`;
  });

  // 2. Process inline math: $...$ (ensure not preceded/followed by another $)
  processed = processed.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)(?<!\$)\$(?!\$)/g, (_, math) => {
    hasMath = true;
    const normalized = normalizeMathExpression(math);
    return `<span class="katex-inline-wrapper mx-0.5 select-text">${renderKatex(normalized, false)}</span>`;
  });

  // 3. Auto-detect plain-text formula ONLY on single isolated short lines (never multi-paragraph text)
  if (!hasMath && !text.includes('\n') && text.length < 140 && text.includes('=')) {
    const isMathFormulation =
      text.includes('^') ||
      text.includes('sqrt(') ||
      /\b(Attention|Softmax|ReLU|Sigmoid|arg(min|max))\s*\(/i.test(text);

    if (isMathFormulation) {
      const colonIdx = text.indexOf(':');
      if (colonIdx > 0 && colonIdx < 40) {
        const prefix = text.slice(0, colonIdx + 1);
        const formula = text.slice(colonIdx + 1).trim();
        hasMath = true;
        const normalized = normalizeMathExpression(formula);
        return {
          hasMath: true,
          html: `${escapeHtml(prefix)} <span class="katex-inline-wrapper ml-1 inline-block align-middle select-text">${renderKatex(normalized, false)}</span>`,
        };
      }
    }
  }

  return { hasMath, html: processed };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlPreservingTags(str: string): string {
  // KaTeX generated HTML contains <span class="katex">...</span>
  // We only escape text outside of katex tags
  return str;
}

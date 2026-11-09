import { ColorPalette, CursorStyleId } from '../types';

export type { CursorStyleId };

export interface CursorOption {
  id: CursorStyleId;
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  hotspot: [number, number];
}

export const CURSOR_OPTIONS: CursorOption[] = [
  {
    id: 'chevron',
    name: 'Chevron Arrow',
    subtitle: 'Smooth Precision',
    description: 'Crisp custom stemless arrow pointer with dynamic theme gradient adaptation and smooth physics.',
    badge: 'Smooth Precision',
    hotspot: [5, 3],
  },
  {
    id: 'arrow',
    name: 'Default OS',
    subtitle: 'System Pointer',
    description: 'Standard operating system hardware pointer with native browser hover states.',
    badge: 'System Default',
    hotspot: [0, 0],
  },
  {
    id: 'circle',
    name: 'Circle',
    subtitle: 'Precision Ring',
    description: 'Minimalist hollow circular ring offering clean, unobstructed focus.',
    badge: 'Hollow Ring',
    hotspot: [16, 16],
  },
  {
    id: 'crosshair',
    name: 'Crosshair',
    subtitle: 'Orthogonal +',
    description: 'Slender, thin geometric plus (+) crosshair with a single white base.',
    badge: 'Thin +',
    hotspot: [16, 16],
  },
  {
    id: 'cross',
    name: 'Cross',
    subtitle: '45° Diagonal ✕',
    description: 'Precision cross rotated 45 degrees for diagonal drafting and target alignment.',
    badge: 'Diagonal ✕',
    hotspot: [16, 16],
  },
  {
    id: 'pen',
    name: 'Pen',
    subtitle: 'Editorial Stylus',
    description: 'Calligraphic drafting stylus angled at 45° with a razor-sharp nib hotspot.',
    badge: 'Stylus Nib',
    hotspot: [2, 2],
  },
];

export function normalizeCursorStyle(style: CursorStyleId): 'arrow' | 'chevron' | 'circle' | 'crosshair' | 'cross' | 'pen' {
  if (style === 'chevron') return 'chevron';
  if (style === 'arrow') return 'arrow';
  if (style === 'default') return 'arrow';
  if (style === 'white-circle' || style === 'circle') return 'circle';
  if (style === 'white-plus' || style === 'white-crosshair' || style === 'crosshair') return 'crosshair';
  if (style === 'white-cross' || style === 'cross') return 'cross';
  if (style === 'white-pen' || style === 'pen') return 'pen';
  return 'chevron';
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 255,
      parseInt(clean[1] + clean[1], 16) || 255,
      parseInt(clean[2] + clean[2], 16) || 255,
    ];
  }
  return [
    parseInt(clean.substring(0, 2), 16) || 255,
    parseInt(clean.substring(2, 4), 16) || 255,
    parseInt(clean.substring(4, 6), 16) || 255,
  ];
}

export function interpolateRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  factor: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, factor));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * clamped),
    Math.round(c1[1] + (c2[1] - c1[1]) * clamped),
    Math.round(c1[2] + (c2[2] - c1[2]) * clamped),
  ];
}

export function rgbToString(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function getCursorGradient(palette: ColorPalette, adapterPercent: number): {
  color1: string;
  color2: string;
  cssGradient: string;
  rgb1: [number, number, number];
  rgb2: [number, number, number];
} {
  const factor = adapterPercent / 100;
  const white: [number, number, number] = [255, 255, 255];
  const primaryRgb = hexToRgb(palette.primary);
  const accentRgb = hexToRgb(palette.accent);

  const rgb1 = interpolateRgb(white, primaryRgb, factor);
  const rgb2 = interpolateRgb(white, accentRgb, factor);

  const color1 = rgbToString(rgb1);
  const color2 = rgbToString(rgb2);

  return {
    color1,
    color2,
    rgb1,
    rgb2,
    cssGradient: `linear-gradient(135deg, ${color1}, ${color2})`,
  };
}

export function generateCursorSvg(
  style: CursorStyleId,
  color1: string = 'var(--cursor-color-1, #ffffff)',
  color2: string = 'var(--cursor-color-2, #ffffff)'
): string {
  const norm = normalizeCursorStyle(style);
  const gradId = `cursorGrad_${norm}`;

  const gradDef = `
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}"/>
        <stop offset="100%" stop-color="${color2}"/>
      </linearGradient>
    </defs>`;

  if (norm === 'arrow') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
      <!-- Soft drop shadow -->
      <path d="M4 2 L4 18.5 L8.2 14.8 L11.2 21.8 L13.7 20.6 L10.8 13.8 L16 13.8 Z" fill="#000000" fill-opacity="0.35" transform="translate(1, 1.5)"/>
      <!-- Classic OS Hardware Pointer -->
      <path d="M4 2 L4 18.5 L8.2 14.8 L11.2 21.8 L13.7 20.6 L10.8 13.8 L16 13.8 Z" fill="#ffffff" stroke="#050811" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }

  if (norm === 'chevron') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">${gradDef}
      <!-- Soft drop shadow -->
      <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86c-.32-.32-.85-.1-.85.35z" fill="#050811" fill-opacity="0.35" transform="translate(1, 1.5)"/>
      <!-- Custom stemless arrow pointer: vertical left edge, solid white / dynamic theme fill, crisp dark border -->
      <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86c-.32-.32-.85-.1-.85.35z" fill="url(#${gradId})" stroke="#050811" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  if (norm === 'circle') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${gradDef}
      <!-- High contrast dark backing -->
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#050811" stroke-width="3.2" stroke-opacity="0.75"/>
      <!-- Primary dynamic gradient ring -->
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="url(#${gradId})" stroke-width="1.8"/>
    </svg>`;
  }

  if (norm === 'crosshair') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <!-- Dark contrast backing lines for visibility on light/dark backgrounds -->
      <line x1="16" y1="8" x2="16" y2="24" stroke="#050811" stroke-width="2.8" stroke-linecap="square" stroke-opacity="0.8"/>
      <line x1="8" y1="16" x2="24" y2="16" stroke="#050811" stroke-width="2.8" stroke-linecap="square" stroke-opacity="0.8"/>

      <!-- Slender, thin precision plus with single cohesive white base (+ adapter tint) -->
      <line x1="16" y1="8" x2="16" y2="24" stroke="${color1}" stroke-width="1.2" stroke-linecap="square"/>
      <line x1="8" y1="16" x2="24" y2="16" stroke="${color1}" stroke-width="1.2" stroke-linecap="square"/>
    </svg>`;
  }

  if (norm === 'cross') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <g transform="rotate(45 16 16)">
        <!-- Dark contrast backing lines (45 deg diagonal cross) -->
        <line x1="16" y1="8" x2="16" y2="24" stroke="#050811" stroke-width="2.8" stroke-linecap="square" stroke-opacity="0.8"/>
        <line x1="8" y1="16" x2="24" y2="16" stroke="#050811" stroke-width="2.8" stroke-linecap="square" stroke-opacity="0.8"/>

        <!-- Slender, thin precision diagonal cross with single cohesive white base (+ adapter tint) -->
        <line x1="16" y1="8" x2="16" y2="24" stroke="${color1}" stroke-width="1.2" stroke-linecap="square"/>
        <line x1="8" y1="16" x2="24" y2="16" stroke="${color1}" stroke-width="1.2" stroke-linecap="square"/>
      </g>
    </svg>`;
  }

  if (norm === 'pen') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${gradDef}
      <g transform="translate(1, 1)">
        <!-- High contrast dark backing shadow -->
        <path d="M1 1 L8 4 L5 7 Z" fill="#050811" fill-opacity="0.75"/>
        <path d="M8 4 L5 7 L8 10 L11 7 Z" fill="#050811" fill-opacity="0.75"/>
        <path d="M8 10 L11 7 L23 19 L20 22 Z" fill="#050811" fill-opacity="0.75"/>
        <path d="M23 19 L20 22 L24 26 L27 23 Z" fill="#050811" fill-opacity="0.75"/>

        <!-- Pen Nib tip at (1, 1) + (1, 1) translate = (2, 2) -->
        <path d="M1 1 L7.5 3.8 L4.8 6.5 Z" fill="url(#${gradId})" stroke="#050811" stroke-width="0.8" stroke-linejoin="round"/>
        <!-- Stylus accent collar -->
        <path d="M7.5 3.8 L4.8 6.5 L7.8 9.5 L10.5 6.8 Z" fill="#ffffff" stroke="#050811" stroke-width="0.8" stroke-linejoin="round"/>
        <!-- Stylus barrel -->
        <path d="M7.8 9.5 L10.5 6.8 L22 18.3 L19.3 21 Z" fill="url(#${gradId})" stroke="#050811" stroke-width="0.8" stroke-linejoin="round"/>
        <!-- Stylus end cap -->
        <path d="M22 18.3 L19.3 21 L23 24.7 L25.7 22 Z" fill="#ffffff" stroke="#050811" stroke-width="0.8" stroke-linejoin="round"/>
        <!-- Nib slit line -->
        <line x1="1" y1="1" x2="4.8" y2="4.8" stroke="#050811" stroke-width="0.75"/>
      </g>
    </svg>`;
  }

  return '';
}

const STATIC_CURSOR_NONE = `
  *, *::before, *::after, html, body, input, textarea, [contenteditable="true"], button, a, [role="button"], select, canvas, div, span, label, p, h1, h2, h3, h4, h5, h6 {
    cursor: none !important;
  }
`;

export function getCursorCss(
  style: CursorStyleId,
  palette: ColorPalette,
  adapterPercent: number
): string {
  const norm = normalizeCursorStyle(style);

  // Default OS Pointer: use native hardware cursor without override
  if (norm === 'arrow') {
    return '';
  }

  // Smooth Chevron Arrow: physics-based cursor handled by SmoothCursor component, hide default pointer
  if (norm === 'chevron') {
    return STATIC_CURSOR_NONE;
  }

  const { color1, color2 } = getCursorGradient(palette, adapterPercent);
  const svg = generateCursorSvg(norm, color1, color2);
  if (!svg) return '';

  const option = CURSOR_OPTIONS.find((c) => c.id === norm);
  const [hx, hy] = option ? option.hotspot : (norm === 'pen' ? [2, 2] : [16, 16]);
  const encodedSvg = encodeURIComponent(svg.trim());
  const dataUri = `data:image/svg+xml,${encodedSvg}`;

  // Hard impose chosen custom cursor on EVERY single element without exception
  return `
    *, *::before, *::after, html, body, input, textarea, [contenteditable="true"], button, a, [role="button"], select, canvas, div, span, label, p, h1, h2, h3, h4, h5, h6 {
      cursor: url("${dataUri}") ${hx} ${hy}, auto !important;
    }
  `;
}

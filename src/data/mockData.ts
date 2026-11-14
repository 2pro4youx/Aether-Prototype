import {
  ColorPalette,
  CustomPaletteConfig,
  StudyDay,
  TaskItem,
  PlannerEntry,
  NotebookSource,
  OneNoteNotebook,
  LibraryItem,
  SubjectAnalytics,
  AuditLog,
  GeminiConversation,
  Workspace,
} from '../types';

export const PALETTES: ColorPalette[] = [
  {
    id: 'gold-obsidian',
    name: 'Imperial Gold & Obsidian',
    description: 'Bespoke crimson & auric gold with deep interstellar obsidian slate',
    primary: '#f59e0b',
    accent: '#dc2626',
    gradient: 'from-amber-500 via-amber-600 to-red-600',
    bgDark: '#090d16',
    textAccent: 'text-amber-400',
  },
  {
    id: 'crimson-velvet',
    name: 'Crimson Velvet',
    description: 'Deep ruby reds with rose gold highlights',
    primary: '#e11d48',
    accent: '#fb7185',
    gradient: 'from-rose-500 via-red-600 to-amber-500',
    bgDark: '#12070a',
    textAccent: 'text-rose-400',
  },
  {
    id: 'nordic-frost',
    name: 'Nordic Frost',
    description: 'Glacial cyan with crisp titanium blue',
    primary: '#06b6d4',
    accent: '#38bdf8',
    gradient: 'from-cyan-500 via-sky-600 to-blue-700',
    bgDark: '#071018',
    textAccent: 'text-cyan-400',
  },
  {
    id: 'emerald-solarium',
    name: 'Emerald Solarium',
    description: 'Botanical deep forest emerald with lime luminescence',
    primary: '#10b981',
    accent: '#34d399',
    gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
    bgDark: '#05130f',
    textAccent: 'text-emerald-400',
  },
  {
    id: 'cyberpunk-amber',
    name: 'Cyberpunk Amber',
    description: 'Electric cadmium amber with high-contrast sulfur neon',
    primary: '#eab308',
    accent: '#f97316',
    gradient: 'from-yellow-400 via-amber-500 to-orange-600',
    bgDark: '#141005',
    textAccent: 'text-yellow-400',
  },
  {
    id: 'midnight-sapphire',
    name: 'Midnight Sapphire',
    description: 'Deep royal ultramarine with celestial cobalt shimmer',
    primary: '#3b82f6',
    accent: '#6366f1',
    gradient: 'from-blue-500 via-indigo-600 to-violet-800',
    bgDark: '#070b19',
    textAccent: 'text-blue-400',
  },
  {
    id: 'travertine-minimal',
    name: 'Travertine Minimal',
    description: 'Warm editorial sandstone and ivory with rich terracotta red accents',
    primary: '#c84b31',
    accent: '#8e2820',
    gradient: 'from-amber-200 via-rose-600 to-red-800',
    bgDark: '#140c0b',
    textAccent: 'text-rose-400',
  },
  {
    id: 'amethyst-royal',
    name: 'Amethyst Royal',
    description: 'Deep astral purple with imperial orchid accents',
    primary: '#a855f7',
    accent: '#d946ef',
    gradient: 'from-purple-500 via-fuchsia-600 to-pink-600',
    bgDark: '#12081c',
    textAccent: 'text-purple-400',
  },
  {
    id: 'tokyo-neon',
    name: 'Tokyo Neon Dawn',
    description: 'Vibrant magenta paired with electric turquoise and gold',
    primary: '#ec4899',
    accent: '#14b8a6',
    gradient: 'from-pink-500 via-purple-600 to-teal-400',
    bgDark: '#0e0817',
    textAccent: 'text-pink-400',
  },
  {
    id: 'titanium-mono',
    name: 'Titanium Monochrome',
    description: 'Ultra-pure silver steel with surgical contrast',
    primary: '#94a3b8',
    accent: '#e2e8f0',
    gradient: 'from-slate-400 via-slate-600 to-zinc-900',
    bgDark: '#0a0a0c',
    textAccent: 'text-slate-300',
  },
  {
    id: 'autumn',
    name: 'Autumn',
    description: 'Crisp autumnal maple leaves, burnt sienna, and warm golden amber',
    primary: '#e05a1b',
    accent: '#b91c1c',
    gradient: 'from-amber-500 via-orange-600 to-red-700',
    bgDark: '#130804',
    textAccent: 'text-orange-400',
  },
];

export const DEFAULT_CUSTOM_PALETTE_CONFIG: CustomPaletteConfig = {
  name: 'Custom Studio',
  primary: '#6366f1',
  accent: '#ec4899',
  bgDark: '#0a0914',
};

export function buildCustomPalette(config: CustomPaletteConfig): ColorPalette {
  return {
    id: 'custom',
    name: config.name.trim() || 'Custom Theme',
    description: `Custom ${config.primary.toUpperCase()} & ${config.accent.toUpperCase()} studio palette`,
    primary: config.primary,
    accent: config.accent,
    gradient: '',
    bgDark: config.bgDark,
    textAccent: '',
  };
}

// Generate 365 days of clean real-time study activity (52 weeks x 7 days), initialized with 0 dummy hours
export function generateYearStudyData(dailyHoursMap: Record<string, number> = {}): StudyDay[] {
  const days: StudyDay[] = [];
  const today = new Date();

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const rawHours = dailyHoursMap[dateStr] || 0;
    const hours = +rawHours.toFixed(2);
    let count = 0;
    if (hours >= 4.5) count = 4;
    else if (hours >= 2.5) count = 3;
    else if (hours >= 1.0) count = 2;
    else if (hours > 0) count = 1;

    days.push({
      date: dateStr,
      count,
      hours,
    });
  }
  return days;
}

export const INITIAL_TASKS: TaskItem[] = [];

export const INITIAL_PLANNERS: PlannerEntry[] = [];

export const INITIAL_SOURCES: NotebookSource[] = [];

export const INITIAL_ONENOTE_NOTEBOOKS: OneNoteNotebook[] = [];

export const INITIAL_LIBRARY: LibraryItem[] = [];

export const INITIAL_SUBJECT_ANALYTICS: SubjectAnalytics[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_GEMINI_CONVERSATIONS: GeminiConversation[] = [];

export const INITIAL_WORKSPACES: Workspace[] = [];



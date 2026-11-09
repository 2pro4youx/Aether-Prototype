export interface LanguageTheme {
  id: string;
  name: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  headerBg: string;
  codeTextColor: string;
  placeholderColor: string;
  glowColor: string;
}

export const LANGUAGE_THEMES: Record<string, LanguageTheme> = {
  python: {
    id: 'python',
    name: 'Python',
    dotColor: '#38bdf8', // Sky Blue
    badgeBg: 'bg-sky-500/15 border-sky-500/30',
    badgeText: 'text-sky-300',
    borderClass: 'border-sky-500/35 hover:border-sky-500/60',
    headerBg: 'bg-sky-950/60',
    codeTextColor: 'text-sky-200',
    placeholderColor: 'placeholder:text-sky-300/30',
    glowColor: 'rgba(56, 189, 248, 0.25)',
  },
  typescript: {
    id: 'typescript',
    name: 'TypeScript',
    dotColor: '#3b82f6', // TS Blue
    badgeBg: 'bg-blue-500/15 border-blue-500/30',
    badgeText: 'text-blue-300',
    borderClass: 'border-blue-500/35 hover:border-blue-500/60',
    headerBg: 'bg-blue-950/60',
    codeTextColor: 'text-blue-200',
    placeholderColor: 'placeholder:text-blue-300/30',
    glowColor: 'rgba(59, 130, 246, 0.25)',
  },
  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    dotColor: '#facc15', // JS Gold Yellow
    badgeBg: 'bg-yellow-500/15 border-yellow-500/30',
    badgeText: 'text-yellow-300',
    borderClass: 'border-yellow-500/35 hover:border-yellow-500/60',
    headerBg: 'bg-yellow-950/60',
    codeTextColor: 'text-yellow-100',
    placeholderColor: 'placeholder:text-yellow-300/30',
    glowColor: 'rgba(250, 204, 21, 0.25)',
  },
  rust: {
    id: 'rust',
    name: 'Rust',
    dotColor: '#f97316', // Rust Orange
    badgeBg: 'bg-orange-500/15 border-orange-500/30',
    badgeText: 'text-orange-300',
    borderClass: 'border-orange-500/35 hover:border-orange-500/60',
    headerBg: 'bg-orange-950/60',
    codeTextColor: 'text-orange-200',
    placeholderColor: 'placeholder:text-orange-300/30',
    glowColor: 'rgba(249, 115, 22, 0.25)',
  },
  cpp: {
    id: 'cpp',
    name: 'C++',
    dotColor: '#6366f1', // Indigo
    badgeBg: 'bg-indigo-500/15 border-indigo-500/30',
    badgeText: 'text-indigo-300',
    borderClass: 'border-indigo-500/35 hover:border-indigo-500/60',
    headerBg: 'bg-indigo-950/60',
    codeTextColor: 'text-indigo-200',
    placeholderColor: 'placeholder:text-indigo-300/30',
    glowColor: 'rgba(99, 102, 241, 0.25)',
  },
  c: {
    id: 'c',
    name: 'C',
    dotColor: '#818cf8',
    badgeBg: 'bg-indigo-500/15 border-indigo-500/30',
    badgeText: 'text-indigo-300',
    borderClass: 'border-indigo-500/35 hover:border-indigo-500/60',
    headerBg: 'bg-indigo-950/60',
    codeTextColor: 'text-indigo-200',
    placeholderColor: 'placeholder:text-indigo-300/30',
    glowColor: 'rgba(129, 140, 248, 0.25)',
  },
  cuda: {
    id: 'cuda',
    name: 'CUDA',
    dotColor: '#10b981', // NVIDIA Green
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30',
    badgeText: 'text-emerald-300',
    borderClass: 'border-emerald-500/35 hover:border-emerald-500/60',
    headerBg: 'bg-emerald-950/60',
    codeTextColor: 'text-emerald-200',
    placeholderColor: 'placeholder:text-emerald-300/30',
    glowColor: 'rgba(16, 185, 129, 0.25)',
  },
  go: {
    id: 'go',
    name: 'Go',
    dotColor: '#06b6d4', // Cyan
    badgeBg: 'bg-cyan-500/15 border-cyan-500/30',
    badgeText: 'text-cyan-300',
    borderClass: 'border-cyan-500/35 hover:border-cyan-500/60',
    headerBg: 'bg-cyan-950/60',
    codeTextColor: 'text-cyan-200',
    placeholderColor: 'placeholder:text-cyan-300/30',
    glowColor: 'rgba(6, 182, 212, 0.25)',
  },
  sql: {
    id: 'sql',
    name: 'SQL',
    dotColor: '#a855f7', // Violet
    badgeBg: 'bg-purple-500/15 border-purple-500/30',
    badgeText: 'text-purple-300',
    borderClass: 'border-purple-500/35 hover:border-purple-500/60',
    headerBg: 'bg-purple-950/60',
    codeTextColor: 'text-purple-200',
    placeholderColor: 'placeholder:text-purple-300/30',
    glowColor: 'rgba(168, 85, 247, 0.25)',
  },
  json: {
    id: 'json',
    name: 'JSON',
    dotColor: '#f59e0b', // Amber
    badgeBg: 'bg-amber-500/15 border-amber-500/30',
    badgeText: 'text-amber-300',
    borderClass: 'border-amber-500/35 hover:border-amber-500/60',
    headerBg: 'bg-amber-950/60',
    codeTextColor: 'text-amber-200',
    placeholderColor: 'placeholder:text-amber-300/30',
    glowColor: 'rgba(245, 158, 11, 0.25)',
  },
  html: {
    id: 'html',
    name: 'HTML',
    dotColor: '#f43f5e', // Rose
    badgeBg: 'bg-rose-500/15 border-rose-500/30',
    badgeText: 'text-rose-300',
    borderClass: 'border-rose-500/35 hover:border-rose-500/60',
    headerBg: 'bg-rose-950/60',
    codeTextColor: 'text-rose-200',
    placeholderColor: 'placeholder:text-rose-300/30',
    glowColor: 'rgba(244, 63, 94, 0.25)',
  },
  css: {
    id: 'css',
    name: 'CSS',
    dotColor: '#ec4899', // Pink
    badgeBg: 'bg-pink-500/15 border-pink-500/30',
    badgeText: 'text-pink-300',
    borderClass: 'border-pink-500/35 hover:border-pink-500/60',
    headerBg: 'bg-pink-950/60',
    codeTextColor: 'text-pink-200',
    placeholderColor: 'placeholder:text-pink-300/30',
    glowColor: 'rgba(236, 72, 153, 0.25)',
  },
  bash: {
    id: 'bash',
    name: 'Bash',
    dotColor: '#84cc16', // Lime
    badgeBg: 'bg-lime-500/15 border-lime-500/30',
    badgeText: 'text-lime-300',
    borderClass: 'border-lime-500/35 hover:border-lime-500/60',
    headerBg: 'bg-lime-950/60',
    codeTextColor: 'text-lime-200',
    placeholderColor: 'placeholder:text-lime-300/30',
    glowColor: 'rgba(132, 204, 22, 0.25)',
  },
  markdown: {
    id: 'markdown',
    name: 'Markdown',
    dotColor: '#94a3b8', // Slate
    badgeBg: 'bg-slate-500/15 border-slate-500/30',
    badgeText: 'text-slate-300',
    borderClass: 'border-slate-500/35 hover:border-slate-500/60',
    headerBg: 'bg-slate-900/60',
    codeTextColor: 'text-slate-200',
    placeholderColor: 'placeholder:text-slate-300/30',
    glowColor: 'rgba(148, 163, 184, 0.25)',
  },
};

export const SUPPORTED_LANGUAGES: LanguageTheme[] = Object.values(LANGUAGE_THEMES);

export const getLanguageTheme = (lang?: string): LanguageTheme => {
  if (!lang) return LANGUAGE_THEMES.python;
  const normalized = lang.toLowerCase().trim();
  if (normalized === 'js') return LANGUAGE_THEMES.javascript;
  if (normalized === 'ts') return LANGUAGE_THEMES.typescript;
  if (normalized === 'py') return LANGUAGE_THEMES.python;
  if (normalized === 'c++') return LANGUAGE_THEMES.cpp;
  if (normalized === 'sh' || normalized === 'shell') return LANGUAGE_THEMES.bash;
  if (normalized === 'md') return LANGUAGE_THEMES.markdown;
  return LANGUAGE_THEMES[normalized] || LANGUAGE_THEMES.python;
};

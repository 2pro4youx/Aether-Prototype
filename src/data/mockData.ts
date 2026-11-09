import {
  ColorPalette,
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
  {
    id: 'black-night',
    name: 'Black Night',
    description: 'Deep cosmic obsidian void with off-white luminescence and dark carbon shadow glow',
    primary: '#f1f5f9',
    accent: '#cbd5e1',
    gradient: 'from-slate-100 via-slate-300 to-zinc-700',
    bgDark: '#000000',
    textAccent: 'text-slate-100',
  },
];

// Generate 365 days of study activity (52 weeks x 7 days)
export function generateYearStudyData(): StudyDay[] {
  const days: StudyDay[] = [];
  const today = new Date();
  
  for (let i = 364; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Seed realistic study pattern: heavier on weekdays, occasional rest days
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const rand = Math.random();

    let count = 0;
    let hours = 0;

    if (rand > 0.22) {
      if (rand > 0.85) {
        count = 4;
        hours = +(4.5 + Math.random() * 3).toFixed(1);
      } else if (rand > 0.6) {
        count = 3;
        hours = +(3 + Math.random() * 1.5).toFixed(1);
      } else if (rand > 0.35) {
        count = 2;
        hours = +(1.5 + Math.random() * 1.5).toFixed(1);
      } else {
        count = 1;
        hours = +(0.5 + Math.random() * 1).toFixed(1);
      }
    }

    if (isWeekend && rand < 0.4) {
      count = 0;
      hours = 0;
    }

    days.push({
      date: dateStr,
      count,
      hours,
    });
  }
  return days;
}

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    title: 'Review Self-Attention Mechanism derivation in Vaswani et al.',
    category: 'Deep Learning',
    priority: 'high',
    completed: true,
    dueDate: 'Today',
  },
  {
    id: 'task-2',
    title: 'Complete problem set on Hamiltonian operators and eigenvalues',
    category: 'Quantum Mechanics',
    priority: 'high',
    completed: false,
    dueDate: 'Tomorrow',
  },
  {
    id: 'task-3',
    title: 'Synthesize lecture notes on Distributed Consensus & Raft protocol',
    category: 'Computer Systems',
    priority: 'medium',
    completed: false,
    dueDate: 'Nov 12',
  },
  {
    id: 'task-4',
    title: 'Draft literature review outline for organic photovoltaics project',
    category: 'Materials Science',
    priority: 'medium',
    completed: false,
    dueDate: 'Nov 15',
  },
  {
    id: 'task-5',
    title: 'Re-index NotebookLM sources for Computational Biology exam',
    category: 'Bioinformatics',
    priority: 'low',
    completed: true,
    dueDate: 'Yesterday',
  },
];

export const INITIAL_PLANNERS: PlannerEntry[] = [
  {
    id: 'plan-1',
    title: 'Transformer Architecture Mastery Sprint',
    subject: 'Artificial Intelligence',
    timeSlot: '09:00 - 11:30 AM',
    date: 'Daily Sprint',
    milestone: 'Implement FlashAttention kernel in PyTorch/Triton',
    progress: 75,
  },
  {
    id: 'plan-2',
    title: 'Quantum Computing Midterm Revision',
    subject: 'Physics',
    timeSlot: '02:00 - 04:30 PM',
    date: 'Nov 09 - Nov 14',
    milestone: 'Shor algorithm circuit simulation & phase estimation',
    progress: 40,
  },
  {
    id: 'plan-3',
    title: 'Distributed Systems Capstone Specification',
    subject: 'Systems Engineering',
    timeSlot: '05:00 - 07:00 PM',
    date: 'Phase 2 Architecture',
    milestone: 'Formal TLA+ safety proofs for Paxos election logic',
    progress: 20,
  },
];

export const INITIAL_SOURCES: NotebookSource[] = [];

export const INITIAL_ONENOTE_NOTEBOOKS: OneNoteNotebook[] = [];

export const INITIAL_LIBRARY: LibraryItem[] = [];

export const INITIAL_SUBJECT_ANALYTICS: SubjectAnalytics[] = [
  {
    subject: 'Computer Science & AI',
    minutes: 940,
    percentage: 38,
    color: '#f59e0b',
  },
  {
    subject: 'Quantum Physics',
    minutes: 620,
    percentage: 25,
    color: '#3b82f6',
  },
  {
    subject: 'Neuroscience & Biology',
    minutes: 410,
    percentage: 17,
    color: '#10b981',
  },
  {
    subject: 'Mathematics & Statistics',
    minutes: 320,
    percentage: 13,
    color: '#8b5cf6',
  },
  {
    subject: 'Scientific Writing & Ethics',
    minutes: 170,
    percentage: 7,
    color: '#ec4899',
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-1',
    timestamp: '10:42 AM',
    action: 'Grounded Query Generated',
    detail: 'Executed AI chat synthesis referencing 3 sources on Self-Attention Mechanism',
    category: 'ai',
  },
  {
    id: 'aud-2',
    timestamp: '09:15 AM',
    action: 'OneNote Block Edited',
    detail: 'Added Python implementation snippet to FlashAttention page in section 01',
    category: 'note',
  },
  {
    id: 'aud-3',
    timestamp: '08:30 AM',
    action: 'Task Completed',
    detail: 'Checked off "Review Self-Attention Mechanism derivation"',
    category: 'task',
  },
  {
    id: 'aud-4',
    timestamp: 'Yesterday',
    action: 'Source Uploaded',
    detail: 'Extracted and indexed "Principles of Neural Dynamics" (1,105 words)',
    category: 'source',
  },
  {
    id: 'aud-5',
    timestamp: '2 days ago',
    action: 'Study Session Logged',
    detail: 'Completed 4.2 hours across Computer Science and Quantum Mechanics',
    category: 'system',
  },
];

export const INITIAL_GEMINI_CONVERSATIONS: GeminiConversation[] = [];

export const INITIAL_WORKSPACES: Workspace[] = [];



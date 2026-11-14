export type MemoryCategory = 'study' | 'preference' | 'goal' | 'background' | 'context';

export interface LearnedMemoryItem {
  id: string;
  text: string;
  category: MemoryCategory;
  createdAt: string;
  source?: 'auto' | 'manual';
}

export interface GeminiPersonalizationConfig {
  customName: string;
  memoryLevel: number;
  memories: LearnedMemoryItem[];
  customInstructions: string;
}

export interface ActiveGeminiPersonalizationPayload {
  firstName: string;
  memoryLevel: number;
  memories: string[];
  customInstructions: string;
}

export interface MemoryTierInfo {
  label: string;
  shortLabel: string;
  description: string;
  maxRecallCount: number;
  learnSensitivity: 'off' | 'conservative' | 'balanced' | 'deep';
}

export const PERSONALIZATION_STORAGE_KEY = 'aether_personalization_v1';
export const PERSONALIZATION_EVENT = 'aether-personalization-updated';

export const DEFAULT_GEMINI_PERSONALIZATION: GeminiPersonalizationConfig = {
  customName: '',
  memoryLevel: 65,
  memories: [],
  customInstructions: '',
};

export const GEMINI_INSTRUCTION_STARTERS: Array<{
  id: string;
  label: string;
  instruction: string;
}> = [
  {
    id: 'concise',
    label: 'Concise & Structured',
    instruction: 'Keep explanations crisp, scannable, and structured with clear bullet takeaways first, then deeper details if helpful.',
  },
  {
    id: 'socratic',
    label: 'Socratic Tutor',
    instruction: 'Act as a Socratic tutor: guide me toward the intuition with probing questions and hints before giving away full solutions.',
  },
  {
    id: 'math-rigor',
    label: 'LaTeX Math & Proofs',
    instruction: 'Show complete step-by-step mathematical derivations in clean LaTeX and explain the intuition behind every major step.',
  },
  {
    id: 'code-first',
    label: 'Code & Systems Depth',
    instruction: 'Explain concepts with clean, production-grade TypeScript/Python code examples, edge cases, and architectural trade-offs.',
  },
  {
    id: 'visual-analogies',
    label: 'First Principles & Analogies',
    instruction: 'Break down unfamiliar ideas from first principles using intuitive real-world analogies before introducing formal terminology.',
  },
];

let activeAccountBaseName = '';

export function setActiveAccountBaseName(name?: string | null): void {
  activeAccountBaseName = typeof name === 'string' ? name.trim() : '';
}

export function getActiveAccountBaseName(): string {
  return activeAccountBaseName;
}

/**
 * Extracts strictly the user's first name from a display name, custom name, or email handle.
 */
export function extractFirstName(fullName?: string | null): string {
  const raw = typeof fullName === 'string' ? fullName.trim() : '';
  if (!raw) return '';

  const lower = raw.toLowerCase();
  if (
    lower === 'guest' ||
    lower === 'guest learner' ||
    lower === 'aether learner' ||
    lower === 'anonymous' ||
    lower === 'user'
  ) {
    return '';
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  const honorifics = new Set(['mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss', 'dr', 'dr.', 'prof', 'prof.']);
  let candidate = tokens[0];
  if (honorifics.has(candidate.toLowerCase()) && tokens.length > 1) {
    candidate = tokens[1];
  }

  if (candidate.includes('@')) {
    const handle = candidate.split('@')[0].split(/[._-]+/)[0] || '';
    if (!handle) return '';
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }

  return candidate;
}

export function resolvePreferredNames(
  accountName?: string | null,
  customName?: string | null
): { effectiveFullName: string; firstName: string } {
  const custom = (customName || '').trim();
  const base = (accountName || '').trim();
  const effectiveFullName = custom || base;
  return {
    effectiveFullName,
    firstName: extractFirstName(effectiveFullName),
  };
}

function normalizeCategory(cat: unknown): MemoryCategory {
  if (
    cat === 'study' ||
    cat === 'preference' ||
    cat === 'goal' ||
    cat === 'background' ||
    cat === 'context'
  ) {
    return cat;
  }
  return 'context';
}

export function sanitizePersonalizationConfig(
  raw: Partial<GeminiPersonalizationConfig> | null | undefined
): GeminiPersonalizationConfig {
  const customName = typeof raw?.customName === 'string' ? raw.customName.slice(0, 80) : '';
  const rawLevel = typeof raw?.memoryLevel === 'number' && !Number.isNaN(raw.memoryLevel)
    ? raw.memoryLevel
    : DEFAULT_GEMINI_PERSONALIZATION.memoryLevel;
  const memoryLevel = Math.max(0, Math.min(100, Math.round(rawLevel)));
  const customInstructions =
    typeof raw?.customInstructions === 'string' ? raw.customInstructions.slice(0, 4000) : '';

  const memories: LearnedMemoryItem[] = Array.isArray(raw?.memories)
    ? raw!.memories
        .filter((m): m is LearnedMemoryItem => Boolean(m && typeof m.text === 'string' && m.text.trim()))
        .slice(0, 40)
        .map((m, idx) => ({
          id: typeof m.id === 'string' && m.id.trim() ? m.id.slice(0, 80) : `mem-${Date.now()}-${idx}`,
          text: m.text.trim().slice(0, 220),
          category: normalizeCategory(m.category),
          createdAt:
            typeof m.createdAt === 'string' && m.createdAt.trim()
              ? m.createdAt.slice(0, 48)
              : new Date().toISOString(),
          source: m.source === 'manual' ? 'manual' : 'auto',
        }))
    : [];

  return {
    customName,
    memoryLevel,
    memories,
    customInstructions,
  };
}

export function getGeminiPersonalization(): GeminiPersonalizationConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_GEMINI_PERSONALIZATION;
  }
  try {
    const raw = localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
    if (!raw) return DEFAULT_GEMINI_PERSONALIZATION;
    return sanitizePersonalizationConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_GEMINI_PERSONALIZATION;
  }
}

export function setGeminiPersonalization(
  next: GeminiPersonalizationConfig,
  options?: { silent?: boolean }
): GeminiPersonalizationConfig {
  const sanitized = sanitizePersonalizationConfig(next);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore quota errors
    }
    if (!options?.silent) {
      window.dispatchEvent(
        new CustomEvent<GeminiPersonalizationConfig>(PERSONALIZATION_EVENT, { detail: sanitized })
      );
    }
  }
  return sanitized;
}

export function getMemoryTierInfo(level: number): MemoryTierInfo {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  if (clamped === 0) {
    return {
      label: 'Off · Incognito Recall',
      shortLabel: 'Off',
      description: 'Gemini will neither save new facts nor reference stored memories in conversations.',
      maxRecallCount: 0,
      learnSensitivity: 'off',
    };
  }
  if (clamped <= 35) {
    return {
      label: 'Light · Essential Preferences',
      shortLabel: 'Light',
      description: 'Captures only explicit personal preferences and core subjects you directly state.',
      maxRecallCount: 4,
      learnSensitivity: 'conservative',
    };
  }
  if (clamped <= 70) {
    return {
      label: 'Balanced · Adaptive Learning',
      shortLabel: 'Balanced',
      description: 'Automatically learns your courses, study habits, goals, and explanation preferences as you chat.',
      maxRecallCount: 12,
      learnSensitivity: 'balanced',
    };
  }
  return {
    label: 'Deep · Continuous Memory',
    shortLabel: 'Deep',
    description: 'Richly adapts across sessions, recalling nuanced academic interests, milestones, and weak spots.',
    maxRecallCount: 25,
    learnSensitivity: 'deep',
  };
}

function isNearDuplicateMemory(existingText: string, candidateText: string): boolean {
  const normA = existingText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const normB = candidateText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (!normA || !normB) return true;
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) return true;

  const wordsA = new Set(normA.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let overlap = 0;
  for (const w of wordsB) {
    if (wordsA.has(w)) overlap++;
  }
  const jaccard = overlap / Math.min(wordsA.size, wordsB.size);
  return jaccard >= 0.72;
}

export function mergeLearnedMemories(
  incoming: Array<{ text: string; category?: MemoryCategory }>,
  source: 'auto' | 'manual' = 'auto'
): { config: GeminiPersonalizationConfig; addedCount: number } {
  const current = getGeminiPersonalization();
  const existing = [...current.memories];
  let addedCount = 0;

  for (const entry of incoming) {
    const cleanText = (entry.text || '').trim().replace(/\s+/g, ' ').slice(0, 220);
    if (cleanText.length < 5) continue;
    const duplicate = existing.some((item) => isNearDuplicateMemory(item.text, cleanText));
    if (duplicate) continue;

    existing.unshift({
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: cleanText,
      category: normalizeCategory(entry.category),
      createdAt: new Date().toISOString(),
      source,
    });
    addedCount++;
  }

  if (addedCount === 0) {
    return { config: current, addedCount: 0 };
  }

  const updated = setGeminiPersonalization({
    ...current,
    memories: existing.slice(0, 40),
  });
  return { config: updated, addedCount };
}

export function buildActiveGeminiPersonalizationPayload(
  fallbackAccountName?: string
): ActiveGeminiPersonalizationPayload {
  const cfg = getGeminiPersonalization();
  const tier = getMemoryTierInfo(cfg.memoryLevel);
  const baseName = fallbackAccountName || activeAccountBaseName;
  const { firstName } = resolvePreferredNames(baseName, cfg.customName);

  const activeMemories =
    tier.maxRecallCount > 0
      ? cfg.memories.slice(0, tier.maxRecallCount).map((m) => m.text)
      : [];

  return {
    firstName,
    memoryLevel: cfg.memoryLevel,
    memories: activeMemories,
    customInstructions: cfg.customInstructions.trim(),
  };
}

export function appendPersonalizationToSystemInstruction(
  baseInstruction: string,
  personalization?: Partial<ActiveGeminiPersonalizationPayload> | null
): string {
  if (!personalization) return baseInstruction;
  const sections: string[] = [];

  const firstName = typeof personalization.firstName === 'string' ? personalization.firstName.trim() : '';
  if (firstName) {
    sections.push(
      `[User Identity]: The user's first name is "${firstName}". Always address them naturally by their first name ("${firstName}") rather than their full name or surname whenever greeting or referring to them.`
    );
  }

  const instructions =
    typeof personalization.customInstructions === 'string'
      ? personalization.customInstructions.trim()
      : '';
  if (instructions) {
    sections.push(
      `[Custom Instructions for Gemini from User]:\nFollow these user-defined preferences and instructions consistently:\n${instructions}`
    );
  }

  const memLevel = typeof personalization.memoryLevel === 'number' ? personalization.memoryLevel : 0;
  const memList = Array.isArray(personalization.memories)
    ? personalization.memories.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    : [];

  if (memLevel > 0 && memList.length > 0) {
    const tier = getMemoryTierInfo(memLevel);
    sections.push(
      `[Learned User Memory · ${tier.shortLabel} (${memLevel}%)]:\nUse these learned details about the user naturally to personalize explanations, analogies, and recommendations without awkwardly parroting them back unless relevant:\n` +
        memList.slice(0, tier.maxRecallCount).map((m) => `- ${m}`).join('\n') +
        (memLevel >= 71
          ? '\n(Deep memory active: proactively connect concepts to their ongoing goals, coursework, and preferred reasoning style.)'
          : '')
    );
  }

  if (sections.length === 0) return baseInstruction;
  return `${baseInstruction}\n\n${sections.join('\n\n')}`;
}

export function extractDeterministicLocalSignals(
  userMessage: string,
  memoryLevel: number
): Array<{ text: string; category: MemoryCategory }> {
  if (memoryLevel <= 0) return [];
  const clean = userMessage.trim().replace(/\s+/g, ' ');
  if (clean.length < 12) return [];

  const results: Array<{ text: string; category: MemoryCategory }> = [];

  const rememberMatch = clean.match(/(?:please\s+)?remember\s+(?:that\s+)?([^.!?\n]{8,140})/i);
  if (rememberMatch?.[1]) {
    const fact = rememberMatch[1].trim();
    results.push({ text: fact.charAt(0).toUpperCase() + fact.slice(1), category: 'preference' });
  }

  const studyingMatch = clean.match(
    /\bi(?:'m| am)\s+(?:currently\s+)?(?:studying|learning|majoring in|taking|preparing for)\s+([^.!?\n]{4,100})/i
  );
  if (studyingMatch?.[1]) {
    results.push({ text: `Studying / preparing for ${studyingMatch[1].trim()}`, category: 'study' });
  }

  const preferMatch = clean.match(
    /\bi\s+(?:prefer|learn best|like responses?|want answers?)\s+(?:when\s+|with\s+|to be\s+|in\s+)?([^.!?\n]{6,110})/i
  );
  if (preferMatch?.[1]) {
    results.push({ text: `Prefers ${preferMatch[1].trim()}`, category: 'preference' });
  }

  if (memoryLevel >= 36) {
    const goalMatch = clean.match(
      /\bmy\s+(?:goal|exam|midterm|final|project|thesis)\s+(?:is|on|next)\s+([^.!?\n]{5,110})/i
    );
    if (goalMatch?.[1]) {
      results.push({ text: `Goal / milestone: ${goalMatch[1].trim()}`, category: 'goal' });
    }
  }

  return results.slice(0, 2);
}

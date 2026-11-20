import { ChatAttachment, NotebookSource } from '../types';
import {
  appendPersonalizationToSystemInstruction,
  buildActiveGeminiPersonalizationPayload,
  extractDeterministicLocalSignals,
  getGeminiPersonalization,
  MemoryCategory,
  mergeLearnedMemories,
} from './personalization';
import { DecodedTimetableSlot, sanitizeDecodedTimetableSlots } from './timetableParser';
import { prepareTimetableImagesForDecoding } from './timetableImagePrep';

export interface GeminiModelInfo {
  id: string;
  name: string;
  tag: string;
  badge: string;
  description: string;
  recommended?: boolean;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    tag: 'Fast Multimodal',
    badge: 'Recommended Default',
    description: 'Fast, token-efficient multimodal model balancing speed and nuanced reading of documents and visual attachments.',
    recommended: true,
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    tag: 'Vision & Multimodal Pro',
    badge: 'Multimodal Pro',
    description: 'Ultra-responsive, high-throughput multimodal model with exceptional vision recognition for screenshots, diagrams, handwriting, and source synthesis.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    tag: 'Ultra-Low Latency',
    badge: 'Lightning Fast',
    description: 'Lightweight latency-optimized vision model designed for rapid image inspection, document Q&A, and real-time study notes.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    tag: 'Extended Reasoning',
    badge: 'Advanced Synthesis',
    description: 'Highly capable reasoning model for advanced synthesis and complex multi-source STEM analysis.',
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    tag: 'Deep Reasoning & Proofs',
    badge: 'Extended Thinking',
    description: 'Extended reasoning engine with ThinkingLevel.HIGH configured to generate exhaustive, in-depth mathematical proofs and code architectures.',
  },
];

export interface GeminiRequestOptions {
  message: string;
  rawUserMessage?: string;
  skipMemoryLearning?: boolean;
  model?: string;
  enableThinking?: boolean;
  sources?: Array<{ title: string; content: string } | NotebookSource>;
  attachments?: ChatAttachment[];
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  apiKey?: string;
}

export interface GeminiResponse {
  success: boolean;
  reply: string;
  modelUsed?: string;
  thinkingUsed?: boolean;
  error?: string;
}

export function getActiveGeminiApiKey(): string {
  // 1. User manual override in localStorage
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('aether_gemini_api_key') : null;
  if (storedKey && storedKey.trim()) return storedKey.trim();

  // 2. Vite environment variable
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.replace(/^["']|["']$/g, '').trim();
  }

  return '';
}

const GOOGLE_UID_KEYS_STORAGE = 'aether_google_api_keys_v1';

export function getRememberedGoogleApiKey(uid: string): string {
  if (typeof window === 'undefined' || !uid) return '';
  try {
    const raw = localStorage.getItem(GOOGLE_UID_KEYS_STORAGE);
    if (!raw) return '';
    const map = JSON.parse(raw) as Record<string, string>;
    const val = map?.[uid];
    return typeof val === 'string' ? val.trim() : '';
  } catch {
    return '';
  }
}

export function setRememberedGoogleApiKey(uid: string, key: string): void {
  if (typeof window === 'undefined' || !uid) return;
  const trimmed = key.trim();
  try {
    const raw = localStorage.getItem(GOOGLE_UID_KEYS_STORAGE);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    if (trimmed) {
      map[uid] = trimmed;
    } else {
      delete map[uid];
    }
    localStorage.setItem(GOOGLE_UID_KEYS_STORAGE, JSON.stringify(map));
  } catch {
    // Ignore storage quota issues
  }
}

export function setActiveGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem('aether_gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('aether_gemini_api_key');
      localStorage.removeItem('aether_gemini_api_mode');
    }
    window.dispatchEvent(new CustomEvent('aether-gemini-key-updated', { detail: trimmed }));
  }
}

/**
 * Helper to extract outermost balanced JSON object from a string
 */
function extractOutermostJson(str: string): { raw: string; start: number; end: number } | null {
  const startIdx = str.indexOf('{');
  if (startIdx === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return {
            raw: str.slice(startIdx, i + 1),
            start: startIdx,
            end: i + 1,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Cleans up raw JSON tool calls (like dalle.text2im) and formats them into
 * human-readable markdown with live visual rendering via Pollinations AI.
 */
export function cleanGeminiReply(reply: string): string {
  if (!reply) return '';
  const trimmed = reply.trim();

  // 1. Try balanced JSON extraction for action / tool calls
  const extracted = extractOutermostJson(trimmed);
  if (extracted && (extracted.raw.includes('"action"') || extracted.raw.includes('"dalle') || extracted.raw.includes('"thought"'))) {
    try {
      const parsed = JSON.parse(extracted.raw);
      if (parsed.action || parsed.action_input || parsed.thought) {
        let prompt = '';
        if (typeof parsed.action_input === 'string') {
          try {
            const inputObj = JSON.parse(parsed.action_input);
            prompt = inputObj.prompt || inputObj.text || parsed.action_input;
          } catch {
            prompt = parsed.action_input;
          }
        } else if (parsed.action_input && typeof parsed.action_input === 'object') {
          prompt = parsed.action_input.prompt || parsed.action_input.text || JSON.stringify(parsed.action_input);
        } else if (parsed.prompt) {
          prompt = parsed.prompt;
        }

        let thought = parsed.thought || '';
        thought = thought.replace(
          /Since I cannot directly ['"]see['"] the user's local file in the same way a human sees a physical object,?\s*/gi,
          ''
        ).trim();

        // If it's a visual synthesis / DALL-E call
        if (parsed.action === 'dalle.text2im' || prompt || thought) {
          const cleanDesc = prompt || thought || 'Visual analysis';
          const encodedPrompt = encodeURIComponent(cleanDesc.slice(0, 200));
          const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&nologo=true`;

          const formattedCard =
            `### 🎨 Visual Synthesis & Representation\n\n` +
            (thought ? `> **Visual Analysis**: ${thought}\n\n` : '') +
            (prompt ? `**Visual Specification & Analysis**:\n${prompt}\n\n` : '') +
            `![Generated Visual: ${cleanDesc.slice(0, 60)}](${imageUrl})\n`;

          const before = trimmed.slice(0, extracted.start).trim();
          const after = trimmed.slice(extracted.end).trim();
          return [before, formattedCard, after].filter(Boolean).join('\n\n').trim();
        }
      }
    } catch {
      // Fallback regex if parse fails
      const thoughtMatch = trimmed.match(/"thought"\s*:\s*"([^"]+)"/);
      const promptMatch = trimmed.match(/"prompt"\s*:\s*"([^"]+)"/);
      if (promptMatch || thoughtMatch) {
        const prompt = promptMatch ? promptMatch[1] : '';
        const thought = (thoughtMatch ? thoughtMatch[1] : '').replace(
          /Since I cannot directly ['"]see['"] the user's local file in the same way a human sees a physical object,?\s*/gi,
          ''
        ).trim();
        const cleanDesc = prompt || thought;
        const encodedPrompt = encodeURIComponent(cleanDesc);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&nologo=true`;
        return `### 🎨 Visual Synthesis & Representation\n\n` +
          (thought ? `> **Visual Analysis**: ${thought}\n\n` : '') +
          (prompt ? `**Visual Specification**:\n${prompt}\n\n` : '') +
          `![Generated Visual](${imageUrl})\n`;
      }
    }
  }

  return reply;
}

type BackendApiStatus = 'unknown' | 'available' | 'static-host';
let backendApiStatus: BackendApiStatus = 'unknown';

const clientKeyEndpointCache = new Map<string, 'generativelanguage' | 'aiplatform'>();

function getCachedKeyEndpoint(apiKey: string): 'generativelanguage' | 'aiplatform' | undefined {
  const mem = clientKeyEndpointCache.get(apiKey);
  if (mem) return mem;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('aether_gemini_api_mode');
    if (saved === 'generativelanguage' || saved === 'aiplatform') {
      return saved;
    }
  }
  return undefined;
}

function setCachedKeyEndpoint(apiKey: string, mode: 'generativelanguage' | 'aiplatform'): void {
  clientKeyEndpointCache.set(apiKey, mode);
  if (typeof window !== 'undefined') {
    localStorage.setItem('aether_gemini_api_mode', mode);
  }
}

function mapClientRestModel(model?: string): string {
  if (
    !model ||
    model === 'gemini-2.5-flash-lite' ||
    model === 'gemini-2.5-flash' ||
    model === 'gemini-2.0-flash' ||
    model === 'gemini-1.5-flash' ||
    model === 'gemini-flash-latest'
  ) {
    return 'gemini-3.5-flash-lite';
  }
  if (
    model === 'gemini-2.5-pro' ||
    model === 'gemini-2.0-pro' ||
    model === 'gemini-1.5-pro' ||
    model === 'gemini-pro' ||
    model === 'gemini-pro-latest'
  ) {
    return 'gemini-4-argon';
  }
  return model;
}

function isAuthErrorResponse(status: number, message: string): boolean {
  if (status === 401 || status === 403) return true;
  if (status === 400) {
    const lower = message.toLowerCase();
    return (
      lower.includes('api key') ||
      lower.includes('api_key') ||
      lower.includes('permission') ||
      lower.includes('unauthenticated') ||
      lower.includes('invalid authentication')
    );
  }
  return false;
}

/**
 * Safely calls a backend `/api/...` route.
 * On static hosts like Firebase Hosting, `/api/*` rewrites to `index.html` (`200 OK` + `text/html`),
 * which would crash `.json()` with `Unexpected token '<', "<!doctype "...`.
 * This detects HTML/404 responses immediately without throwing and latches `static-host`.
 */
async function postBackendJson<T = any>(
  url: string,
  body: Record<string, unknown>,
  apiKey?: string,
  timeoutMs = 15000
): Promise<{ status: 'ok'; data: T } | { status: 'http-error'; code: number; error: string } | { status: 'unavailable' }> {
  if (backendApiStatus === 'static-host') {
    return { status: 'unavailable' };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['x-gemini-api-key'] = apiKey;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (res.status === 404 || res.status === 405 || res.status === 501) {
      backendApiStatus = 'static-host';
      return { status: 'unavailable' };
    }

    if (!contentType.includes('application/json')) {
      const preview = await res.text().catch(() => '');
      const trimmed = preview.trimStart().toLowerCase();
      if (!trimmed || trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || contentType.includes('text/html')) {
        backendApiStatus = 'static-host';
        return { status: 'unavailable' };
      }
      try {
        const parsed = JSON.parse(preview);
        backendApiStatus = 'available';
        if (res.ok) return { status: 'ok', data: parsed };
        return { status: 'http-error', code: res.status, error: parsed?.error || `HTTP ${res.status}` };
      } catch {
        backendApiStatus = 'static-host';
        return { status: 'unavailable' };
      }
    }

    const data = await res.json();
    backendApiStatus = 'available';
    if (res.ok) {
      return { status: 'ok', data };
    }
    return {
      status: 'http-error',
      code: res.status,
      error: data?.error || `HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { status: 'http-error', code: 408, error: 'Request timed out. Please try again.' };
    }
    return { status: 'unavailable' };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Direct Google REST fallback used automatically when running on Firebase Hosting / static deployments.
 */
async function callDirectGoogleRest(options: {
  apiKey: string;
  model?: string;
  contents: Array<{ role: 'user' | 'model'; parts: any[] }>;
  systemInstruction?: string;
  generationConfig?: Record<string, any>;
  timeoutMs?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const { apiKey, model, contents, systemInstruction, generationConfig, timeoutMs = 30000 } = options;
  const cachedMode = getCachedKeyEndpoint(apiKey);
  const candidates = Array.from(
    new Set([mapClientRestModel(model), 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'])
  );

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const attemptEndpoint = async (useVertex: boolean): Promise<{ text: string; modelUsed: string }> => {
    let lastError: Error | null = null;
    for (const m of candidates) {
      const endpoint = useVertex
        ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const payload: Record<string, any> = { contents };
      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
      }
      if (generationConfig && Object.keys(generationConfig).length > 0) {
        payload.generationConfig = generationConfig;
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        setCachedKeyEndpoint(apiKey, useVertex ? 'aiplatform' : 'generativelanguage');
        const data = await resp.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = parts
          .filter((p: any) => !p.thought && typeof p.text === 'string')
          .map((p: any) => p.text)
          .join('\n\n')
          .trim();
        return { text: text || 'No response generated from the model.', modelUsed: m };
      }

      const errData = await resp.json().catch(() => null);
      const errMsg = errData?.error?.message || `HTTP ${resp.status}: ${resp.statusText}`;
      lastError = new Error(errMsg);
      if (isAuthErrorResponse(resp.status, errMsg)) {
        throw lastError;
      }
    }
    throw lastError || new Error('Failed to generate Gemini response.');
  };

  try {
    try {
      return await attemptEndpoint(cachedMode === 'aiplatform');
    } catch (err: any) {
      // Cold-start fallback if an AQ. Vertex Express key was used before verifyGeminiApiKey populated cache
      if (apiKey.startsWith('AQ.') && cachedMode !== 'aiplatform') {
        try {
          return await attemptEndpoint(true);
        } catch {
          throw err;
        }
      }
      throw err;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface VerifyKeyResult {
  valid: boolean;
  model?: string;
  mode?: string;
  error?: string;
}

/**
 * Instant Gemini API key verification (< 500ms).
 * Supports ALL personal Google AI Studio keys (`AIzaSy...` and `AQ.Ab8...`) using the user's own credits,
 * working cleanly on both Express (`server.ts`) and static Firebase Hosting (`*.web.app`).
 */
export async function verifyGeminiApiKey(rawKey: string): Promise<VerifyKeyResult> {
  const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();
  if (!apiKey) {
    return { valid: false, error: 'Please paste your Gemini API key before verifying.' };
  }
  if (apiKey.length < 16 || /\s/.test(apiKey)) {
    return { valid: false, error: 'Invalid API key format. Keys should not contain spaces.' };
  }

  // 1. Try Express backend verify endpoint if available (fast 5.5s timeout)
  const backendCheck = await postBackendJson<VerifyKeyResult>(
    '/api/gemini/verify',
    { apiKey },
    apiKey,
    5500
  );

  if (backendCheck.status === 'ok') {
    if (backendCheck.data?.mode === 'vertex-express') {
      setCachedKeyEndpoint(apiKey, 'aiplatform');
    } else if (backendCheck.data?.valid) {
      setCachedKeyEndpoint(apiKey, 'generativelanguage');
    }
    return {
      valid: Boolean(backendCheck.data?.valid),
      model: backendCheck.data?.model,
      mode: backendCheck.data?.mode,
      error: backendCheck.data?.error,
    };
  }
  if (backendCheck.status === 'http-error') {
    return {
      valid: false,
      error: backendCheck.error || 'Invalid Gemini API key.',
    };
  }

  // 2. Direct REST verification for static hosting (Firebase Hosting / CDN deployments)
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5500);

  try {
    // Always try native Google AI Studio / Generative Language API FIRST (~150ms).
    const glResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=8&key=${encodeURIComponent(apiKey)}`,
      {
        method: 'GET',
        signal: controller.signal,
      }
    );

    if (glResp.ok) {
      setCachedKeyEndpoint(apiKey, 'generativelanguage');
      const data = await glResp.json().catch(() => ({}));
      const modelNames: string[] = Array.isArray(data?.models)
        ? data.models.map((m: any) => String(m?.name || '').replace(/^models\//, ''))
        : [];
      const preferred =
        modelNames.find((name) => name === 'gemini-3.5-flash-lite') ||
        modelNames.find((name) => name.includes('3.5-flash')) ||
        modelNames.find((name) => name.includes('flash-lite') && !name.includes('2.5')) ||
        'gemini-3.5-flash-lite';
      return {
        valid: true,
        model: preferred,
        mode: 'ai-studio',
      };
    }

    const glErrData = await glResp.json().catch(() => null);
    const glErrMsg = glErrData?.error?.message || `HTTP ${glResp.status}: Invalid Gemini API key.`;

    // If this is an `AQ.` key and Generative Language API rejected it, check Vertex AI Express once.
    if (apiKey.startsWith('AQ.')) {
      const vxResp = await fetch(
        `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
            generationConfig: {
              maxOutputTokens: 2,
            },
          }),
        }
      );

      if (vxResp.ok) {
        setCachedKeyEndpoint(apiKey, 'aiplatform');
        return { valid: true, model: 'gemini-3.5-flash-lite', mode: 'vertex-express' };
      }
      const vxErr = await vxResp.json().catch(() => null);
      const vxMsg = String(vxErr?.error?.message || '');
      if (
        vxMsg.toLowerCase().includes('aiplatform.googleapis.com') ||
        vxMsg.toLowerCase().includes('has not been used in project') ||
        vxMsg.toLowerCase().includes('it is disabled')
      ) {
        return {
          valid: false,
          error:
            'This Google Cloud key does not have Gemini / Generative Language API or Vertex AI enabled on its project. Create a standard key at Google AI Studio (aistudio.google.com/apikey) to use your own Gemini credits immediately.',
        };
      }
    }

    return { valid: false, error: glErrMsg };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { valid: false, error: 'Verification timed out. Please check your network and try again.' };
    }
    return { valid: false, error: err?.message || 'Unable to verify API key.' };
  } finally {
    window.clearTimeout(timer);
  }
}

function cleanLearningPrompt(rawText: string): string {
  return (rawText || '')
    .replace(/^\[NotebookLM Grounding Protocol:[\s\S]*?\]\s*/i, '')
    .trim();
}

async function scheduleGeminiMemoryLearning(params: {
  apiKey: string;
  userMessage: string;
  assistantReply: string;
}): Promise<void> {
  const { apiKey, userMessage, assistantReply } = params;
  const cleanUser = cleanLearningPrompt(userMessage);
  if (!apiKey || cleanUser.length < 10) return;
  if (!assistantReply || assistantReply.startsWith('⚠️')) return;

  const current = getGeminiPersonalization();
  if (current.memoryLevel <= 0) return;

  try {
    const backendRes = await postBackendJson<{
      memories?: Array<{ text: string; category?: MemoryCategory }>;
    }>(
      '/api/gemini/learn-memory',
      {
        userMessage: cleanUser.slice(0, 2000),
        assistantReply: assistantReply.slice(0, 600),
        memoryLevel: current.memoryLevel,
        existingMemories: current.memories.map((m) => m.text),
        apiKey,
      },
      apiKey,
      12000
    );

    if (backendRes.status === 'ok' && Array.isArray(backendRes.data?.memories)) {
      if (backendRes.data.memories.length > 0) {
        mergeLearnedMemories(backendRes.data.memories, 'auto');
      }
      return;
    }

    if (backendRes.status === 'unavailable') {
      const level = current.memoryLevel;
      const sensitivity =
        level <= 35
          ? 'CONSERVATIVE: Extract only explicit personal preferences/facts stated directly by the user.'
          : level <= 70
          ? 'BALANCED: Extract clear study topics, goals, or style preferences.'
          : 'DEEP: Extract enduring study interests, goals, weak spots, and learning preferences.';
      const existingList = current.memories.slice(0, 25).map((m) => `- ${m.text}`).join('\n') || 'None yet';
      const prompt =
        `${sensitivity}\nExisting memories (do not repeat):\n${existingList}\n\n` +
        `Return ONLY valid JSON {"memories":[{"text":"...","category":"study|preference|goal|background|context"}]} with 0 to 2 concise memories from:\n${cleanUser.slice(0, 1500)}`;

      const restRes = await callDirectGoogleRest({
        apiKey,
        model: 'gemini-3.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
        timeoutMs: 12000,
      });

      const match = restRes.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { memories?: Array<{ text: string; category?: MemoryCategory }> };
        if (Array.isArray(parsed.memories) && parsed.memories.length > 0) {
          mergeLearnedMemories(parsed.memories.slice(0, 2), 'auto');
          return;
        }
      }
    }
  } catch {
    // Fallback to deterministic local extraction if API call fails
  }

  const localSignals = extractDeterministicLocalSignals(cleanUser, current.memoryLevel);
  if (localSignals.length > 0) {
    mergeLearnedMemories(localSignals, 'auto');
  }
}

/**
 * Unified Gemini API Caller
 * 1. Tries Express / Cloud Run endpoint `/api/gemini/chat`
 * 2. If server endpoint returns HTML/404 (e.g. Firebase Hosting) or is offline, calls Google Gemini REST directly
 * 3. Returns accurate real Gemini response or explicit error message
 */
export async function callGeminiChat(options: GeminiRequestOptions): Promise<GeminiResponse> {
  const {
    message,
    rawUserMessage,
    skipMemoryLearning = false,
    model = 'gemini-3.5-flash-lite',
    enableThinking = false,
    sources = [],
    attachments = [],
    history = [],
    apiKey: explicitKey,
  } = options;

  const apiKey = (explicitKey || getActiveGeminiApiKey()).trim();

  if (!apiKey) {
    return {
      success: false,
      reply: '⚠️ **Gemini Disconnected**: Please enter a valid Gemini API key in Settings or Login to enable AI responses.',
      error: 'Gemini is disconnected. Please enter a valid Gemini API key in Settings or Login to enable AI features.',
    };
  }

  const formattedSources = sources.map((s) => ({
    title: s.title,
    content: 'fullContent' in s ? (s as NotebookSource).fullContent : (s as { content: string }).content,
  }));

  const requestedModel = mapClientRestModel(model);
  const personalization = buildActiveGeminiPersonalizationPayload();
  const hasImages = attachments.some(
    (a) => a.isImage || a.type?.startsWith('image/') || (a.dataUrl && a.dataUrl.startsWith('data:image/'))
  );

  let fullMessage = message;
  if (!fullMessage && attachments.length === 0) {
    fullMessage = 'Hello, please respond.';
  }
  const textAttachments = attachments.filter((a) => !a.isImage && !a.type?.startsWith('image/'));
  if (textAttachments.length > 0) {
    const attContext = textAttachments
      .map(
        (a) =>
          `[Attached File: ${a.name} (${a.type})]${
            a.textContent ? `\nContent excerpt:\n${a.textContent.slice(0, 15000)}` : ''
          }`
      )
      .join('\n\n');
    fullMessage = `${fullMessage ? `${fullMessage}\n\n` : ''}User attached files:\n${attContext}`;
  }

  if (hasImages && (!fullMessage || fullMessage.startsWith('Uploaded '))) {
    fullMessage = 'Please examine the attached image in detail. Read any text, transcribe words/phrases, analyze visual elements, colors, and layout.';
  }

  // Strategy 1: Attempt Server Endpoint (/api/gemini/chat)
  const backendRes = await postBackendJson<{
    reply?: string;
    modelUsed?: string;
    thinkingUsed?: boolean;
  }>(
    '/api/gemini/chat',
    {
      message: fullMessage,
      model: requestedModel,
      enableThinking,
      sources: hasImages ? [] : formattedSources,
      attachments,
      history,
      personalization,
      apiKey,
    },
    apiKey,
    35000
  );

  if (backendRes.status === 'ok') {
    const cleaned = backendRes.data?.reply ? cleanGeminiReply(backendRes.data.reply) : '';
    const finalReply = cleaned.trim() || 'Sorry, I could not generate a response.';
    if (!skipMemoryLearning) {
      void scheduleGeminiMemoryLearning({
        apiKey,
        userMessage: rawUserMessage || message,
        assistantReply: finalReply,
      });
    }
    return {
      success: true,
      reply: finalReply,
      modelUsed: backendRes.data?.modelUsed || requestedModel,
      thinkingUsed: Boolean(backendRes.data?.thinkingUsed),
    };
  }

  if (backendRes.status === 'http-error') {
    return {
      success: false,
      error: backendRes.error,
      reply: `⚠️ **Gemini Server Error**: ${backendRes.error}\n\nPlease check your API key in **Settings > Gemini Model Hub** or verify network connectivity.`,
    };
  }

  // Strategy 2: Direct Google REST fallback (for Firebase Hosting / static deployments)
  try {
    let sourcesContext = '';
    if (!hasImages && formattedSources.length > 0) {
      sourcesContext =
        `\n\n[Active Knowledge Sources for Grounding]:\n` +
        formattedSources.map((s, idx) => `[Source ${idx + 1}: ${s.title}]\n${s.content}\n`).join('\n---\n');
    }

    const promptText = sourcesContext ? `${sourcesContext}\n\nUser Question:\n${fullMessage}` : fullMessage;
    const parts: any[] = [{ text: promptText }];

    for (const att of attachments) {
      if (att.dataUrl && typeof att.dataUrl === 'string' && att.dataUrl.includes('base64,')) {
        const [header, base64Data] = att.dataUrl.split('base64,');
        if (base64Data && base64Data.trim()) {
          const match = header.match(/data:([^;]+);/);
          const mimeType = att.type || match?.[1] || (att.isImage ? 'image/png' : 'application/pdf');
          if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
            parts.push({ inlineData: { mimeType, data: base64Data.trim() } });
          }
        }
      }
    }

    const baseSystemInstruction = hasImages
      ? 'You are Gemini, a helpful multimodal AI assistant. Inspect visual data accurately and respond in clean Markdown.'
      : sourcesContext
      ? 'You are a research synthesis assistant grounded in the provided study sources. Cite sources as [1], [2], etc., using clean Markdown and LaTeX.'
      : 'You are Gemini, a helpful, capable AI assistant. Format responses cleanly with Markdown and LaTeX when helpful.';

    const systemInstruction = appendPersonalizationToSystemInstruction(
      baseSystemInstruction,
      personalization
    );

    const restResult = await callDirectGoogleRest({
      apiKey,
      model: requestedModel,
      contents: [{ role: 'user', parts }],
      systemInstruction,
      generationConfig: enableThinking ? { maxOutputTokens: 8192 } : undefined,
    });

    const finalReply = cleanGeminiReply(restResult.text);
    if (!skipMemoryLearning) {
      void scheduleGeminiMemoryLearning({
        apiKey,
        userMessage: rawUserMessage || message,
        assistantReply: finalReply,
      });
    }

    return {
      success: true,
      reply: finalReply,
      modelUsed: restResult.modelUsed,
      thinkingUsed: Boolean(enableThinking || model === 'gemini-4-argon'),
    };
  } catch (err: any) {
    const errMessage = err?.message || 'Network error';
    return {
      success: false,
      error: errMessage,
      reply: `⚠️ **Gemini Error**: ${errMessage}`,
    };
  }
}

/**
 * Stream Gemini responses using Server-Sent Events (SSE) via /api/gemini/stream
 * Automatically falls back to direct REST streaming when hosted statically (Firebase Hosting).
 */
export async function streamGeminiChat(
  options: GeminiRequestOptions,
  onChunk: (text: string, fullText: string) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; fullText: string; error?: string }> {
  const {
    message,
    rawUserMessage,
    skipMemoryLearning = false,
    model = 'gemini-3.5-flash-lite',
    enableThinking = false,
    sources = [],
    attachments = [],
    history = [],
    apiKey: explicitKey,
  } = options;

  const apiKey = (explicitKey || getActiveGeminiApiKey()).trim();
  if (!apiKey) {
    return { success: false, fullText: '', error: 'Gemini API key is missing.' };
  }

  const personalization = buildActiveGeminiPersonalizationPayload();

  if (backendApiStatus !== 'static-host') {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      headers['x-gemini-api-key'] = apiKey;

      const res = await fetch('/api/gemini/stream', {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          message,
          model,
          enableThinking,
          sources,
          attachments,
          history,
          personalization,
          apiKey,
        }),
      });

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const isHtml = contentType.includes('text/html');

      if (res.status === 404 || res.status === 405 || isHtml) {
        backendApiStatus = 'static-host';
      } else if (!res.ok) {
        const errData = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
        return { success: false, fullText: '', error: errData.error || `HTTP ${res.status}` };
      } else if (res.body) {
        backendApiStatus = 'available';
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const block of lines) {
            const trimmed = block.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const payloadStr = trimmed.slice(6).trim();
            if (payloadStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payloadStr);
              const piece = parsed.text ?? parsed.chunk;
              if (piece) {
                fullText += piece;
                onChunk(piece, fullText);
              }
              if (parsed.done && parsed.reply && !fullText) {
                fullText = parsed.reply;
                onChunk(parsed.reply, fullText);
              }
              if (parsed.error) {
                return { success: false, fullText, error: parsed.error };
              }
            } catch {
              // skip malformed line
            }
          }
        }

        const cleaned = cleanGeminiReply(fullText);
        if (!skipMemoryLearning) {
          void scheduleGeminiMemoryLearning({
            apiKey,
            userMessage: rawUserMessage || message,
            assistantReply: cleaned,
          });
        }
        return { success: true, fullText: cleaned };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: true, fullText: '[Response stopped by user]' };
      }
      // Fall through to direct REST
    }
  }

  // Static hosting direct fallback
  const result = await callGeminiChat({
    message,
    rawUserMessage,
    skipMemoryLearning,
    model,
    enableThinking,
    sources,
    attachments,
    history,
    apiKey,
  });

  if (result.success) {
    onChunk(result.reply, result.reply);
    return { success: true, fullText: result.reply };
  }
  return { success: false, fullText: '', error: result.error || 'Streaming failed' };
}

/**
 * Study Guide / Briefing / FAQ / Audio Overview synthesis (Express + Firebase Hosting compatible).
 */
export async function synthesizeStudyDocument(options: {
  type: 'study_guide' | 'briefing_doc' | 'faq' | 'audio_overview' | 'topics_covered';
  sources: Array<{ title: string; content: string }>;
  title?: string;
  model?: string;
}): Promise<{ title: string; content: string; modelUsed?: string }> {
  const { type, sources, title = 'Research Synthesis', model } = options;
  const apiKey = getActiveGeminiApiKey();

  const backendRes = await postBackendJson<{ title: string; content: string; modelUsed?: string }>(
    '/api/gemini/synthesize',
    { type, sources, title, model, apiKey },
    apiKey,
    45000
  );

  if (backendRes.status === 'ok') {
    return backendRes.data;
  }
  if (backendRes.status === 'http-error') {
    throw new Error(backendRes.error);
  }

  if (!apiKey) {
    throw new Error('Gemini API key is missing. Please add it in Settings or Login.');
  }

  const combinedSources = sources
    .map((s, idx) => `[Source ${idx + 1}: ${s.title}]\n${s.content}`)
    .join('\n\n');

  let synthesisPrompt = 'Summarize and organize key insights from these sources:';
  if (type === 'study_guide') {
    synthesisPrompt = 'Generate a comprehensive, structured Study Guide based on these sources. Include key concepts, core principles, vocabulary terms, and 3 review quiz questions with answers:';
  } else if (type === 'briefing_doc') {
    synthesisPrompt = 'Generate an Executive Briefing Document synthesizing the primary findings, key quotes, and critical takeaways from these sources:';
  } else if (type === 'faq') {
    synthesisPrompt = 'Generate a 5-question Frequently Asked Questions (FAQ) guide answering the most critical inquiries addressed in these sources:';
  } else if (type === 'audio_overview') {
    synthesisPrompt = "Generate an engaging dual-host podcast discussion script ('Host Alex' and 'Host Morgan') discussing and dissecting these sources in an insightful, conversational NotebookLM style:";
  } else if (type === 'topics_covered') {
    synthesisPrompt = 'Analyze all the provided sources and generate a comprehensive, structured, categorized list of ALL topics, domains, subtopics, and key themes covered across the sources:';
  }

  const restResult = await callDirectGoogleRest({
    apiKey,
    model: model || 'gemini-3.5-flash-lite',
    contents: [{ role: 'user', parts: [{ text: `${synthesisPrompt}\n\n${combinedSources}` }] }],
    systemInstruction: 'You are an elite academic synthesizer. Produce beautifully formatted, insightful markdown documents.',
  });

  return {
    title: `${title} - ${type.replace('_', ' ').toUpperCase()}`,
    content: restResult.text,
    modelUsed: restResult.modelUsed,
  };
}

/**
 * Exam Schedule Photo Decoder (Express + Firebase Hosting compatible).
 */
export async function decodeExamScheduleImage(options: {
  imageDataUrl: string;
  mimeType?: string;
}): Promise<{ exams: Array<Record<string, string>>; modelUsed?: string }> {
  const { imageDataUrl, mimeType: explicitMime } = options;
  const apiKey = getActiveGeminiApiKey();

  const backendRes = await postBackendJson<{ exams: Array<Record<string, string>>; modelUsed?: string }>(
    '/api/gemini/decode-exam-schedule',
    { imageDataUrl, mimeType: explicitMime, apiKey },
    apiKey,
    45000
  );

  if (backendRes.status === 'ok') {
    return backendRes.data;
  }
  if (backendRes.status === 'http-error') {
    throw new Error(backendRes.error);
  }

  if (!apiKey) {
    throw new Error('Gemini API key is missing. Please add it in Settings.');
  }

  const [header, base64Data] = imageDataUrl.split('base64,');
  let mimeType = explicitMime || '';
  if (!mimeType || !mimeType.includes('/')) {
    const match = header.match(/data:([^;]+);/);
    mimeType = match?.[1] || 'image/png';
  }

  const extractionPrompt =
    'Inspect this exam schedule image carefully. Extract every individual exam row visible in the photo. ' +
    'Return ONLY a JSON object with shape {"exams":[{"course":"","title":"","date":"YYYY-MM-DD or readable date","time":"","venue":"","notes":""}]}.';

  const restResult = await callDirectGoogleRest({
    apiKey,
    model: 'gemini-3.5-flash-lite',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Data.trim() } },
          { text: extractionPrompt },
        ],
      },
    ],
    generationConfig: { responseMimeType: 'application/json' },
  });

  let parsed: { exams?: Array<Record<string, string>> } = { exams: [] };
  try {
    parsed = JSON.parse(restResult.text.trim());
  } catch {
    const match = restResult.text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }

  return {
    exams: Array.isArray(parsed.exams) ? parsed.exams : [],
    modelUsed: restResult.modelUsed,
  };
}

/**
 * Timetable Photo Decoder (Express + Firebase Hosting compatible).
 */
export async function decodeTimetableImage(options: {
  imageDataUrl: string;
  mimeType?: string;
}): Promise<{ slots: DecodedTimetableSlot[]; modelUsed?: string }> {
  const { imageDataUrl, mimeType: explicitMime } = options;
  const apiKey = getActiveGeminiApiKey();

  const prepped = await prepareTimetableImagesForDecoding(imageDataUrl, explicitMime || 'image/png');

  const backendRes = await postBackendJson<{ slots: Array<Record<string, any>>; modelUsed?: string }>(
    '/api/gemini/decode-timetable',
    {
      imageDataUrl,
      mimeType: explicitMime,
      imageParts: prepped.images,
      isWidePanoramic: prepped.isWidePanoramic,
      apiKey,
    },
    apiKey,
    75000
  );

  if (backendRes.status === 'ok') {
    return {
      slots: sanitizeDecodedTimetableSlots(backendRes.data.slots),
      modelUsed: backendRes.data.modelUsed,
    };
  }
  if (backendRes.status === 'http-error') {
    throw new Error(backendRes.error);
  }

  if (!apiKey) {
    throw new Error('Gemini API key is missing. Please add it in Settings.');
  }

  const parts: any[] = [];
  for (const imgPart of prepped.images) {
    const [hdr, b64] = imgPart.dataUrl.split('base64,');
    if (!b64) continue;
    let mType = imgPart.mimeType || explicitMime || '';
    if (!mType || !mType.includes('/')) {
      const m = hdr.match(/data:([^;]+);/);
      mType = m?.[1] || 'image/png';
    }
    if (prepped.images.length > 1) {
      parts.push({ text: `[Image view: ${imgPart.label}]` });
    }
    parts.push({ inlineData: { mimeType: mType, data: b64.trim() } });
  }

  const multiViewNote =
    prepped.images.length > 1 || prepped.isWidePanoramic
      ? 'You are provided zoomed left and right views (each keeping the weekday/header labels on the left) plus the full overview so every small cell is legible. Align every class accurately to its row weekday and its column Start/End header times across the full table, and output each unique class ONCE without duplicates. '
      : '';

  const extractionPrompt =
    'Inspect this weekly timetable image carefully and extract EVERY SINGLE scheduled class across ALL days (Mon through Sun) and ALL time columns. ' +
    'NEVER stop after 1 class or 1 day—scan every row and every column from start to finish! ' +
    multiViewNote +
    'STEP 1: Read the Start/End time header row left-to-right into "timeColumns" with 1-based colIndex, 24-hour HH:MM startTime/endTime, and isBreak (true for Lunch/Break). ' +
    'STEP 2: For each weekday row, skip empty slot codes (like A11, A13, A21, B13, A23, D24, TAA1, L31+L32, Lunch, THEORY), and extract ALL actual class cells. ' +
    'For hyphenated/slot-grid cells (e.g. A11-MAT3003-LT-AB02-418-ALL), put verbatim cell text in "rawCellText", drop ALL slot codes/prefixes, map type tag (P->Lab, T->Tutorial, LT/LTP->Lecture) and drop it, drop "-ALL", put ONLY course code in "subject", and ONLY room code in "room". ' +
    'Return ONLY a JSON object with shape {"timeColumns":[{"colIndex":1,"startTime":"HH:MM","endTime":"HH:MM","isBreak":false}],"slots":[{"day":"Mon|Tue|Wed|Thu|Fri|Sat|Sun","colIndex":1,"startTime":"HH:MM","endTime":"HH:MM","rawCellText":"","subject":"","room":"","kind":"Lecture|Lab|Tutorial|Study"}]}.';

  parts.push({ text: extractionPrompt });

  const restResult = await callDirectGoogleRest({
    apiKey,
    model: 'gemini-4-hydrogen',
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: { responseMimeType: 'application/json' },
    timeoutMs: 75000,
  });

  let parsed: { timeColumns?: any[]; slots?: Array<Record<string, any>> } = { slots: [] };
  try {
    parsed = JSON.parse(restResult.text.trim());
  } catch {
    const match = restResult.text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }

  return {
    slots: sanitizeDecodedTimetableSlots(parsed.slots, 'Mon', parsed.timeColumns),
    modelUsed: restResult.modelUsed,
  };
}

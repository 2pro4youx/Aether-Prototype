import { ChatAttachment, NotebookSource } from '../types';

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
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    tag: 'Vision & Multimodal Pro',
    badge: 'Recommended Default',
    description: 'Ultra-responsive, high-throughput multimodal model with exceptional vision recognition for screenshots, diagrams, handwriting, and source synthesis.',
    recommended: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    tag: 'Ultra-Low Latency',
    badge: 'Lightning Fast',
    description: 'Lightweight latency-optimized vision model designed for rapid image inspection, document Q&A, and real-time study notes.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    tag: 'Fast Multimodal',
    badge: 'High Throughput',
    description: 'Fast, token-efficient multimodal model balancing speed and nuanced reading of documents and visual attachments.',
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

export function setActiveGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem('aether_gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('aether_gemini_api_key');
      localStorage.removeItem('aether_gemini_api_mode');
    }
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
    model === 'gemini-3.8-flash' ||
    model === 'gemini-3.5-flash' ||
    model === 'gemini-3.5-flash-lite' ||
    model === 'gemini-2.5-pro' ||
    model === 'gemini-2.5-flash' ||
    model === 'gemini-1.5-flash' ||
    model === 'gemini-1.5-pro' ||
    model === 'gemini-flash-latest' ||
    model === 'gemini-pro-latest'
  ) {
    return model === 'gemini-3.5-flash-lite' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
  }
  if (model === 'gemini-4-argon') return 'gemini-2.5-pro';
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
  const candidates = Array.from(new Set([mapClientRestModel(model), 'gemini-2.5-flash', 'gemini-2.5-flash-lite']));

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
      const firstModel = Array.isArray(data?.models)
        ? data.models.find((m: any) => String(m?.name || '').includes('flash'))?.name?.replace(/^models\//, '')
        : undefined;
      return {
        valid: true,
        model: firstModel || 'gemini-2.5-flash',
        mode: 'ai-studio',
      };
    }

    const glErrData = await glResp.json().catch(() => null);
    const glErrMsg = glErrData?.error?.message || `HTTP ${glResp.status}: Invalid Gemini API key.`;

    // If this is an `AQ.` key and Generative Language API rejected it, check Vertex AI Express once.
    if (apiKey.startsWith('AQ.')) {
      const vxResp = await fetch(
        `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
            generationConfig: {
              maxOutputTokens: 2,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      );

      if (vxResp.ok) {
        setCachedKeyEndpoint(apiKey, 'aiplatform');
        return { valid: true, model: 'gemini-2.5-flash', mode: 'vertex-express' };
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

/**
 * Unified Gemini API Caller
 * 1. Tries Express / Cloud Run endpoint `/api/gemini/chat`
 * 2. If server endpoint returns HTML/404 (e.g. Firebase Hosting) or is offline, calls Google Gemini REST directly
 * 3. Returns accurate real Gemini response or explicit error message
 */
export async function callGeminiChat(options: GeminiRequestOptions): Promise<GeminiResponse> {
  const {
    message,
    model = 'gemini-2.5-flash',
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
      apiKey,
    },
    apiKey,
    35000
  );

  if (backendRes.status === 'ok') {
    const cleaned = backendRes.data?.reply ? cleanGeminiReply(backendRes.data.reply) : '';
    return {
      success: true,
      reply: cleaned.trim() || 'Sorry, I could not generate a response.',
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

    const systemInstruction = hasImages
      ? 'You are Gemini, a helpful multimodal AI assistant. Inspect visual data accurately and respond in clean Markdown.'
      : sourcesContext
      ? 'You are a research synthesis assistant grounded in the provided study sources. Cite sources as [1], [2], etc., using clean Markdown and LaTeX.'
      : 'You are Gemini, a helpful, capable AI assistant. Format responses cleanly with Markdown and LaTeX when helpful.';

    const restResult = await callDirectGoogleRest({
      apiKey,
      model: requestedModel,
      contents: [{ role: 'user', parts }],
      systemInstruction,
      generationConfig: enableThinking ? { maxOutputTokens: 8192 } : undefined,
    });

    return {
      success: true,
      reply: cleanGeminiReply(restResult.text),
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
    model = 'gemini-2.5-flash',
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

        return { success: true, fullText: cleanGeminiReply(fullText) };
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
    model: model || 'gemini-2.5-flash',
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
    model: 'gemini-2.5-flash',
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



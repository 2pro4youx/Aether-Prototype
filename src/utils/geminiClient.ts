import { GoogleGenAI, ThinkingLevel } from '@google/genai';
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
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    tag: 'Fast & Concise',
    badge: 'Recommended Default',
    description: 'Ultra-fast, highly capable default model for responsive research queries, multi-source synthesis, and everyday study.',
    recommended: true,
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    tag: 'Deep Reasoning & Long-Form',
    badge: 'Extended Thinking Pro',
    description: 'Extended reasoning engine with ThinkingLevel.HIGH configured to generate exhaustive, in-depth, long-form explanations with comprehensive STEM derivations.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    tag: 'Low Latency',
    badge: 'Ultra-Fast Lite',
    description: 'Lightweight latency-optimized model designed for rapid summarization, high-throughput study quizzes, and flashcards.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    tag: 'Extended Multimodal',
    badge: 'Long-Form Pro',
    description: 'Premier extended multimodal model with high token capacity configured to generate comprehensive, thorough, long-form analyses across code, documents, and vision.',
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    tag: 'Rolling Flash',
    badge: 'Auto-Updating',
    description: 'Rolling release track that automatically routes to Google AI Studio’s newest production Flash build without manual changes.',
  },
  {
    id: 'gemini-pro-latest',
    name: 'Gemini Pro Latest',
    tag: 'Rolling Pro',
    badge: 'Auto-Updating Pro',
    description: 'Rolling release track for the latest production Pro-tier model, delivering cutting-edge multimodal and reasoning performance.',
  },
];

export interface GeminiRequestOptions {
  message: string;
  model?: string;
  enableThinking?: boolean;
  sources?: Array<{ title: string; content: string } | NotebookSource>;
  attachments?: ChatAttachment[];
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
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
    }
  }
}

/**
 * Unified Gemini API Caller
 * 1. Tries Express / Cloud Run endpoint `/api/gemini/chat`
 * 2. If server endpoint is unreachable (404/500/offline), falls back to direct browser SDK call
 * 3. Returns accurate real Gemini response or explicit error message (never silent dummy text)
 */
export async function callGeminiChat(options: GeminiRequestOptions): Promise<GeminiResponse> {
  const {
    message,
    model = 'gemini-3.8-flash',
    enableThinking = false,
    sources = [],
    attachments = [],
    history = [],
  } = options;

  const apiKey = getActiveGeminiApiKey();

  // Format sources grounding if provided
  const formattedSources = sources.map((s) => ({
    title: s.title,
    content: 'fullContent' in s ? (s as NotebookSource).fullContent : (s as { content: string }).content,
  }));

  // Build message query incorporating attachments if text content exists
  let fullMessage = message;
  if (attachments.length > 0) {
    const attContext = attachments
      .map(
        (a) =>
          `[Attached File: ${a.name} (${a.type})]${
            a.textContent ? `\nContent excerpt:\n${a.textContent.slice(0, 15000)}` : ''
          }`
      )
      .join('\n\n');
    fullMessage = `${fullMessage ? `${fullMessage}\n\n` : ''}User attached files:\n${attContext}`;
  }

  // Strategy 1: Attempt Server Endpoint (/api/gemini/chat)
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['x-gemini-api-key'] = apiKey;
    }

    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: fullMessage,
        model,
        enableThinking,
        sources: formattedSources,
        history,
        apiKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.reply) {
        return {
          success: true,
          reply: data.reply,
          modelUsed: data.modelUsed || model,
          thinkingUsed: Boolean(data.thinkingUsed),
        };
      }
    } else {
      // If server returned a JSON error (e.g. 401 or 500)
      const errData = await res.json().catch(() => ({}));
      if (errData.error && !errData.error.includes('Cannot POST')) {
        console.warn('Backend Gemini API returned error:', errData.error);
        // If it's a backend error with a configured key, let's also try direct browser call
      }
    }
  } catch (backendErr) {
    console.warn('Backend server /api/gemini/chat unreachable, attempting direct client fallback...', backendErr);
  }

  // Strategy 2: Direct Client-Side Gemini Call using @google/genai SDK
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let sourcesContext = '';
      if (formattedSources.length > 0) {
        sourcesContext =
          `\n\n[Active Knowledge Sources for Grounding]:\n` +
          formattedSources
            .map((s, idx) => `[Source ${idx + 1}: ${s.title}]\n${s.content}\n`)
            .join('\n---\n');
      }

      const targetModel = enableThinking ? 'gemini-4-argon' : model;
      const isExtendedModel =
        enableThinking ||
        targetModel === 'gemini-4-argon' ||
        targetModel === 'gemini-2.5-pro' ||
        targetModel === 'gemini-pro-latest';

      const systemInstruction = isExtendedModel
        ? (sourcesContext
            ? `You are an expert research and academic synthesis assistant using Gemini extended reasoning mode. ` +
              `Generate thorough, exhaustive, in-depth, and well-structured long-form explanations by default. ` +
              `Deeply unpack every facet of the inquiry, cite relevant knowledge sources as [1], [2], etc., provide thorough step-by-step conceptual breakdowns, rigorous mathematical derivations with explicit LaTeX equations, code examples with inline annotations where applicable, and nuanced synthesis. Do not abbreviate or provide terse answers; deliver fully developed, highly detailed explanations.`
            : `You are Gemini in extended reasoning mode, built by Google. ` +
              `Generate comprehensive, in-depth, thorough, and exhaustive long-form responses by default. ` +
              `Break down topics methodically with rich conceptual detail, step-by-step logical reasoning, complete mathematical proofs and derivations with full intermediate steps in LaTeX, practical code implementations, and multi-perspective analysis. Avoid superficial summaries or brief answers; provide expansive, complete, and thoroughly articulated explanations. Format with clean Markdown, clear section headings, structured bullet points, and KaTeX math formulas.`)
        : (sourcesContext
            ? `You are a research synthesis assistant grounded in the provided study sources. ` +
              `Strictly ground your answers in the provided knowledge sources, citing sources as [1], [2], etc. ` +
              `Format your responses using clean Markdown, bullet points, and LaTeX math formulas when applicable.`
            : `You are Gemini, a helpful, capable, and thoughtful AI assistant built by Google. ` +
              `Respond naturally, directly, intelligently, and conversationally without being subservient. ` +
              `Format your responses using clean Markdown, bullet points, and LaTeX math formulas when applicable.`);

      const config: Record<string, unknown> = {
        systemInstruction,
      };

      // Extended models receive a high token budget for expansive long-form generation by default
      if (isExtendedModel) {
        config.maxOutputTokens = 8192;
      }

      if (enableThinking || targetModel === 'gemini-4-argon') {
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
      }

      const promptWithContext = sourcesContext
        ? `${sourcesContext}\n\nUser Question:\n${fullMessage}`
        : fullMessage;

      // Candidate models in priority order (strictly valid active models; gemini-2.5-flash deprecated)
      const candidateModels = [
        targetModel,
        'gemini-3.8-flash',
        'gemini-4-argon',
        'gemini-3.1-flash-lite',
        'gemini-2.5-pro',
        'gemini-flash-latest',
        'gemini-pro-latest',
      ].filter((v, i, a) => a.indexOf(v) === i);

      let genResult: any = null;
      let usedModel = targetModel;
      let lastClientErr: any = null;

      for (const m of candidateModels) {
        try {
          const attempt = await ai.models.generateContent({
            model: m,
            contents: promptWithContext,
            config,
          });
          genResult = attempt;
          usedModel = m;
          break;
        } catch (err: any) {
          lastClientErr = err;
          if (config.thinkingConfig) {
            try {
              const noThinking = { ...config };
              delete noThinking.thinkingConfig;
              const fallbackAttempt = await ai.models.generateContent({
                model: m,
                contents: promptWithContext,
                config: noThinking,
              });
              genResult = fallbackAttempt;
              usedModel = m;
              break;
            } catch {
              // continue to next model
            }
          }
        }
      }

      if (genResult?.text) {
        return {
          success: true,
          reply: genResult.text,
          modelUsed: usedModel,
          thinkingUsed: Boolean(enableThinking),
        };
      }

      if (lastClientErr) {
        return {
          success: false,
          error: lastClientErr.message,
          reply: `⚠️ **Gemini API Error**: ${lastClientErr.message}\n\nPlease check your API key in **Settings > Gemini Model Hub** or verify network connectivity.`,
        };
      }
    } catch (clientErr: any) {
      return {
        success: false,
        error: clientErr.message,
        reply: `⚠️ **Gemini API Error**: ${clientErr.message}\n\nPlease check your API key in **Settings > Gemini Model Hub**.`,
      };
    }
  }

  // If no API key is found at all
  return {
    success: false,
    error: 'API_KEY_NOT_FOUND',
    reply: `⚠️ **Gemini API Key Required**\n\nNo API key was detected. Please ensure **GEMINI_API_KEY** is configured in your \`.env\` file or paste your API key in **Settings > Gemini Model Hub** to activate live AI responses.`,
  };
}

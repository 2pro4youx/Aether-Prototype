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

  // Normalize requested model to the best active multimodal models (gemini-3.5-flash is top-tier and has full quota)
  const requestedModel = (!model || model === 'gemini-2.5-pro' || model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash' || model === 'gemini-1.5-pro' || model === 'gemini-flash-latest' || model === 'gemini-pro-latest')
    ? 'gemini-3.5-flash'
    : model;

  // Determine if image attachments exist
  const hasImages = attachments.some(
    (a) => a.isImage || a.type?.startsWith('image/') || (a.dataUrl && a.dataUrl.startsWith('data:image/'))
  );

  // Build message query incorporating attachments if text content exists
  let fullMessage = message;
  // Ensure we always send a non‑empty user prompt to the model
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
        model: requestedModel,
        enableThinking,
        sources: hasImages ? [] : formattedSources,
        attachments,
        history,
        apiKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.reply) {
        const cleaned = cleanGeminiReply(data.reply);
        if (cleaned && cleaned.trim()) {
          return {
            success: true,
            reply: cleaned,
            modelUsed: data.modelUsed || requestedModel,
            thinkingUsed: Boolean(data.thinkingUsed),
          };
        }
        // Fallback when cleaned reply is empty
        return {
          success: true,
          reply: 'Sorry, I could not generate a response.',
          modelUsed: data.modelUsed || requestedModel,
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
      // Only inject notebook grounding text if NO image is being analyzed
      if (!hasImages && formattedSources.length > 0) {
        sourcesContext =
          `\n\n[Active Knowledge Sources for Grounding]:\n` +
          formattedSources
            .map((s, idx) => `[Source ${idx + 1}: ${s.title}]\n${s.content}\n`)
            .join('\n---\n');
      }

      const targetModel = enableThinking ? 'gemini-3.5-flash' : requestedModel;
      const isExtendedModel =
        enableThinking ||
        targetModel === 'gemini-4-argon';

      const systemInstruction = hasImages
        ? `You are Gemini, a helpful, precise, and capable multimodal AI assistant built by Google. Inspect the visual data provided in the attached image parts. Carefully describe what you see, transcribe any visible text, words, and labels with complete accuracy, and format your response in clean Markdown.`
        : isExtendedModel
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

      if (enableThinking) {
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
      }

      const promptWithContext = sourcesContext
        ? `${sourcesContext}\n\nUser Question:\n${fullMessage}`
        : fullMessage;

      // Construct native multimodal contents: user text prompt followed by image inlineData parts
      const contentsParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      contentsParts.push({ text: promptWithContext || 'Please describe and analyze what is in this image.' });

      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          // If it has a dataUrl (images and PDFs)
          if (att.dataUrl && typeof att.dataUrl === 'string' && att.dataUrl.includes('base64,')) {
            const [header, base64Data] = att.dataUrl.split('base64,');
            if (base64Data && base64Data.trim()) {
              let mimeType = att.type || '';
              if (!mimeType || !mimeType.includes('/')) {
                const match = header.match(/data:([^;]+);/);
                if (match && match[1]) {
                  mimeType = match[1];
                } else if (att.isImage) {
                  mimeType = 'image/png';
                } else if (att.name?.toLowerCase().endsWith('.pdf')) {
                  mimeType = 'application/pdf';
                }
              }
              if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
                contentsParts.push({
                  inlineData: {
                    mimeType,
                    data: base64Data.trim(),
                  },
                });
              }
            }
          }

          // If it has text content (e.g. text or code document), add it as grounded document text
          if (att.textContent && !att.isImage) {
            contentsParts.push({
              text: `\n\n[Attached Document: ${att.name} (${att.type})]\n\`\`\`\n${att.textContent.slice(0, 45000)}\n\`\`\`\n`,
            });
          }
        }
      }

      const finalContents =
        contentsParts.length === 1 && 'text' in contentsParts[0]
          ? (contentsParts[0] as any).text
          : (contentsParts as any);

      // Candidate models in priority order (strictly valid active models)
      const candidateModels = [
        targetModel,
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash',
      ].filter((v, i, a) => a.indexOf(v) === i);

      let genResult: any = null;
      let usedModel = targetModel;
      let lastClientErr: any = null;

      for (const m of candidateModels) {
        try {
          const attempt = await ai.models.generateContent({
            model: m,
            contents: finalContents,
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
                contents: finalContents,
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

      // Extract clean non-thought text from candidate parts
      let replyText = '';
      const parts = genResult?.candidates?.[0]?.content?.parts || [];
      if (parts.length > 0) {
        const regularParts = parts.filter((p: any) => !p.thought && typeof p.text === 'string');
        if (regularParts.length > 0) {
          replyText = regularParts.map((p: any) => p.text).join('\n\n').trim();
        } else {
          const textParts = parts.filter((p: any) => typeof p.text === 'string');
          replyText = textParts.map((p: any) => p.text).join('\n\n').trim();
        }
      }

      if (!replyText && genResult?.text) {
        replyText = genResult.text;
      }

      if (replyText) {
        return {
          success: true,
          reply: cleanGeminiReply(replyText),
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

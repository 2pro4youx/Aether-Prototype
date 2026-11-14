import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env, falling back to .env.local and .env.example
dotenv.config();
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: path.resolve(__dirname, '.env.local') });
}
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: path.resolve(__dirname, '.env.example') });
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

// Helper to extract clean API key from request or environment
function resolveApiKey(req?: express.Request): string {
  const reqKey = (req?.headers['x-gemini-api-key'] as string) || (req?.body?.apiKey as string);
  const rawKey = reqKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  return rawKey.replace(/^["']|["']$/g, '').trim();
}

const vertexKeyCache = new Map<string, 'generativelanguage' | 'aiplatform'>();

function isAuthErrorStatus(status: number | undefined, message: string): boolean {
  if (status === 400 || status === 401 || status === 403) {
    const lower = message.toLowerCase();
    if (
      lower.includes('api key') ||
      lower.includes('api_key') ||
      lower.includes('permission') ||
      lower.includes('unauthorized') ||
      lower.includes('unauthenticated') ||
      lower.includes('invalid authentication') ||
      status === 401 ||
      status === 403
    ) {
      return true;
    }
  }
  return false;
}

function mapServerModel(model?: string): string {
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

async function verifyKeyFast(apiKey: string): Promise<{ valid: boolean; model?: string; mode?: string; error?: string }> {
  const cleanKey = apiKey.replace(/^["']|["']$/g, '').trim();
  if (!cleanKey || cleanKey.length < 16 || /\s/.test(cleanKey)) {
    return { valid: false, error: 'Invalid API key format.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    // 1. Always try native Google AI Studio / Generative Language API FIRST (~150ms).
    // Note: Modern Google AI Studio keys can start with either `AIza...` OR `AQ.Ab8...`.
    const glResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=8&key=${encodeURIComponent(cleanKey)}`,
      {
        method: 'GET',
        signal: controller.signal,
      }
    );

    if (glResp.ok) {
      vertexKeyCache.set(cleanKey, 'generativelanguage');
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

    const glErrJson = await glResp.json().catch(() => null);
    const glErrMsg = glErrJson?.error?.message || `HTTP ${glResp.status}: Invalid Gemini API key.`;

    // 2. If this is an `AQ.` key and Generative Language API rejected it, check Vertex AI Express once.
    if (cleanKey.startsWith('AQ.')) {
      const vxResp = await fetch(
        `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(cleanKey)}`,
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
        vertexKeyCache.set(cleanKey, 'aiplatform');
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
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { valid: false, error: 'Verification timed out. Please try again.' };
    }
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Verification request failed.',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callVertexExpressRest(
  apiKey: string,
  model: string,
  contents: any,
  config?: Record<string, any>
): Promise<{ text: string; modelUsed: string }> {
  const models = Array.from(
    new Set([mapServerModel(model), 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'])
  );
  let lastError: any = null;

  for (const m of models) {
    const normalizedContents =
      typeof contents === 'string'
        ? [{ role: 'user', parts: [{ text: contents }] }]
        : contents?.parts
        ? [{ role: 'user', parts: contents.parts }]
        : Array.isArray(contents)
        ? [{ role: 'user', parts: contents }]
        : [{ role: 'user', parts: [{ text: String(contents || '') }] }];

    const body: Record<string, any> = {
      contents: normalizedContents,
    };
    if (config?.systemInstruction) {
      body.systemInstruction = { parts: [{ text: String(config.systemInstruction) }] };
    }
    const generationConfig: Record<string, any> = {};
    if (config?.maxOutputTokens) generationConfig.maxOutputTokens = config.maxOutputTokens;
    if (config?.responseMimeType) generationConfig.responseMimeType = config.responseMimeType;
    if (config?.responseSchema) generationConfig.responseSchema = config.responseSchema;
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    const resp = await fetch(
      `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (resp.ok) {
      const data = await resp.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter((p: any) => !p.thought && typeof p.text === 'string')
        .map((p: any) => p.text)
        .join('\n\n')
        .trim();
      return { text: text || 'No response generated from the model.', modelUsed: m };
    }

    const errJson = await resp.json().catch(() => null);
    const errMessage = errJson?.error?.message || `HTTP ${resp.status}: ${resp.statusText}`;
    lastError = new Error(errMessage);
    if (isAuthErrorStatus(resp.status, errMessage)) {
      throw lastError;
    }
  }

  throw lastError || new Error('Vertex AI Express request failed.');
}

// Instant API Key Verification Endpoint (< 500ms, zero multi-model stalls)
app.post('/api/gemini/verify', async (req, res) => {
  const apiKey = resolveApiKey(req);
  if (!apiKey) {
    return res.status(400).json({ valid: false, error: 'Please provide a Gemini API key.' });
  }
  const result = await verifyKeyFast(apiKey);
  if (!result.valid) {
    return res.status(401).json(result);
  }
  return res.json(result);
});

// Health & Connection Check Endpoint
app.get('/api/gemini/status', async (req, res) => {
  const apiKey = resolveApiKey(req);
  if (!apiKey) {
    return res.json({
      connected: false,
      error: 'GEMINI_API_KEY is not configured in .env or request headers.',
    });
  }

  const check = await verifyKeyFast(apiKey);
  if (check.valid) {
    return res.json({
      connected: true,
      model: check.model || 'gemini-3.5-flash-lite',
      reply: 'PONG',
      keyPreview: `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`,
    });
  }
  return res.json({
    connected: false,
    error: check.error || 'API Check failed',
    keyPreview: `${apiKey.substring(0, 6)}...`,
  });
});

// Helper to extract outermost balanced JSON object from a string
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

// Helper to clean up raw JSON tool calls (like dalle.text2im) and format them into
// human-readable markdown with live visual rendering via Pollinations AI.
function cleanGeminiReply(reply: string): string {
  if (!reply) return '';
  const trimmed = reply.trim();

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

        let thought = (parsed.thought || '').replace(
          /Since I cannot directly ['"]see['"] the user's local file in the same way a human sees a physical object,?\s*/gi,
          ''
        ).trim();

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
      // Fallback regex
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

// Grounded and Thinking Chat Endpoint
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const {
      message,
      model = 'gemini-3.5-flash-lite',
      enableThinking = false,
      sources = [],
      attachments = [],
      history = [],
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = resolveApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        error: 'Gemini API key is missing. Please add GEMINI_API_KEY to your .env file or Settings panel.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const hasImages = Array.isArray(attachments) && attachments.some(
      (a: any) => a.isImage || a.type?.startsWith('image/') || (a.dataUrl && a.dataUrl.startsWith('data:image/'))
    );

    // Build grounding context from active sources if provided (omitted if visual image is analyzed)
    let sourcesContext = '';
    if (!hasImages && Array.isArray(sources) && sources.length > 0) {
      sourcesContext =
        `\n\n[Active Knowledge Sources for Grounding]:\n` +
        sources
          .map(
            (s: { title: string; content: string }, idx: number) =>
              `[Source ${idx + 1}: ${s.title}]\n${s.content}\n`
          )
          .join('\n---\n');
    }

    // Normalize requested model to valid fast multimodal models
    const requestedModel = mapServerModel(model);

    const targetModel = enableThinking ? 'gemini-4-hydrogen' : requestedModel;
    const isExtendedModel =
      enableThinking ||
      model === 'gemini-4-argon';

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

    // If using high thinking mode
    if (enableThinking) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    // Construct prompt with history & grounding
    let promptWithContext = sourcesContext
      ? `${sourcesContext}\n\nUser Question:\n${message}`
      : message;

    if (hasImages && (!promptWithContext || promptWithContext.startsWith('Uploaded '))) {
      promptWithContext = 'Please examine the attached image in detail. Read any text, transcribe words/phrases, analyze visual elements, colors, and layout.';
    }

    // Construct native multimodal contents: user text prompt followed by image inlineData parts
    const contentsParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    contentsParts.push({ text: promptWithContext || 'Please describe and analyze what is in this image.' });

    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
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

    if (vertexKeyCache.get(apiKey) === 'aiplatform') {
      const vertexResult = await callVertexExpressRest(apiKey, targetModel, finalContents, config);
      return res.json({
        reply: cleanGeminiReply(vertexResult.text),
        modelUsed: vertexResult.modelUsed,
        thinkingUsed: Boolean(enableThinking || model === 'gemini-4-argon'),
      });
    }

    // Candidate fallback models in priority order (strictly valid active models)
    const candidateModels = [
      targetModel,
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-4-hydrogen',
    ].filter((v, i, a) => a.indexOf(v) === i);

    let response: any = null;
    let successfulModel = targetModel;
    let lastError: any = null;

    for (const m of candidateModels) {
      try {
        const attempt = await ai.models.generateContent({
          model: m,
          contents: finalContents,
          config,
        });
        response = attempt;
        successfulModel = m;
        break;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        const status = err?.status ?? err?.code;
        if (isAuthErrorStatus(typeof status === 'number' ? status : undefined, msg)) {
          throw err;
        }
        // If thinking config caused rejection, retry candidate without thinkingConfig
        if (config.thinkingConfig) {
          try {
            const noThinkingConfig = { ...config };
            delete noThinkingConfig.thinkingConfig;
            const attemptNoThinking = await ai.models.generateContent({
              model: m,
              contents: finalContents,
              config: noThinkingConfig,
            });
            response = attemptNoThinking;
            successfulModel = m;
            break;
          } catch (innerErr: any) {
            const innerMsg = String(innerErr?.message || innerErr);
            const innerStatus = innerErr?.status ?? innerErr?.code;
            if (isAuthErrorStatus(typeof innerStatus === 'number' ? innerStatus : undefined, innerMsg)) {
              throw innerErr;
            }
          }
        }
      }
    }

    if (!response && lastError) {
      throw lastError;
    }

    // Extract clean non-thought text from candidate parts
    let rawReply = '';
    const parts = response?.candidates?.[0]?.content?.parts || [];
    if (parts.length > 0) {
      const regularParts = parts.filter((p: any) => !p.thought && typeof p.text === 'string');
      if (regularParts.length > 0) {
        rawReply = regularParts.map((p: any) => p.text).join('\n\n').trim();
      } else {
        const textParts = parts.filter((p: any) => typeof p.text === 'string');
        rawReply = textParts.map((p: any) => p.text).join('\n\n').trim();
      }
    }

    if (!rawReply && response?.text) {
      rawReply = response.text;
    }

    if (!rawReply) {
      rawReply = 'No response generated from the model.';
    }

    const reply = cleanGeminiReply(rawReply);

    return res.json({
      reply,
      modelUsed: successfulModel,
      thinkingUsed: Boolean(enableThinking || targetModel === 'gemini-4-argon'),
    });
  } catch (err: unknown) {
    console.error('Gemini API Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal Gemini Server Error';
    return res.status(500).json({ error: errorMessage });
  }
});

// Server-Sent Events (SSE) Streaming Chat Endpoint
app.post('/api/gemini/stream', async (req, res) => {
  try {
    const {
      message,
      model = 'gemini-3.5-flash-lite',
      enableThinking = false,
      sources = [],
      attachments = [],
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = resolveApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        error: 'Gemini API key is missing. Please enter a valid key in Settings or Login.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const hasImages = Array.isArray(attachments) && attachments.some(
      (a: any) => a.isImage || a.type?.startsWith('image/') || (a.dataUrl && a.dataUrl.startsWith('data:image/'))
    );

    let sourcesContext = '';
    if (!hasImages && Array.isArray(sources) && sources.length > 0) {
      sourcesContext =
        `\n\n[Active Knowledge Sources for Grounding]:\n` +
        sources
          .map(
            (s: { title: string; content: string }, idx: number) =>
              `[Source ${idx + 1}: ${s.title}]\n${s.content}\n`
          )
          .join('\n---\n');
    }

    const targetModel = mapServerModel(enableThinking ? 'gemini-4-hydrogen' : model);
    const isExtendedModel = enableThinking || model === 'gemini-4-argon';

    const systemInstruction = hasImages
      ? `You are Gemini, a helpful, precise, and capable multimodal AI assistant built by Google. Inspect visual attachments and transcribe or analyze with precision.`
      : isExtendedModel
      ? (sourcesContext
          ? `You are an expert research and academic synthesis assistant using Gemini extended reasoning mode. Strictly cite sources as [1], [2], provide full mathematical derivations in LaTeX, and expansive deep analysis.`
          : `You are Gemini in extended reasoning mode, built by Google. Generate comprehensive, in-depth responses with clean Markdown and LaTeX formulas.`)
      : (sourcesContext
          ? `You are a research synthesis assistant grounded in the provided study sources. Cite sources as [1], [2].`
          : `You are Gemini, a helpful, capable, and thoughtful AI assistant built by Google.`);

    const config: Record<string, unknown> = { systemInstruction };
    if (isExtendedModel) config.maxOutputTokens = 8192;
    if (enableThinking) config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };

    const promptWithContext = sourcesContext ? `${sourcesContext}\n\nUser Question:\n${message}` : message;

    const contentsParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    contentsParts.push({ text: promptWithContext });

    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.dataUrl && typeof att.dataUrl === 'string' && att.dataUrl.includes('base64,')) {
          const [header, base64Data] = att.dataUrl.split('base64,');
          if (base64Data && base64Data.trim()) {
            let mimeType = att.type || 'image/png';
            contentsParts.push({ inlineData: { mimeType, data: base64Data.trim() } });
          }
        } else if (att.textContent && !att.isImage) {
          contentsParts.push({ text: `\n\n[Document: ${att.name}]\n${att.textContent.slice(0, 45000)}\n` });
        }
      }
    }

    const finalContents = contentsParts.length === 1 && 'text' in contentsParts[0]
      ? (contentsParts[0] as any).text
      : (contentsParts as any);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (vertexKeyCache.get(apiKey) === 'aiplatform') {
      const vertexResult = await callVertexExpressRest(apiKey, targetModel, finalContents, config);
      res.write(`data: ${JSON.stringify({ text: vertexResult.text })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }

    const stream = await ai.models.generateContentStream({
      model: targetModel,
      contents: finalContents,
      config,
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err: unknown) {
    console.error('Gemini Stream Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Streaming error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Stream failed' })}\n\n`);
      res.end();
    }
  }
});

// Helper for robust generation with automatic retry and model fallback (handles 503 high-demand spikes)
async function generateWithModelFallback(
  ai: GoogleGenAI,
  preferredModel: string,
  contents: any,
  config?: any
) {
  const candidateModels = [
    preferredModel,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-4-hydrogen',
  ];
  const uniqueModels = Array.from(new Set(candidateModels.filter(Boolean)));
  let lastError: any = null;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        if (response && (response.text !== undefined || (response.candidates && response.candidates.length > 0))) {
          return { response, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        console.warn(`[Gemini Fallback] Model ${model} (attempt ${attempt + 1}) encountered: ${msg}`);
        if (msg.includes('503') || msg.includes('429') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        } else {
          break;
        }
      }
    }
  }
  throw lastError;
}

// Quick Study Synthesis Generator (Study Guide, FAQ, Briefing, Audio Overview script)
app.post('/api/gemini/synthesize', async (req, res) => {
  try {
    const { type, sources = [], title = 'Research Synthesis', model: requestedModel } = req.body;
    
    if (!sources || sources.length === 0) {
      return res.status(400).json({ error: 'At least one source is required for synthesis' });
    }

    const combinedSources = sources
      .map((s: { title: string; content: string }, idx: number) => `[Source ${idx + 1}: ${s.title}]\n${s.content}`)
      .join('\n\n');

    let synthesisPrompt = '';
    switch (type) {
      case 'study_guide':
        synthesisPrompt = `Generate a comprehensive, structured Study Guide based on these sources. Include key concepts, core principles, vocabulary terms, and 3 review quiz questions with answers:`;
        break;
      case 'briefing_doc':
        synthesisPrompt = `Generate an Executive Briefing Document synthesizing the primary findings, key quotes, and critical takeaways from these sources:`;
        break;
      case 'faq':
        synthesisPrompt = `Generate a 5-question Frequently Asked Questions (FAQ) guide answering the most critical inquiries addressed in these sources:`;
        break;
      case 'audio_overview':
        synthesisPrompt = `Generate an engaging dual-host podcast discussion script ('Host Alex' and 'Host Morgan') discussing and dissecting these sources in an insightful, conversational NotebookLM style:`;
        break;
      case 'topics_covered':
        synthesisPrompt = `Analyze all the provided sources and generate a comprehensive, structured, categorized list of ALL topics, domains, subtopics, and key themes covered across the sources. Group them systematically with clear headers, bullet points, and concise explanatory summaries for each:`;
        break;
      default:
        synthesisPrompt = `Summarize and organize key insights from these sources:`;
    }

    const apiKey = resolveApiKey(req);
    if (!apiKey) {
      return res.status(401).json({ error: 'Gemini API key is missing.' });
    }

    if (vertexKeyCache.get(apiKey) === 'aiplatform') {
      const vertexResult = await callVertexExpressRest(
        apiKey,
        requestedModel || 'gemini-3.5-flash-lite',
        `${synthesisPrompt}\n\n${combinedSources}`,
        { systemInstruction: 'You are an elite academic synthesizer. Produce beautifully formatted, insightful markdown documents.' }
      );
      return res.json({
        title: `${title} - ${type.replace('_', ' ').toUpperCase()}`,
        content: vertexResult.text,
        modelUsed: vertexResult.modelUsed,
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    // Use fallback-enabled generator starting with gemini-3.5-flash-lite or requested model
    const primaryModel = mapServerModel(requestedModel || 'gemini-3.5-flash-lite');
    const { response, modelUsed } = await generateWithModelFallback(
      ai,
      primaryModel,
      `${synthesisPrompt}\n\n${combinedSources}`,
      {
        systemInstruction: 'You are an elite academic synthesizer. Produce beautifully formatted, insightful markdown documents.',
      }
    );

    return res.json({
      title: `${title} - ${type.replace('_', ' ').toUpperCase()}`,
      content: response.text || 'Synthesis could not be generated.',
      modelUsed,
    });
  } catch (err: unknown) {
    console.error('Synthesis Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to synthesize content';
    return res.status(500).json({ error: errorMessage });
  }
});

// Exam Schedule Photo Decoder Endpoint (Multimodal Gemini Vision -> Structured JSON)
app.post('/api/gemini/decode-exam-schedule', async (req, res) => {
  try {
    const { imageDataUrl, mimeType: explicitMime } = req.body as {
      imageDataUrl?: string;
      mimeType?: string;
    };

    if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.includes('base64,')) {
      return res.status(400).json({ error: 'A valid base64 imageDataUrl of the exam schedule is required.' });
    }

    const apiKey = resolveApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        error: 'Gemini API key is missing. Configure GEMINI_API_KEY in Secrets or Settings.',
      });
    }

    const [header, base64Data] = imageDataUrl.split('base64,');
    let mimeType = explicitMime || '';
    if (!mimeType || !mimeType.includes('/')) {
      const match = header.match(/data:([^;]+);/);
      mimeType = match?.[1] || 'image/png';
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const extractionPrompt =
      'Inspect this exam schedule image carefully. Extract every individual exam row or entry visible in the photo. ' +
      'For each exam, normalize the date to YYYY-MM-DD when the year/month/day can be determined (otherwise keep the exact readable date string), ' +
      'preserve the course code/subject name, exam paper/type title, exam time window, venue/room/hall (if visible), and any seat/instructions notes.';

    const contents = {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data.trim(),
          },
        },
        {
          text: extractionPrompt,
        },
      ],
    };

    const config = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          exams: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                course: { type: Type.STRING, description: 'Course code or subject name' },
                title: { type: Type.STRING, description: 'Exam title or paper description' },
                date: { type: Type.STRING, description: 'Exam date (YYYY-MM-DD if known)' },
                time: { type: Type.STRING, description: 'Start and end time or session slot' },
                venue: { type: Type.STRING, description: 'Exam room, hall, or location' },
                notes: { type: Type.STRING, description: 'Seat number, reporting time, or extra notes' },
              },
              required: ['course', 'title', 'date', 'time'],
            },
          },
        },
        required: ['exams'],
      },
    };

    if (vertexKeyCache.get(apiKey) === 'aiplatform') {
      const vertexResult = await callVertexExpressRest(apiKey, 'gemini-3.5-flash-lite', contents, config);
      const rawVertex = vertexResult.text.trim();
      let parsedVertex: { exams?: Array<Record<string, string>> } = { exams: [] };
      try {
        parsedVertex = JSON.parse(rawVertex);
      } catch {
        const jsonMatch = rawVertex.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedVertex = JSON.parse(jsonMatch[0]);
        }
      }
      return res.json({
        exams: Array.isArray(parsedVertex.exams) ? parsedVertex.exams : [],
        modelUsed: vertexResult.modelUsed,
      });
    }

    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
    let response: any = null;
    let modelUsed = candidateModels[0];
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });
        modelUsed = modelName;
        break;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        const status = err?.status ?? err?.code;
        if (isAuthErrorStatus(typeof status === 'number' ? status : undefined, msg)) {
          throw err;
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to decode exam schedule image.');
    }

    const rawText = (response.text ?? '{}').trim();
    let parsed: { exams?: Array<Record<string, string>> } = { exams: [] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    const exams = Array.isArray(parsed.exams) ? parsed.exams : [];
    return res.json({ exams, modelUsed });
  } catch (err: unknown) {
    console.error('Exam Schedule Decode Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to decode exam schedule image';
    return res.status(500).json({ error: errorMessage });
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

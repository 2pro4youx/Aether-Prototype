import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
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

// Health & Connection Check Endpoint
app.get('/api/gemini/status', async (req, res) => {
  const apiKey = resolveApiKey(req);
  if (!apiKey) {
    return res.json({
      connected: false,
      error: 'GEMINI_API_KEY is not configured in .env or request headers.',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const ping = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Ping: Reply with "PONG".',
    });

    return res.json({
      connected: true,
      model: 'gemini-3.8-flash',
      reply: ping.text?.trim() || 'PONG',
      keyPreview: `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'API Check failed';
    return res.json({
      connected: false,
      error: errMsg,
      keyPreview: `${apiKey.substring(0, 6)}...`,
    });
  }
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
      model = 'gemini-3.8-flash',
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

    // Normalize requested model to the best active multimodal models (gemini-3.5-flash is ultra-reliable)
    const requestedModel = (!model || model === 'gemini-2.5-pro' || model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash' || model === 'gemini-1.5-pro' || model === 'gemini-flash-latest' || model === 'gemini-pro-latest')
      ? 'gemini-3.5-flash'
      : model;

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

    // Candidate fallback models in priority order (strictly valid active models)
    const candidateModels = [
      targetModel,
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
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
          } catch {
            // continue to next model candidate
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

// Quick Study Synthesis Generator (Study Guide, FAQ, Briefing, Audio Overview script)
app.post('/api/gemini/synthesize', async (req, res) => {
  try {
    const { type, sources = [], title = 'Research Synthesis' } = req.body;
    
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
      default:
        synthesisPrompt = `Summarize and organize key insights from these sources:`;
    }

    const apiKey = resolveApiKey(req);
    const ai = new GoogleGenAI(apiKey ? { apiKey } : {});
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `${synthesisPrompt}\n\n${combinedSources}`,
      config: {
        systemInstruction: 'You are an elite academic synthesizer. Produce beautifully formatted, insightful markdown documents.',
      },
    });

    return res.json({
      title: `${title} - ${type.replace('_', ' ').toUpperCase()}`,
      content: response.text || 'Synthesis could not be generated.',
    });
  } catch (err: unknown) {
    console.error('Synthesis Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to synthesize content';
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

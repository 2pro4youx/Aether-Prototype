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

// Grounded and Thinking Chat Endpoint
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const {
      message,
      model = 'gemini-3.8-flash',
      enableThinking = false,
      sources = [],
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

    // Build grounding context from active sources if provided
    let sourcesContext = '';
    if (Array.isArray(sources) && sources.length > 0) {
      sourcesContext =
        `\n\n[Active Knowledge Sources for Grounding]:\n` +
        sources
          .map(
            (s: { title: string; content: string }, idx: number) =>
              `[Source ${idx + 1}: ${s.title}]\n${s.content}\n`
          )
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

    // If using high thinking mode
    if (enableThinking || targetModel === 'gemini-4-argon') {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    // Construct prompt with history & grounding
    const promptWithContext = sourcesContext
      ? `${sourcesContext}\n\nUser Question:\n${message}`
      : message;

    // Candidate fallback models in priority order (strictly valid models, gemini-2.5-flash deprecated)
    const candidateModels = [
      targetModel,
      'gemini-3.8-flash',
      'gemini-4-argon',
      'gemini-3.1-flash-lite',
      'gemini-2.5-pro',
      'gemini-flash-latest',
      'gemini-pro-latest',
    ].filter((v, i, a) => a.indexOf(v) === i);

    let response: any = null;
    let successfulModel = targetModel;
    let lastError: any = null;

    for (const m of candidateModels) {
      try {
        const attempt = await ai.models.generateContent({
          model: m,
          contents: promptWithContext,
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
              contents: promptWithContext,
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

    const reply = response?.text || 'No response generated from the model.';

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

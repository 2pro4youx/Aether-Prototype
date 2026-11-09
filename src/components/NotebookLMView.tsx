import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Send,
  Sparkles,
  ExternalLink,
  Trash2,
  CheckSquare,
  Square,
  Brain,
  Headphones,
  FileText,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Bot,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileCode,
  File,
  X,
  Image as ImageIcon,
} from 'lucide-react';

import { NotebookSource, ColorPalette, ChatAttachment } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { callGeminiChat, AVAILABLE_GEMINI_MODELS } from '../utils/geminiClient';
import { useChatSmoothScroll } from '../hooks/useSmoothScroll';

interface NotebookLMViewProps {
  sources: NotebookSource[];
  workspaceId?: string;
  chatMessages?: ChatMessage[];
  onUpdateChatMessages?: (msgs: ChatMessage[]) => void;
  onToggleSource: (id: string) => void;
  onAddSource: (source: Omit<NotebookSource, 'id' | 'dateAdded'>) => void;
  onDeleteSource: (id: string) => void;
  onOpenOneNoteNotes: () => void;
  onOpenGeminiWorkspace?: () => void;
  selectedModel: string;
  onChangeModel?: (model: string) => void;
  enableThinking: boolean;
  activePalette: ColorPalette;
  darkMode: boolean;
  smoothScroll?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  attachments?: ChatAttachment[];
}

export const NotebookLMView: React.FC<NotebookLMViewProps> = ({
  sources,
  workspaceId,
  chatMessages,
  onUpdateChatMessages,
  onToggleSource,
  onAddSource,
  onDeleteSource,
  onOpenOneNoteNotes,
  onOpenGeminiWorkspace,
  selectedModel,
  onChangeModel,
  enableThinking,
  activePalette,
  darkMode,
  smoothScroll = true,
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeModelObj = AVAILABLE_GEMINI_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_GEMINI_MODELS[0];
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return chatMessages && chatMessages.length > 0
      ? chatMessages
      : [
          {
            id: 'm-welcome',
            role: 'assistant',
            content:
              'Welcome to your grounded NotebookLM workspace. Add sources on the left to ground neural synthesis, ask research questions, or click the **OneNote Canvas** arrow on the right sidebar to open your companion workspace.',
            timestamp: 'Just now',
            model: selectedModel,
          },
        ];
  });

  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      setMessages(chatMessages);
    } else {
      setMessages([
        {
          id: 'm-welcome',
          role: 'assistant',
          content:
            'Welcome to your grounded NotebookLM workspace. Add sources on the left to ground neural synthesis, ask research questions, or click the **OneNote Canvas** arrow on the right sidebar to open your companion workspace.',
          timestamp: 'Just now',
          model: selectedModel,
        },
      ]);
    }
  }, [workspaceId]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Smooth Momentum Scrolling for NotebookLM Chat Messages via Lenis
  const { wrapperRef: chatScrollRef, contentRef: chatContentRef, scrollToBottom } = useChatSmoothScroll<HTMLDivElement, HTMLDivElement>({
    enabled: smoothScroll,
    deps: [messages.length, isLoading],
  });

  const [studioOutput, setStudioOutput] = useState<{ title: string; content: string } | null>(null);

  // Deck minimization states to prevent clipping and give full widescreen focus
  const [isSourcesMinimized, setIsSourcesMinimized] = useState(false);
  const [isStudioMinimized, setIsStudioMinimized] = useState(false);

  // Add source form state
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [newSourceType, setNewSourceType] = useState<'pdf' | 'text' | 'web' | 'notes'>('pdf');

  // Preview source modal state
  const [previewSource, setPreviewSource] = useState<NotebookSource | null>(null);

  // Attached files state (images, pdfs, txt, md, csv, code)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
      const isTextOrCode = /\.(txt|md|csv|json|py|js|ts|tsx|jsx|html|css|c|cpp|rs|go|java|xml|yaml|yml|log|sh)$/i.test(file.name);
      const reader = new FileReader();

      if (isImage) {
        reader.onload = (e) => {
          const newAttachment: ChatAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: file.type || 'image',
            isImage: true,
            dataUrl: e.target?.result as string,
          };
          setAttachments((prev) => [...prev, newAttachment]);
        };
        reader.readAsDataURL(file);
      } else if (isTextOrCode) {
        reader.onload = (e) => {
          const textContent = typeof e.target?.result === 'string' ? e.target.result : '';
          const newAttachment: ChatAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: file.name.split('.').pop() || 'text',
            isImage: false,
            textContent: textContent.slice(0, 45000),
          };
          setAttachments((prev) => [...prev, newAttachment]);

          // Automatically ground new document into NotebookLM sources!
          onAddSource({
            title: file.name,
            type: 'text',
            excerpt: textContent.slice(0, 180) + '...',
            fullContent: textContent,
            words: textContent.split(/\s+/).filter(Boolean).length,
            selected: true,
          });
        };
        reader.readAsText(file);
      } else {
        // PDF or binary documents
        reader.onload = (e) => {
          const newAttachment: ChatAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: file.name.split('.').pop() || 'document',
            isImage: false,
            dataUrl: e.target?.result as string,
          };
          setAttachments((prev) => [...prev, newAttachment]);

          // Automatically ground PDF into NotebookLM sources!
          onAddSource({
            title: file.name,
            type: file.name.endsWith('.pdf') ? 'pdf' : 'text',
            excerpt: `Uploaded ${file.name} (${formatFileSize(file.size)})`,
            fullContent: `Uploaded document: ${file.name}. Size: ${formatFileSize(file.size)}`,
            words: 100,
            selected: true,
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const selectedSources = sources.filter((s) => s.selected);

  const handleStopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    const stoppedMsg: ChatMessage = {
      id: `stop-${Date.now()}`,
      role: 'assistant',
      content: '⏹️ *Response generation stopped by user.*',
      model: selectedModel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => {
      const updated = [...prev, stoppedMsg];
      onUpdateChatMessages?.(updated);
      return updated;
    });
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputQuery).trim();
    if ((!textToSend && attachments.length === 0) || isLoading) return;

    const currentAttachments = [...attachments];
    setAttachments([]);
    if (!customPrompt) setInputQuery('');

    const displayContent =
      textToSend ||
      (currentAttachments.length > 0
        ? `Uploaded ${currentAttachments.length} document${
            currentAttachments.length > 1 ? 's' : ''
          }: ${currentAttachments.map((a) => a.name).join(', ')}`
        : '');

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: displayContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    setMessages((prev) => {
      const updated = [...prev, userMessage];
      onUpdateChatMessages?.(updated);
      return updated;
    });
    setIsLoading(true);

    const ac = new AbortController();
    abortControllerRef.current = ac;

    let queryWithContext = textToSend || displayContent;
    if (currentAttachments.length > 0) {
      const attInfo = currentAttachments
        .map(
          (a) =>
            `[Attachment: ${a.name} (${a.type})]${
              a.textContent ? `\nContent:\n${a.textContent.slice(0, 10000)}` : ''
            }`
        )
        .join('\n\n');
      queryWithContext = `${queryWithContext}\n\nAttached user files:\n${attInfo}`;
    }

    try {
      const result = await callGeminiChat({
        message: queryWithContext,
        model: selectedModel,
        enableThinking,
        sources: selectedSources,
        attachments: currentAttachments,
      });

      if (ac.signal.aborted) return;

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        model: result.modelUsed || selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => {
        const updated = [...prev, assistantMessage];
        onUpdateChatMessages?.(updated);
        return updated;
      });
    } catch (err: unknown) {
      if (ac.signal.aborted) return;
      const errMsg = err instanceof Error ? err.message : 'Unknown AI connection error';
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Grounded AI Error**: ${errMsg}\n\nPlease verify that your Gemini API key is valid.`,
        model: selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => {
        const updated = [...prev, assistantMessage];
        onUpdateChatMessages?.(updated);
        return updated;
      });
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleStudioAction = async (type: 'study_guide' | 'briefing_doc' | 'faq' | 'audio_overview') => {
    if (selectedSources.length === 0) {
      alert('Please check at least one active source on the left to ground the studio generator.');
      return;
    }

    setIsSynthesizing(true);
    try {
      const res = await fetch('/api/gemini/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          sources: selectedSources.map((s) => ({ title: s.title, content: s.fullContent })),
          title: selectedSources[0]?.title || 'Research Synthesis',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Synthesis generation failed');

      setStudioOutput({
        title: data.title,
        content: data.content,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Synthesis failed';
      alert(`Synthesis generation error: ${errMsg}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleCreateSourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceTitle.trim() || !newSourceContent.trim()) return;

    const words = newSourceContent.trim().split(/\s+/).length;
    onAddSource({
      title: newSourceTitle.trim(),
      type: newSourceType,
      fullContent: newSourceContent.trim(),
      excerpt: newSourceContent.trim().slice(0, 160) + '...',
      words,
      selected: true,
    });

    setNewSourceTitle('');
    setNewSourceContent('');
    setShowAddSourceModal(false);
  };

  return (
    <div className="relative h-full flex-1 min-h-0 pt-20 pb-6 px-4 sm:px-6 lg:px-8 max-w-[1720px] w-full mx-auto flex flex-col gap-3.5 select-none">
      {/* Notebook Top Title Bar */}
      <div
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b shrink-0 ${
          darkMode ? 'border-white/10' : 'border-slate-200/90'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg text-slate-950 font-bold shrink-0"
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
          >
            <BookOpen className="w-5 h-5 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1
                className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                Frontier AI & Quantum Systems Research
              </h1>
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                style={{
                  backgroundColor: `${activePalette.primary}20`,
                  borderColor: `${activePalette.primary}50`,
                  color: darkMode ? '#ffffff' : activePalette.primary,
                }}
              >
                Grounded
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
              {sources.length} sources indexed ({selectedSources.length} selected for AI grounding) · 16:9 Studio Canvas
            </p>
          </div>
        </div>

        {/* Top Deck Quick Toggles */}
        <div className="flex items-center gap-2">
          {isSourcesMinimized && (
            <button
              onClick={() => setIsSourcesMinimized(false)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                darkMode
                  ? 'bg-slate-900/40 border-white/10 text-slate-300 hover:text-white hover:bg-slate-900'
                  : 'bg-white/90 border-slate-200 text-slate-700 hover:text-slate-950 shadow-sm'
              }`}
              title="Expand Sources Deck"
            >
              <PanelLeftOpen className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
              <span>Show Sources ({sources.length})</span>
            </button>
          )}

          {isStudioMinimized && (
            <button
              onClick={() => setIsStudioMinimized(false)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                darkMode
                  ? 'bg-slate-900/40 border-white/10 text-slate-300 hover:text-white hover:bg-slate-900'
                  : 'bg-white/90 border-slate-200 text-slate-700 hover:text-slate-950 shadow-sm'
              }`}
              title="Expand Studio Generators Deck"
            >
              <PanelRightOpen className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
              <span>Show Generators (4)</span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Zone Workspace Layout (Sources | Grounded Chat | Studio Generators) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 items-stretch w-full p-1 -m-1">
        {/* ================= LEFT PANEL: Sources Deck ================= */}
        {!isSourcesMinimized ? (
          <div
            className={`w-full lg:w-80 xl:w-88 shrink-0 liquid-glass rounded-2xl p-4 sm:p-5 border shadow-xl flex flex-col h-full overflow-hidden transition-all duration-300 ${
              darkMode ? 'border-white/10' : 'border-slate-200/90'
            }`}
          >
              <div className="flex items-center justify-between pb-3 shrink-0 border-b border-white/5">
                <div className="space-y-0.5">
                  <h2
                    className={`text-xs font-bold uppercase tracking-wider ${
                      darkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    Sources Deck
                  </h2>
                  <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Select sources to ground synthesis
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAddSourceModal(true)}
                    style={{
                      backgroundColor: `${activePalette.primary}20`,
                      borderColor: `${activePalette.primary}50`,
                      color: darkMode ? '#ffffff' : activePalette.primary,
                    }}
                    className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition hover:opacity-90 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>

                  {/* Minimize Source Deck Button */}
                  <button
                    type="button"
                    onClick={() => setIsSourcesMinimized(true)}
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                      darkMode
                        ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                        : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Minimize Sources Deck"
                    aria-label="Minimize Sources Deck"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sources List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 pt-3 no-scrollbar">
                {sources.map((source, index) => (
                  <div
                    key={source.id}
                    className={`p-3.5 rounded-xl border transition group liquid-glass-tile ${
                      source.selected
                        ? darkMode
                          ? 'border-amber-500/50 shadow-sm'
                          : 'border-amber-500/60 shadow-sm text-slate-900'
                        : darkMode
                        ? 'border-white/5 opacity-70 hover:opacity-100'
                        : 'border-slate-200/80 opacity-80 hover:opacity-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        onClick={() => onToggleSource(source.id)}
                        className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0"
                      >
                        <button
                          className="mt-0.5 shrink-0"
                          style={{ color: activePalette.primary }}
                          aria-label={source.selected ? 'Deselect source' : 'Select source'}
                        >
                          {source.selected ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                          )}
                        </button>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-[10px] font-mono font-bold"
                              style={{ color: activePalette.primary }}
                            >
                              [{index + 1}]
                            </span>
                            <h4
                              className={`text-xs font-bold truncate ${
                                darkMode ? 'text-slate-200' : 'text-slate-900'
                              }`}
                            >
                              {source.title}
                            </h4>
                          </div>
                          <p
                            className={`text-[11px] line-clamp-2 leading-relaxed ${
                              darkMode ? 'text-slate-400' : 'text-slate-600'
                            }`}
                          >
                            {source.excerpt}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-mono uppercase font-semibold ${
                            darkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {source.type}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => setPreviewSource(source)}
                            className={`p-1 rounded ${
                              darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                            }`}
                            title="Preview Full Content"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteSource(source.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-500"
                            title="Delete Source"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`flex items-center justify-between text-[10px] pt-2 border-t mt-2 font-mono ${
                        darkMode ? 'border-white/5 text-slate-400' : 'border-slate-200/80 text-slate-600'
                      }`}
                    >
                      <span>{source.words.toLocaleString()} words</span>
                      <span>{source.dateAdded}</span>
                    </div>
                  </div>
                ))}

                {sources.length === 0 && (
                  <div
                    className={`text-center py-10 text-xs ${
                      darkMode ? 'text-slate-500' : 'text-slate-500'
                    }`}
                  >
                    No sources added yet. Click &quot;Add&quot; to begin.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Minimized Sources Strip */
          <div
            onClick={() => setIsSourcesMinimized(false)}
            className={`w-full lg:w-14 shrink-0 liquid-glass rounded-2xl p-3 border shadow-xl flex flex-col items-center justify-between h-full overflow-hidden cursor-pointer transition-all duration-300 group ${
              darkMode
                ? activePalette.id === 'black-night'
                  ? 'border-white/10 hover:border-zinc-800'
                  : 'border-white/10 hover:border-white/30'
                : 'border-slate-200/90 hover:border-slate-400 shadow-sm'
            }`}
            title="Click to expand Sources Deck"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSourcesMinimized(false);
              }}
              className={`p-2 rounded-xl border transition group-hover:scale-110 ${
                darkMode ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200 shadow-sm'
              }`}
              style={{ color: activePalette.primary }}
              title="Expand Sources Deck"
              aria-label="Expand Sources Deck"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 [writing-mode:vertical-rl] rotate-180 py-4 select-none">
              <span
                className={`text-xs font-bold uppercase tracking-widest transition ${
                  darkMode ? 'text-slate-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-950'
                }`}
              >
                Sources ({sources.length})
              </span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-sm"
                style={{
                  backgroundColor: `${activePalette.primary}20`,
                  borderColor: `${activePalette.primary}50`,
                  color: darkMode ? '#ffffff' : activePalette.primary,
                }}
              >
                {selectedSources.length}/{sources.length}
              </span>
            </div>
          </div>
        )}

        {/* ================= CENTER PANEL: Grounded Chat & Synthesizer ================= */}
        <div
          className={`flex-1 min-w-0 w-full liquid-glass rounded-2xl p-4 sm:p-5 border shadow-xl flex flex-col h-full overflow-hidden transition-all duration-300 ${
            darkMode ? 'border-white/10' : 'border-slate-200/90'
          }`}
        >
          <div
            className={`flex items-center justify-between pb-3 border-b shrink-0 ${
              darkMode ? 'border-white/10' : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" style={{ color: activePalette.primary }} />
              <h3
                className={`text-sm font-bold ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                Grounded Neural Chat
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {/* On-the-Go Model Selector Dropdown */}
              <div className="relative z-40" ref={modelDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition select-none liquid-glass-tile cursor-pointer ${
                    darkMode
                      ? 'bg-slate-900/90 border-white/15 text-slate-200 hover:text-white hover:bg-slate-800'
                      : 'bg-white/95 border-slate-300 text-slate-800 hover:text-slate-950 hover:bg-white shadow-xs'
                  }`}
                  style={{
                    borderColor: isModelDropdownOpen ? `${activePalette.primary}80` : undefined,
                  }}
                  title="Switch Grounded Gemini Model"
                >
                  <Bot className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                  <span className="font-semibold">{activeModelObj.name}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 opacity-60 ${
                      isModelDropdownOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>

                {/* Dropdown Options Popup */}
                {isModelDropdownOpen && (
                  <div
                    style={{ zIndex: 100 }}
                    className={`absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border p-2 shadow-2xl z-[100] space-y-1.5 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150 ${
                      darkMode
                        ? 'bg-slate-900 border-white/20 text-slate-100 shadow-2xl shadow-black/80 ring-1 ring-white/10'
                        : 'bg-white border-slate-300 text-slate-900 shadow-2xl shadow-slate-400/50 ring-1 ring-black/5'
                    }`}
                  >
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/10 dark:border-white/10 border-slate-200 flex items-center justify-between">
                      <span>Select Model</span>
                      <span className="text-[9px] text-cyan-400 font-bold">{AVAILABLE_GEMINI_MODELS.length} Active</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                      {AVAILABLE_GEMINI_MODELS.map((m) => {
                        const isSelected = selectedModel === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              onChangeModel?.(m.id);
                              setIsModelDropdownOpen(false);
                            }}
                            className={`p-2.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition select-none border ${
                              isSelected
                                ? darkMode
                                  ? 'bg-slate-800/90 border-white/25 text-white font-semibold shadow-xs'
                                  : 'bg-slate-100 border-slate-300 text-slate-950 font-semibold shadow-xs'
                                : darkMode
                                ? 'border-transparent text-slate-300 hover:bg-white/10 hover:text-white'
                                : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: isSelected ? activePalette.primary : 'rgba(255,255,255,0.2)',
                                }}
                              />
                              <div className="truncate">
                                <p className="font-semibold truncate">{m.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono truncate">{m.tag}</p>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {enableThinking && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    darkMode
                      ? 'bg-red-950 border border-red-500/40 text-red-300'
                      : 'bg-red-100 border border-red-300 text-red-700'
                  }`}
                >
                  Thinking
                </span>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto py-3 pr-1 no-scrollbar overscroll-contain"
          >
            <div ref={chatContentRef} className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                      m.role === 'user'
                        ? 'text-white font-medium rounded-tr-none shadow-md'
                        : darkMode
                        ? 'bg-slate-900/40 border border-white/10 text-slate-100 rounded-tl-none'
                        : 'bg-white/95 border border-slate-200/90 text-slate-900 rounded-tl-none shadow'
                    }`}
                    style={
                      m.role === 'user'
                        ? {
                            background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                            color: '#ffffff',
                          }
                        : {}
                    }
                  >
                    {/* Attachments preview if present in message */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2.5">
                        {m.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border backdrop-blur-md bg-white/20 border-white/30 text-white"
                          >
                            {att.isImage && att.dataUrl ? (
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="w-10 h-10 rounded-lg object-cover border border-white/30"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/15 shrink-0">
                                {att.name.endsWith('.pdf') ? (
                                  <FileText className="w-4 h-4 text-rose-200" />
                                ) : /\.(py|js|ts|tsx|jsx|html|css|c|cpp|rs|go|java)$/i.test(att.name) ? (
                                  <FileCode className="w-4 h-4 text-cyan-200" />
                                ) : /\.(csv|xlsx|json)$/i.test(att.name) ? (
                                  <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                                ) : (
                                  <File className="w-4 h-4 text-amber-200" />
                                )}
                              </div>
                            )}
                            <div className="text-left overflow-hidden max-w-[170px]">
                              <p className="text-[11px] font-semibold truncate leading-tight text-white">
                                {att.name}
                              </p>
                              <p className="text-[9px] text-white/80 font-mono">
                                {att.sizeFormatted}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <MarkdownRenderer
                      content={m.content}
                      darkMode={darkMode}
                      isUser={m.role === 'user'}
                    />

                    <div
                      className={`flex items-center justify-between text-[10px] mt-2 pt-1.5 border-t font-mono ${
                        m.role === 'user'
                          ? 'border-white/25 text-white/85'
                          : darkMode
                          ? 'border-white/10 text-slate-400'
                          : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <span>{m.timestamp}</span>
                      {m.model && (
                        <span
                          className="font-semibold"
                          style={{ color: m.role === 'user' ? '#ffffff' : activePalette.primary }}
                        >
                          {m.model}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div
                  className={`flex items-center gap-2 text-xs font-mono p-3 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-900/30 border-white/10 text-amber-300'
                      : 'bg-amber-50/80 border-amber-200 text-amber-900'
                  }`}
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {enableThinking
                      ? 'Gemini 4 Argon running High Thinking deliberation across sources...'
                      : 'Synthesizing response from checked sources...'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Prompt Starters */}
          <div className="flex items-center gap-2 py-2 overflow-x-auto shrink-0 text-xs">
            <button
              onClick={() => handleSendMessage('Summarize the primary thesis across all active sources.')}
              className={`px-3 py-1.5 rounded-full border transition shrink-0 font-medium ${
                darkMode
                  ? 'bg-slate-800/30 text-slate-200 border-white/10 hover:bg-slate-800/60'
                  : 'bg-white/95 text-slate-800 border-slate-200/90 hover:bg-white hover:text-slate-950 shadow-sm'
              }`}
            >
              Summarize sources
            </button>
            <button
              onClick={() => handleSendMessage('Compare the core mechanism in Attention vs Synaptic Plasticity.')}
              className={`px-3 py-1.5 rounded-full border transition shrink-0 font-medium ${
                darkMode
                  ? 'bg-slate-800/30 text-slate-200 border-white/10 hover:bg-slate-800/60'
                  : 'bg-white/95 text-slate-800 border-slate-200/90 hover:bg-white hover:text-slate-950 shadow-sm'
              }`}
            >
              Compare mechanisms
            </button>
            <button
              onClick={() => handleSendMessage('Generate a 3-question conceptual quiz on these documents.')}
              className={`px-3 py-1.5 rounded-full border transition shrink-0 font-medium ${
                darkMode
                  ? 'bg-slate-800/30 text-slate-200 border-white/10 hover:bg-slate-800/60'
                  : 'bg-white/95 text-slate-800 border-slate-200/90 hover:bg-white hover:text-slate-950 shadow-sm'
              }`}
            >
              Quiz me
            </button>
          </div>

          {/* Input Box with + file attachment on left side */}
          <div
            className={`pt-2 border-t shrink-0 ${
              darkMode ? 'border-white/10' : 'border-slate-200/80'
            }`}
          >
            {/* Hidden File Input for images and documents */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.json,.docx,.py,.js,.ts,.tsx,.jsx,.html,.css,.c,.cpp,.rs,.go,.java,.xml,.yaml,.yml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFiles(e.target.files);
                }
                e.target.value = '';
              }}
            />

            {/* Pending Attachments Preview Tray */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2 p-1.5 rounded-xl bg-black/10 dark:bg-white/5 border border-white/10">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className={`flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg border text-[11px] font-medium backdrop-blur-md transition ${
                      darkMode
                        ? 'bg-white/10 border-white/15 text-slate-200'
                        : 'bg-slate-100 border-slate-300 text-slate-800'
                    }`}
                  >
                    {att.isImage && att.dataUrl ? (
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="w-5 h-5 rounded object-cover border border-white/20"
                      />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span className="max-w-[130px] truncate">{att.name}</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      ({att.sizeFormatted})
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="p-0.5 ml-0.5 rounded-full hover:bg-white/20 text-slate-400 hover:text-white transition cursor-pointer"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAttachments([])}
                  className="text-[10px] text-slate-400 hover:text-rose-400 px-1 font-mono transition cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* + Option on left side of chat input */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition select-none liquid-glass-tile onenote-section-tile cursor-pointer shadow-sm ${
                  attachments.length > 0
                    ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50 shadow-xs'
                    : darkMode
                    ? 'bg-slate-900/60 border-white/15 text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900 shadow-xs'
                }`}
                title="Upload images or documents (PDF, TXT, MD, CSV, Code, Docx)"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>

              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder={
                    attachments.length > 0
                      ? `Ask about ${attachments.length} attached document${attachments.length > 1 ? 's' : ''} or type math...`
                      : selectedSources.length > 0
                      ? `Ask about your ${selectedSources.length} selected sources or upload documents with +...`
                      : 'Select sources or click + to upload images & documents...'
                  }
                  className={`w-full pl-4 pr-12 py-3.5 rounded-xl border text-xs sm:text-sm shadow-inner transition focus:outline-none focus:ring-2 ${
                    darkMode
                      ? 'bg-slate-950/25 border-white/10 text-slate-100 placeholder-slate-500'
                      : 'bg-white/95 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                  }`}
                  style={{ borderColor: `${activePalette.primary}35` }}
                />
                {isLoading ? (
                  <button
                    type="button"
                    onClick={handleStopResponse}
                    className="absolute right-2 p-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition shadow cursor-pointer flex items-center justify-center animate-pulse"
                    title="Stop response"
                    aria-label="Stop response"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputQuery.trim() && attachments.length === 0}
                    style={{
                      background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                    }}
                    className="absolute right-2 p-2 rounded-lg text-slate-950 disabled:opacity-40 transition shadow hover:opacity-95 cursor-pointer"
                    title="Send message"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* ================= RIGHT PANEL: Studio Generators Deck ================= */}
        {!isStudioMinimized ? (
          <div
            className={`w-full lg:w-80 xl:w-88 shrink-0 liquid-glass rounded-2xl p-4 sm:p-5 border shadow-xl flex flex-col h-full overflow-hidden transition-all duration-300 ${
              darkMode ? 'border-white/10' : 'border-slate-200/90'
            }`}
          >
              <div className="flex items-center justify-between pb-3 shrink-0 border-b border-white/5">
                <div className="space-y-0.5">
                  <h3
                    className={`text-xs font-bold uppercase tracking-wide ${
                      darkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    Studio Generators
                  </h3>
                  <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Synthesize active sources in 1 click
                  </p>
                </div>

                {/* Minimize Studio Deck Button */}
                <button
                  type="button"
                  onClick={() => setIsStudioMinimized(true)}
                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                    darkMode
                      ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Minimize Studio Deck"
                  aria-label="Minimize Studio Deck"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              {/* 4 Studio Generators - Comfortable fit without clipping */}
              <div className="space-y-3 pt-3 flex-1 overflow-y-auto pr-0.5 no-scrollbar">
                <button
                  disabled={isSynthesizing}
                  onClick={() => handleStudioAction('audio_overview')}
                  className="w-full p-3 rounded-xl border transition flex items-center gap-3 text-left text-xs font-medium group liquid-glass-tile cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-amber-500/15 text-amber-500 group-hover:scale-105 transition shrink-0">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div>
                    <p
                      className={`font-semibold ${
                        darkMode ? 'text-slate-200' : 'text-slate-900'
                      }`}
                    >
                      Audio Overview Script
                    </p>
                    <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Deep dive dual-host podcast
                    </p>
                  </div>
                </button>

                <button
                  disabled={isSynthesizing}
                  onClick={() => handleStudioAction('study_guide')}
                  className="w-full p-3 rounded-xl border transition flex items-center gap-3 text-left text-xs font-medium group liquid-glass-tile cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-red-500/15 text-red-500 group-hover:scale-105 transition shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p
                      className={`font-semibold ${
                        darkMode ? 'text-slate-200' : 'text-slate-900'
                      }`}
                    >
                      Comprehensive Study Guide
                    </p>
                    <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Concepts, terms, and review quiz
                    </p>
                  </div>
                </button>

                <button
                  disabled={isSynthesizing}
                  onClick={() => handleStudioAction('briefing_doc')}
                  className="w-full p-3 rounded-xl border transition flex items-center gap-3 text-left text-xs font-medium group liquid-glass-tile cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-blue-500/15 text-blue-500 group-hover:scale-105 transition shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <p
                      className={`font-semibold ${
                        darkMode ? 'text-slate-200' : 'text-slate-900'
                      }`}
                    >
                      Executive Briefing Doc
                    </p>
                    <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Key takeaways and findings
                    </p>
                  </div>
                </button>

                <button
                  disabled={isSynthesizing}
                  onClick={() => handleStudioAction('faq')}
                  className="w-full p-3 rounded-xl border transition flex items-center gap-3 text-left text-xs font-medium group liquid-glass-tile cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-purple-500/15 text-purple-500 group-hover:scale-105 transition shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p
                      className={`font-semibold ${
                        darkMode ? 'text-slate-200' : 'text-slate-900'
                      }`}
                    >
                      Source FAQ
                    </p>
                    <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Essential questions answered
                    </p>
                  </div>
                </button>
              </div>

              {isSynthesizing && (
                <div
                  className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 font-mono shrink-0 mt-3 ${
                    darkMode
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-amber-100/90 border-amber-300 text-amber-900'
                  }`}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating synthesis document...</span>
                </div>
              )}
            </div>
          ) : (
          /* Minimized Studio Strip */
          <div
            onClick={() => setIsStudioMinimized(false)}
            className={`w-full lg:w-14 shrink-0 liquid-glass rounded-2xl p-3 border shadow-xl flex flex-col items-center justify-between h-full overflow-hidden cursor-pointer transition-all duration-300 group ${
              darkMode
                ? activePalette.id === 'black-night'
                  ? 'border-white/10 hover:border-zinc-800'
                  : 'border-white/10 hover:border-white/30'
                : 'border-slate-200/90 hover:border-slate-400 shadow-sm'
            }`}
            title="Click to expand Studio Generators Deck"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsStudioMinimized(false);
              }}
              className={`p-2 rounded-xl border transition group-hover:scale-110 ${
                darkMode ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200 shadow-sm'
              }`}
              style={{ color: activePalette.primary }}
              title="Expand Studio Deck"
              aria-label="Expand Studio Deck"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 [writing-mode:vertical-rl] py-4 select-none">
              <span
                className={`text-xs font-bold uppercase tracking-widest transition ${
                  darkMode ? 'text-slate-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-950'
                }`}
              >
                Studio Generators
              </span>
            </div>

            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-950 font-bold shadow"
              style={{
                background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
              }}
            >
              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            </div>
          </div>
        )}
      </div>

      {/* ================= FAINTED ARROW ON THE LEFT SIDEBAR (HYPRLAND GEMINI WORKSPACE TRIGGER) ================= */}
      {/* Symmetrical counterpart to OneNote's right trigger: slides Gemini Workspace in horizontally from left */}
      <aside
        aria-label="Gemini Workspace Launcher"
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 group pointer-events-auto"
      >
        <button
          onClick={onOpenGeminiWorkspace}
          aria-label="Open Fullscreen Gemini AI Workspace"
          className={`h-56 sm:h-64 w-9 sm:w-11 rounded-r-2xl border-r border-y flex flex-col items-center justify-center gap-2.5 opacity-60 hover:opacity-100 transition-all duration-300 cursor-pointer shadow-2xl backdrop-blur-2xl group hover:translate-x-1 ${
            darkMode
              ? 'bg-slate-900/50 hover:bg-slate-900/85 border-white/20'
              : 'bg-white/70 hover:bg-white/95 border-slate-300/80 shadow-slate-300/50'
          }`}
          style={{ color: activePalette.primary }}
          title="Click to slide open full Gemini AI chat workspace (Hyprland window switch)"
        >
          <div
            className="p-1.5 rounded-full border group-hover:scale-125 group-hover:-translate-x-0.5 transition-transform duration-300 shadow-sm"
            style={{
              backgroundColor: `${activePalette.primary}25`,
              borderColor: `${activePalette.primary}60`,
            }}
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span
            className={`[writing-mode:vertical-rl] rotate-180 text-[10px] font-mono tracking-widest uppercase font-bold transition-colors ${
              darkMode ? 'text-slate-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-950'
            }`}
          >
            Gemini Workspace
          </span>
          <span
            className={`text-[9px] font-mono px-1 py-0.5 rounded border [writing-mode:vertical-rl] rotate-180 opacity-60 group-hover:opacity-100 transition ${
              darkMode ? 'border-white/20 text-slate-400' : 'border-slate-400/30 text-slate-600'
            }`}
          >
            AI Chat
          </span>
        </button>
      </aside>

      {/* ================= FAINTED ARROW ON THE RIGHT SIDEBAR (HYPRLAND ONENOTE TRIGGER) ================= */}
      {/* Symmetrical counterpart to OneNote's left back-arrow: slides OneNote in horizontally from right */}
      <aside
        aria-label="OneNote Canvas Launcher"
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 group pointer-events-auto"
      >
        <button
          onClick={onOpenOneNoteNotes}
          aria-label="Open Fullscreen OneNote Multi-Tab Workspace"
          className={`h-56 sm:h-64 w-9 sm:w-11 rounded-l-2xl border-l border-y flex flex-col items-center justify-center gap-2.5 opacity-60 hover:opacity-100 transition-all duration-300 cursor-pointer shadow-2xl backdrop-blur-2xl group hover:-translate-x-1 ${
            darkMode
              ? 'bg-slate-900/50 hover:bg-slate-900/85 border-white/20'
              : 'bg-white/70 hover:bg-white/95 border-slate-300/80 shadow-slate-300/50'
          }`}
          style={{ color: activePalette.primary }}
          title="Click to slide open full OneNote multi-tab notebook (Hyprland window switch)"
        >
          <div
            className="p-1.5 rounded-full border group-hover:scale-125 group-hover:translate-x-0.5 transition-transform duration-300 shadow-sm"
            style={{
              backgroundColor: `${activePalette.primary}25`,
              borderColor: `${activePalette.primary}60`,
            }}
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span
            className={`[writing-mode:vertical-rl] text-[10px] font-mono tracking-widest uppercase font-bold transition-colors ${
              darkMode ? 'text-slate-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-950'
            }`}
          >
            OneNote Canvas
          </span>
          <span
            className={`text-[9px] font-mono px-1 py-0.5 rounded border [writing-mode:vertical-rl] opacity-60 group-hover:opacity-100 transition ${
              darkMode ? 'border-white/20 text-slate-400' : 'border-slate-400/30 text-slate-600'
            }`}
          >
            Tab ›
          </span>
        </button>
      </aside>

      {/* Synthesis Output Display Modal */}
      {studioOutput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div
            className={`liquid-glass rounded-2xl p-6 border w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col ${
              darkMode ? 'bg-slate-900/95 border-white/20 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b shrink-0 ${
                darkMode ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <h3 className="text-base font-bold" style={{ color: activePalette.primary }}>
                {studioOutput.title}
              </h3>
              <button
                onClick={() => setStudioOutput(null)}
                className={`text-xs ${
                  darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                ✕ Close
              </button>
            </div>
            <div
              className={`flex-1 overflow-y-auto text-xs sm:text-sm leading-relaxed font-sans pr-2 no-scrollbar ${
                darkMode ? 'text-slate-200' : 'text-slate-800'
              }`}
            >
              <MarkdownRenderer content={studioOutput.content} darkMode={darkMode} />
            </div>
            <div
              className={`pt-3 border-t flex justify-end shrink-0 ${
                darkMode ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <button
                onClick={() => {
                  navigator.clipboard.writeText(studioOutput.content);
                  alert('Copied synthesis to clipboard!');
                }}
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
                className="px-4 py-2 rounded-xl text-slate-950 font-bold text-xs shadow hover:opacity-90 transition"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Source Modal */}
      {showAddSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div
            className={`liquid-glass rounded-2xl p-6 border w-full max-w-lg shadow-2xl space-y-4 ${
              darkMode ? 'bg-slate-900/95 border-white/20 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`flex items-center justify-between pb-2 border-b ${
                darkMode ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <h3
                className={`text-base font-bold flex items-center gap-2 ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                <Plus className="w-4 h-4" style={{ color: activePalette.primary }} />
                <span>Add Source to NotebookLM</span>
              </h3>
              <button
                onClick={() => setShowAddSourceModal(false)}
                className={`text-xs ${
                  darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSourceSubmit} className="space-y-3.5">
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Source Title
                </label>
                <input
                  type="text"
                  required
                  value={newSourceTitle}
                  onChange={(e) => setNewSourceTitle(e.target.value)}
                  placeholder="e.g. FlashAttention 3 GPU Kernel Optimization..."
                  className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 border ${
                    darkMode
                      ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  style={{ borderColor: `${activePalette.primary}40` }}
                />
              </div>

              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Source Type
                </label>
                <select
                  value={newSourceType}
                  onChange={(e) => setNewSourceType(e.target.value as any)}
                  className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 border ${
                    darkMode
                      ? 'bg-slate-950 border-white/10 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="pdf">Research Paper / PDF Extract</option>
                  <option value="text">Lecture Notes / Textbook</option>
                  <option value="web">Web Article / Documentation</option>
                  <option value="notes">Personal Notes</option>
                </select>
              </div>

              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Content / Excerpt
                </label>
                <textarea
                  required
                  rows={6}
                  value={newSourceContent}
                  onChange={(e) => setNewSourceContent(e.target.value)}
                  placeholder="Paste research text, notes, equations, or transcript here..."
                  className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 border ${
                    darkMode
                      ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  style={{ borderColor: `${activePalette.primary}40` }}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSourceModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs ${
                    darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                  className="px-4 py-2 rounded-xl text-slate-950 font-bold text-xs shadow hover:opacity-90 transition"
                >
                  Index Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Source Modal */}
      {previewSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div
            className={`liquid-glass rounded-2xl p-6 border w-full max-w-xl shadow-2xl space-y-4 max-h-[80vh] flex flex-col ${
              darkMode ? 'bg-slate-900/95 border-white/20 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`flex items-center justify-between pb-2 border-b shrink-0 ${
                darkMode ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <h3
                className={`text-sm font-bold ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {previewSource.title}
              </h3>
              <button
                onClick={() => setPreviewSource(null)}
                className={`text-xs ${
                  darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                ✕ Close
              </button>
            </div>
            <div
              className={`flex-1 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap no-scrollbar ${
                darkMode ? 'text-slate-300' : 'text-slate-800'
              }`}
            >
              {previewSource.fullContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Grounded Academic RAG Generator based strictly on active user sources & attached files
function generateGroundedNotebookLMResponse(
  query: string,
  selectedSources: NotebookSource[],
  enableThinking: boolean,
  attachments?: ChatAttachment[]
): string {
  if ((!selectedSources || selectedSources.length === 0) && (!attachments || attachments.length === 0)) {
    return `⚠️ **No Sources Grounded**: Please select at least one active source in the left panel or upload files with **+** to ground your questions in verified documents.`;
  }

  const lower = query.toLowerCase();
  const totalCount = (selectedSources?.length || 0) + (attachments?.length || 0);
  const thinkingPrefix = enableThinking
    ? `> **Grounded Verification**: Cross-referencing query predicates against ${totalCount} active sources & documents...\n\n`
    : '';

  if (attachments && attachments.length > 0) {
    const attList = attachments
      .map((a) => `- **${a.name}** (${a.isImage ? 'Image' : a.type.toUpperCase()}, ${a.sizeFormatted})`)
      .join('\n');
    return `${thinkingPrefix}### Grounded Synthesis: ${attachments.length} Uploaded File${attachments.length > 1 ? 's' : ''} & Sources

Synthesizing evidence from your uploaded materials and active notebook sources:

${attList}

#### Document Key Insights:
1. **Multimodal Grounding**: Uploaded documents have been indexed and grounded directly into your workspace.
2. **Analysis for Query**: ${
      query.trim()
        ? `Regarding **"${query.trim()}"**, the uploaded content provides verified factual predicates for synthesis.`
        : 'The uploaded content is processed and ready for conceptual analysis, quiz generation, or notes synthesis.'
    }

---
**Sources & Uploads Consulted**:
${attachments.map((a, i) => `- **[U${i + 1}] ${a.name}** (${a.type.toUpperCase()})`).join('\n')}
${selectedSources.map((s, idx) => `- **[${idx + 1}] ${s.title}** (${s.type.toUpperCase()})`).join('\n')}`;
  }

  if (selectedSources.length === 0) {
    return `${thinkingPrefix}### Grounded Workspace Synthesis

No sources are currently selected in this workspace. Add or check documents in the **Sources Deck** on the left to ground neural queries and study syntheses.`;
  }

  if (lower.includes('attention') || lower.includes('softmax') || lower.includes('transformer')) {
    const s1 = selectedSources.find((s) => s.title.toLowerCase().includes('attention')) || selectedSources[0];
    return `${thinkingPrefix}### Grounded Synthesis: ${s1.title}

According to **${s1.title}**, self-attention calculates relationships between tokens without recurrence:

Mathematical Formulation: Attention(Q, K, V) = Softmax((Q * K^T) / sqrt(d_k)) * V

$$\\operatorname{Attention}(Q, K, V) = \\operatorname{Softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V$$

1. **Variance Normalization**: Dividing by $\\sqrt{d_k}$ prevents inner products from growing excessively large, ensuring the Softmax function operates with healthy gradients.
2. **Multi-Head Projection**: Allows parallel representation subspaces across positions.

---
**Sources Consulted**:
- **${s1.title}** (${s1.type.toUpperCase()})`;
  }

  if (lower.includes('quantum') || lower.includes('tomography') || lower.includes('density')) {
    const s2 = selectedSources.find((s) => s.title.toLowerCase().includes('quantum')) || selectedSources[0];
    return `${thinkingPrefix}### Grounded Synthesis: ${s2.title}

According to **${s2.title}**, quantum states and density matrices $\\rho$ satisfy fundamental invariants:

$$\\rho = \\sum_{i} p_i |\\psi_i\\rangle \\langle\\psi_i|, \\quad \\operatorname{Tr}(\\rho) = 1, \\quad \\rho \\ge 0$$

Pauli measurements along $X, Y, Z$ fully reconstruct the Bloch vector $\\vec{r}$ of a single qubit.

---
**Sources Consulted**:
- **${s2.title}** (${s2.type.toUpperCase()})`;
  }

  return `${thinkingPrefix}### Grounded Synthesis Across ${selectedSources.length} Sources

Grounded directly in your active study sources:
${selectedSources.map((s, idx) => `* **[${idx + 1}] ${s.title}**: ${s.excerpt}`).join('\n')}

#### Document Insights:
Your query **"${query}"** connects directly with the conceptual and mathematical structures documented across your active reading materials.

---
**Sources Consulted**:
${selectedSources.map((s, idx) => `- **[${idx + 1}] ${s.title}** (${s.type.toUpperCase()})`).join('\n')}`;
}

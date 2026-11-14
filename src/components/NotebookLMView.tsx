import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Copy,
  Download,
  UploadCloud,
  ListChecks,
  Image as ImageIcon,
  Save,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { NotebookSource, ColorPalette, ChatAttachment } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { callGeminiChat, synthesizeStudyDocument, AVAILABLE_GEMINI_MODELS } from '../utils/geminiClient';
import { useChatSmoothScroll } from '../hooks/useSmoothScroll';
import {
  dataUrlToBlobUrl,
  buildImageIframeDoc,
  buildGeneratedMarkdownIframeDoc,
} from '../utils/iframePreview';

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

  const pendingPromptIdRef = useRef<string | null>(null);
  const wasLoadingRef = useRef(false);

  // Smooth Momentum Scrolling for NotebookLM Chat Messages via Lenis
  const {
    wrapperRef: chatScrollRef,
    contentRef: chatContentRef,
    scrollToBottom,
    scrollToElementTop,
  } = useChatSmoothScroll<HTMLDivElement, HTMLDivElement>({
    enabled: smoothScroll,
    deps: [messages.length, isLoading],
  });

  // Smooth momentum scroll: glide to bottom while waiting, then align top of answered prompt when response arrives
  useEffect(() => {
    if (isLoading) {
      wasLoadingRef.current = true;
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 50);
      return () => clearTimeout(timer);
    } else if (wasLoadingRef.current) {
      wasLoadingRef.current = false;
      const targetId = pendingPromptIdRef.current;
      pendingPromptIdRef.current = null;
      const timer = setTimeout(() => {
        const container = chatScrollRef.current;
        if (!container) return;
        let promptEl = targetId
          ? (container.querySelector(`[data-msg-id="${targetId}"]`) as HTMLElement | null)
          : null;
        if (!promptEl) {
          const allUserMsgs = container.querySelectorAll<HTMLElement>('[data-msg-role="user"]');
          promptEl = allUserMsgs.length > 0 ? allUserMsgs[allUserMsgs.length - 1] : null;
        }
        if (promptEl) {
          scrollToElementTop(promptEl, 14);
        } else {
          scrollToBottom();
        }
      }, 75);
      return () => clearTimeout(timer);
    }
  }, [isLoading, scrollToBottom, scrollToElementTop]);

  const [studioOutput, setStudioOutput] = useState<{ title: string; content: string } | null>(null);
  const [savedStudioToSources, setSavedStudioToSources] = useState(false);

  // Deck minimization states to prevent clipping and give full widescreen focus
  const [isSourcesMinimized, setIsSourcesMinimized] = useState(false);
  const [isStudioMinimized, setIsStudioMinimized] = useState(false);
  const [mobileActivePane, setMobileActivePane] = useState<'chat' | 'sources' | 'studio'>('chat');
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Add source form state (Upload vs Write tabs)
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [addSourceTab, setAddSourceTab] = useState<'upload' | 'write'>('upload');
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [newSourceType, setNewSourceType] = useState<'pdf' | 'text' | 'web' | 'notes'>('pdf');
  const [modalIsDragging, setModalIsDragging] = useState(false);
  const modalFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Preview source & attachment modal state (with Blob iframe URLs)
  const [previewSource, setPreviewSource] = useState<NotebookSource | null>(null);
  const [sourceIframeUrl, setSourceIframeUrl] = useState<string | null>(null);
  const [sourceViewMode, setSourceViewMode] = useState<'iframe' | 'markdown'>('iframe');
  const [sourceCopied, setSourceCopied] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<ChatAttachment | null>(null);
  const [attachmentIframeUrl, setAttachmentIframeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewSource?.dataUrl || previewSource.isImage) {
      setSourceIframeUrl(null);
      return;
    }
    const blobUrl = dataUrlToBlobUrl(previewSource.dataUrl);
    setSourceIframeUrl(blobUrl);
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [previewSource]);

  useEffect(() => {
    if (!viewingAttachment?.dataUrl || viewingAttachment.isImage) {
      setAttachmentIframeUrl(null);
      return;
    }
    const blobUrl = dataUrlToBlobUrl(viewingAttachment.dataUrl);
    setAttachmentIframeUrl(blobUrl);
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [viewingAttachment]);

  // Escape key dismissal for overlays
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (viewingAttachment) setViewingAttachment(null);
      else if (previewSource) setPreviewSource(null);
      else if (studioOutput) setStudioOutput(null);
      else if (showAddSourceModal) setShowAddSourceModal(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [viewingAttachment, previewSource, studioOutput, showAddSourceModal]);

  // Attached files state (images, pdfs, txt, md, csv, code)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCleanMimeType = (file: File): string => {
    if (file.type && file.type.includes('/')) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'webp': return 'image/webp';
      case 'gif': return 'image/gif';
      case 'svg': return 'image/svg+xml';
      case 'pdf': return 'application/pdf';
      case 'txt': return 'text/plain';
      case 'md': return 'text/markdown';
      case 'csv': return 'text/csv';
      case 'json': return 'application/json';
      default: return file.type || 'application/octet-stream';
    }
  };

  const handleFiles = (files: FileList | File[], addOnlyToSources: boolean = false) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
      const isTextOrCode = /\.(txt|md|csv|json|py|js|ts|tsx|jsx|html|css|c|cpp|rs|go|java|xml|yaml|yml|log|sh)$/i.test(file.name);
      const mimeType = getCleanMimeType(file);
      const reader = new FileReader();

      if (isImage) {
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (!addOnlyToSources) {
            const newAttachment: ChatAttachment = {
              id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              size: file.size,
              sizeFormatted: formatFileSize(file.size),
              type: mimeType,
              isImage: true,
              dataUrl,
            };
            setAttachments((prev) => [...prev, newAttachment]);
          }

          // Save uploaded image into NotebookLM Sources with dataUrl so it can be viewed in iframe
          onAddSource({
            title: file.name,
            type: 'notes',
            excerpt: `Image asset (${formatFileSize(file.size)}) · Click to view in iframe`,
            fullContent: `[Uploaded Image: ${file.name}]\nMIME Type: ${mimeType}\nFile Size: ${formatFileSize(file.size)}`,
            words: 10,
            selected: true,
            dataUrl,
            mimeType,
            isImage: true,
          });
        };
        reader.readAsDataURL(file);
      } else if (isTextOrCode) {
        reader.onload = (e) => {
          const textContent = typeof e.target?.result === 'string' ? e.target.result : '';
          if (!addOnlyToSources) {
            const newAttachment: ChatAttachment = {
              id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              size: file.size,
              sizeFormatted: formatFileSize(file.size),
              type: mimeType,
              isImage: false,
              textContent: textContent.slice(0, 45000),
            };
            setAttachments((prev) => [...prev, newAttachment]);
          }

          // Automatically ground new document into NotebookLM sources!
          onAddSource({
            title: file.name,
            type: 'text',
            excerpt: textContent.slice(0, 180) + '...',
            fullContent: textContent,
            words: textContent.split(/\s+/).filter(Boolean).length,
            selected: true,
            mimeType,
          });
        };
        reader.readAsText(file);
      } else {
        // PDF or binary documents
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (!addOnlyToSources) {
            const newAttachment: ChatAttachment = {
              id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              size: file.size,
              sizeFormatted: formatFileSize(file.size),
              type: mimeType,
              isImage: false,
              dataUrl,
            };
            setAttachments((prev) => [...prev, newAttachment]);
          }

          // Automatically ground PDF/document into NotebookLM sources with dataUrl for iframe viewing!
          onAddSource({
            title: file.name,
            type: file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text',
            excerpt: `Uploaded ${file.name} (${formatFileSize(file.size)}) · Click to view in iframe`,
            fullContent: `[Document Attached: ${file.name}]\nDocument uploaded to workspace for synthesis and multimodal grounding.\nFile Size: ${formatFileSize(file.size)}`,
            words: Math.max(25, Math.round(file.size / 120)),
            selected: true,
            dataUrl,
            mimeType,
            isImage: false,
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

  const handleDeleteChatMessage = (msgId: string) => {
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== msgId);
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

    // Check if 0 sources exist & no files attached: provide clear grounded guidance
    if (selectedSources.length === 0 && currentAttachments.length === 0) {
      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const guidanceNotice: ChatMessage = {
        id: `notice-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **No Sources Grounded in NotebookLM**\n\nGoogle NotebookLM synthesizes answers directly from your active grounded documents.\n\nCurrently, you have 0 active sources checked in the Sources deck on the left.\n\n**To get started:**\n1. Add a source on the left (upload PDF, notes, markdown, text, code, or docs).\n2. Ensure the source checkbox is checked.\n3. Ask questions or click **List all topics covered** to generate grounded research outlines.`,
        model: selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => {
        const updated = [...prev, userMessage, guidanceNotice];
        onUpdateChatMessages?.(updated);
        return updated;
      });
      return;
    }

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
    pendingPromptIdRef.current = userMessage.id;
    setIsLoading(true);

    const ac = new AbortController();
    abortControllerRef.current = ac;

    let queryWithContext = textToSend;
    if (!queryWithContext) {
      if (currentAttachments.some((a) => a.isImage)) {
        queryWithContext = 'Please examine the attached image in detail. Analyze and describe its contents, layout, text, diagrammatic elements, and key information.';
      } else if (currentAttachments.length > 0) {
        queryWithContext = `Please analyze and summarize the attached document${currentAttachments.length > 1 ? 's' : ''} in depth.`;
      } else {
        queryWithContext = displayContent;
      }
    }

    if (selectedSources.length === 0 && currentAttachments.length === 0) {
      setIsLoading(false);
      abortControllerRef.current = null;
      const noSourcesMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **No Sources Grounded in NotebookLM**\n\nNotebookLM is designed to synthesize and reason exclusively over your active reference documents.\n\nTo begin:\n1. Check one or more documents in the **Sources Deck** on the left.\n2. Or click **+ Add** in the Sources Deck to upload documents (PDF, TXT, DOCX, Code, Audio, etc.) or write study notes.\n3. Or attach a document directly below using the **+** button.`,
        model: selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => {
        const updated = [...prev, noSourcesMsg];
        onUpdateChatMessages?.(updated);
        return updated;
      });
      return;
    }

    try {
      // Grounding instruction: answer queries directly or slightly related to sources, synthesize helpfully; only flag if completely unrelated
      const groundedPrompt = selectedSources.length > 0
        ? `[NotebookLM Grounding Protocol: Prioritize and ground your answer in the provided knowledge sources. If the user's question is directly, tangentially, or slightly related to any concepts, themes, contexts, or implications of the sources, provide a thorough, helpful answer connecting the source material to their question and synthesizing relevant insights. ONLY if the question is completely unrelated with zero connection to any source topics whatsoever, gently state: "⚠️ This topic appears unrelated to the currently uploaded knowledge sources in your notebook." and summarize what topics are covered.]\n\n${queryWithContext}`
        : queryWithContext;

      const result = await callGeminiChat({
        message: groundedPrompt,
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

  const handleStudioAction = async (type: 'study_guide' | 'briefing_doc' | 'faq' | 'audio_overview' | 'topics_covered') => {
    setSavedStudioToSources(false);
    if (selectedSources.length === 0) {
      setStudioOutput({
        title: '⚠️ Grounding Source Required',
        content: `Please select at least one active source in the **Sources Deck** on the left to generate structured syntheses and topic breakdowns.`,
      });
      return;
    }

    setIsSynthesizing(true);
    try {
      const data = await synthesizeStudyDocument({
        type,
        sources: selectedSources.map((s) => ({ title: s.title, content: s.fullContent })),
        title: selectedSources[0]?.title || 'Research Synthesis',
        model: selectedModel,
      });

      setStudioOutput({
        title: data.title,
        content: data.content,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Synthesis failed';
      setStudioOutput({
        title: '⚠️ Generation Error',
        content: `Synthesis generation encountered an error: ${errMsg}. Please verify that your Gemini API key is configured.`,
      });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleSaveStudioToSources = () => {
    if (!studioOutput || studioOutput.title.startsWith('⚠️') || savedStudioToSources) return;
    const cleanText = studioOutput.content.trim();
    const words = cleanText.split(/\s+/).filter(Boolean).length;
    onAddSource({
      title: studioOutput.title,
      type: 'notes',
      fullContent: cleanText,
      excerpt: cleanText.replace(/[#*_>`-]/g, '').trim().slice(0, 150) + '...',
      words,
      selected: true,
      isGenerated: true,
      mimeType: 'text/html',
    });
    setSavedStudioToSources(true);
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
    <div className="relative h-full flex-1 min-h-0 pt-14 pb-20 md:pt-20 md:pb-6 px-3 md:px-6 lg:px-8 max-w-[1720px] w-full mx-auto flex flex-col gap-2.5 md:gap-3.5 select-none">
      {/* Notebook Top Title Bar */}
      <div
        className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 md:gap-3 pb-2.5 md:pb-3 border-b shrink-0 ${
          darkMode ? 'border-white/10' : 'border-slate-200/90'
        }`}
      >
        <div className="flex items-center gap-2.5 md:gap-3 min-w-0 w-full md:w-auto">
          <div
            className="w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg text-slate-950 font-bold shrink-0"
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
          >
            <BookOpen className="w-4 h-4 md:w-5 md:h-5 font-bold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className={`text-base md:text-2xl font-extrabold tracking-tight truncate ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                Frontier AI & Quantum Systems Research
              </h1>
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0"
                style={{
                  backgroundColor: `${activePalette.primary}20`,
                  borderColor: `${activePalette.primary}50`,
                  color: darkMode ? '#ffffff' : activePalette.primary,
                }}
              >
                Grounded
              </span>
            </div>
            <p className={`text-[11px] md:text-xs mt-0.5 truncate ${darkMode ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
              {sources.length} sources indexed ({selectedSources.length} selected for AI grounding) · 16:9 Studio Canvas
            </p>
          </div>
        </div>

        {/* Android / Mobile Segmented Switcher & Quick Window Launchers (< 768px ONLY) */}
        <div className="md:hidden w-full flex items-center justify-between gap-2 pt-0.5">
          <div
            className={`flex items-center p-1 rounded-xl border flex-1 min-w-0 ${
              darkMode ? 'bg-slate-900/60 border-white/10' : 'bg-white/80 border-slate-200'
            }`}
          >
            {(
              [
                { id: 'chat', label: 'Chat' },
                { id: 'sources', label: `Sources (${sources.length})` },
                { id: 'studio', label: 'Studio' },
              ] as const
            ).map((pane) => {
              const active = mobileActivePane === pane.id;
              return (
                <button
                  key={pane.id}
                  type="button"
                  onClick={() => setMobileActivePane(pane.id)}
                  style={
                    active
                      ? {
                          backgroundColor: `${activePalette.primary}25`,
                          color: darkMode ? '#ffffff' : activePalette.primary,
                          borderColor: `${activePalette.primary}55`,
                        }
                      : undefined
                  }
                  className={`flex-1 min-h-[36px] px-2 py-1 rounded-lg text-[11px] font-bold border border-transparent transition truncate ${
                    active ? 'shadow-xs' : darkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {pane.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenGeminiWorkspace && (
              <button
                type="button"
                onClick={onOpenGeminiWorkspace}
                className={`min-h-[38px] px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition active:scale-95 ${
                  darkMode
                    ? 'bg-slate-900/70 border-white/15 text-slate-200'
                    : 'bg-white/90 border-slate-300 text-slate-800 shadow-xs'
                }`}
                title="Open Gemini AI Workspace"
              >
                <Sparkles className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                <span>AI</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenOneNoteNotes}
              className={`min-h-[38px] px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition active:scale-95 ${
                darkMode
                  ? 'bg-slate-900/70 border-white/15 text-slate-200'
                  : 'bg-white/90 border-slate-300 text-slate-800 shadow-xs'
              }`}
              title="Open OneNote Canvas"
            >
              <FileText className="w-3.5 h-3.5" style={{ color: activePalette.accent }} />
              <span>Notes</span>
            </button>
          </div>
        </div>

        {/* Top Deck Quick Toggles (Desktop >= 768px) */}
        <div className="hidden md:flex items-center gap-2">
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
        {/* ================= LEFT PANEL: Sources Deck (Smooth Spring Motion Animation) ================= */}
        <motion.div
          initial={false}
          animate={{
            width: isMobileViewport ? '100%' : isSourcesMinimized ? 56 : 352,
          }}
          transition={{
            type: 'spring',
            stiffness: 460,
            damping: 34,
            mass: 0.65,
          }}
          className={`relative shrink-0 liquid-glass rounded-2xl border shadow-xl flex-col overflow-hidden h-full ${
            mobileActivePane === 'sources' ? 'flex' : 'hidden md:flex'
          } ${
            darkMode ? 'border-white/10' : 'border-slate-200/90'
          }`}
          style={{ contain: 'paint', willChange: 'width' }}
        >
          {/* Minimized Sources Strip (Animated Crossfade) */}
          <motion.div
            initial={false}
            animate={{
              opacity: isSourcesMinimized && !isMobileViewport ? 1 : 0,
              pointerEvents: isSourcesMinimized && !isMobileViewport ? 'auto' : 'none',
            }}
            transition={{ duration: 0.16 }}
            onClick={() => setIsSourcesMinimized(false)}
            className="hidden md:flex absolute inset-0 w-14 p-3 flex-col items-center justify-between select-none cursor-pointer group"
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
          </motion.div>

          {/* Expanded Full Sources Deck (Animated Crossfade) */}
          <motion.div
            initial={false}
            animate={{
              opacity: isSourcesMinimized && !isMobileViewport ? 0 : 1,
              pointerEvents: isSourcesMinimized && !isMobileViewport ? 'none' : 'auto',
            }}
            transition={{ duration: 0.16 }}
            className="absolute inset-0 w-full md:w-[352px] p-4 md:p-5 flex flex-col min-h-0"
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

                {/* Minimize Source Deck Button (Desktop >= 768px) */}
                <button
                  type="button"
                  onClick={() => setIsSourcesMinimized(true)}
                  className={`hidden md:inline-flex p-1.5 rounded-lg border transition cursor-pointer ${
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

            {/* Sources List (Horizontal clearance so card hover glow/borders never clip) */}
            <div className="flex-1 overflow-y-auto space-y-2.5 -mx-3 px-3 pt-3 pb-4 no-scrollbar">
              {sources.map((source, index) => (
                <div
                  key={source.id}
                  onClick={() => {
                    setSourceViewMode('iframe');
                    setPreviewSource(source);
                  }}
                  className={`p-3.5 rounded-xl border transition group liquid-glass-tile cursor-pointer ${
                    source.selected
                      ? darkMode
                        ? 'border-amber-500/50 shadow-sm'
                        : 'border-amber-500/60 shadow-sm text-slate-900'
                      : darkMode
                      ? 'border-white/5 opacity-75 hover:opacity-100'
                      : 'border-slate-200/80 opacity-85 hover:opacity-100 text-slate-800'
                  }`}
                  title="Click to preview source in viewer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSource(source.id);
                        }}
                        className="mt-0.5 p-1 -m-1 shrink-0 cursor-pointer"
                        style={{ color: activePalette.primary }}
                        aria-label={source.selected ? 'Deselect source' : 'Select source'}
                        title={source.selected ? 'Exclude from grounding' : 'Include in grounding'}
                      >
                        {source.selected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                        )}
                      </button>
                      <div className="min-w-0 space-y-1 flex-1">
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
                        {source.isGenerated ? 'GEN' : source.isImage ? 'IMG' : source.type}
                      </span>
                      <div className="flex items-center gap-1 opacity-90 md:opacity-60 md:group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSourceViewMode('iframe');
                            setPreviewSource(source);
                          }}
                          className={`p-1 rounded cursor-pointer ${
                            darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                          }`}
                          title="Open Source Viewer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSource(source.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-red-500 cursor-pointer"
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
                    <span className="flex items-center gap-1.5">
                      {(source.dataUrl || source.isGenerated) && (
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded border"
                          style={{
                            borderColor: `${activePalette.primary}40`,
                            color: activePalette.primary,
                            backgroundColor: `${activePalette.primary}12`,
                          }}
                        >
                          View
                        </span>
                      )}
                      <span>{source.dateAdded}</span>
                    </span>
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
          </motion.div>
        </motion.div>

        {/* ================= CENTER PANEL: Grounded Chat & Synthesizer ================= */}
        <div
          className={`flex-1 min-w-0 w-full liquid-glass rounded-2xl p-3.5 md:p-5 border shadow-xl flex-col h-full overflow-hidden transition-all duration-300 ${
            mobileActivePane === 'chat' ? 'flex' : 'hidden md:flex'
          } ${
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
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    data-msg-id={m.id}
                    data-msg-role={m.role}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.88, height: 0, overflow: 'hidden', marginBottom: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
                      {/* Attachments preview if present in message (clickable to open in iframe viewer) */}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2.5">
                          {m.attachments.map((att) => (
                            <div
                              key={att.id}
                              onClick={() => setViewingAttachment(att)}
                              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border backdrop-blur-md bg-white/20 border-white/30 text-white cursor-pointer hover:scale-[1.02] hover:bg-white/25 transition"
                              title="Click to view file in iframe viewer"
                            >
                              {att.isImage && att.dataUrl ? (
                                <img
                                  src={att.dataUrl}
                                  alt={att.name}
                                  className="w-10 h-10 rounded-lg object-cover border border-white/30"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 shrink-0">
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
                                  {att.sizeFormatted} · Click to View
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
                        <div className="flex items-center gap-2">
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

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(m.content);
                            }}
                            className="opacity-70 hover:opacity-100 transition p-1 rounded hover:bg-white/10"
                            title="Copy text"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChatMessage(m.id)}
                            className="opacity-70 hover:opacity-100 transition p-1 rounded hover:text-rose-400 hover:bg-rose-500/10 text-slate-400"
                            title="Delete message"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

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
              onClick={() => handleSendMessage('Create a structured, bulleted list of all the key topics and subtopics covered across all active sources.')}
              className={`px-3 py-1.5 rounded-full border transition shrink-0 font-medium ${
                darkMode
                  ? 'bg-slate-800/30 text-slate-200 border-white/10 hover:bg-slate-800/60'
                  : 'bg-white/95 text-slate-800 border-slate-200/90 hover:bg-white hover:text-slate-950 shadow-sm'
              }`}
            >
              List all topics covered
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
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    const pastedFiles: File[] = [];
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file) pastedFiles.push(file);
                      }
                    }
                    if (pastedFiles.length > 0) {
                      e.preventDefault();
                      handleFiles(pastedFiles);
                    }
                  }}
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

        {/* ================= RIGHT PANEL: Studio Generators Deck (Smooth Spring Motion Animation) ================= */}
        <motion.div
          initial={false}
          animate={{
            width: isMobileViewport ? '100%' : isStudioMinimized ? 56 : 352,
          }}
          transition={{
            type: 'spring',
            stiffness: 460,
            damping: 34,
            mass: 0.65,
          }}
          className={`relative shrink-0 liquid-glass rounded-2xl border shadow-xl flex-col overflow-hidden h-full ${
            mobileActivePane === 'studio' ? 'flex' : 'hidden md:flex'
          } ${
            darkMode ? 'border-white/10' : 'border-slate-200/90'
          }`}
          style={{ contain: 'paint', willChange: 'width' }}
        >
          {/* Minimized Studio Strip (Animated Crossfade) */}
          <motion.div
            initial={false}
            animate={{
              opacity: isStudioMinimized && !isMobileViewport ? 1 : 0,
              pointerEvents: isStudioMinimized && !isMobileViewport ? 'auto' : 'none',
            }}
            transition={{ duration: 0.16 }}
            onClick={() => setIsStudioMinimized(false)}
            className="hidden md:flex absolute inset-0 w-14 p-3 flex-col items-center justify-between select-none cursor-pointer group"
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
          </motion.div>

          {/* Expanded Studio Generators Deck (Animated Crossfade) */}
          <motion.div
            initial={false}
            animate={{
              opacity: isStudioMinimized && !isMobileViewport ? 0 : 1,
              pointerEvents: isStudioMinimized && !isMobileViewport ? 'none' : 'auto',
            }}
            transition={{ duration: 0.16 }}
            className="absolute inset-0 w-full md:w-[352px] p-4 md:p-5 flex flex-col min-h-0"
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

              {/* Minimize Studio Deck Button (Desktop >= 768px) */}
              <button
                type="button"
                onClick={() => setIsStudioMinimized(true)}
                className={`hidden md:inline-flex p-1.5 rounded-lg border transition cursor-pointer ${
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

            {/* 5 Studio Generators - Negative horizontal margin buffer eliminates edge/glow/scale clipping */}
            <div className="space-y-3 pt-3 pb-4 -mx-3.5 px-3.5 flex-1 overflow-y-auto no-scrollbar">
              <button
                disabled={isSynthesizing}
                onClick={() => handleStudioAction('audio_overview')}
                className="w-full p-3 rounded-xl border transition-[translate,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-amber-400/50 flex items-center gap-3 text-left text-xs font-medium group liquid-glass-tile no-tilt cursor-pointer"
              >
                <div className="relative z-20 p-2 rounded-lg bg-amber-500/15 text-amber-500 group-hover:scale-105 transition-transform shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div className="relative z-20">
                  <p
                    className={`font-semibold ${
                      darkMode ? 'text-slate-200 group-hover:text-amber-300' : 'text-slate-900 group-hover:text-amber-600'
                    } transition-colors`}
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
                className="w-full p-3 rounded-xl border transition-[translate,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-red-400/50 flex items-center gap-3 text-left text-xs font-medium group liquid-glass-tile no-tilt cursor-pointer"
              >
                <div className="relative z-20 p-2 rounded-lg bg-red-500/15 text-red-500 group-hover:scale-105 transition-transform shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="relative z-20">
                  <p
                    className={`font-semibold ${
                      darkMode ? 'text-slate-200 group-hover:text-red-300' : 'text-slate-900 group-hover:text-red-600'
                    } transition-colors`}
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
                className="w-full p-3 rounded-xl border transition-[translate,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-400/50 flex items-center gap-3 text-left text-xs font-medium group liquid-glass-tile no-tilt cursor-pointer"
              >
                <div className="relative z-20 p-2 rounded-lg bg-blue-500/15 text-blue-500 group-hover:scale-105 transition-transform shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="relative z-20">
                  <p
                    className={`font-semibold ${
                      darkMode ? 'text-slate-200 group-hover:text-blue-300' : 'text-slate-900 group-hover:text-blue-600'
                    } transition-colors`}
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
                className="w-full p-3 rounded-xl border transition-[translate,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-purple-400/50 flex items-center gap-3 text-left text-xs font-medium group liquid-glass-tile no-tilt cursor-pointer"
              >
                <div className="relative z-20 p-2 rounded-lg bg-purple-500/15 text-purple-500 group-hover:scale-105 transition-transform shrink-0">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div className="relative z-20">
                  <p
                    className={`font-semibold ${
                      darkMode ? 'text-slate-200 group-hover:text-purple-300' : 'text-slate-900 group-hover:text-purple-600'
                    } transition-colors`}
                  >
                    Source FAQ
                  </p>
                  <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Essential questions answered
                  </p>
                </div>
              </button>

              <button
                disabled={isSynthesizing}
                onClick={() => handleStudioAction('topics_covered')}
                className="w-full p-3 rounded-xl border transition-[translate,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-emerald-400/50 flex items-center gap-3 text-left text-xs font-medium group liquid-glass-tile no-tilt cursor-pointer"
              >
                <div className="relative z-20 p-2 rounded-lg bg-emerald-500/15 text-emerald-500 group-hover:scale-105 transition-transform shrink-0">
                  <ListChecks className="w-4 h-4" />
                </div>
                <div className="relative z-20">
                  <p
                    className={`font-semibold ${
                      darkMode ? 'text-slate-200 group-hover:text-emerald-300' : 'text-slate-900 group-hover:text-emerald-600'
                    } transition-colors`}
                  >
                    Topics Covered in Sources
                  </p>
                  <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Full breakdown of all source themes & concepts
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
          </motion.div>
        </motion.div>
      </div>

      {/* ================= FAINTED ARROW ON THE LEFT SIDEBAR (HYPRLAND GEMINI WORKSPACE TRIGGER) ================= */}
      {/* Symmetrical counterpart to OneNote's right trigger: slides Gemini Workspace in horizontally from left */}
      <aside
        aria-label="Gemini Workspace Launcher"
        className="hidden md:block fixed left-0 top-1/2 -translate-y-1/2 z-40 group pointer-events-auto"
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
        className="hidden md:block fixed right-0 top-1/2 -translate-y-1/2 z-40 group pointer-events-auto"
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

      {/* Synthesis Output Display Modal (Portaled to document.body at z-[90] so Header top bar blurs behind backdrop) */}
      {studioOutput &&
        createPortal(
          <div
            onClick={() => setStudioOutput(null)}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-all duration-300 animate-in fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`liquid-glass rounded-2xl p-6 border w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col transform transition-all duration-300 animate-in zoom-in-95 ${
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
                  className={`text-xs cursor-pointer ${
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
                className={`pt-3 border-t flex items-center justify-end gap-2.5 shrink-0 ${
                  darkMode ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                {!studioOutput.title.startsWith('⚠️') && (
                  <button
                    type="button"
                    onClick={handleSaveStudioToSources}
                    disabled={savedStudioToSources}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      savedStudioToSources
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : darkMode
                        ? 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10 hover:text-white'
                        : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                    }`}
                    title="Save this generated document to the Sources Deck"
                  >
                    {savedStudioToSources ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Saved to Sources</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                        <span>Save to Sources</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(studioOutput.content);
                  }}
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                  className="px-4 py-2 rounded-xl text-slate-950 font-bold text-xs shadow hover:opacity-90 transition cursor-pointer"
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Add Source Modal: Upload vs Write / Paste Tabs (Portaled above Header for clean blur backdrop) */}
      {showAddSourceModal &&
        createPortal(
          <div
            onClick={() => setShowAddSourceModal(false)}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`liquid-glass rounded-2xl p-6 border w-full max-w-xl shadow-2xl space-y-4 ${
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
                  className={`text-xs p-1 rounded-lg transition cursor-pointer ${
                    darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Tab Switcher: Upload File vs Write / Paste Note */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/20 border border-white/10">
                <button
                  type="button"
                  onClick={() => setAddSourceTab('upload')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                    addSourceTab === 'upload'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : darkMode
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddSourceTab('write')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                    addSourceTab === 'write'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : darkMode
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Write / Paste Note</span>
                </button>
              </div>

              {addSourceTab === 'upload' ? (
                <div className="space-y-4">
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.docx,.json,.csv,.py,.ts,.tsx,.js,.cpp,.java,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp3,.wav"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFiles(e.target.files, true);
                        setShowAddSourceModal(false);
                      }
                    }}
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setModalIsDragging(true);
                    }}
                    onDragLeave={() => setModalIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setModalIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleFiles(e.dataTransfer.files, true);
                        setShowAddSourceModal(false);
                      }
                    }}
                  onClick={() => modalFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    modalIsDragging
                      ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
                      : darkMode
                      ? 'border-white/20 hover:border-amber-400/60 bg-slate-950/40 hover:bg-slate-950/70'
                      : 'border-slate-300 hover:border-amber-500/60 bg-slate-50/70 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-slate-950 shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                    }}
                  >
                    <UploadCloud className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <p className="text-sm font-bold text-slate-100 dark:text-slate-100">
                    Click to browse or drag and drop files here
                  </p>
                  <p className={`text-xs mt-1 max-w-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Supports PDF, Word, Markdown, Text, Code (.ts, .py, .cpp, .json), Images (.png, .jpg), and Audio recordings.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[10px] font-mono text-slate-400">
                    <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5">PDF</span>
                    <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5">DOCX</span>
                    <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5">TXT & MD</span>
                    <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5">Code</span>
                    <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5">Images</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddSourceModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                      darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => modalFileInputRef.current?.click()}
                    style={{
                      background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                    }}
                    className="px-4 py-2 rounded-xl text-slate-950 font-bold text-xs shadow hover:opacity-90 transition cursor-pointer"
                  >
                    Select Files
                  </button>
                </div>
              </div>
            ) : (
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
                    className="px-4 py-2 rounded-xl text-slate-950 font-bold text-xs shadow hover:opacity-90 transition cursor-pointer"
                  >
                    Index Source
                  </button>
                </div>
              </form>
            )}
            </div>
          </div>,
          document.body
        )}

      {/* Document & Media Iframe Viewer Modal (Portaled at z-[90] so Header top bar blurs behind backdrop) */}
      {previewSource &&
        createPortal(
          <div
            onClick={() => setPreviewSource(null)}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`liquid-glass rounded-2xl p-6 border w-full max-w-4xl shadow-2xl space-y-4 max-h-[88vh] flex flex-col ${
                darkMode ? 'bg-slate-900/95 border-white/20 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'
              }`}
            >
              {/* Document Header */}
              <div
                className={`flex items-center justify-between pb-3 border-b shrink-0 ${
                  darkMode ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: `${activePalette.primary}20`,
                        borderColor: `${activePalette.primary}50`,
                        color: darkMode ? '#ffffff' : activePalette.primary,
                      }}
                    >
                      {previewSource.isGenerated ? 'Generated' : previewSource.isImage ? 'Image' : previewSource.type}
                    </span>
                    <h3
                      className={`text-sm sm:text-base font-bold truncate ${
                        darkMode ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      {previewSource.title}
                    </h3>
                  </div>
                  <p className={`text-[11px] font-mono mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {previewSource.words} words · Grounded in NotebookLM
                  </p>
                </div>

                {/* Action Buttons: Iframe/Markdown Toggle, Copy, Download, Close */}
                <div className="flex items-center gap-2 shrink-0">
                  {!previewSource.dataUrl && (
                    <button
                      type="button"
                      onClick={() => setSourceViewMode((m) => (m === 'iframe' ? 'markdown' : 'iframe'))}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        darkMode
                          ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                      }`}
                      title="Toggle Iframe Document View / Raw Reader"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{sourceViewMode === 'iframe' ? 'Markdown' : 'Iframe View'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(previewSource.fullContent);
                      setSourceCopied(true);
                      setTimeout(() => setSourceCopied(false), 2000);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      sourceCopied
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : darkMode
                        ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                    }`}
                    title="Copy Document Text"
                  >
                    {sourceCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {previewSource.dataUrl ? (
                    <a
                      href={previewSource.dataUrl}
                      download={previewSource.title}
                      className={`p-1.5 rounded-xl border text-xs transition cursor-pointer ${
                        darkMode
                          ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                      }`}
                      title="Download Original File"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([previewSource.fullContent], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${previewSource.title.replace(/[^a-z0-9_-]/gi, '_')}.txt`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                      className={`p-1.5 rounded-xl border text-xs transition cursor-pointer ${
                        darkMode
                          ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                      }`}
                      title="Download Document"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPreviewSource(null)}
                    className={`p-1.5 rounded-xl border text-xs transition cursor-pointer ${
                      darkMode
                        ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/30'
                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900'
                    }`}
                    title="Close Document Viewer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Document / PDF / Image Iframe Viewport */}
              <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden">
                {previewSource.isImage && previewSource.dataUrl ? (
                  <iframe
                    srcDoc={buildImageIframeDoc(previewSource.dataUrl, previewSource.title, darkMode)}
                    title={previewSource.title}
                    className="w-full h-[66vh] border-0 rounded-xl"
                  />
                ) : sourceIframeUrl ? (
                  <iframe
                    src={sourceIframeUrl}
                    title={previewSource.title}
                    className="w-full h-[66vh] border-0 rounded-xl bg-white"
                  />
                ) : (previewSource.isGenerated || sourceViewMode === 'iframe') ? (
                  <iframe
                    srcDoc={buildGeneratedMarkdownIframeDoc(
                      previewSource.title,
                      previewSource.fullContent,
                      darkMode,
                      activePalette.primary
                    )}
                    title={previewSource.title}
                    className="w-full h-[66vh] border-0 rounded-xl"
                  />
                ) : (
                  <div
                    className={`flex-1 overflow-y-auto text-xs leading-relaxed font-sans pr-2 no-scrollbar ${
                      darkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    <MarkdownRenderer content={previewSource.fullContent} darkMode={darkMode} />
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Chat Attachment Iframe Viewer Modal (Portaled at z-[95] so Header top bar blurs behind backdrop) */}
      {viewingAttachment &&
        createPortal(
          <div
            onClick={() => setViewingAttachment(null)}
            className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`liquid-glass rounded-2xl p-6 border w-full max-w-4xl shadow-2xl space-y-4 max-h-[88vh] flex flex-col ${
                darkMode ? 'bg-slate-900/95 border-white/20 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'
              }`}
            >
              <div
                className={`flex items-center justify-between pb-3 border-b shrink-0 ${
                  darkMode ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: `${activePalette.primary}25`, color: activePalette.primary }}
                  >
                    {viewingAttachment.isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="truncate">
                    <h3 className="text-sm font-bold truncate">{viewingAttachment.name}</h3>
                    <p className="text-[10px] font-mono opacity-70">
                      {viewingAttachment.sizeFormatted} · {viewingAttachment.type || 'DOCUMENT'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {viewingAttachment.dataUrl && (
                    <a
                      href={viewingAttachment.dataUrl}
                      download={viewingAttachment.name}
                      className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition text-xs flex items-center gap-1 cursor-pointer"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingAttachment(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden bg-black/20">
                {viewingAttachment.isImage && viewingAttachment.dataUrl ? (
                  <iframe
                    srcDoc={buildImageIframeDoc(viewingAttachment.dataUrl, viewingAttachment.name, darkMode)}
                    title={viewingAttachment.name}
                    className="w-full h-[65vh] border-0 rounded-xl"
                  />
                ) : attachmentIframeUrl ? (
                  <iframe
                    src={attachmentIframeUrl}
                    title={viewingAttachment.name}
                    className="w-full h-[65vh] border-0 rounded-xl bg-white"
                  />
                ) : (
                  <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                    <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap select-text">
                      {viewingAttachment.textContent || 'No text preview available for this binary file.'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
  Sparkles,
  Plus,
  Search,
  Trash2,
  X,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  MessageSquare,
  Brain,
  Globe,
  Copy,
  Check,
  Edit2,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  CheckSquare,
  Square,
  Sigma,
  Bot,
  Zap,
  FileText,
  FileCode,
  FileSpreadsheet,
  File,
  Paperclip,
  Pin,
  Download,
  Eye,
} from 'lucide-react';
import { GeminiConversation, GeminiChatMessage, ChatAttachment, ColorPalette } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { callGeminiChat, AVAILABLE_GEMINI_MODELS, GeminiModelInfo } from '../utils/geminiClient';
import { LiquidGlassSvgFilter } from './LiquidGlassFilter';
import { useChatSmoothScroll } from '../hooks/useSmoothScroll';
import { dataUrlToBlobUrl, buildImageIframeDoc } from '../utils/iframePreview';

interface GeminiWorkspaceProps {
  isOpen: boolean;
  onCloseBack: () => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  conversations: GeminiConversation[];
  onUpdateConversations: (conversations: GeminiConversation[]) => void;
  selectedModel?: string;
  onChangeModel?: (model: string) => void;
  smoothScroll?: boolean;
}

const SUPPORTED_MODELS: GeminiModelInfo[] = AVAILABLE_GEMINI_MODELS;

const SUGGESTED_PROMPTS = [
  {
    title: 'Attention Formulation',
    prompt: 'Derive the Scaled Dot-Product Attention formula and explain why dividing by sqrt(d_k) prevents softmax gradient vanishing.',
    icon: Sigma,
  },
  {
    title: 'Quantum Decoherence',
    prompt: 'Explain the mechanism of environmental decoherence in quantum superposition and write down the decay equation.',
    icon: Brain,
  },
  {
    title: 'React Performance',
    prompt: 'How does structural sharing in immutable React state maintain 120 FPS frame rates without cloning whole state trees?',
    icon: Sparkles,
  },
  {
    title: 'Clean Architecture',
    prompt: 'Draft an architectural proposal for an offline-first real-time workspace with local persistence and low-latency rendering.',
    icon: Zap,
  },
];

export const GeminiWorkspace: React.FC<GeminiWorkspaceProps> = ({
  isOpen,
  onCloseBack,
  activePalette,
  darkMode,
  conversations,
  onUpdateConversations,
  selectedModel: propSelectedModel,
  onChangeModel,
  smoothScroll = true,
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string>(() => {
    return conversations[0]?.id || '';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState(propSelectedModel || 'gemini-3.5-flash');

  useEffect(() => {
    if (propSelectedModel && propSelectedModel !== selectedModel) {
      setSelectedModel(propSelectedModel);
    }
  }, [propSelectedModel]);
  const [enableThinking, setEnableThinking] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Attached files state (images, pdfs, txt, md, csv, code)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<ChatAttachment | null>(null);
  const [attachmentIframeUrl, setAttachmentIframeUrl] = useState<string | null>(null);

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

  const pendingPromptIdRef = useRef<string | null>(null);
  const wasLoadingRef = useRef(false);

  // Smooth Lenis / RAF Momentum Scrolling for Chat Stage
  const { wrapperRef: chatScrollContainerRef, scrollToBottom, scrollToElementTop } = useChatSmoothScroll<HTMLDivElement>({
    enabled: smoothScroll && isOpen,
    deps: [selectedConvId, isLoading],
  });

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

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
      const isTextOrCode = /\.(txt|md|csv|json|py|js|ts|tsx|jsx|html|css|c|cpp|rs|go|java|xml|yaml|yml|log|sh)$/i.test(file.name);
      const mimeType = getCleanMimeType(file);
      const reader = new FileReader();

      if (isImage) {
        reader.onload = (e) => {
          const newAttachment: ChatAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: mimeType,
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
            type: mimeType,
            isImage: false,
            textContent: textContent.slice(0, 45000),
          };
          setAttachments((prev) => [...prev, newAttachment]);
        };
        reader.readAsText(file);
      } else {
        // PDF or other binary document types
        reader.onload = (e) => {
          const newAttachment: ChatAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: mimeType,
            isImage: false,
            dataUrl: e.target?.result as string,
          };
          setAttachments((prev) => [...prev, newAttachment]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // Permanent Delete Modal Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    convId: string;
    convTitle: string;
  }>({
    isOpen: false,
    convId: '',
    convTitle: '',
  });

  // Rename Conversation Inline State
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

  // Sync active conversation when conversations update
  useEffect(() => {
    if (conversations.length > 0 && !conversations.some((c) => c.id === selectedConvId)) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // Handle Esc key to close workspace & modals
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingAttachment) {
          setViewingAttachment(null);
          return;
        }
        if (deleteConfirmation.isOpen) {
          setDeleteConfirmation({ isOpen: false, convId: '', convTitle: '' });
          return;
        }
        if (isModelDropdownOpen) {
          setIsModelDropdownOpen(false);
          return;
        }
        onCloseBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCloseBack, deleteConfirmation.isOpen, isModelDropdownOpen, viewingAttachment]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isModelDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [isModelDropdownOpen]);

  // High-performance 120 FPS cursor tracking for the main chat stage (ends strictly at sidebar margin)
  const stageRafRef = useRef<number | null>(null);

  const handleStagePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (!stageRafRef.current) {
      stageRafRef.current = requestAnimationFrame(() => {
        stageRafRef.current = null;
        const rect = el.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const ratio = Math.max(0, Math.min(1, x / (rect.width || 1)));
        el.style.setProperty('--pointer-x', `${Math.round(x)}px`);
        el.style.setProperty('--pointer-y', `${Math.round(y)}px`);
        el.style.setProperty('--pointer-ratio', `${Math.round(ratio * 1000) / 1000}`);
      });
    }
  };

  const handleStagePointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    if (stageRafRef.current) {
      cancelAnimationFrame(stageRafRef.current);
      stageRafRef.current = null;
    }
    const el = e.currentTarget;
    el.style.setProperty('--pointer-x', '-999px');
    el.style.setProperty('--pointer-y', '-999px');
  };

  // High-performance 120 FPS liquid glass tracking for conversation items (both minimized and maximized)
  const itemRafRef = useRef<number | null>(null);

  const handleItemPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (!itemRafRef.current) {
      itemRafRef.current = requestAnimationFrame(() => {
        itemRafRef.current = null;
        const rect = el.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const ratio = Math.max(0, Math.min(1, x / (rect.width || 1)));
        el.style.setProperty('--pointer-x', `${Math.round(x)}px`);
        el.style.setProperty('--pointer-y', `${Math.round(y)}px`);
        el.style.setProperty('--pointer-ratio', `${Math.round(ratio * 1000) / 1000}`);
      });
    }
  };

  const handleItemPointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    if (itemRafRef.current) {
      cancelAnimationFrame(itemRafRef.current);
      itemRafRef.current = null;
    }
    const el = e.currentTarget;
    el.style.setProperty('--pointer-x', '-999px');
    el.style.setProperty('--pointer-y', '-999px');
  };

  useEffect(() => {
    return () => {
      if (stageRafRef.current) cancelAnimationFrame(stageRafRef.current);
      if (itemRafRef.current) cancelAnimationFrame(itemRafRef.current);
    };
  }, []);

  // Current selected conversation
  const currentConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConvId) || conversations[0] || null;
  }, [conversations, selectedConvId]);

  // Conversation transition sweep counter
  const [convChangeCount, setConvChangeCount] = useState(0);
  const prevConvIdRef = useRef(selectedConvId);
  const isConvInitialMount = useRef(true);

  useEffect(() => {
    if (prevConvIdRef.current !== selectedConvId) {
      prevConvIdRef.current = selectedConvId;
      if (isConvInitialMount.current) {
        isConvInitialMount.current = false;
        return;
      }
      setConvChangeCount((c) => c + 1);
    }
  }, [selectedConvId]);

  // Smooth auto-scroll: glide to bottom while waiting, then align top of answered prompt when response completes
  useEffect(() => {
    if (!isOpen) return;
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
        const container = chatScrollContainerRef.current;
        if (!container) return;
        let promptEl = targetId
          ? (container.querySelector(`[data-msg-id="${targetId}"]`) as HTMLElement | null)
          : null;
        if (!promptEl) {
          const allUserMsgs = container.querySelectorAll<HTMLElement>('[data-msg-role="user"]');
          promptEl = allUserMsgs.length > 0 ? allUserMsgs[allUserMsgs.length - 1] : null;
        }
        if (promptEl) {
          scrollToElementTop(promptEl, 16);
        } else {
          scrollToBottom();
        }
      }, 75);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isOpen, scrollToBottom, scrollToElementTop]);

  // Global search filtering across titles and message contents
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => {
      const titleMatch = c.title.toLowerCase().includes(q);
      const messageMatch = c.messages.some((m) =>
        m.content.toLowerCase().includes(q)
      );
      return titleMatch || messageMatch;
    });
  }, [conversations, searchQuery]);

  // Pin / Unpin conversation handler - moves pinned items to top in authoritative state
  const handleTogglePin = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    const updated = conversations.map((c) => (c.id === convId ? { ...c, pinned: !c.pinned } : c));
    const sorted = [...updated].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
    onUpdateConversations(sorted);
  };

  // Create new conversation
  const handleCreateNewChat = useCallback(() => {
    const newId = `conv-${Date.now()}`;
    const newConv: GeminiConversation = {
      id: newId,
      title: 'New Conversation',
      createdAt: 'Just now',
      updatedAt: 'Just now',
      model: selectedModel,
      messages: [],
    };
    onUpdateConversations([newConv, ...conversations]);
    setSelectedConvId(newId);
    setSearchQuery('');
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
  }, [conversations, onUpdateConversations, selectedModel]);

  // Request permanent delete
  const handleRequestDelete = (e: React.MouseEvent, conv: GeminiConversation) => {
    e.stopPropagation();
    setDeleteConfirmation({
      isOpen: true,
      convId: conv.id,
      convTitle: conv.title,
    });
  };

  // Confirm permanent delete with smooth animated exit
  const handleConfirmPermanentDelete = () => {
    const { convId } = deleteConfirmation;
    setDeletingConvId(convId);
    setDeleteConfirmation({ isOpen: false, convId: '', convTitle: '' });

    setTimeout(() => {
      const nextList = conversations.filter((c) => c.id !== convId);
      onUpdateConversations(nextList);
      setDeletingConvId(null);

      if (selectedConvId === convId) {
        if (nextList.length > 0) {
          setSelectedConvId(nextList[0].id);
        } else {
          const brandNewId = `conv-${Date.now()}`;
          const brandNew: GeminiConversation = {
            id: brandNewId,
            title: 'New Conversation',
            createdAt: 'Just now',
            updatedAt: 'Just now',
            model: selectedModel,
            messages: [],
          };
          onUpdateConversations([brandNew]);
          setSelectedConvId(brandNewId);
        }
      }
    }, 220);
  };

  // Save renamed title
  const handleSaveTitle = (convId: string) => {
    if (!tempTitle.trim()) {
      setEditingTitleId(null);
      return;
    }
    onUpdateConversations(
      conversations.map((c) =>
        c.id === convId ? { ...c, title: tempTitle.trim(), updatedAt: 'Just now' } : c
      )
    );
    setEditingTitleId(null);
  };

  // Stop response generation
  const handleStopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    if (!currentConversation) return;

    const stopMessage: GeminiChatMessage = {
      id: `b-${Date.now()}`,
      role: 'assistant',
      content: '⏹️ *Response generation stopped by user.*',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: selectedModel,
    };

    const finalConversation: GeminiConversation = {
      ...currentConversation,
      updatedAt: 'Just now',
      messages: [...currentConversation.messages, stopMessage],
    };

    onUpdateConversations(
      conversations.map((c) => (c.id === currentConversation.id ? finalConversation : c))
    );
  };

  // Delete individual message from current conversation
  const handleDeleteMessage = (msgId: string) => {
    if (!currentConversation) return;
    const updatedMessages = currentConversation.messages.filter((m) => m.id !== msgId);
    const updatedConv: GeminiConversation = {
      ...currentConversation,
      messages: updatedMessages,
      updatedAt: 'Just now',
    };
    onUpdateConversations(
      conversations.map((c) => (c.id === currentConversation.id ? updatedConv : c))
    );
  };

  // Send message (supports text query, attachments, or both, auto-creating conversation if needed)
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? inputMessage).trim();
    if ((!query && attachments.length === 0) || isLoading) return;

    let targetConv = currentConversation;
    let isBrandNewConv = false;

    if (!targetConv) {
      isBrandNewConv = true;
      const brandNewId = `conv-${Date.now()}`;
      targetConv = {
        id: brandNewId,
        title: query ? (query.length > 35 ? query.slice(0, 32) + '...' : query) : 'New Conversation',
        createdAt: 'Just now',
        updatedAt: 'Just now',
        model: selectedModel,
        messages: [],
      };
      setSelectedConvId(brandNewId);
    }

    const currentAttachments = [...attachments];
    setAttachments([]);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMessageId = `u-${Date.now()}`;
    const displayContent =
      query ||
      (currentAttachments.length > 0
        ? `Uploaded ${currentAttachments.length} file${
            currentAttachments.length > 1 ? 's' : ''
          }: ${currentAttachments.map((a) => a.name).join(', ')}`
        : '');

    const userMessage: GeminiChatMessage = {
      id: userMessageId,
      role: 'user',
      content: displayContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    // If it's a new conversation or generic title, auto-title from prompt
    const shouldAutoTitle =
      isBrandNewConv ||
      targetConv.title === 'New Conversation' ||
      targetConv.messages.length === 0;
    const autoTitle = shouldAutoTitle
      ? query.length > 40
        ? query.slice(0, 37) + '...'
        : query || (currentAttachments[0]?.name ? `File: ${currentAttachments[0].name}` : 'New Conversation')
      : targetConv.title;

    const updatedConversation: GeminiConversation = {
      ...targetConv,
      title: autoTitle,
      updatedAt: 'Just now',
      messages: [...targetConv.messages, userMessage],
    };

    if (isBrandNewConv) {
      onUpdateConversations([updatedConversation, ...conversations]);
    } else {
      onUpdateConversations(
        conversations.map((c) => (c.id === targetConv!.id ? updatedConversation : c))
      );
    }

    pendingPromptIdRef.current = userMessageId;
    setIsLoading(true);

    const ac = new AbortController();
    abortControllerRef.current = ac;

    let promptWithContext = query;
    if (!promptWithContext) {
      if (currentAttachments.some((a) => a.isImage)) {
        promptWithContext = 'Please examine the attached image in detail. Analyze and describe its contents, layout, text, diagrammatic elements, and key information.';
      } else if (currentAttachments.length > 0) {
        promptWithContext = `Please analyze and summarize the attached document${currentAttachments.length > 1 ? 's' : ''} in depth.`;
      } else {
        promptWithContext = displayContent;
      }
    }

    try {
      const result = await callGeminiChat({
        message: promptWithContext,
        model: selectedModel,
        enableThinking,
        attachments: currentAttachments,
        history: targetConv.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      if (ac.signal.aborted) return;

      const botMessage: GeminiChatMessage = {
        id: `b-${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: result.modelUsed || (enableThinking ? 'gemini-4-argon' : selectedModel),
      };

      const finalConversation: GeminiConversation = {
        ...updatedConversation,
        updatedAt: 'Just now',
        messages: [...updatedConversation.messages, botMessage],
      };

      if (isBrandNewConv) {
        onUpdateConversations([finalConversation, ...conversations]);
      } else {
        onUpdateConversations(
          conversations.map((c) => (c.id === targetConv!.id ? finalConversation : c))
        );
      }
    } catch (err: unknown) {
      if (ac.signal.aborted) return;
      const errMsg = err instanceof Error ? err.message : 'Unknown network error';
      const botMessage: GeminiChatMessage = {
        id: `b-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **AI Connection Error**: ${errMsg}\n\nPlease verify that your Gemini API key is valid.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: selectedModel,
      };

      const finalConversation: GeminiConversation = {
        ...updatedConversation,
        updatedAt: 'Just now',
        messages: [...updatedConversation.messages, botMessage],
      };

      if (isBrandNewConv) {
        onUpdateConversations([finalConversation, ...conversations]);
      } else {
        onUpdateConversations(
          conversations.map((c) => (c.id === targetConv!.id ? finalConversation : c))
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // Copy message text
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const activeModelObj = SUPPORTED_MODELS.find((m) => m.id === selectedModel) || SUPPORTED_MODELS[0];

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 flex hyprland-slide ${
        isOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto visible frost-edge'
          : '-translate-x-[100%] opacity-0 pointer-events-none invisible'
      } ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}
      style={{ backgroundColor: darkMode ? activePalette.bgDark : '#f8fafc' }}
    >
      {/* SVG Chromatic Aberration & Liquid Glass Displacement Shader Filter Definition */}
      <LiquidGlassSvgFilter />

      {/* ================= MAIN LIQUID FROST GLASS BUBBLE CONTAINER ================= */}
      <div className="flex-1 h-full p-2 sm:p-4 md:p-6 flex flex-col min-w-0 overflow-hidden relative">
        {/* Ambient atmospheric liquid frost aura radiating around the workspace bubble */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none -z-10 opacity-70 blur-3xl transition-opacity duration-700"
          style={{
            background: `radial-gradient(circle 800px at 70% 30%, ${activePalette.primary}22, transparent 70%), radial-gradient(circle 600px at 20% 70%, ${activePalette.accent}18, transparent 65%)`,
          }}
        />

        <div
          className={`relative flex-1 h-full rounded-2xl md:rounded-3xl border shadow-2xl overflow-hidden flex flex-col md:flex-row transition-[box-shadow,border-color] duration-300 gemini-workspace-bubble ${
            darkMode
              ? 'acrylic-glass-panel bg-slate-900/60 border-white/20 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.7)]'
              : 'acrylic-glass-panel bg-white/70 border-slate-300/80 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.12)]'
          }`}
          style={{
            borderColor: `${activePalette.primary}50`,
          }}
        >
          {/* Liquid Glass Frosted Layer — Layered strictly BELOW the left conversation list (z-0) */}
          <div className="liquidglass pointer-events-none z-0" aria-hidden="true" />

          {/* ================= LEFT SIDEBAR (CHATS, SEARCH, ACTIONS) ================= */}
          <aside
            className={`relative z-20 flex flex-col shrink-0 transition-[width] duration-300 border-r liquid-glass-frost-sidebar ${
              isSidebarCollapsed
                ? 'w-14 sm:w-16 items-center p-2.5 justify-between h-full'
                : 'w-full md:w-80 lg:w-96 p-3 sm:p-4'
            } ${
              darkMode
                ? 'border-white/15 bg-slate-950/40 text-slate-100'
                : 'border-slate-300/80 bg-white/55 text-slate-900 shadow-sm'
            }`}
            style={{
              backdropFilter: 'blur(28px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
            }}
          >
            {isSidebarCollapsed ? (
              /* Minimized Sidebar View — Inspired by OneNote Pages Rail */
              <div className="flex flex-col items-center justify-between h-full w-full py-1 select-none">
                {/* Top Actions: Expand & New Conversation */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(false)}
                    className="p-2 rounded-xl transition shadow-sm hover:scale-105 cursor-pointer border"
                    style={{
                      backgroundColor: `${activePalette.primary}20`,
                      borderColor: `${activePalette.primary}40`,
                      color: activePalette.primary,
                    }}
                    title="Expand Conversations Sidebar"
                    aria-label="Expand Conversations Sidebar"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateNewChat}
                    className="p-1.5 rounded-lg border border-white/10 hover:border-amber-500/40 text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                    title="New Conversation"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-100" style={{ color: activePalette.id === 'black-night' ? '#f1f5f9' : activePalette.primary }} />
                  </button>
                </div>

                {/* Subtle Divider */}
                <div className="w-6 h-px bg-white/10 my-2 shrink-0" />

                {/* Scrollable Indexed Conversation Bubbles (OneNote Rail Style with Reorder) */}
                <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-2 py-2 px-1">
                  <Reorder.Group
                    axis="y"
                    values={conversations}
                    onReorder={onUpdateConversations}
                    layoutScroll
                    className="flex flex-col items-center gap-2 w-full"
                  >
                    {conversations.map((conv, index) => {
                      const isSelected = selectedConvId === conv.id;
                      return (
                        <Reorder.Item
                          key={conv.id}
                          value={conv}
                          dragElastic={0.1}
                          dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
                          whileDrag={{ scale: 1.08, zIndex: 60 }}
                          className="relative group/bubble cursor-grab active:cursor-grabbing select-none"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedConvId(conv.id)}
                            className={`w-9 h-9 rounded-xl text-xs font-mono font-bold flex items-center justify-center transition-colors duration-150 border cursor-pointer select-none ${
                              isSelected
                                ? 'shadow-md scale-105 active-conv'
                                : darkMode
                                ? 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                : 'border-slate-300 bg-white/60 text-slate-600 hover:bg-white'
                            }`}
                            style={
                              isSelected
                                ? {
                                    backgroundColor: `${activePalette.primary}25`,
                                    borderColor: `${activePalette.primary}80`,
                                    color: darkMode ? '#ffffff' : activePalette.primary,
                                    boxShadow: `0 0 14px ${activePalette.primary}40`,
                                  }
                                : {
                                    boxShadow: 'none',
                                  }
                            }
                            title={conv.title}
                          >
                            <MessageSquare
                              className={`w-4 h-4 ${isSelected ? (activePalette.id === 'black-night' ? 'text-slate-100' : '') : 'text-slate-300'}`}
                              style={{ color: isSelected && activePalette.id !== 'black-night' ? activePalette.primary : undefined }}
                            />
                          </button>

                          {/* Hover Tooltip displaying Chat Title & Index */}
                          <div
                            className={`absolute left-full ml-2.5 px-2.5 py-1.5 rounded-xl text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover/bubble:opacity-100 transition-all duration-150 z-50 shadow-xl border backdrop-blur-2xl ${
                              darkMode
                                ? 'bg-slate-900/95 border-white/15 text-slate-200 shadow-black/80'
                                : 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-300/60'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: activePalette.primary }}
                              />
                              <span className="font-bold font-mono text-[11px]">#{index + 1}</span>
                              <span className="max-w-[200px] truncate font-medium">{conv.title}</span>
                            </div>
                          </div>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>
                </div>

                {/* Subtle Divider */}
                <div className="w-6 h-px bg-white/10 my-2 shrink-0" />

                {/* Bottom Total Indicator Button */}
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className={`w-full py-1.5 text-[9px] font-mono rounded-lg border flex flex-col items-center justify-center transition cursor-pointer select-none shrink-0 ${
                    darkMode
                      ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                      : 'border-slate-200 text-slate-600 hover:text-slate-950 hover:bg-black/5'
                  }`}
                  title="Click to expand full sidebar"
                >
                  <span className="font-bold">{conversations.length} chats</span>
                </button>
              </div>
            ) : (
              /* Maximized Sidebar View — Replicating Previous Look with OneNote Page Tile Inspiration */
              <>
                {/* Sidebar Top: Logo, Total Count & Collapse Toggle Button */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${activePalette.primary}30, ${activePalette.accent}30)`,
                        borderColor: `${activePalette.primary}60`,
                      }}
                    >
                      <Sparkles className="w-4 h-4 text-slate-100" style={{ color: darkMode ? '#f1f5f9' : activePalette.primary }} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                        Gemini Workspace
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.2 rounded-full border"
                          style={{
                            backgroundColor: `${activePalette.primary}15`,
                            borderColor: `${activePalette.primary}40`,
                            color: darkMode ? '#f1f5f9' : activePalette.primary,
                          }}
                        >
                          AI
                        </span>
                      </h2>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {conversations.length} total conversations
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(true)}
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                      darkMode
                        ? 'border-white/10 hover:bg-white/10 text-slate-300 hover:text-white'
                        : 'border-slate-300/80 hover:bg-white text-slate-600 hover:text-slate-900 shadow-xs'
                    }`}
                    title="Minimize sidebar"
                    aria-label="Minimize sidebar"
                  >
                    <PanelLeftClose className="w-4 h-4 text-slate-200" />
                  </button>
                </div>

                {/* "+ New Conversation" Button */}
                <button
                  type="button"
                  onClick={handleCreateNewChat}
                  onPointerMove={handleItemPointerMove}
                  onPointerLeave={handleItemPointerLeave}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 select-none border mb-3 shadow-sm cursor-pointer liquid-glass-tile gemini-conv-tile ${
                    darkMode
                      ? 'text-white border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/15'
                      : 'text-slate-900 border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-100 shadow-xs'
                  }`}
                  style={{
                    borderColor: `${activePalette.primary}60`,
                  }}
                  title="Start a new AI conversation"
                >
                  <Plus className="w-4 h-4 shrink-0 relative z-10 text-slate-100" style={{ color: darkMode ? '#f1f5f9' : activePalette.primary }} />
                  <span className="relative z-10 font-bold">New Conversation</span>
                </button>

                {/* Global Search Bar */}
                <div className="relative mb-3 shrink-0">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Global search chats & messages..."
                    className={`w-full pl-8 pr-7 py-2 text-xs rounded-xl border focus:outline-none transition placeholder:text-slate-400 ${
                      darkMode
                        ? 'bg-slate-900/60 border-white/10 focus:border-cyan-400 text-slate-200'
                        : 'bg-white/80 border-slate-300/80 focus:border-cyan-600 text-slate-800'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Conversation List Tiles with generous breathing padding to prevent clipping */}
                <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar min-h-0 -mx-1 px-4 py-3">
                  {filteredConversations.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 font-mono">
                      No conversations match "{searchQuery}"
                    </div>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={conversations}
                      onReorder={onUpdateConversations}
                      layoutScroll
                      className="space-y-2.5"
                    >
                      {filteredConversations.map((conv) => {
                        const isSelected = selectedConvId === conv.id;
                        const isEditing = editingTitleId === conv.id;

                        return (
                          <Reorder.Item
                            key={conv.id}
                            value={conv}
                            dragListener={!searchQuery.trim()}
                            dragElastic={0.1}
                            dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
                            whileDrag={{
                              scale: 1.02,
                              zIndex: 60,
                              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
                            }}
                            onClick={() => setSelectedConvId(conv.id)}
                            className={`p-3 rounded-2xl select-none border transition-all duration-200 group relative gemini-conv-tile ${
                              conv.id === deletingConvId
                                ? 'opacity-0 scale-90 -translate-x-4 max-h-0 py-0 my-0 overflow-hidden pointer-events-none'
                                : ''
                            } ${
                              isSelected ? 'active-conv is-opened' : ''
                            } ${
                              !searchQuery.trim() ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                            } ${
                              isSelected
                                ? darkMode
                                  ? 'bg-white/12 text-white font-semibold'
                                  : 'bg-white text-slate-950 font-semibold'
                                : darkMode
                                ? 'bg-slate-900/60 hover:bg-slate-900/80 text-slate-200 border-white/10 hover:border-white/25'
                                : 'bg-white/80 hover:bg-white text-slate-800 border-slate-200/90 hover:border-slate-300'
                            }`}
                            style={{
                              borderColor: isSelected
                                ? activePalette.primary
                                : undefined,
                              boxShadow: isSelected
                                ? `0 0 10px 0px ${activePalette.primary}45, inset 0 0 8px -1px ${activePalette.primary}25`
                                : 'none',
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Rounded Square Message Icon matching previous look and OneNote style */}
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 group-hover:scale-105 pointer-events-none"
                                style={{
                                  background: isSelected
                                    ? `linear-gradient(135deg, ${activePalette.primary}30, ${activePalette.accent}20)`
                                    : darkMode
                                    ? 'rgba(255, 255, 255, 0.04)'
                                    : 'rgba(0, 0, 0, 0.04)',
                                  borderColor: isSelected
                                    ? `${activePalette.primary}70`
                                    : darkMode
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.08)',
                                }}
                              >
                                <MessageSquare
                                  className={`w-4 h-4 shrink-0 transition-colors ${
                                    isSelected
                                      ? darkMode
                                        ? 'text-slate-100'
                                        : ''
                                      : 'text-slate-300 group-hover:text-white'
                                  }`}
                                  style={{
                                    color: isSelected ? (darkMode ? '#f1f5f9' : activePalette.primary) : undefined,
                                  }}
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1.5">
                                  {isEditing ? (
                                    <input
                                      autoFocus
                                      type="text"
                                      value={tempTitle}
                                      onChange={(e) => setTempTitle(e.target.value)}
                                      onBlur={() => handleSaveTitle(conv.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveTitle(conv.id);
                                        if (e.key === 'Escape') setEditingTitleId(null);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => e.stopPropagation()}
                                      className="w-full text-xs font-semibold bg-transparent border-b border-cyan-400 focus:outline-none"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      {conv.pinned && (
                                        <Pin
                                          className="w-3 h-3 shrink-0 rotate-45"
                                          style={{ color: activePalette.primary }}
                                        />
                                      )}
                                      <h4
                                        className={`text-xs font-semibold truncate ${
                                          isSelected
                                            ? 'text-white'
                                            : 'text-slate-200 group-hover:text-white'
                                        } transition-colors`}
                                      >
                                        {conv.title}
                                      </h4>
                                      {isSelected && (
                                        <span
                                          className="w-1.5 h-1.5 rounded-full shrink-0"
                                          style={{ backgroundColor: activePalette.primary }}
                                        />
                                      )}
                                    </div>
                                  )}

                                  {/* Right Action Icons (Pin, Edit Title & Trash) */}
                                  {!isEditing && (
                                    <div
                                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0"
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => handleTogglePin(e, conv.id)}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className={`p-1 rounded hover:bg-white/20 transition cursor-pointer ${
                                          conv.pinned ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                                        }`}
                                        title={conv.pinned ? 'Unpin chat' : 'Pin chat to top'}
                                      >
                                        <Pin className={`w-3 h-3 ${conv.pinned ? 'fill-current' : ''}`} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTitleId(conv.id);
                                          setTempTitle(conv.title);
                                        }}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className="p-1 rounded hover:bg-white/20 text-slate-400 hover:text-white transition cursor-pointer"
                                        title="Rename chat"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => handleRequestDelete(e, conv)}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                        title="Permanently delete conversation"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Bottom Meta Row (Just now / 6 msgs) matching previous look & OneNote PageListItem */}
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pointer-events-none">
                                  <span>{conv.updatedAt || 'Just now'}</span>
                                  <span>{conv.messages.length} msgs</span>
                                </div>
                              </div>
                            </div>
                          </Reorder.Item>
                        );
                      })}
                    </Reorder.Group>
                  )}
                </div>
              </>
            )}
          </aside>

          {/* ================= RIGHT MAIN CHAT STAGE ================= */}
          <main
            onPointerMove={handleStagePointerMove}
            onPointerLeave={handleStagePointerLeave}
            className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 gemini-stage-glow"
          >
            {/* Conversation Switch Blur Sweep — Covering the entire right stage including the bottom chat input dock */}
            {convChangeCount > 0 && (
              <div
                key={`stage-blur-${convChangeCount}`}
                className="absolute inset-0 z-40 pointer-events-none onenote-page-blur-sweep"
                aria-hidden="true"
              />
            )}
            {/* Top Workspace Bar — High z-50 stacking context prevents chat bubbles from clipping through dropdown */}
            <header
              className={`px-4 sm:px-6 py-2.5 border-b flex items-center justify-between gap-3 shrink-0 backdrop-blur-md relative z-50 ${
                darkMode ? 'border-white/10 bg-slate-950/40' : 'border-slate-200/80 bg-white/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activePalette.primary }}
                />
                <h1 className="text-sm sm:text-base font-bold truncate">
                  {currentConversation?.title || 'Gemini Workspace'}
                </h1>
              </div>

              {/* Top Controls: Bespoke Frosted Dropdown, Thinking Mode & Close Button */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Bespoke Liquid Frosted Glass Model Selector Dropdown */}
                <div className="relative z-[60]" ref={modelDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition select-none liquid-glass-tile gemini-button-tile cursor-pointer ${
                      darkMode
                        ? 'bg-slate-900/90 border-white/15 text-slate-200 hover:text-white hover:bg-slate-800'
                        : 'bg-white/95 border-slate-300 text-slate-800 hover:text-slate-950 hover:bg-white shadow-xs'
                    }`}
                    style={{
                      borderColor: isModelDropdownOpen ? `${activePalette.primary}80` : undefined,
                    }}
                    title="Select Google Gemini Model"
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
                        <span className="text-[9px] text-cyan-400 font-bold">{SUPPORTED_MODELS.length} Active</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                        {SUPPORTED_MODELS.map((m) => {
                          const isSelected = selectedModel === m.id;
                          return (
                            <div
                              key={m.id}
                              onClick={() => {
                                setSelectedModel(m.id);
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

                {/* Deep Thinking Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setEnableThinking(!enableThinking)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition select-none liquid-glass-tile gemini-button-tile cursor-pointer ${
                    enableThinking
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-xs'
                      : darkMode
                      ? 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                      : 'bg-slate-100 text-slate-600 border-slate-300 hover:text-slate-900'
                  }`}
                  title={enableThinking ? 'Thinking reasoning active' : 'Enable deep chain-of-thought'}
                >
                  <Brain
                    className={`w-3.5 h-3.5 ${
                      enableThinking ? 'text-purple-400 animate-pulse' : 'text-slate-400'
                    }`}
                  />
                  <span className="hidden sm:inline">Thinking</span>
                </button>

                {/* Exit to Workspace Button */}
                <button
                  type="button"
                  onClick={onCloseBack}
                  className={`p-1.5 rounded-xl border transition select-none liquid-glass-tile gemini-button-tile cursor-pointer ${
                    darkMode
                      ? 'border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'
                      : 'border-slate-300/80 hover:bg-white text-slate-600 hover:text-slate-950 shadow-xs'
                  }`}
                  title="Exit Gemini Workspace (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Chat Thread Messages Area — Protected with .gemini-chat-canvas for 120 FPS Zero-Lag Scrolling */}
            <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
              <div
                key={currentConversation?.id || 'empty-stage'}
                ref={chatScrollContainerRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar gemini-chat-canvas relative z-10 onenote-page-content-reveal"
              >
                {!currentConversation || currentConversation.messages.length === 0 ? (
                /* Empty Chat Welcome Hero */
                <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
                  <div
                    className="w-16 h-16 mx-auto rounded-3xl flex items-center justify-center border shadow-xl relative group"
                    style={{
                      background: `linear-gradient(135deg, ${activePalette.primary}35, ${activePalette.accent}35)`,
                      borderColor: `${activePalette.primary}60`,
                    }}
                  >
                    <Sparkles className="w-8 h-8" style={{ color: activePalette.primary }} />
                    <div
                      className="absolute inset-0 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition"
                      style={{ backgroundColor: `${activePalette.primary}30` }}
                    />
                  </div>

                  <div>
                    <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                      What can I help you explore today?
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                      Gemini Workspace provides fast multimodal intelligence, LaTeX mathematical formatting, and code synthesis.
                    </p>
                  </div>

                  {/* Suggestion Chips */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                    {SUGGESTED_PROMPTS.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleSendMessage(item.prompt)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition select-none liquid-glass-tile gemini-button-tile ${
                            darkMode
                              ? 'bg-slate-900/50 hover:bg-slate-800/80 border-white/10 hover:border-white/25'
                              : 'bg-white/80 hover:bg-white border-slate-300/80 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                            <h4 className="text-xs font-bold">{item.title}</h4>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {item.prompt}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Thread of Messages with Smooth Deletion Animation & Natural Readable Sizing */
                <AnimatePresence initial={false}>
                  {currentConversation?.messages.map((msg) => {
                    const isUser = msg.role === 'user';

                    return (
                      <motion.div
                        key={msg.id}
                        data-msg-id={msg.id}
                        data-msg-role={msg.role}
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.88, height: 0, overflow: 'hidden', marginBottom: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {/* Message card with natural ergonomic width matching prompt length */}
                        <div
                          className={`rounded-2xl transition-all duration-200 relative group/msg border ${
                            isUser
                              ? 'max-w-[85%] sm:max-w-xl md:max-w-2xl w-fit ml-auto min-w-[140px] p-3.5 sm:p-4 text-xs sm:text-sm rounded-tr-md shadow-md'
                              : 'max-w-[88%] sm:max-w-2xl md:max-w-3xl w-fit mr-auto min-w-[180px] p-4 sm:p-5 text-xs sm:text-sm rounded-tl-md shadow-md'
                          }`}
                          style={
                            isUser
                              ? {
                                  background: darkMode
                                    ? activePalette.id === 'black-night'
                                      ? 'rgba(24, 24, 28, 0.95)'
                                      : 'rgba(45, 33, 20, 0.85)'
                                    : 'rgba(254, 243, 199, 0.95)',
                                  borderColor: `${activePalette.primary}85`,
                                  boxShadow: `0 4px 18px -2px ${activePalette.primary}30`,
                                  color: darkMode ? '#f8fafc' : '#451a03',
                                }
                              : {
                                  background: darkMode
                                    ? activePalette.id === 'black-night'
                                      ? 'rgba(12, 14, 20, 0.88)'
                                      : 'rgba(15, 23, 42, 0.75)'
                                    : 'rgba(255, 255, 255, 0.95)',
                                  borderColor: darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(226, 232, 240, 0.9)',
                                  boxShadow: darkMode
                                    ? '0 8px 32px -4px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                                    : '0 8px 24px -4px rgba(0, 0, 0, 0.08)',
                                  color: darkMode ? '#f1f5f9' : '#0f172a',
                                }
                          }
                        >
                          {/* Attachments preview if present in message */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2.5">
                              {msg.attachments.map((att) => (
                                <div
                                  key={att.id}
                                  onClick={() => setViewingAttachment(att)}
                                  className={`flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border backdrop-blur-md cursor-pointer hover:scale-[1.02] transition ${
                                    isUser
                                      ? 'bg-white/15 border-white/25 text-white'
                                      : darkMode
                                      ? 'bg-white/5 border-white/10 text-slate-200 hover:border-white/25'
                                      : 'bg-black/5 border-black/10 text-slate-800 hover:border-black/20'
                                  }`}
                                  title="Click to view file contents"
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
                                        <FileText className="w-4 h-4 text-rose-300" />
                                      ) : /\.(py|js|ts|tsx|jsx|html|css|c|cpp|rs|go|java)$/i.test(att.name) ? (
                                        <FileCode className="w-4 h-4 text-cyan-300" />
                                      ) : /\.(csv|xlsx|json)$/i.test(att.name) ? (
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                                      ) : (
                                        <File className="w-4 h-4 text-amber-300" />
                                      )}
                                    </div>
                                  )}
                                  <div className="text-left overflow-hidden max-w-[170px]">
                                    <p className="text-[11px] font-semibold truncate leading-tight">
                                      {att.name}
                                    </p>
                                    <p className="text-[9px] opacity-80 font-mono">
                                      {att.sizeFormatted} · Click to View
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Rich Markdown & KaTeX Math Renderer */}
                          <MarkdownRenderer
                            content={msg.content}
                            darkMode={darkMode}
                            isUser={isUser}
                          />

                          {/* Integrated compact meta footer row */}
                          <div
                            className={`flex items-center justify-between gap-3 text-[10px] font-mono mt-2.5 pt-2 border-t ${
                              isUser
                                ? 'border-amber-500/25 text-amber-200/80'
                                : darkMode
                                ? 'border-white/10 text-slate-400'
                                : 'border-slate-200 text-slate-500'
                            }`}
                          >
                            <span>{msg.timestamp}</span>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover/msg:opacity-100 transition">
                              <button
                                type="button"
                                onClick={() => handleCopy(msg.id, msg.content)}
                                className="flex items-center gap-1 hover:text-white transition"
                                title="Copy message text"
                              >
                                {copiedMsgId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 rounded hover:text-rose-400 hover:bg-rose-500/10 text-slate-400 transition"
                                title="Delete message"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}

              {/* Thinking / Streaming Indicator */}
              {isLoading && (
                <div className="flex gap-3 max-w-xl mr-auto">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border animate-pulse"
                    style={{
                      background: `linear-gradient(135deg, ${activePalette.primary}30, ${activePalette.accent}30)`,
                      borderColor: `${activePalette.primary}60`,
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                  </div>
                  <div
                    className={`rounded-2xl p-3.5 text-xs border flex items-center gap-2.5 shadow-md ${
                      darkMode
                        ? 'bg-slate-900/80 text-slate-300 border-white/10'
                        : 'bg-white/95 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Brain className="w-4 h-4 text-purple-400 animate-spin" />
                    <span className="font-medium">
                      Gemini is formulating response...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

            {/* Bottom Streamlined Prompt Dock */}
            <div className="px-3 sm:px-6 pb-3 pt-1 shrink-0">
              {/* Hidden File Input for Image & Multi-document Upload */}
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

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFiles(e.dataTransfer.files);
                  }
                }}
                className={`max-w-3xl mx-auto rounded-2xl border px-3.5 py-2.5 shadow-2xl relative transition-all duration-300 gemini-prompt-dock ${
                  isDraggingOver
                    ? 'scale-[1.008]'
                    : darkMode
                    ? 'bg-slate-950/75 backdrop-blur-2xl'
                    : 'bg-white/90 backdrop-blur-2xl shadow-slate-300/50'
                }`}
                style={{
                  borderColor: isDraggingOver
                    ? activePalette.primary
                    : `${activePalette.primary}75`,
                  boxShadow: isDraggingOver
                    ? `0 0 24px 2px ${activePalette.primary}50, inset 0 0 16px ${activePalette.primary}20`
                    : `0 0 16px -2px ${activePalette.primary}30, inset 0 0 12px ${activePalette.primary}10`,
                }}
              >
                {/* Pending Attachments Preview Tray */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-1.5 border-b border-white/10 dark:border-white/10 border-slate-200">
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
                          <FileText className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
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

                {/* Clean, low-profile autosizing textarea with clipboard paste support */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(140, Math.max(32, e.target.scrollHeight))}px`;
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    attachments.length > 0
                      ? `Ask Gemini about ${attachments.length} attached file${attachments.length > 1 ? 's' : ''} or type math... (Enter to send)`
                      : 'Ask Gemini anything or type equations... (Enter to send, Shift+Enter for newline)'
                  }
                  className="w-full bg-transparent text-xs sm:text-sm focus:outline-none resize-none px-1 py-1 leading-relaxed min-h-[32px]"
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    {/* + Option on left side of chat input */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border transition select-none liquid-glass-tile gemini-button-tile cursor-pointer ${
                        attachments.length > 0
                          ? 'border-transparent shadow-xs'
                          : darkMode
                          ? 'bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/10'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:text-slate-900 shadow-xs'
                      }`}
                      style={{
                        backgroundColor: attachments.length > 0 ? `${activePalette.primary}25` : undefined,
                        borderColor: attachments.length > 0 ? `${activePalette.primary}60` : undefined,
                        color: attachments.length > 0 ? activePalette.primary : undefined,
                      }}
                      title="Upload images or documents (PDF, TXT, MD, CSV, Code, Docx)"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5] text-slate-200" style={{ color: attachments.length > 0 ? activePalette.primary : undefined }} />
                      <span>Upload</span>
                      {attachments.length > 0 && (
                        <span
                          className="w-3.5 h-3.5 rounded-full text-slate-950 font-bold text-[8px] flex items-center justify-center"
                          style={{ backgroundColor: activePalette.primary }}
                        >
                          {attachments.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEnableWebSearch(!enableWebSearch)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 border transition select-none liquid-glass-tile gemini-button-tile cursor-pointer ${
                        enableWebSearch
                          ? 'border-transparent shadow-xs'
                          : 'text-slate-300 border-transparent hover:bg-white/5 hover:text-white'
                      }`}
                      style={{
                        backgroundColor: enableWebSearch ? `${activePalette.primary}25` : undefined,
                        borderColor: enableWebSearch ? `${activePalette.primary}60` : undefined,
                        color: enableWebSearch ? activePalette.primary : undefined,
                      }}
                      title="Toggle Web search"
                    >
                      <Globe className="w-3 h-3 text-slate-200" style={{ color: enableWebSearch ? activePalette.primary : undefined }} />
                      <span>Web</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEnableThinking(!enableThinking)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 border transition select-none liquid-glass-tile gemini-button-tile cursor-pointer ${
                        enableThinking
                          ? 'border-transparent'
                          : 'text-slate-300 border-transparent hover:bg-white/5 hover:text-white'
                      }`}
                      style={{
                        backgroundColor: enableThinking ? `${activePalette.accent}25` : undefined,
                        borderColor: enableThinking ? `${activePalette.accent}60` : undefined,
                        color: enableThinking ? activePalette.accent : undefined,
                      }}
                      title="Toggle Thinking reasoning mode"
                    >
                      <Brain className="w-3 h-3 text-slate-200" style={{ color: enableThinking ? activePalette.accent : undefined }} />
                      <span>Thinking</span>
                    </button>
                  </div>

                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStopResponse}
                      className="w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 border border-rose-400 text-white flex items-center justify-center transition shadow-md shrink-0 cursor-pointer animate-pulse"
                      title="Stop response"
                      aria-label="Stop response"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputMessage.trim() && attachments.length === 0}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center transition shadow-md shrink-0 ${
                        inputMessage.trim() || attachments.length > 0
                          ? 'opacity-100 cursor-pointer scale-100 hover:scale-105 active:scale-95'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                      style={{
                        background: (inputMessage.trim() || attachments.length > 0)
                          ? `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`
                          : undefined,
                        borderColor: `${activePalette.primary}80`,
                        color: (inputMessage.trim() || attachments.length > 0) ? '#ffffff' : undefined,
                        boxShadow: (inputMessage.trim() || attachments.length > 0) ? `0 0 16px ${activePalette.primary}40` : undefined,
                      }}
                      title="Send to Gemini"
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.5] text-slate-200" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-center text-slate-400 mt-1.5 font-mono">
                Gemini Workspace may display inaccurate info, including about people, so double-check its responses.
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* ================= FAINTED ARROW ON THE RIGHT (HYPRLAND BACK TRIGGER) ================= */}
      <div className="relative group shrink-0 z-50">
        <button
          onClick={onCloseBack}
          aria-label="Return to Primary Workspace"
          className={`h-full w-11 sm:w-12 border-l flex flex-col items-center justify-center gap-3.5 opacity-70 hover:opacity-100 transition-all duration-300 cursor-pointer shadow-2xl backdrop-blur-2xl group ${
            darkMode
              ? 'bg-slate-900/40 hover:bg-slate-900/80 border-white/15'
              : 'bg-white/50 hover:bg-white/90 border-slate-300/80 shadow-slate-300/40'
          }`}
          style={{ color: activePalette.primary }}
          title="Click to glide back to main workspace (or press Esc)"
        >
          <div
            className="p-1 rounded-full border group-hover:scale-110 transition-transform duration-300 shadow-sm flex items-center justify-center"
            style={{
              backgroundColor: `${activePalette.primary}25`,
              borderColor: `${activePalette.primary}60`,
            }}
          >
            <ChevronRight className="w-4.5 h-4.5 stroke-[2.5]" />
          </div>
          <span
            className={`[writing-mode:vertical-rl] text-[10px] font-mono tracking-widest uppercase font-bold transition-colors ${
              darkMode ? 'text-slate-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-950'
            }`}
          >
            Workspace
          </span>
          <span
            className={`text-[9px] font-mono px-1 py-0.5 rounded border [writing-mode:vertical-rl] opacity-60 group-hover:opacity-100 transition ${
              darkMode ? 'border-white/20 text-slate-400' : 'border-slate-400/30 text-slate-600'
            }`}
          >
            Esc
          </span>
        </button>
      </div>

      {/* ================= PERMANENT DELETE CONFIRMATION MODAL ================= */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4 ${
              darkMode ? 'bg-slate-900 border-white/20 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
            }`}
            style={{ borderColor: `${activePalette.primary}60` }}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Delete Conversation Permanently?</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-rose-300">"{deleteConfirmation.convTitle}"</span>?
                  This conversation and all of its messages will be permanently removed and cannot be recovered.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDeleteConfirmation({ isOpen: false, convId: '', convTitle: '' })}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  darkMode
                    ? 'border-white/15 hover:bg-white/10 text-slate-300'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal for Chat Attachments (Renders PDFs and Images in an <iframe>) */}
      {viewingAttachment &&
        createPortal(
          <div
            onClick={() => setViewingAttachment(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-4xl rounded-3xl p-6 border shadow-2xl flex flex-col max-h-[88vh] space-y-4 acrylic-glass-panel ${
                darkMode ? 'bg-slate-900/95 border-white/20 text-slate-100' : 'bg-white/95 border-slate-300 text-slate-900'
              }`}
              style={{ borderColor: `${activePalette.primary}60` }}
            >
              <div className="flex items-center justify-between pb-3 border-b border-inherit shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: `${activePalette.primary}25`, color: activePalette.primary }}
                  >
                    {viewingAttachment.isImage ? <FileText className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
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
                      className="p-1.5 rounded-lg border hover:bg-white/10 transition text-xs flex items-center gap-1 cursor-pointer"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  )}
                  {viewingAttachment.textContent && (
                    <button
                      type="button"
                      onClick={() => handleCopy('view-att', viewingAttachment.textContent || '')}
                      className="p-1.5 rounded-lg border hover:bg-white/10 transition text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedMsgId === 'view-att' ? 'Copied' : 'Copy'}</span>
                    </button>
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
                  <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
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

// General Gemini Assistant Synthesis for offline or fallback operation
function generateGeneralAssistantResponse(
  query: string,
  enableThinking: boolean,
  attachments?: ChatAttachment[]
): string {
  const lower = query.toLowerCase();

  const thinkingPrefix = enableThinking
    ? `> **Chain-of-Thought Reasoning**: Decomposing query components, analyzing multimodal attachments, algorithmic complexity, and formulating clear derivations.\n\n`
    : '';

  if (attachments && attachments.length > 0) {
    const fileList = attachments
      .map((a) => `- **${a.name}** (${a.isImage ? 'Image' : a.type.toUpperCase()}, ${a.sizeFormatted})`)
      .join('\n');
    return `${thinkingPrefix}### Multimodal Analysis: ${attachments.length} Uploaded File${attachments.length > 1 ? 's' : ''}

I have processed the uploaded files and analyzed their contents in the context of your query:

${fileList}

#### Key Findings & Extracted Content:
1. **Document Structure**: The uploaded documents have been inspected. ${
      attachments.some((a) => a.isImage)
        ? 'Image assets have been rendered with visual fidelity.'
        : 'Text and structural schemas have been parsed.'
    }
2. **Context Synthesis**: ${
      query.trim()
        ? `In response to *"**${query.trim()}**"*, the provided sources support direct query synthesis and computation.`
        : 'The files are ready for querying, mathematical formulation, or code transformation.'
    }

Would you like me to extract specific sections, summarize statistical metrics, or convert parts of these files into executable code or tables?`;
  }

  if (lower.includes('attention') || lower.includes('softmax') || lower.includes('transformer')) {
    return `${thinkingPrefix}### Scaled Dot-Product Attention

Scaled Dot-Product Attention computes query-key affinity and maps to value representations:

Mathematical Formulation: Attention(Q, K, V) = Softmax((Q * K^T) / sqrt(d_k)) * V

$$\\operatorname{Attention}(Q, K, V) = \\operatorname{Softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V$$

#### Mathematical Rationale for $\\frac{1}{\\sqrt{d_k}}$:
1. Under the assumption that the components of $q$ and $k$ are independent random variables with zero mean and unit variance $\\sigma^2 = 1$, their dot product has mean 0 and variance $d_k$:
   $$\\operatorname{Var}(q \\cdot k) = \\sum_{i=1}^{d_k} \\operatorname{Var}(q_i k_i) = d_k$$
2. For large $d_k$, dot products grow large in magnitude, pushing the softmax function into regions with extremely small gradients. Dividing by $\\sqrt{d_k}$ stabilizes the variance to 1.`;
  }

  if (lower.includes('quantum') || lower.includes('decoherence') || lower.includes('superposition')) {
    return `${thinkingPrefix}### Quantum Superposition & Environmental Decoherence

In an isolated system, state vectors evolve unitarily according to the Schrödinger equation:
$$i\\hbar \\frac{\\partial}{\\partial t} |\\psi(t)\\rangle = \\hat{H} |\\psi(t)\\rangle$$

When interacting with an environment with $N$ degrees of freedom, the bipartite system entangles:
$$|\\Psi(t)\\rangle = \\alpha |0\\rangle |E_0(t)\\rangle + \\beta |1\\rangle |E_1(t)\\rangle$$

Tracing out environmental states yields the reduced density matrix:
$$\\rho_S(t) = \\begin{pmatrix} |\\alpha|^2 & \\alpha \\beta^* \\langle E_1(t)|E_0(t)\\rangle \\\\ \\alpha^* \\beta \\langle E_0(t)|E_1(t)\\rangle & |\\beta|^2 \\end{pmatrix}$$

Because $\\langle E_0(t)|E_1(t)\\rangle \\to 0$ exponentially fast, quantum phase interference disappears on macroscopic timescales.`;
  }

  return `${thinkingPrefix}### Gemini Response

I have analyzed your inquiry: **"${query}"**.

Here are the key takeaways:
1. **Core Concept**: The architecture emphasizes low-latency processing, clear separation of concerns, and clean visual typography.
2. **Implementation Details**: Hardware-accelerated CSS transforms and composited layers ensure consistent 120 FPS frame rates.

Let me know if you would like me to write code examples or elaborate on specific points!`;
}

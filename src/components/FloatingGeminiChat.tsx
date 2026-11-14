import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Square,
  X,
  Loader2,
  Bot,
  ChevronDown,
  Check,
  Copy,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { ColorPalette } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LiquidGlassSvgFilter } from './LiquidGlassFilter';
import { callGeminiChat, AVAILABLE_GEMINI_MODELS } from '../utils/geminiClient';
import { useChatSmoothScroll } from '../hooks/useSmoothScroll';

interface FloatingGeminiChatProps {
  selectedModel: string;
  onChangeModel?: (model: string) => void;
  enableThinking: boolean;
  activePalette: ColorPalette;
  darkMode: boolean;
  hidden?: boolean;
  smoothScroll?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const FloatingGeminiChat: React.FC<FloatingGeminiChatProps> = ({
  selectedModel,
  onChangeModel,
  enableThinking,
  activePalette,
  darkMode,
  hidden = false,
  smoothScroll = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-0',
      role: 'assistant',
      text: "Hey! How can I help you today?",
      timestamp: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const tileRafRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const pendingPromptIdRef = useRef<string | null>(null);
  const wasLoadingRef = useRef(false);

  const { wrapperRef: chatScrollRef, scrollToBottom, scrollToElementTop } = useChatSmoothScroll<HTMLDivElement>({
    enabled: smoothScroll && isOpen,
    deps: [messages, isLoading],
  });

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `stop-${Date.now()}`,
        role: 'assistant',
        text: '⏹️ *Response stopped by user.*',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // High-performance 120 FPS cursor tracking for the floating liquid glass tile
  const handleTilePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (!tileRafRef.current) {
      tileRafRef.current = requestAnimationFrame(() => {
        tileRafRef.current = null;
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

  const handleTilePointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    if (tileRafRef.current) {
      cancelAnimationFrame(tileRafRef.current);
      tileRafRef.current = null;
    }
    const el = e.currentTarget;
    el.style.setProperty('--pointer-x', '-999px');
    el.style.setProperty('--pointer-y', '-999px');
  };

  useEffect(() => {
    return () => {
      if (tileRafRef.current) cancelAnimationFrame(tileRafRef.current);
    };
  }, []);

  // Auto-scroll: glide to bottom while waiting on prompt, then align top of answered prompt when response completes
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
          scrollToElementTop(promptEl, 12);
        } else {
          scrollToBottom();
        }
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isOpen, scrollToBottom, scrollToElementTop]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    pendingPromptIdRef.current = userMsg.id;
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      const result = await callGeminiChat({
        message: userText,
        model: selectedModel,
        enableThinking,
      });

      if (ac.signal.aborted) return;

      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'assistant',
        text: result.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      if (ac.signal.aborted) return;
      const errMsg = err instanceof Error ? err.message : 'Chat error';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ **API Note**: ${errMsg}. Verify that GEMINI_API_KEY is available in .env or Settings.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <aside
      aria-label="Floating Gemini Assistant"
      className={`fixed right-3 md:right-6 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 z-[60] flex flex-col items-end pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        hidden ? 'translate-y-28 opacity-0 pointer-events-none select-none invisible' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* SVG Chromatic Aberration & Liquid Glass Displacement Shader Filter Definition */}
      <LiquidGlassSvgFilter />

      <AnimatePresence mode="wait">
        {/* Floating Trigger Button (when closed) */}
        {!isOpen ? (
          <motion.button
            key="gemini-trigger-btn"
            initial={{ scale: 0.8, opacity: 0, y: 15, filter: 'blur(12px)' }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              transitionEnd: { filter: 'none' },
            }}
            exit={{ scale: 0.8, opacity: 0, y: 15, filter: 'blur(12px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 25 }}
            onClick={() => setIsOpen(true)}
            onPointerMove={handleTilePointerMove}
            onPointerLeave={handleTilePointerLeave}
            style={{
              borderColor: `${activePalette.primary}60`,
              boxShadow: `0 8px 32px ${activePalette.primary}25`,
            }}
            className={`pointer-events-auto acrylic-glass-panel-minimized liquid-glass liquid-glass-tile no-lift floating-gemini-tile border group relative overflow-hidden p-3 md:p-3.5 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2.5 cursor-pointer ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
            title="Open Gemini"
          >
            {/* Liquid Glass Chromatic Filter Layer */}
            <div className="liquidglass pointer-events-none" aria-hidden="true" />

            <div className="relative z-10 flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-950 font-bold shadow-md relative shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse" />
              </div>
              <div className="text-left pr-1 hidden md:block">
                <p className="text-xs font-bold transition flex items-center gap-1.5" style={{ color: activePalette.primary }}>
                  <span>Gemini</span>
                </p>
                <p className={`text-[10px] font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {enableThinking ? 'High Thinking' : selectedModel}
                </p>
              </div>
            </div>
          </motion.button>
        ) : (
          /* Floating Chat Window (when open, handles minimized & maximized with slick spring layout morph) */
          <motion.div
            key="gemini-chat-window"
            layout
            initial={{ scale: 0.88, opacity: 0, y: 16, filter: 'blur(16px)' }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              transitionEnd: { filter: 'none' },
            }}
            exit={{ scale: 0.88, opacity: 0, y: 16, filter: 'blur(16px)' }}
            transition={{
              layout: { type: 'spring', stiffness: 360, damping: 28 },
              scale: { type: 'spring', stiffness: 400, damping: 26 },
              opacity: { duration: 0.22 },
              filter: { duration: 0.22 },
            }}
            onPointerMove={handleTilePointerMove}
            onPointerLeave={handleTilePointerLeave}
            className={`pointer-events-auto no-lift flex flex-col overflow-hidden relative transition-[box-shadow,border-color,background-color] duration-300 liquid-glass liquid-glass-tile floating-gemini-tile border rounded-3xl shadow-2xl w-[calc(100vw-1.5rem)] md:w-96 max-w-sm h-[440px] md:h-[520px] max-h-[calc(100dvh-8.5rem)] md:max-h-[85vh] border-white/20`}
            style={{
              transformOrigin: 'bottom right',
              borderColor: `${activePalette.primary}50`,
            }}
          >
            {/* Liquid Glass Chromatic Filter Layer */}
            <div className="liquidglass pointer-events-none" aria-hidden="true" />

            {/* Header */}
            <div
              className={`p-3.5 flex items-center justify-between shrink-0 select-none relative z-10 ${
                darkMode
                  ? 'border-b border-white/10 bg-white/[0.04]'
                  : 'border-b border-slate-200/60 bg-white/40'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-950 shadow-sm font-bold relative shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                >
                  <Bot className="w-4 h-4" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-slate-950 animate-pulse" />
                </div>
                <div className="min-w-0 truncate">
                  <h4
                    className={`text-xs font-bold leading-tight truncate ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    Gemini
                  </h4>
                  <div
                    className={`flex items-center gap-1.5 text-[10px] font-mono leading-none mt-0.5 relative ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                    ref={modelDropdownRef}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsModelDropdownOpen(!isModelDropdownOpen);
                      }}
                      className="font-semibold shrink-0 flex items-center gap-1 hover:underline cursor-pointer"
                      style={{ color: activePalette.primary }}
                      title="Switch Gemini model on the go"
                    >
                      <span>{selectedModel}</span>
                      <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                    </button>
                    {enableThinking ? (
                      <span className="text-red-400 font-bold shrink-0">· Thinking High</span>
                    ) : (
                      <span className="text-emerald-400 font-medium shrink-0">· Ready</span>
                    )}

                    {/* Quick Model Selector Dropdown Popup */}
                    {isModelDropdownOpen && (
                      <div
                        style={{ zIndex: 100 }}
                        className={`absolute left-0 top-full mt-1.5 w-60 rounded-xl border p-1.5 shadow-2xl space-y-1 backdrop-blur-3xl animate-in fade-in duration-100 ${
                          darkMode
                            ? 'bg-slate-900 border-white/20 text-slate-100 shadow-black/80'
                            : 'bg-white border-slate-300 text-slate-900 shadow-slate-400/50'
                        }`}
                      >
                        <div className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/10 dark:border-white/10 border-slate-200">
                          Select Model
                        </div>
                        {AVAILABLE_GEMINI_MODELS.map((m) => {
                          const isSelected = selectedModel === m.id;
                          return (
                            <div
                              key={m.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onChangeModel?.(m.id);
                                setIsModelDropdownOpen(false);
                              }}
                              className={`p-1.5 rounded-lg text-[11px] flex items-center justify-between cursor-pointer transition select-none ${
                                isSelected
                                  ? darkMode
                                    ? 'bg-slate-800 text-white font-semibold'
                                    : 'bg-slate-100 text-slate-950 font-semibold'
                                  : darkMode
                                  ? 'text-slate-300 hover:bg-white/10'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <div className="truncate pr-1">
                                <p className="font-medium truncate">{m.name}</p>
                                <p className="text-[9px] text-slate-400 font-mono truncate">{m.tag}</p>
                              </div>
                              {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Window Controls: Only Close Button */}
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    darkMode
                      ? 'hover:bg-red-500/20 hover:text-red-300 text-slate-300'
                      : 'hover:bg-red-100 hover:text-red-600 text-slate-600'
                  }`}
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>

            {/* Chat Body: Messages + Input Form */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Message List */}
                  <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs leading-relaxed custom-scrollbar relative z-10">
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
                            className={`max-w-[85%] p-3.5 rounded-2xl shadow-sm ${
                              m.role === 'user'
                                ? 'text-slate-950 font-semibold rounded-tr-none shadow-md'
                                : darkMode
                                ? 'bg-slate-900/60 text-slate-100 border border-white/14 rounded-tl-none shadow-md backdrop-blur-md'
                                : 'bg-white/90 text-slate-900 border border-slate-200/90 rounded-tl-none shadow-sm backdrop-blur-sm'
                            }`}
                            style={
                              m.role === 'user'
                                ? {
                                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                                    boxShadow: `0 4px 14px ${activePalette.primary}35`,
                                  }
                                : {}
                            }
                          >
                            <MarkdownRenderer
                              content={m.text}
                              darkMode={darkMode}
                              isUser={m.role === 'user'}
                            />
                            <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-white/10 text-[9px] font-mono">
                              <span
                                className={
                                  m.role === 'user'
                                    ? 'text-slate-950/75'
                                    : darkMode
                                    ? 'text-slate-400'
                                    : 'text-slate-500'
                                }
                              >
                                {m.timestamp}
                              </span>

                              <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard.writeText(m.text)}
                                  className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                                  title="Copy text"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMessages((prev) => prev.filter((item) => item.id !== m.id))}
                                  className="p-0.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-xs font-mono p-2.5 bg-slate-950/70 text-amber-300 rounded-xl border border-white/14 shadow-sm backdrop-blur-md"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>Gemini is thinking...</span>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Translucent Frosted Acrylic Input Bar */}
                  <form
                    onSubmit={handleSend}
                    className={`p-3 border-t flex items-center gap-2 shrink-0 relative z-10 ${
                      darkMode
                        ? 'border-white/10 bg-white/[0.04]'
                        : 'border-slate-200/60 bg-white/40'
                    }`}
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask Gemini anything..."
                      className={`flex-1 px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 transition ${
                        darkMode
                          ? 'bg-slate-950/50 border-white/14 text-slate-100 placeholder-slate-400 focus:border-amber-400/80 focus:ring-amber-400/20'
                          : 'bg-white/90 border-slate-300 text-slate-900 placeholder-slate-500 focus:border-amber-500 focus:ring-amber-500/20 shadow-inner'
                      }`}
                    />
                    {isLoading ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={handleStop}
                        className="p-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition font-bold shadow-md cursor-pointer flex items-center justify-center animate-pulse"
                        title="Stop response"
                        aria-label="Stop response"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={!input.trim()}
                        className="p-2 rounded-xl text-slate-950 disabled:opacity-40 transition font-bold shadow-md cursor-pointer disabled:cursor-not-allowed"
                        style={{
                          background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                        }}
                        title="Send Prompt"
                      >
                        <Send className="w-3.5 h-3.5 fill-slate-950" />
                      </motion.button>
                    )}
                  </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    );
  };

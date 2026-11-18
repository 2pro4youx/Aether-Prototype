import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  FolderGit2,
  BookOpen,
  FileCode,
  Calendar,
  Sparkles,
  Layers,
  ArrowRight,
  GraduationCap,
  Network,
  FlaskConical,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ColorPalette } from '../types';
import { LiquidGlassSvgFilter } from './LiquidGlassFilter';

export type CreationItemType =
  | 'note'
  | 'project'
  | 'notebook'
  | 'document'
  | 'planner'
  | 'onenote'
  | 'flashcards'
  | 'mindmap'
  | 'lab';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateItem: (type: CreationItemType) => void;
  darkMode?: boolean;
  activePalette?: ColorPalette;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  isOpen,
  onClose,
  onCreateItem,
  darkMode = true,
  activePalette,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const creationOptions = [
    {
      type: 'notebook' as const,
      title: 'Google NotebookLM Workspace',
      description:
        'Multi-source grounded AI workspace for ingesting PDFs, research papers, and generating audio podcast scripts.',
      icon: BookOpen,
      badge: 'Grounded AI',
      gradient: 'from-amber-500/20 to-red-500/20',
      border: 'border-amber-500/40',
      iconColor: 'text-amber-400',
      inDevelopment: false,
    },
    {
      type: 'onenote' as const,
      title: 'OneNote Multi-Tab Notebook',
      description:
        'Standalone hierarchical notebook (Notebooks > Color Sections > Pages) with rich block editing and no Google Notebook window.',
      icon: Layers,
      badge: 'Standalone',
      gradient: 'from-purple-500/20 to-indigo-500/20',
      border: 'border-purple-500/40',
      iconColor: 'text-purple-400',
      inDevelopment: false,
    },
    {
      type: 'note' as const,
      title: 'Quick Atomic Note',
      description:
        'Fast markdown scratchpad for capturing lecture insights, spontaneous thoughts, or exam formulas.',
      icon: FileText,
      badge: 'In Development',
      gradient: 'from-slate-500/10 to-slate-600/10',
      border: 'border-white/10',
      iconColor: 'text-slate-400',
      inDevelopment: true,
    },
    {
      type: 'project' as const,
      title: 'Research Project',
      description:
        'Structured repository uniting citations, milestone goals, lab benchmarks, and teammate assets.',
      icon: FolderGit2,
      badge: 'In Development',
      gradient: 'from-slate-500/10 to-slate-600/10',
      border: 'border-white/10',
      iconColor: 'text-slate-400',
      inDevelopment: true,
    },
    {
      type: 'document' as const,
      title: 'Academic Document',
      description:
        'Polished editorial document formatted for literature reviews, conference submissions, or lab write-ups.',
      icon: FileCode,
      badge: 'In Development',
      gradient: 'from-slate-500/10 to-slate-600/10',
      border: 'border-white/10',
      iconColor: 'text-slate-400',
      inDevelopment: true,
    },
    {
      type: 'planner' as const,
      title: 'Study Planner & Sprint',
      description:
        'Time-blocked calendar agenda with hourly slots, task dependencies, and milestone velocity meters.',
      icon: Calendar,
      badge: 'In Development',
      gradient: 'from-slate-500/10 to-slate-600/10',
      border: 'border-white/10',
      iconColor: 'text-slate-400',
      inDevelopment: true,
    },
    {
      type: 'flashcards' as const,
      title: 'Active Recall & Resource Deck',
      description:
        'Spaced repetition flashcards with algorithmic review intervals and self-testing rubrics.',
      icon: GraduationCap,
      badge: 'In Development',
      gradient: 'from-slate-500/10 to-slate-600/10',
      border: 'border-white/10',
      iconColor: 'text-slate-400',
      inDevelopment: true,
    },
    {
      type: 'mindmap' as const,
      title: 'Interactive Concept Mindmap',
      description:
        'Spatial node-graph canvas for linking theories, theorem proofs, and source references visually.',
      icon: Network,
      badge: 'In Development',
      gradient: 'from-slate-500/10 to-slate-600/10',
      border: 'border-white/10',
      iconColor: 'text-slate-400',
      inDevelopment: true,
    },
    {
      type: 'lab' as const,
      title: 'Code & Math Execution Lab',
      description:
        'Live computational notebook pairing executable code cells, LaTeX derivations, and interactive charts.',
      icon: FlaskConical,
      badge: 'In Development',
      gradient: 'from-slate-500/10 to-slate-600/10',
      border: 'border-white/10',
      iconColor: 'text-slate-400',
      inDevelopment: true,
    },
  ];

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-labelledby="creation-studio-heading"
          className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-hidden select-none"
        >
          {/* Chromatic Liquid Glass Shader Filter Definition */}
          <LiquidGlassSvgFilter />

          {/* Frosted Acrylic Backdrop with Hardware-Accelerated Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-md cursor-pointer"
            aria-hidden="true"
          />

          {/* Frosted Modal Window Card with 65% Opacity & Pinned Header + Internal Scroll Body */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            data-lenis-prevent
            className={`creation-frost-panel relative z-10 flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
            style={{
              willChange: 'transform, opacity',
            }}
          >
            {/* Chromatic Liquid Glass Displacement Frost Layer (strictly below all text and cards, fixed to non-scrolling shell) */}
            <div
              className="liquidglass pointer-events-none absolute inset-0 z-0"
              aria-hidden="true"
              style={{ opacity: 0.55 }}
            />

            {/* Pinned Header (always reachable on mobile without scrolling) */}
            <div
              className={`relative z-10 shrink-0 flex items-start justify-between gap-3 px-4 pt-4 pb-3.5 sm:px-6 sm:pt-6 sm:pb-4 md:px-8 md:pt-8 md:pb-4 border-b ${
                darkMode ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div
                  className="flex items-center gap-2 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-widest"
                  style={{ color: activePalette?.primary || '#f59e0b' }}
                >
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>Creation Studio</span>
                </div>
                <h2
                  id="creation-studio-heading"
                  className={`text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight ${
                    darkMode ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  What will you build today?
                </h2>
                <p
                  className={`text-xs sm:text-sm leading-snug ${
                    darkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Launch a grounded NotebookLM workspace or a standalone OneNote notebook — additional studios are in development.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`shrink-0 p-2 rounded-xl transition cursor-pointer ${
                  darkMode
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Close Creation Studio"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body for Creation Instruments (3x3 desktop, 2-col sm, 1-col mobile) */}
            <div
              data-lenis-prevent
              className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {creationOptions.map((opt) => {
                  const Icon = opt.icon;
                  const disabled = opt.inDevelopment;

                  return (
                    <div
                      key={opt.type}
                      role="button"
                      tabIndex={disabled ? -1 : 0}
                      aria-disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        onCreateItem(opt.type);
                        onClose();
                      }}
                      onKeyDown={(e) => {
                        if (disabled) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onCreateItem(opt.type);
                          onClose();
                        }
                      }}
                      className={`p-4 sm:p-5 rounded-2xl border space-y-2.5 sm:space-y-3 flex flex-col justify-between transition ${
                        disabled
                          ? darkMode
                            ? 'bg-slate-900/40 border-white/10 opacity-45 grayscale cursor-not-allowed'
                            : 'bg-slate-100/70 border-slate-200 opacity-50 grayscale cursor-not-allowed'
                          : `bg-gradient-to-br ${opt.gradient} ${opt.border} md:hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer shadow-lg group ${
                              darkMode ? '' : 'shadow-slate-200/60'
                            }`
                      }`}
                    >
                      <div className="space-y-2.5 sm:space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={`p-2 sm:p-2.5 rounded-xl border ${
                              disabled
                                ? darkMode
                                  ? 'bg-slate-900/70 border-white/10 text-slate-500'
                                  : 'bg-white/70 border-slate-200 text-slate-400'
                                : `${
                                    darkMode
                                      ? 'bg-slate-950/60 border-white/10'
                                      : 'bg-white border-slate-200 shadow-sm'
                                  } ${opt.iconColor}`
                            }`}
                          >
                            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                              disabled
                                ? darkMode
                                  ? 'bg-slate-900/70 border-white/10 text-slate-500'
                                  : 'bg-white/80 border-slate-200 text-slate-500'
                                : darkMode
                                ? 'bg-slate-950/60 border-white/10 text-slate-300'
                                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>

                        <div>
                          <h3
                            className={`text-sm font-bold transition ${
                              disabled
                                ? darkMode
                                  ? 'text-slate-400'
                                  : 'text-slate-600'
                                : darkMode
                                ? 'text-slate-100 group-hover:text-amber-300'
                                : 'text-slate-900 group-hover:text-amber-700'
                            }`}
                          >
                            {opt.title}
                          </h3>
                          <p
                            className={`text-xs leading-relaxed mt-1 ${
                              disabled
                                ? darkMode
                                  ? 'text-slate-500'
                                  : 'text-slate-500'
                                : darkMode
                                ? 'text-slate-400'
                                : 'text-slate-700 font-medium'
                            }`}
                          >
                            {opt.description}
                          </p>
                        </div>
                      </div>

                      {disabled ? (
                        <div
                          className={`pt-1.5 sm:pt-2 flex items-center justify-between text-xs font-mono ${
                            darkMode ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          <span>Coming Soon</span>
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div
                          className="pt-1.5 sm:pt-2 flex items-center justify-between text-xs font-semibold"
                          style={{ color: activePalette?.primary || '#f59e0b' }}
                        >
                          <span>Create Now</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
};

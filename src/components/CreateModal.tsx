import React from 'react';
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none">
          {/* Chromatic Liquid Glass Shader Filter Definition */}
          <LiquidGlassSvgFilter />

          {/* Frosted Acrylic Backdrop with Hardware-Accelerated Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-md cursor-pointer"
          />

          {/* Frosted Modal Window Card with 65% Opacity & Silky Maximizing/Minimizing Physics */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className={`creation-frost-panel relative z-10 rounded-3xl p-6 sm:p-8 w-full max-w-4xl my-auto overflow-hidden ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
            style={{
              willChange: 'transform, opacity',
              transform: 'translateZ(0)',
            }}
          >
            {/* Chromatic Liquid Glass Displacement Frost Layer (strictly below all text and cards) */}
            <div
              className="liquidglass pointer-events-none absolute inset-0 z-0"
              aria-hidden="true"
              style={{ opacity: 0.55 }}
            />

            {/* Foreground Content Container (strictly layered above the frost filter) */}
            <div className="relative z-10 space-y-6">
              {/* Header */}
              <div
                className={`flex items-start justify-between pb-4 border-b ${
                  darkMode ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <div className="space-y-1">
                  <div
                    className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest"
                    style={{ color: activePalette?.primary || '#f59e0b' }}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Creation Studio</span>
                  </div>
                  <h2
                    className={`text-2xl sm:text-3xl font-extrabold ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    What will you build today?
                  </h2>
                  <p
                    className={`text-xs sm:text-sm ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Launch a grounded NotebookLM workspace or a standalone OneNote notebook — additional studios are in development.
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className={`p-2 rounded-xl transition cursor-pointer ${
                    darkMode
                      ? 'text-slate-400 hover:text-white hover:bg-white/5'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  aria-label="Close Creation Studio"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid of Creation Instruments (3x3) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {creationOptions.map((opt) => {
                  const Icon = opt.icon;
                  const disabled = opt.inDevelopment;

                  return (
                    <div
                      key={opt.type}
                      aria-disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        onCreateItem(opt.type);
                        onClose();
                      }}
                      className={`p-5 rounded-2xl border space-y-3 flex flex-col justify-between transition ${
                        disabled
                          ? darkMode
                            ? 'bg-slate-900/40 border-white/10 opacity-45 grayscale cursor-not-allowed'
                            : 'bg-slate-100/70 border-slate-200 opacity-50 grayscale cursor-not-allowed'
                          : `bg-gradient-to-br ${opt.gradient} ${opt.border} hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-lg group ${
                              darkMode ? '' : 'shadow-slate-200/60'
                            }`
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div
                            className={`p-2.5 rounded-xl border ${
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
                            <Icon className="w-5 h-5" />
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
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
                          className={`pt-2 flex items-center justify-between text-xs font-mono ${
                            darkMode ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          <span>Coming Soon</span>
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div
                          className="pt-2 flex items-center justify-between text-xs font-semibold"
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
};

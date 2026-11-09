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
  BrainCircuit,
  GraduationCap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ColorPalette } from '../types';
import { LiquidGlassSvgFilter } from './LiquidGlassFilter';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateItem: (type: 'note' | 'project' | 'notebook' | 'document' | 'planner' | 'onenote' | 'flashcards') => void;
  darkMode?: boolean;
  activePalette?: ColorPalette;
}

export const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose, onCreateItem, darkMode = true, activePalette }) => {
  const creationOptions = [
    {
      type: 'notebook' as const,
      title: 'Google NotebookLM Workspace',
      description: 'Multi-source grounded AI workspace for ingesting PDFs, research papers, and generating audio podcast scripts.',
      icon: BookOpen,
      badge: 'Grounded AI',
      gradient: 'from-amber-500/20 to-red-500/20',
      border: 'border-amber-500/40',
      iconColor: 'text-amber-400',
    },
    {
      type: 'onenote' as const,
      title: 'OneNote Multi-Tab Notebook',
      description: 'Hierarchical notebook (Notebooks > Color Sections > Pages) with rich block editing, code syntax, and action items.',
      icon: Layers,
      badge: 'Rich Blocks',
      gradient: 'from-purple-500/20 to-indigo-500/20',
      border: 'border-purple-500/40',
      iconColor: 'text-purple-400',
    },
    {
      type: 'note' as const,
      title: 'Quick Atomic Note',
      description: 'Fast markdown scratchpad for capturing lecture insights, spontaneous thoughts, or exam formulas.',
      icon: FileText,
      badge: 'Instant Capture',
      gradient: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/40',
      iconColor: 'text-blue-400',
    },
    {
      type: 'project' as const,
      title: 'Research Project',
      description: 'Structured repository uniting citations, milestone goals, lab benchmarks, and teammate assets.',
      icon: FolderGit2,
      badge: 'Multi-Asset',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      border: 'border-emerald-500/40',
      iconColor: 'text-emerald-400',
    },
    {
      type: 'document' as const,
      title: 'Academic Document',
      description: 'Polished editorial document formatted for literature reviews, conference submissions, or lab write-ups.',
      icon: FileCode,
      badge: 'Publication',
      gradient: 'from-rose-500/20 to-pink-500/20',
      border: 'border-rose-500/40',
      iconColor: 'text-rose-400',
    },
    {
      type: 'planner' as const,
      title: 'Study Planner & Sprint',
      description: 'Time-blocked calendar agenda with hourly slots, task dependencies, and milestone velocity meters.',
      icon: Calendar,
      badge: 'Time Management',
      gradient: 'from-amber-600/20 to-yellow-500/20',
      border: 'border-yellow-500/40',
      iconColor: 'text-yellow-400',
    },
    {
      type: 'flashcards' as const,
      title: 'Active Recall & Resource Deck',
      description: 'Spaced repetition flashcards with algorithmic review intervals and self-testing rubrics.',
      icon: GraduationCap,
      badge: 'Retention',
      gradient: 'from-cyan-500/20 to-emerald-500/20',
      border: 'border-cyan-500/40',
      iconColor: 'text-cyan-400',
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
              Select an instrument to harness your study insights, grounded models, and documentation.
            </p>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              darkMode ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid of Creation Instruments */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creationOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <div
                key={opt.type}
                onClick={() => {
                  onCreateItem(opt.type);
                  onClose();
                }}
                className={`p-5 rounded-2xl bg-gradient-to-br ${opt.gradient} border ${opt.border} hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer shadow-lg space-y-3 flex flex-col justify-between group ${
                  darkMode ? '' : 'shadow-slate-200/60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        darkMode ? 'bg-slate-950/60 border-white/10' : 'bg-white border-slate-200 shadow-sm'
                      } ${opt.iconColor}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        darkMode
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
                        darkMode ? 'text-slate-100 group-hover:text-amber-300' : 'text-slate-900 group-hover:text-amber-700'
                      }`}
                    >
                      {opt.title}
                    </h3>
                    <p
                      className={`text-xs leading-relaxed mt-1 ${
                        darkMode ? 'text-slate-400' : 'text-slate-700 font-medium'
                      }`}
                    >
                      {opt.description}
                    </p>
                  </div>
                </div>

                <div
                  className="pt-2 flex items-center justify-between text-xs font-semibold"
                  style={{ color: activePalette?.primary || '#f59e0b' }}
                >
                  <span>Create Now</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
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

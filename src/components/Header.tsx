import React, { useState, useEffect, useRef } from 'react';
import { Plus, LayoutDashboard, Library, BarChart3, Settings, Sparkles, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { ActiveTab, ColorPalette } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenCreate: () => void;
  onOpenNotebookLM: () => void;
  darkMode: boolean;
  activePalette: ColorPalette;
  isWorkspaceSelectorOpen?: boolean;
  isAuthenticated?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreate,
  onOpenNotebookLM,
  darkMode,
  activePalette,
  isWorkspaceSelectorOpen = false,
  isAuthenticated = true,
}) => {
  const isInitialMount = useRef(true);
  const [spinCount, setSpinCount] = useState(0);

  // Trigger blur spinning animation on '+' icon when theme palette changes via lander/home interactions
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setSpinCount((prev) => prev + 1);
  }, [activePalette.id]);

  const getTabStyle = (tab: ActiveTab) => {
    if (activeTab === tab) {
      return {
        backgroundColor: `${activePalette.primary}25`,
        borderColor: `${activePalette.primary}60`,
        color: darkMode ? '#ffffff' : activePalette.primary,
        boxShadow: `0 2px 10px ${activePalette.primary}20`,
      };
    }
    return {};
  };

  if (!isAuthenticated) return null;

  return (
    <motion.header
      initial={{ y: -90, opacity: 0, scale: 0.95 }}
      animate={{
        y: isWorkspaceSelectorOpen ? -80 : 0,
        opacity: isWorkspaceSelectorOpen ? 0 : 1,
        scale: 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        mass: 0.8,
      }}
      className={`fixed top-4 inset-x-0 z-50 flex justify-center items-center pointer-events-none px-4 ${
        isWorkspaceSelectorOpen ? 'pointer-events-none' : ''
      }`}
    >
      {/* Floating Pill Container with Liquid Glass - seamless smooth edges with zero gap */}
      <nav
        aria-label="Main Navigation"
        className={`pointer-events-auto rounded-full px-5 py-2 flex items-center gap-2 sm:gap-3 shadow-2xl transition-all duration-300 liquid-glass no-lift overflow-hidden ${
          darkMode ? 'text-slate-200' : 'text-slate-800'
        }`}
      >
        {/* Brand / Home anchor with clean white A icon */}
        <button
          onClick={() => onSelectTab('lander')}
          className="flex items-center gap-2 px-2 py-1 text-xs font-bold tracking-tight transition shrink-0 group rounded-full hover:bg-white/10"
          title="Return to Lander & Polygon Mesh"
        >
          <div className="w-5 h-5 rounded-full border border-white/30 bg-white/10 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <span className="text-[11px] font-black text-white leading-none tracking-normal font-sans">A</span>
          </div>
          <span className="hidden md:inline font-sans text-[11px] uppercase tracking-wider font-extrabold text-white">
            AETHER
          </span>
        </button>

        {/* Small thin line dividing Brand and Navigation links */}
        <div
          className={`w-px h-3.5 shrink-0 rounded-full ${
            darkMode ? 'bg-white/20' : 'bg-slate-900/15'
          }`}
          aria-hidden="true"
        />

        {/* Dashboard Link */}
        <button
          onClick={() => onSelectTab('dashboard')}
          style={getTabStyle('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap shrink-0 border border-transparent ${
            activeTab === 'dashboard'
              ? 'font-bold'
              : darkMode
              ? 'text-slate-300 hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        {/* My Library Link */}
        <button
          onClick={() => onSelectTab('library')}
          style={getTabStyle('library')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap shrink-0 border border-transparent ${
            activeTab === 'library'
              ? 'font-bold'
              : darkMode
              ? 'text-slate-300 hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Library className="w-3.5 h-3.5" />
          <span>My Library</span>
        </button>

        {/* DOMINATING '+' ICON (Gold/Palette and Black with Theme Change Blur Spinning Animation) */}
        <div className="relative px-1 shrink-0 flex items-center justify-center">
          {/* Animated Glow Aura when theme changes */}
          <motion.div
            key={`pulse-${spinCount}`}
            initial={false}
            animate={
              spinCount > 0
                ? {
                    opacity: [0, 0.85, 0],
                    scale: [0.9, 1.4, 1.65],
                  }
                : { opacity: 0 }
            }
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 rounded-2xl pointer-events-none -z-10"
            style={{
              boxShadow: `0 0 24px 6px ${activePalette.primary}88`,
            }}
          />

          <button
            onClick={onOpenCreate}
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
            className={`group relative flex items-center justify-center w-11 h-11 rounded-2xl text-slate-950 shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 border-2 focus:outline-none ${
              darkMode ? 'border-slate-950 shadow-black/40' : 'border-white shadow-slate-400/40'
            }`}
            title="Create new note, project, notebook, document, or planner"
            aria-label="Create New Item"
          >
            {/* Concentric inner border matching outer 16px curve with 2px inset = 14px radius */}
            <div className="absolute inset-0.5 rounded-[14px] border border-white/40 pointer-events-none" />
            <motion.div
              animate={
                spinCount > 0
                  ? {
                      rotate: spinCount * 360,
                      filter: ['blur(0px)', 'blur(5px)', 'blur(0px)'],
                      scale: [1, 1.22, 1],
                    }
                  : { rotate: 0, filter: 'blur(0px)', scale: 1 }
              }
              whileHover={{ rotate: spinCount * 360 + 90 }}
              transition={{
                rotate: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
                filter: { duration: 0.42, times: [0, 0.35, 1], ease: 'easeInOut' },
                scale: { duration: 0.42, times: [0, 0.3, 1], ease: [0.16, 1, 0.3, 1] },
              }}
              className="flex items-center justify-center pointer-events-none"
            >
              <Plus className="w-6 h-6 stroke-[3] text-slate-950" />
            </motion.div>
          </button>
        </div>

        {/* Workspace Tab */}
        <button
          onClick={onOpenNotebookLM}
          style={getTabStyle('notebooklm')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap shrink-0 border border-transparent ${
            activeTab === 'notebooklm'
              ? 'font-bold'
              : darkMode
              ? 'text-slate-300 hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Switch Workspaces & Open Knowledge Studio"
        >
          <Layers className="w-3.5 h-3.5 text-white" />
          <span>Workspace</span>
        </button>

        {/* Analytics Link */}
        <button
          onClick={() => onSelectTab('analytics')}
          style={getTabStyle('analytics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap shrink-0 border border-transparent ${
            activeTab === 'analytics'
              ? 'font-bold'
              : darkMode
              ? 'text-slate-300 hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Analytics</span>
        </button>

        {/* Settings Link */}
        <button
          onClick={() => onSelectTab('settings')}
          style={getTabStyle('settings')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap shrink-0 border border-transparent ${
            activeTab === 'settings'
              ? 'font-bold'
              : darkMode
              ? 'text-slate-300 hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </nav>
    </motion.header>
  );
};

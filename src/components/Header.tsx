import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, LayoutDashboard, Library, BarChart3, Settings, Layers } from 'lucide-react';
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
  autoHideOnTopEdge?: boolean;
  isStageHidden?: boolean;
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
  autoHideOnTopEdge = false,
  isStageHidden = false,
}) => {
  const isInitialMount = useRef(true);
  const [spinCount, setSpinCount] = useState(0);
  const [isEdgeRevealed, setIsEdgeRevealed] = useState(false);
  const [isNavHovered, setIsNavHovered] = useState(false);
  const navHoveredRef = useRef(false);

  // Trigger blur spinning animation on '+' icon when theme palette changes via lander/home interactions
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setSpinCount((prev) => prev + 1);
  }, [activePalette.id]);

  // Auto-hide header above viewport and slide down on top-edge touch in singular OneNote workbench
  useEffect(() => {
    if (!autoHideOnTopEdge) {
      setIsEdgeRevealed(false);
      setIsNavHovered(false);
      navHoveredRef.current = false;
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (e.clientY <= 12) {
        setIsEdgeRevealed(true);
      } else if (e.clientY > 92 && !navHoveredRef.current) {
        setIsEdgeRevealed(false);
      }
    };

    const handlePointerLeaveWindow = () => {
      if (!navHoveredRef.current) {
        setIsEdgeRevealed(false);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeaveWindow);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeaveWindow);
    };
  }, [autoHideOnTopEdge]);

  useEffect(() => {
    if (isWorkspaceSelectorOpen) {
      setIsEdgeRevealed(false);
      setIsNavHovered(false);
      navHoveredRef.current = false;
    }
  }, [isWorkspaceSelectorOpen]);

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

  const isHeaderHidden =
    isWorkspaceSelectorOpen || (autoHideOnTopEdge && !isEdgeRevealed && !isNavHovered);

  return (
    <>
      {autoHideOnTopEdge && !isWorkspaceSelectorOpen && (
        <div
          onPointerEnter={() => setIsEdgeRevealed(true)}
          className="hidden md:block fixed top-0 inset-x-0 h-3 z-[210] pointer-events-auto"
          aria-hidden="true"
        />
      )}

      {/* ================= ANDROID / MOBILE CHROME (< 768px ONLY) ================= */}
      {/* Portaled directly to document.body so parent transforms (.hyprland-slide) never break position: fixed */}
      {typeof document !== 'undefined' &&
        !isWorkspaceSelectorOpen &&
        !isStageHidden &&
        createPortal(
          <>
            {/* Floating Settings Button (replaces mobile top header) */}
            <button
              type="button"
              onClick={() => onSelectTab('settings')}
              style={
                activeTab === 'settings'
                  ? {
                      backgroundColor: `${activePalette.primary}30`,
                      borderColor: `${activePalette.primary}80`,
                      color: darkMode ? '#ffffff' : activePalette.primary,
                      boxShadow: `0 8px 24px -4px ${activePalette.primary}55`,
                    }
                  : {
                      borderColor: darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(148,163,184,0.4)',
                    }
              }
              className={`md:hidden fixed top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 z-40 w-11 h-11 rounded-2xl border backdrop-blur-2xl shadow-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'font-bold'
                  : darkMode
                  ? 'bg-slate-950/88 text-slate-100 shadow-black/50'
                  : 'bg-white/92 text-slate-700 shadow-slate-400/25'
              }`}
              aria-label="Settings"
              title="Settings"
            >
              <Settings
                className="w-5 h-5"
                style={activeTab === 'settings' ? { color: activePalette.primary } : undefined}
              />
            </button>

            {/* Sticky Bottom Navigation Dock */}
            <nav
              aria-label="Mobile Bottom Navigation"
              className={`md:hidden fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom,0px)] border-t backdrop-blur-2xl shadow-2xl transition-colors duration-300 ${
                darkMode
                  ? 'bg-slate-950/92 border-white/10 text-slate-300 shadow-black/60'
                  : 'bg-white/92 border-slate-200/90 text-slate-600 shadow-slate-400/25'
              }`}
            >
              <div className="h-16 px-1.5 grid grid-cols-5 items-center max-w-lg mx-auto">
                {/* 1. Home / Dashboard */}
                <button
                  type="button"
                  onClick={() => onSelectTab('dashboard')}
                  className="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl active:scale-95 transition-transform"
                  style={
                    activeTab === 'dashboard'
                      ? { color: darkMode ? '#ffffff' : activePalette.primary }
                      : undefined
                  }
                >
                  <div
                    className="px-3 py-1 rounded-full transition-colors"
                    style={
                      activeTab === 'dashboard'
                        ? { backgroundColor: `${activePalette.primary}25` }
                        : undefined
                    }
                  >
                    <LayoutDashboard
                      className="w-4 h-4"
                      style={activeTab === 'dashboard' ? { color: activePalette.primary } : undefined}
                    />
                  </div>
                  <span className={`text-[10px] leading-none ${activeTab === 'dashboard' ? 'font-bold' : 'font-medium'}`}>
                    Home
                  </span>
                </button>

                {/* 2. Library */}
                <button
                  type="button"
                  onClick={() => onSelectTab('library')}
                  className="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl active:scale-95 transition-transform"
                  style={
                    activeTab === 'library'
                      ? { color: darkMode ? '#ffffff' : activePalette.primary }
                      : undefined
                  }
                >
                  <div
                    className="px-3 py-1 rounded-full transition-colors"
                    style={
                      activeTab === 'library'
                        ? { backgroundColor: `${activePalette.primary}25` }
                        : undefined
                    }
                  >
                    <Library
                      className="w-4 h-4"
                      style={activeTab === 'library' ? { color: activePalette.primary } : undefined}
                    />
                  </div>
                  <span className={`text-[10px] leading-none ${activeTab === 'library' ? 'font-bold' : 'font-medium'}`}>
                    Library
                  </span>
                </button>

                {/* 3. Center '+' Creation FAB */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={onOpenCreate}
                    style={{
                      background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                      boxShadow: `0 6px 18px -2px ${activePalette.primary}60`,
                    }}
                    className={`w-12 h-11 rounded-2xl text-slate-950 flex items-center justify-center border-2 active:scale-92 transition-transform ${
                      darkMode ? 'border-slate-950' : 'border-white'
                    }`}
                    aria-label="Create New Item"
                    title="Create New"
                  >
                    <Plus className="w-6 h-6 stroke-[3] text-slate-950" />
                  </button>
                </div>

                {/* 4. Workspaces (opens Workspaces selector) */}
                <button
                  type="button"
                  onClick={onOpenNotebookLM}
                  className="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl active:scale-95 transition-transform"
                  style={
                    isWorkspaceSelectorOpen || activeTab === 'notebooklm'
                      ? { color: darkMode ? '#ffffff' : activePalette.primary }
                      : undefined
                  }
                >
                  <div
                    className="px-3 py-1 rounded-full transition-colors"
                    style={
                      isWorkspaceSelectorOpen || activeTab === 'notebooklm'
                        ? { backgroundColor: `${activePalette.primary}25` }
                        : undefined
                    }
                  >
                    <Layers
                      className="w-4 h-4"
                      style={
                        isWorkspaceSelectorOpen || activeTab === 'notebooklm'
                          ? { color: activePalette.primary }
                          : undefined
                      }
                    />
                  </div>
                  <span
                    className={`text-[10px] leading-none ${
                      isWorkspaceSelectorOpen || activeTab === 'notebooklm' ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    Workspace
                  </span>
                </button>

                {/* 5. Analytics */}
                <button
                  type="button"
                  onClick={() => onSelectTab('analytics')}
                  className="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl active:scale-95 transition-transform"
                  style={
                    activeTab === 'analytics'
                      ? { color: darkMode ? '#ffffff' : activePalette.primary }
                      : undefined
                  }
                >
                  <div
                    className="px-3 py-1 rounded-full transition-colors"
                    style={
                      activeTab === 'analytics'
                        ? { backgroundColor: `${activePalette.primary}25` }
                        : undefined
                    }
                  >
                    <BarChart3
                      className="w-4 h-4"
                      style={activeTab === 'analytics' ? { color: activePalette.primary } : undefined}
                    />
                  </div>
                  <span className={`text-[10px] leading-none ${activeTab === 'analytics' ? 'font-bold' : 'font-medium'}`}>
                    Stats
                  </span>
                </button>
              </div>
            </nav>
          </>,
          document.body
        )}

      {/* ================= DESKTOP FLOATING PILL HEADER (>= 768px IDENTICAL) ================= */}
      <motion.header
        initial={{ y: -90, opacity: 0, scale: 0.95 }}
        animate={{
          y: isHeaderHidden ? -84 : 0,
          opacity: isHeaderHidden ? 0 : 1,
          scale: isHeaderHidden ? 0.96 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 30,
          mass: 0.65,
        }}
        className="fixed top-4 inset-x-0 z-[200] hidden md:flex justify-center items-center pointer-events-none px-4"
      >
        {/* Floating Pill Container with Liquid Glass - seamless smooth edges with zero gap */}
        <nav
          aria-label="Main Navigation"
          onPointerEnter={() => {
            navHoveredRef.current = true;
            setIsNavHovered(true);
            if (autoHideOnTopEdge) setIsEdgeRevealed(true);
          }}
          onPointerLeave={(e) => {
            navHoveredRef.current = false;
            setIsNavHovered(false);
            if (autoHideOnTopEdge && e.clientY > 92) {
              setIsEdgeRevealed(false);
            }
          }}
          className={`${
            isHeaderHidden ? 'pointer-events-none' : 'pointer-events-auto'
          } rounded-full px-5 py-2 flex items-center gap-2 sm:gap-3 shadow-2xl transition-all duration-300 liquid-glass no-lift overflow-hidden ${
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
    </>
  );
};

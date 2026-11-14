import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Plus,
  Check,
  X,
  BookOpen,
  FileText,
  Bot,
  Folder,
  ArrowRight,
  Pencil,
  Sparkles,
  GripHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Workspace, ColorPalette } from '../types';

interface WorkspaceSelectorBarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name?: string, description?: string) => void;
  onUpdateWorkspace?: (workspaceId: string, updates: Partial<Workspace>) => void;
  onCloseWorkspace?: (workspaceId: string) => void;
  onDeleteWorkspace?: (workspaceId: string) => void;
  onReorderWorkspaces?: (reorderedOpenWorkspaces: Workspace[]) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
}

export const WorkspaceSelectorBar: React.FC<WorkspaceSelectorBarProps> = ({
  isOpen,
  onClose,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onUpdateWorkspace,
  onCloseWorkspace,
  onDeleteWorkspace,
  onReorderWorkspaces,
  activePalette,
  darkMode,
}) => {
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState<string | null>(null);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [draggedWorkspaceId, setDraggedWorkspaceId] = useState<string | null>(null);
  const justDraggedRef = useRef(false);

  // Modal to prompt name & description before creating new workspace
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');

  const tileRafRef = useRef<number | null>(null);

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

  const openWorkspaces = React.useMemo(() => {
    return workspaces.filter((w) => !w.isClosed);
  }, [workspaces]);

  const hoveredWorkspace = openWorkspaces.find((w) => w.id === hoveredWorkspaceId) || workspaces.find((w) => w.id === hoveredWorkspaceId);

  const handleStartEdit = (ws: Workspace) => {
    setEditingWs(ws);
    setEditName(ws.name);
    setEditDesc(ws.description || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWs || !editName.trim()) return;
    onUpdateWorkspace?.(editingWs.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      updatedAt: 'Just now',
    });
    setEditingWs(null);
  };

  const handleOpenCreateModal = () => {
    const nextCount = workspaces.length + 1;
    setNewWsName(`Assorted Workspace ${nextCount}`);
    setNewWsDesc('Synchronized research workspace with exclusive NotebookLM sources, OneNote canvas, and Gemini AI.');
    setShowCreateModal(true);
  };

  const handleConfirmCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    onCreateWorkspace(newWsName.trim(), newWsDesc.trim());
    setShowCreateModal(false);
    onClose();
  };

  const handleCloseCard = (e: React.MouseEvent, wsId: string) => {
    e.stopPropagation();
    if (hoveredWorkspaceId === wsId) {
      setHoveredWorkspaceId(null);
    }
    if (onCloseWorkspace) {
      onCloseWorkspace(wsId);
    } else if (onDeleteWorkspace) {
      onDeleteWorkspace(wsId);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {/* Background Dim Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 pointer-events-auto"
          />

          {/* Outer Sliding Wrapper: Enters smoothly from Top (-100%), Exits cleanly back UP above the Top edge */}
          <motion.div
            initial={{ y: '-100%' }}
            animate={{
              y: '0%',
              transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              y: 'calc(-100% - 64px)',
              transition: { duration: 0.26, ease: [0.4, 0, 0.85, 0.6] },
            }}
            style={{ willChange: 'transform' }}
            className="relative z-10 w-full pointer-events-auto"
          >
            {/* Workspace Selector Top Bar — Matching the Workspace Card (liquid-glass, pointer glow, and specular aura) */}
            <div
              onPointerMove={handleTilePointerMove}
              onPointerLeave={handleTilePointerLeave}
              className={`relative w-full border-b rounded-b-3xl shadow-2xl overflow-hidden liquid-glass liquid-glass-tile floating-gemini-tile no-lift workspace-studio-panel ${
                darkMode
                  ? 'bg-slate-950/90 text-slate-100'
                  : 'bg-white/95 text-slate-900 shadow-slate-300/60'
              }`}
              style={{
                borderColor: `${activePalette.primary}50`,
                boxShadow: darkMode
                  ? `0 24px 64px -12px rgba(0,0,0,0.85), 0 0 32px -4px ${activePalette.primary}30, inset 0 1px 1px rgba(255, 255, 255, 0.2)`
                  : `0 24px 64px -12px rgba(0,0,0,0.15), 0 0 24px -4px ${activePalette.primary}25`,
              }}
            >
        {/* Liquid Glass Chromatic Layer matching Workspace Card */}
        <div className="liquidglass pointer-events-none z-0" aria-hidden="true" />

        <div className="max-w-[1720px] mx-auto px-4 sm:px-8 py-4 space-y-4 relative z-20 isolate">
          {/* Bar Header */}
          <div className="flex items-center justify-between relative z-20">
            <div className="flex items-center gap-3 relative z-20">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                style={{
                  backgroundColor: `${activePalette.primary}25`,
                  color: activePalette.primary,
                }}
              >
                <Layers className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="relative z-20">
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm font-bold tracking-tight relative z-20 ${darkMode ? 'text-white' : 'text-slate-950'}`}>Workspaces Studio</h2>
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border relative z-20"
                    style={{
                      backgroundColor: `${activePalette.primary}15`,
                      borderColor: `${activePalette.primary}35`,
                      color: activePalette.primary,
                    }}
                  >
                    Independent Workspaces
                  </span>
                </div>
                <p className={`text-xs relative z-20 font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Select a workspace context. Each workspace stores its own independent sources, OneNote canvas, and AI chat.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 relative z-20">
              <button
                onClick={handleOpenCreateModal}
                style={{
                  backgroundColor: `${activePalette.primary}20`,
                  borderColor: `${activePalette.primary}50`,
                  color: darkMode ? '#ffffff' : activePalette.primary,
                }}
                className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition hover:scale-105 active:scale-95 shadow-sm cursor-pointer relative z-20"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New Workspace</span>
              </button>

              <button
                onClick={onClose}
                className={`p-1.5 rounded-xl border transition cursor-pointer relative z-20 ${
                  darkMode
                    ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                    : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Close selector (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Workspace Cards Carousel / Grid with Drag-and-Drop Reorder & Removal Animation */}
          <div className="pt-14 pb-16 px-12 overflow-x-auto no-scrollbar">
            {openWorkspaces.length > 0 && (
              <Reorder.Group
                axis="x"
                values={openWorkspaces}
                onReorder={(newOrder) => onReorderWorkspaces?.(newOrder)}
                layoutScroll
                className="flex items-stretch gap-6 w-max min-w-full"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {openWorkspaces.map((ws) => {
                    const isActive = ws.id === activeWorkspaceId;
                    const isHovered = ws.id === hoveredWorkspaceId;
                    const isDragged = draggedWorkspaceId === ws.id;

                    return (
                      <Reorder.Item
                        key={ws.id}
                        value={ws}
                        layout
                        initial={{ opacity: 0, scale: 0.9, y: -12 }}
                        animate={{
                          opacity: 1,
                          scale: isDragged ? 1.03 : 1,
                          y: 0,
                          transition: {
                            type: 'spring',
                            stiffness: 420,
                            damping: 30,
                            mass: 0.65,
                          },
                        }}
                        exit={{
                          opacity: 0,
                          scale: 0.78,
                          y: -28,
                          filter: 'blur(6px)',
                          transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
                        }}
                        whileHover={{
                          y: -6,
                          scale: 1.02,
                        }}
                        whileDrag={{
                          scale: 1.04,
                          y: -8,
                          zIndex: 60,
                        }}
                        onDragStart={() => {
                          justDraggedRef.current = true;
                          setDraggedWorkspaceId(ws.id);
                        }}
                        onDragEnd={() => {
                          setDraggedWorkspaceId(null);
                          setTimeout(() => {
                            justDraggedRef.current = false;
                          }, 80);
                        }}
                        style={{ willChange: 'transform, opacity' }}
                        className={`relative group shrink-0 select-none ${
                          isDragged ? 'cursor-grabbing z-50' : 'cursor-grab active:cursor-grabbing'
                        }`}
                        onClick={() => {
                          if (justDraggedRef.current) return;
                          onSelectWorkspace(ws.id);
                          onClose();
                        }}
                        onMouseEnter={() => {
                          if (!draggedWorkspaceId) setHoveredWorkspaceId(ws.id);
                        }}
                        onMouseLeave={() => setHoveredWorkspaceId(null)}
                      >
                        <div
                          onPointerMove={handleTilePointerMove}
                          onPointerLeave={(e) => {
                            handleTilePointerLeave(e);
                            setHoveredWorkspaceId(null);
                          }}
                    style={{
                      borderColor: isActive
                        ? activePalette.primary
                        : isHovered
                        ? `${activePalette.primary}90`
                        : `${activePalette.primary}40`,
                      boxShadow: isActive
                        ? `0 14px 40px -8px rgba(0, 0, 0, 0.45), 0 0 28px -2px ${activePalette.primary}50, inset 0 1px 1px rgba(255, 255, 255, 0.25)`
                        : isHovered
                        ? `0 12px 36px -6px rgba(0, 0, 0, 0.35), 0 0 24px -2px ${activePalette.primary}40`
                        : undefined,
                    }}
                    className={`w-72 sm:w-84 h-full rounded-3xl p-5 border transition-[box-shadow,border-color,background-color] duration-300 flex flex-col justify-between relative overflow-hidden liquid-glass liquid-glass-tile floating-gemini-tile no-lift ${
                      isActive
                        ? darkMode
                          ? 'bg-slate-900/90 shadow-2xl'
                          : 'bg-white/95 shadow-xl'
                        : darkMode
                        ? 'bg-slate-900/65 group-hover:bg-slate-900/90 border-white/15'
                        : 'bg-white/70 group-hover:bg-white border-slate-200/80 shadow-sm'
                    }`}
                  >
                    {/* Liquid Glass Chromatic Filter Layer matching Neural Assistant */}
                    <div className="liquidglass pointer-events-none" aria-hidden="true" />

                  <div className="space-y-2 relative z-20 isolate">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 relative z-20">
                            <GripHorizontal className="w-3.5 h-3.5 opacity-45 group-hover:opacity-90 transition-opacity shrink-0" />
                            <Folder className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[100px]">{ws.folder || 'Assorted Workspaces'}</span>
                          </div>

                          {/* Actions: Edit pencil, Close tab, and Active Badge */}
                          <div
                            className="flex items-center gap-1 relative z-20"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleStartEdit(ws)}
                              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                              title="Edit workspace name & description"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleCloseCard(e, ws.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition cursor-pointer"
                              title="Remove workspace from studio (saved in My Library)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>

                        {isActive && (
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ml-1"
                            style={{
                              backgroundColor: `${activePalette.primary}25`,
                              color: activePalette.primary,
                            }}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <h3
                      className={`text-sm font-bold truncate transition relative z-20 ${
                        isActive
                          ? darkMode
                            ? 'text-white'
                            : 'text-slate-950'
                          : darkMode
                          ? 'text-slate-200 group-hover:text-white'
                          : 'text-slate-800 group-hover:text-slate-950'
                      }`}
                    >
                      {ws.name}
                    </h3>

                    <p
                      className={`text-xs line-clamp-2 leading-relaxed relative z-20 ${
                        darkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {ws.description || 'Dedicated workspace with independent sources, OneNote canvas, and AI chats.'}
                    </p>
                  </div>

                  {/* Synchronized Components Metrics */}
                  <div
                    className={`mt-4 pt-3 border-t flex items-center justify-between text-[11px] font-medium relative z-20 isolate ${
                      darkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 relative z-20">
                      {ws.mode !== 'onenote-only' ? (
                        <span className="flex items-center gap-1" title="Exclusive sources in NotebookLM">
                          <BookOpen className="w-3 h-3" style={{ color: activePalette.primary }} />
                          <span>{ws.sources?.length || 0}</span>
                        </span>
                      ) : (
                        <span
                          className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border"
                          style={{
                            borderColor: `${activePalette.primary}40`,
                            color: activePalette.primary,
                            backgroundColor: `${activePalette.primary}15`,
                          }}
                        >
                          OneNote Only
                        </span>
                      )}
                      <span className="flex items-center gap-1" title="Exclusive notebooks in OneNote">
                        <FileText className="w-3 h-3 text-cyan-400" />
                        <span>{ws.notebooks?.length || 0}</span>
                      </span>
                      {ws.mode !== 'onenote-only' && (
                        <span className="flex items-center gap-1" title="Exclusive Gemini conversations">
                          <Bot className="w-3 h-3 text-emerald-400" />
                          <span>{ws.conversations?.length || 0}</span>
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 relative z-20">
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Reorder.Item>
            );
          })}
                </AnimatePresence>
              </Reorder.Group>
            )}

            {openWorkspaces.length === 0 && (
              <div
                onClick={handleOpenCreateModal}
                className={`w-full py-8 px-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition gap-2.5 relative z-20 isolate ${
                  darkMode
                    ? 'border-white/15 hover:border-white/30 bg-white/5'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: `${activePalette.primary}25`, color: activePalette.primary }}
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-xs font-bold">{workspaces.length === 0 ? 'No workspaces created yet' : 'All workspaces closed'}</p>
                  <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {workspaces.length === 0
                      ? 'Click here to create your first clean synchronized workspace'
                      : 'All workspaces are safely saved in My Library. Click to create a new workspace or open one from Library.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

              {/* Zoomed-Out Glimpse Preview Drawer matching Workspace Studio Style (slides in smoothly) */}
              <AnimatePresence initial={false}>
                {hoveredWorkspace && (
                  <motion.div
                    key="workspace-glimpse-drawer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
                      opacity: { duration: 0.18, ease: 'easeOut' },
                    }}
                    style={{ willChange: 'height, opacity' }}
                    className="overflow-hidden"
                  >
                    <motion.div
                      initial={{ y: -16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -16, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      style={{ willChange: 'transform, opacity' }}
                    >
                      <div
                        onPointerMove={handleTilePointerMove}
                        onPointerLeave={handleTilePointerLeave}
                        className={`py-3.5 relative liquid-glass liquid-glass-tile floating-gemini-tile no-lift workspace-studio-panel border-t ${
                          darkMode
                            ? 'bg-slate-950/90 text-slate-100'
                            : 'bg-white/95 text-slate-900'
                        }`}
                        style={{
                          borderColor: `${activePalette.primary}50`,
                          boxShadow: darkMode
                            ? `inset 0 1px 0 ${activePalette.primary}30, 0 0 28px -4px ${activePalette.primary}30`
                            : `inset 0 1px 0 ${activePalette.primary}25, 0 0 20px -4px ${activePalette.primary}20`,
                        }}
                      >
                        {/* Liquid Glass Chromatic Filter Layer matching Workspace Studio */}
                        <div className="liquidglass pointer-events-none z-0" aria-hidden="true" />

                        <motion.div
                          key={hoveredWorkspace.id}
                          initial={{ y: 8, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          className="max-w-[1720px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4 relative z-20 isolate"
                        >
                          <div className="flex items-center gap-3 min-w-0 relative z-20 isolate">
                            <span
                              className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 relative z-20"
                              style={{
                                backgroundColor: `${activePalette.primary}15`,
                                borderColor: `${activePalette.primary}40`,
                                color: activePalette.primary,
                              }}
                            >
                              Workspace Glimpse
                            </span>
                            <span
                              className={`text-xs font-bold truncate relative z-20 ${
                                darkMode ? 'text-white' : 'text-slate-950'
                              }`}
                            >
                              {hoveredWorkspace.name}
                            </span>
                            <span className={`text-xs hidden sm:inline relative z-20 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              ·
                            </span>
                            <span className={`text-xs hidden sm:inline relative z-20 font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {hoveredWorkspace.mode === 'onenote-only'
                                ? `${hoveredWorkspace.notebooks?.length || 0} OneNote Books · ${hoveredWorkspace.notebooks?.[0]?.sections?.length || 0} Sections`
                                : `${hoveredWorkspace.sources?.length || 0} Sources · ${hoveredWorkspace.notebooks?.length || 0} OneNote Books · ${hoveredWorkspace.conversations?.length || 0} Gemini Dialogs`}
                            </span>
                          </div>

                          {/* Miniature Layout Representation */}
                          <div className="flex items-center gap-2 relative z-20 isolate">
                            {hoveredWorkspace.mode !== 'onenote-only' && (
                              <div
                                className={`px-3 py-1 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 relative z-20 shadow-xs ${
                                  darkMode ? 'bg-slate-900/80 text-slate-200' : 'bg-white/90 text-slate-800'
                                }`}
                                style={{ borderColor: `${activePalette.primary}35` }}
                              >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activePalette.primary }} />
                                <span className="truncate max-w-[180px]">
                                  NotebookLM: {hoveredWorkspace.sources?.[0]?.title?.slice(0, 22) || 'No sources added'}
                                </span>
                              </div>
                            )}

                            <div
                              className={`px-3 py-1 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 relative z-20 shadow-xs ${
                                darkMode ? 'bg-slate-900/80 text-slate-200' : 'bg-white/90 text-slate-800'
                              }`}
                              style={{ borderColor: `${activePalette.primary}35` }}
                            >
                              <FileText className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span className="truncate max-w-[180px]">
                                OneNote: {hoveredWorkspace.notebooks?.[0]?.title?.slice(0, 22) || 'No notebooks added'}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Liquid Glass Modal Prompt before Creating New Workspace */}
          <AnimatePresence>
            {showCreateModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-auto"
        >
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowCreateModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full max-w-md rounded-3xl p-6 border shadow-2xl z-10 space-y-5 acrylic-glass-panel ${
              darkMode ? 'bg-slate-900/90 border-white/20 text-slate-100' : 'bg-white/95 border-slate-300 text-slate-900'
            }`}
            style={{
              borderColor: `${activePalette.primary}75`,
              boxShadow: `0 24px 64px -12px rgba(0,0,0,0.7), 0 0 32px ${activePalette.primary}25`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md"
                  style={{
                    backgroundColor: `${activePalette.primary}25`,
                    color: activePalette.primary,
                  }}
                >
                  <Sparkles className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Create New Workspace</h3>
                  <p className="text-xs text-slate-400">Configure workspace tab title and research focus</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Distributed Consensus Systems"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                    darkMode ? 'bg-slate-950/60 border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  style={{ borderColor: `${activePalette.primary}60` }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Description & Context
                </label>
                <textarea
                  rows={3}
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  placeholder="Outline key topics, research goals, or modules..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 resize-none ${
                    darkMode ? 'bg-slate-950/60 border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  style={{ borderColor: `${activePalette.primary}60` }}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                    darkMode ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newWsName.trim()}
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Edit Workspace Name & Description Modal */}
      <AnimatePresence>
      {editingWs && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-auto"
        >
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-md"
            onClick={() => setEditingWs(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full max-w-md rounded-3xl p-6 border shadow-2xl z-10 space-y-4 acrylic-glass-panel ${
              darkMode ? 'bg-slate-900/90 border-white/15 text-slate-100' : 'bg-white/95 border-slate-300 text-slate-900'
            }`}
            style={{
              borderColor: `${activePalette.primary}60`,
              boxShadow: `0 24px 64px -12px rgba(0,0,0,0.7), 0 0 32px ${activePalette.primary}20`,
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Pencil className="w-4 h-4" style={{ color: activePalette.primary }} />
                <span>Edit Workspace</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingWs(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Distributed Systems Capstone"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                    darkMode ? 'bg-slate-950/60 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  style={{ borderColor: `${activePalette.primary}50` }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Summarize research focus, tags, or context..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 resize-none ${
                    darkMode ? 'bg-slate-950/60 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  style={{ borderColor: `${activePalette.primary}50` }}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWs(null)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                    darkMode ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim()}
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
};

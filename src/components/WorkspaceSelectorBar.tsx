import React, { useState } from 'react';
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
} from 'lucide-react';
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
  activePalette,
  darkMode,
}) => {
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState<string | null>(null);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Modal to prompt name & description before creating new workspace
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');

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
    if (onCloseWorkspace) {
      onCloseWorkspace(wsId);
    } else if (onDeleteWorkspace) {
      onDeleteWorkspace(wsId);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none transition-all duration-300 ${
        isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
      }`}
    >
      {/* Background Dim Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/65 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sliding Workspace Selector Top Bar — Frosted Glass Acrylic matching Neural Assistant */}
      <div
        className={`relative z-10 w-full transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] transform border-b shadow-2xl ${
          isOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : '-translate-y-full opacity-0 pointer-events-none'
        } ${
          darkMode
            ? 'acrylic-glass-panel bg-slate-950/80 border-white/15 text-slate-100 backdrop-blur-2xl'
            : 'acrylic-glass-panel bg-white/85 border-slate-300 text-slate-900 backdrop-blur-2xl shadow-slate-300/60'
        }`}
        style={{
          boxShadow: darkMode
            ? `0 20px 50px -10px rgba(0,0,0,0.8), 0 0 24px -4px ${activePalette.primary}20`
            : '0 20px 50px -10px rgba(0,0,0,0.15)',
        }}
      >
        <div className="max-w-[1720px] mx-auto px-4 sm:px-8 py-4 space-y-4">
          {/* Bar Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
                style={{
                  backgroundColor: `${activePalette.primary}25`,
                  color: activePalette.primary,
                }}
              >
                <Layers className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold tracking-tight">Workspaces Studio</h2>
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: `${activePalette.primary}15`,
                      borderColor: `${activePalette.primary}35`,
                      color: activePalette.primary,
                    }}
                  >
                    Independent Workspaces
                  </span>
                </div>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Select a workspace context. Each workspace stores its own independent sources, OneNote canvas, and AI chat.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenCreateModal}
                style={{
                  backgroundColor: `${activePalette.primary}20`,
                  borderColor: `${activePalette.primary}50`,
                  color: darkMode ? '#ffffff' : activePalette.primary,
                }}
                className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New Workspace</span>
              </button>

              <button
                onClick={onClose}
                className={`p-1.5 rounded-xl border transition cursor-pointer ${
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

          {/* Workspace Cards Carousel / Grid */}
          <div className="flex items-stretch gap-4 overflow-x-auto pb-2 no-scrollbar">
            {openWorkspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              const isHovered = ws.id === hoveredWorkspaceId;

              return (
                <div
                  key={ws.id}
                  onClick={() => {
                    onSelectWorkspace(ws.id);
                    onClose();
                  }}
                  onMouseEnter={() => setHoveredWorkspaceId(ws.id)}
                  onMouseLeave={() => setHoveredWorkspaceId(null)}
                  style={
                    isActive
                      ? {
                          borderColor: activePalette.primary,
                          boxShadow: `0 0 20px -3px ${activePalette.primary}35, inset 0 1px 1px rgba(255, 255, 255, 0.15)`,
                        }
                      : isHovered
                      ? { borderColor: `${activePalette.primary}70` }
                      : undefined
                  }
                  className={`w-72 sm:w-80 shrink-0 rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                    isActive
                      ? darkMode
                        ? 'bg-slate-900/90 shadow-xl'
                        : 'bg-white shadow-lg'
                      : darkMode
                      ? 'bg-slate-900/50 hover:bg-slate-900/80 border-white/10'
                      : 'bg-slate-50/80 hover:bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  {/* Subtle top indicator bar */}
                  {isActive && (
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{
                        background: `linear-gradient(90deg, ${activePalette.primary}, ${activePalette.accent})`,
                      }}
                    />
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <Folder className="w-3 h-3" />
                        <span className="truncate max-w-[110px]">{ws.folder || 'Assorted Workspaces'}</span>
                      </div>

                      {/* Actions: Edit pencil, Close tab, and Active Badge */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(ws)}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition"
                          title="Edit workspace name & description"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleCloseCard(e, ws.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition"
                          title="Close workspace tab (saved in My Library)"
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
                      className={`text-sm font-bold truncate transition ${
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
                      className={`text-xs line-clamp-2 leading-relaxed ${
                        darkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {ws.description || 'Dedicated workspace with independent sources, OneNote canvas, and AI chats.'}
                    </p>
                  </div>

                  {/* Synchronized Components Metrics */}
                  <div
                    className={`mt-4 pt-3 border-t flex items-center justify-between text-[11px] font-medium ${
                      darkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1" title="Exclusive sources in NotebookLM">
                        <BookOpen className="w-3 h-3" style={{ color: activePalette.primary }} />
                        <span>{ws.sources?.length || 0}</span>
                      </span>
                      <span className="flex items-center gap-1" title="Exclusive notebooks in OneNote">
                        <FileText className="w-3 h-3 text-cyan-400" />
                        <span>{ws.notebooks?.length || 0}</span>
                      </span>
                      <span className="flex items-center gap-1" title="Exclusive Gemini conversations">
                        <Bot className="w-3 h-3 text-emerald-400" />
                        <span>{ws.conversations?.length || 0}</span>
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}

            {openWorkspaces.length === 0 && (
              <div
                onClick={handleOpenCreateModal}
                className={`w-full py-8 px-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition gap-2.5 ${
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

        {/* Zoomed-Out Glimpse Preview Drawer that Slides Down & Up smoothly on hover */}
        <div
          className={`border-t transition-all duration-300 ease-out overflow-hidden ${
            hoveredWorkspace
              ? 'max-h-24 opacity-100 py-3'
              : 'max-h-0 opacity-0 py-0 border-transparent'
          } ${
            darkMode ? 'bg-slate-950/95 border-white/10' : 'bg-slate-100/90 border-slate-200'
          }`}
        >
          {hoveredWorkspace && (
            <div className="max-w-[1720px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 shrink-0">
                  Workspace Glimpse:
                </span>
                <span className="text-xs font-bold truncate text-white">{hoveredWorkspace.name}</span>
                <span className="text-xs text-slate-400 hidden sm:inline">·</span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {hoveredWorkspace.sources?.length || 0} Sources · {hoveredWorkspace.notebooks?.length || 0} OneNote Books · {hoveredWorkspace.conversations?.length || 0} Gemini Dialogs
                </span>
              </div>

              {/* Miniature Layout Representation */}
              <div className="flex items-center gap-2">
                <div
                  className={`px-3 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                    darkMode ? 'bg-slate-900 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activePalette.primary }} />
                  <span>NotebookLM: {hoveredWorkspace.sources?.[0]?.title?.slice(0, 20) || 'No sources added'}</span>
                </div>

                <div
                  className={`px-3 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                    darkMode ? 'bg-slate-900 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <FileText className="w-3 h-3 text-cyan-400" />
                  <span>OneNote: {hoveredWorkspace.notebooks?.[0]?.title?.slice(0, 20) || 'No notebooks added'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Liquid Glass Modal Prompt before Creating New Workspace (Task 13) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-auto">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowCreateModal(false)}
          />
          <div
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
          </div>
        </div>
      )}

      {/* Edit Workspace Name & Description Modal */}
      {editingWs && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-auto">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-md"
            onClick={() => setEditingWs(null)}
          />
          <div
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
          </div>
        </div>
      )}
    </div>
  );
};

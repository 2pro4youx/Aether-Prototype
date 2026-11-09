import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Check,
  X,
  BookOpen,
  FileText,
  Sparkles,
  Bot,
  Calendar,
  Folder,
  ArrowRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Workspace, ColorPalette } from '../types';

interface WorkspaceSelectorBarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onUpdateWorkspace?: (workspaceId: string, updates: Partial<Workspace>) => void;
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
  onDeleteWorkspace,
  activePalette,
  darkMode,
}) => {
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState<string | null>(null);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const hoveredWorkspace = workspaces.find((w) => w.id === hoveredWorkspaceId);

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

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none transition-all duration-300 ${
        isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
      }`}
    >
      {/* Background Dim Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sliding Workspace Selector Top Bar (Slides Down & Up smoothly, no pop up) */}
      <div
        className={`relative z-10 w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform border-b shadow-2xl ${
          isOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : '-translate-y-full opacity-0 pointer-events-none'
        } ${
          darkMode
            ? 'bg-slate-950/95 border-white/10 text-slate-100 backdrop-blur-2xl'
            : 'bg-white/95 border-slate-200 text-slate-900 backdrop-blur-2xl'
        }`}
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
                onClick={onCreateWorkspace}
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
            {workspaces.map((ws) => {
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
                          boxShadow: `0 0 20px -3px ${activePalette.primary}30`,
                        }
                      : isHovered
                      ? { borderColor: `${activePalette.primary}60` }
                      : undefined
                  }
                  className={`w-72 sm:w-80 shrink-0 rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                    isActive
                      ? darkMode
                        ? 'bg-slate-900/90 shadow-xl'
                        : 'bg-white shadow-lg'
                      : darkMode
                      ? 'bg-slate-900/40 hover:bg-slate-900/70 border-white/10'
                      : 'bg-slate-50/80 hover:bg-white border-slate-200'
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
                        <span className="truncate max-w-[110px]">{ws.folder || 'Untitled Workspaces'}</span>
                      </div>

                      {/* Actions: Edit pencil, Close/Delete, and Active Badge */}
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
                          onClick={() => onDeleteWorkspace?.(ws.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition"
                          title="Close/delete workspace"
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

            {workspaces.length === 0 && (
              <div
                onClick={() => {
                  onCreateWorkspace();
                  onClose();
                }}
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
                  <p className="text-xs font-bold">No workspaces created yet</p>
                  <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Click here to create your first clean synchronized workspace
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

      {/* Edit Workspace Name & Description Modal */}
      {editingWs && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-auto">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingWs(null)}
          />
          <div
            className={`relative w-full max-w-md rounded-2xl p-6 border shadow-2xl z-10 space-y-4 ${
              darkMode ? 'bg-slate-900 border-white/15 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
            }`}
            style={{ borderColor: `${activePalette.primary}60` }}
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
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                    darkMode ? 'bg-slate-950 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                    darkMode ? 'bg-slate-950 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  style={{ borderColor: `${activePalette.primary}50` }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWs(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
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
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-950 shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-50"
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

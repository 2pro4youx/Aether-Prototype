import React, { useState } from 'react';
import {
  Folder,
  FolderPlus,
  Search,
  Filter,
  FileText,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  Star,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  Bot,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import { LibraryItem, Workspace, ColorPalette } from '../types';

interface LibraryViewProps {
  items: LibraryItem[];
  folders: string[];
  workspaces?: Workspace[];
  onOpenItem: (item: LibraryItem) => void;
  onAddFolder: (name: string) => void;
  onToggleStar: (id: string) => void;
  onSelectWorkspace?: (workspaceId: string) => void;
  onAssignWorkspaceToFolder?: (workspaceId: string, folder: string) => void;
  onCreateWorkspaceInFolder?: (folder: string) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  items,
  folders,
  workspaces = [],
  onOpenItem,
  onAddFolder,
  onToggleStar,
  onSelectWorkspace,
  onAssignWorkspaceToFolder,
  onCreateWorkspaceInFolder,
  activePalette,
  darkMode,
}) => {
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [activeType, setActiveType] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddWorkspaceModal, setShowAddWorkspaceModal] = useState(false);

  // Combine standard library items and workspace items
  const allDisplayItems: LibraryItem[] = React.useMemo(() => {
    const list: LibraryItem[] = [...items];
    // Ensure all workspaces are represented in the library
    workspaces.forEach((ws) => {
      const alreadyExists = list.some((i) => i.id === `item-ws-${ws.id}` || i.workspaceId === ws.id);
      if (!alreadyExists) {
        list.push({
          id: `item-ws-${ws.id}`,
          title: ws.name,
          type: 'workspace',
          folder: ws.folder || 'Untitled Workspaces',
          updatedAt: ws.updatedAt,
          tags: ['Workspace', 'NotebookLM', 'OneNote', 'Gemini'],
          description: ws.description || 'Synchronized NotebookLM, OneNote & Gemini research suite.',
          star: false,
          workspaceId: ws.id,
        });
      }
    });
    return list;
  }, [items, workspaces]);

  const filteredItems = allDisplayItems.filter((item) => {
    if (activeFolder !== 'all' && item.folder !== activeFolder) return false;
    if (activeType !== 'all' && item.type !== activeType) return false;
    if (
      searchFilter &&
      !item.title.toLowerCase().includes(searchFilter.toLowerCase()) &&
      !item.tags.some((t) => t.toLowerCase().includes(searchFilter.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onAddFolder(newFolderName.trim());
    setNewFolderName('');
    setShowNewFolderModal(false);
  };

  const currentFolderTarget = activeFolder === 'all' ? 'Untitled Workspaces' : activeFolder;

  return (
    <div className="relative min-h-screen pt-28 pb-16 px-4 sm:px-8 lg:px-12 max-w-[1720px] w-full mx-auto space-y-8 select-none transition-colors duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: activePalette.primary }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: activePalette.primary }}
            />
            <span>Curated Knowledge Archive · {activePalette.name}</span>
          </div>
          <h1
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            My Study Library
          </h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Categorized research repositories, synchronized workspaces, OneNote canvases, and planners.
          </p>
        </div>

        {/* Search & New Folder Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search library assets and workspaces..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 border transition ${
                darkMode
                  ? 'bg-slate-950/20 border-white/10 text-slate-100 placeholder-slate-400'
                  : 'bg-white/90 border-slate-300 text-slate-900 placeholder-slate-500 shadow-sm'
              }`}
              style={{ borderColor: `${activePalette.primary}30` }}
            />
          </div>

          <button
            onClick={() => setShowNewFolderModal(true)}
            style={{
              backgroundColor: `${activePalette.primary}25`,
              borderColor: `${activePalette.primary}60`,
              color: darkMode ? '#ffffff' : activePalette.primary,
            }}
            className="px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap hover:opacity-90 shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            <span className="hidden sm:inline">New Folder</span>
          </button>
        </div>
      </div>

      {/* Categorized Folders Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => setActiveFolder('all')}
          style={
            activeFolder === 'all'
              ? {
                  backgroundColor: `${activePalette.primary}25`,
                  borderColor: activePalette.primary,
                  color: darkMode ? '#ffffff' : activePalette.primary,
                }
              : {}
          }
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap border ${
            activeFolder === 'all'
              ? 'shadow-sm font-bold'
              : darkMode
              ? 'liquid-glass text-slate-400 hover:text-white'
              : 'bg-white/80 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
          }`}
        >
          All Folders ({allDisplayItems.length})
        </button>

        {folders.map((f) => {
          const count = allDisplayItems.filter((i) => i.folder === f).length;
          const isCurrent = activeFolder === f;
          return (
            <button
              key={f}
              onClick={() => setActiveFolder(f)}
              style={
                isCurrent
                  ? {
                      backgroundColor: `${activePalette.primary}25`,
                      borderColor: activePalette.primary,
                      color: darkMode ? '#ffffff' : activePalette.primary,
                    }
                  : {}
              }
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap border flex items-center gap-1.5 ${
                isCurrent
                  ? 'shadow-sm font-bold'
                  : darkMode
                  ? 'liquid-glass text-slate-400 hover:text-white'
                  : 'bg-white/80 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{f}</span>
              <span className="text-[10px] font-mono opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Type Filter Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
        <div
          className={`flex items-center gap-1 p-0.5 rounded-lg border ${
            darkMode ? 'bg-slate-900/20 border-white/10' : 'bg-white/20 border-slate-200/50'
          }`}
        >
          {(['all', 'workspace', 'notebook', 'onenote', 'project', 'planner', 'document'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              style={
                activeType === t
                  ? {
                      backgroundColor: `${activePalette.primary}25`,
                      color: activePalette.primary,
                    }
                  : {}
              }
              className={`px-2.5 py-1 rounded-md capitalize transition font-medium ${
                activeType === t
                  ? 'font-bold'
                  : darkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'all' ? 'All' : t === 'workspace' ? 'Workspaces' : t === 'notebook' ? 'NotebookLM' : t}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing {filteredItems.length} items in {activeFolder === 'all' ? 'all folders' : `"${activeFolder}"`}
        </div>
      </div>

      {/* Floating Tiles of Liquid Glass + Dotted Add Workspace Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dotted border Add Workspace Card matching theme in every folder */}
        <div
          onClick={() => setShowAddWorkspaceModal(true)}
          style={{
            borderColor: `${activePalette.primary}80`,
          }}
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 transition-all duration-200 cursor-pointer group min-h-[220px] hover:scale-[1.02] shadow-sm select-none ${
            darkMode ? 'hover:bg-white/5 bg-slate-950/20' : 'hover:bg-slate-50 bg-white/40'
          }`}
          title={`Add or link a workspace to ${currentFolderTarget}`}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition group-hover:scale-110 shadow-md"
            style={{
              backgroundColor: `${activePalette.primary}25`,
              color: activePalette.primary,
            }}
          >
            <Layers className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3
              className="text-sm font-bold tracking-tight"
              style={{ color: activePalette.id === 'black-night' ? '#ffffff' : activePalette.primary }}
            >
              + Add Workspace
            </h3>
            <p className={`text-xs mt-1 max-w-[240px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Attach recently created workspaces or start a new synchronized suite in {activeFolder === 'all' ? 'this library' : `"${activeFolder}"`}
            </p>
          </div>
        </div>

        {/* Existing Items and Workspaces */}
        {filteredItems.map((item) => {
          const isWorkspace = item.type === 'workspace';
          const wsData = isWorkspace && workspaces.find((w) => w.id === item.workspaceId || w.name === item.title);

          return (
            <div
              key={item.id}
              onClick={() => {
                if (isWorkspace && item.workspaceId && onSelectWorkspace) {
                  onSelectWorkspace(item.workspaceId);
                } else {
                  onOpenItem(item);
                }
              }}
              className={`liquid-glass rounded-2xl p-5 shadow-xl gap-4 transition-all duration-200 cursor-pointer flex flex-col justify-between group overflow-hidden ${
                isWorkspace ? 'border-2' : ''
              }`}
              style={
                isWorkspace
                  ? {
                      borderColor: `${activePalette.primary}50`,
                    }
                  : undefined
              }
            >
              <div className="space-y-3">
                {/* Type Badge & Star */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1"
                    style={{
                      backgroundColor: `${activePalette.primary}18`,
                      borderColor: `${activePalette.primary}40`,
                      color: activePalette.primary,
                    }}
                  >
                    {isWorkspace && <Layers className="w-3 h-3" />}
                    <span>{item.type === 'notebook' ? 'NotebookLM' : item.type}</span>
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(item.id);
                    }}
                    className="p-1 rounded-lg transition"
                    style={{ color: item.star ? activePalette.primary : undefined }}
                    aria-label="Star asset"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        item.star
                          ? 'fill-current'
                          : darkMode
                          ? 'text-slate-500 hover:text-white'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    />
                  </button>
                </div>

                {/* Title & Description */}
                <div className="space-y-1">
                  <h3
                    className={`text-base font-bold transition group-hover:opacity-90 ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p
                    className={`text-xs line-clamp-2 leading-relaxed ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {item.description}
                  </p>
                </div>

                {/* Tags or Workspace Synced Metrics */}
                {isWorkspace && wsData ? (
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-medium text-slate-400">
                    <span className="flex items-center gap-1 text-amber-400/90">
                      <BookOpen className="w-3 h-3" />
                      <span>{wsData.sources?.length || 0} sources</span>
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-cyan-400/90">
                      <FileText className="w-3 h-3" />
                      <span>{wsData.notebooks?.length || 0} notebooks</span>
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-emerald-400/90">
                      <Bot className="w-3 h-3" />
                      <span>{wsData.conversations?.length || 0} chats</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {item.tags.map((t) => (
                      <span
                        key={t}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                          darkMode ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div
                className={`pt-3 border-t flex items-center justify-between text-[11px] ${
                  darkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Folder className="w-3 h-3" />
                  <span className="truncate max-w-[150px]">{item.folder}</span>
                </div>

                <div className="flex items-center gap-1 text-slate-400 group-hover:text-white transition">
                  <span>{item.updatedAt}</span>
                  <ExternalLink className="w-3 h-3 ml-1" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recently Created Workspaces Modal (triggered by dotted + Add Workspace card) */}
      {showAddWorkspaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            className={`liquid-glass rounded-2xl p-6 border w-full max-w-xl shadow-2xl space-y-5 ${
              darkMode ? 'bg-slate-900/95 border-white/20' : 'bg-white/95 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${activePalette.primary}25`, color: activePalette.primary }}
                >
                  <Layers className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Recently Created Workspaces</h3>
                  <p className="text-xs text-slate-400">
                    Assign to folder: <span className="text-white font-semibold">"{currentFolderTarget}"</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddWorkspaceModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of recent workspaces */}
            <div className="space-y-2.5 max-h-80 overflow-y-auto no-scrollbar pr-1">
              {workspaces.map((ws) => {
                const isAlreadyInThisFolder = ws.folder === currentFolderTarget;

                return (
                  <div
                    key={ws.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                      darkMode
                        ? 'bg-slate-950/40 border-white/10 hover:border-white/20'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white truncate">{ws.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                          {ws.folder || 'Untitled Workspaces'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{ws.sources?.length || 0} sources</span>
                        <span>·</span>
                        <span>{ws.notebooks?.length || 0} notebooks</span>
                        <span>·</span>
                        <span>{ws.conversations?.length || 0} chats</span>
                        <span>·</span>
                        <span>Created {ws.createdAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          if (onAssignWorkspaceToFolder) {
                            onAssignWorkspaceToFolder(ws.id, currentFolderTarget);
                          }
                          setShowAddWorkspaceModal(false);
                        }}
                        style={
                          isAlreadyInThisFolder
                            ? undefined
                            : {
                                backgroundColor: `${activePalette.primary}25`,
                                borderColor: `${activePalette.primary}60`,
                                color: darkMode ? '#ffffff' : activePalette.primary,
                              }
                        }
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                          isAlreadyInThisFolder
                            ? 'bg-white/5 border-white/10 text-slate-400 cursor-default'
                            : 'hover:scale-105 shadow-sm'
                        }`}
                      >
                        {isAlreadyInThisFolder ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>In this folder</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Move to folder</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          if (onSelectWorkspace) {
                            onSelectWorkspace(ws.id);
                          }
                          setShowAddWorkspaceModal(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition"
                        title="Open this workspace"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create New Workspace Action inside Modal */}
            <div className={`pt-3 border-t flex items-center justify-between gap-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <p className="text-xs text-slate-400">
                Need an entirely new suite?
              </p>
              <button
                onClick={() => {
                  if (onCreateWorkspaceInFolder) {
                    onCreateWorkspaceInFolder(currentFolderTarget);
                  }
                  setShowAddWorkspaceModal(false);
                }}
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
                className="px-3.5 py-1.5 rounded-xl text-slate-950 font-bold text-xs shadow hover:scale-105 active:scale-95 transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Create New Workspace</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div
            className={`liquid-glass rounded-2xl p-6 border w-full max-w-sm shadow-2xl space-y-4 ${
              darkMode ? 'bg-slate-900/95 border-white/20' : 'bg-white/95 border-slate-200'
            }`}
          >
            <h3
              className={`text-sm font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              <FolderPlus className="w-4 h-4" style={{ color: activePalette.primary }} />
              <span>Create New Folder</span>
            </h3>

            <form onSubmit={handleCreateFolder} className="space-y-3">
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Master Thesis Chapters"
                className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none border ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400'
                }`}
                style={{ borderColor: `${activePalette.primary}50` }}
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs ${
                    darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-slate-950 font-bold text-xs shadow"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

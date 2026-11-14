import React, { useState, useMemo, useEffect } from 'react';
import {
  Folder,
  FolderPlus,
  Search,
  ArrowUpDown,
  FileText,
  BookOpen,
  Layers,
  Star,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  Bot,
  Clock,
  ArrowRight,
  X,
  AlertTriangle,
  FolderMinus,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LibraryItem, Workspace, ColorPalette } from '../types';

interface LibraryViewProps {
  items: LibraryItem[];
  folders: string[];
  workspaces?: Workspace[];
  onOpenItem: (item: LibraryItem) => void;
  onAddFolder: (name: string) => void;
  onDeleteFolder?: (folderName: string) => void;
  onReorderFolders?: (newFolders: string[]) => void;
  onToggleStar: (id: string) => void;
  onSelectWorkspace?: (workspaceId: string) => void;
  onAssignWorkspaceToFolder?: (workspaceId: string, folder: string) => void;
  onRemoveWorkspaceFromFolder?: (workspaceId: string) => void;
  onDeleteWorkspacePermanently?: (workspaceId: string) => void;
  onCreateWorkspaceInFolder?: (folder: string) => void;
  folderSignal?: { folder: string; nonce: number } | null;
  activePalette: ColorPalette;
  darkMode: boolean;
}

type FolderSortMode = 'name-asc' | 'name-desc' | 'count-desc' | 'recent';

export const LibraryView: React.FC<LibraryViewProps> = ({
  items,
  folders,
  workspaces = [],
  onOpenItem,
  onAddFolder,
  onDeleteFolder,
  onReorderFolders,
  onToggleStar,
  onSelectWorkspace,
  onAssignWorkspaceToFolder,
  onRemoveWorkspaceFromFolder,
  onDeleteWorkspacePermanently,
  onCreateWorkspaceInFolder,
  folderSignal,
  activePalette,
  darkMode,
}) => {
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [activeType, setActiveType] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddWorkspaceModal, setShowAddWorkspaceModal] = useState(false);
  const [folderSortMode, setFolderSortMode] = useState<FolderSortMode>('name-asc');
  const [folderTransitionCount, setFolderTransitionCount] = useState(0);

  useEffect(() => {
    if (!folderSignal) return;
    const target = folderSignal.folder;
    const resolved = target === 'all' || folders.includes(target) ? target : 'all';
    setFolderTransitionCount((c) => c + 1);
    setActiveFolder(resolved);
    setActiveType('all');
    setSearchFilter('');
  }, [folderSignal, folders]);
  const [draggedFolder, setDraggedFolder] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Deletion Confirmation Modals
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  // Combine standard library items and workspace items
  const allDisplayItems: LibraryItem[] = useMemo(() => {
    const list: LibraryItem[] = [...items];
    workspaces.forEach((ws) => {
      const alreadyExists = list.some((i) => i.id === `item-ws-${ws.id}` || i.workspaceId === ws.id);
      if (!alreadyExists) {
        list.push({
          id: `item-ws-${ws.id}`,
          title: ws.name,
          type: 'workspace',
          folder: ws.folder || 'Assorted Workspaces',
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

  // Trigger smooth blur animation when switching folders or sorting
  const handleSelectFolder = (folderName: string) => {
    if (folderName === activeFolder) return;
    setFolderTransitionCount((c) => c + 1);
    setActiveFolder(folderName);
  };

  const handleSortChange = (mode: FolderSortMode) => {
    setFolderTransitionCount((c) => c + 1);
    setFolderSortMode(mode);
  };

  // Sorted folders list — "Assorted Workspaces" is strictly pinned right after "All Folders" per Req 7 & Image 3
  const sortedFolders = useMemo(() => {
    const customFolders = folders.filter((f) => f !== 'Assorted Workspaces');
    if (folderSortMode === 'name-asc') {
      customFolders.sort((a, b) => a.localeCompare(b));
    } else if (folderSortMode === 'name-desc') {
      customFolders.sort((a, b) => b.localeCompare(a));
    } else if (folderSortMode === 'count-desc') {
      customFolders.sort((a, b) => {
        const countA = allDisplayItems.filter((i) => i.folder === a).length;
        const countB = allDisplayItems.filter((i) => i.folder === b).length;
        return countB - countA;
      });
    }
    // Always pin 'Assorted Workspaces' immediately after 'All Folders'
    return ['Assorted Workspaces', ...customFolders];
  }, [folders, folderSortMode, allDisplayItems]);

  const filteredItems = useMemo(() => {
    return allDisplayItems.filter((item) => {
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
  }, [allDisplayItems, activeFolder, activeType, searchFilter]);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onAddFolder(newFolderName.trim());
    setNewFolderName('');
    setShowNewFolderModal(false);
  };

  const handleConfirmDeleteFolder = () => {
    if (folderToDelete && onDeleteFolder) {
      onDeleteFolder(folderToDelete);
      if (activeFolder === folderToDelete) {
        setActiveFolder('all');
      }
    }
    setFolderToDelete(null);
  };

  const handleConfirmDeleteWorkspace = () => {
    if (workspaceToDelete && onDeleteWorkspacePermanently) {
      onDeleteWorkspacePermanently(workspaceToDelete.id);
    }
    setWorkspaceToDelete(null);
  };

  const currentFolderTarget = activeFolder === 'all' ? 'Assorted Workspaces' : activeFolder;

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
            className="px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap hover:opacity-90 shadow-sm cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span className="hidden sm:inline">New Folder</span>
          </button>
        </div>
      </div>

      {/* Categorized Folders Pill Bar & Sorting Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4 border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full sm:w-auto">
          <button
            onClick={() => handleSelectFolder('all')}
            style={
              activeFolder === 'all'
                ? {
                    backgroundColor: `${activePalette.primary}25`,
                    borderColor: activePalette.primary,
                    color: darkMode ? '#ffffff' : activePalette.primary,
                  }
                : {}
            }
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap border cursor-pointer ${
              activeFolder === 'all'
                ? 'shadow-sm font-bold'
                : darkMode
                ? 'liquid-glass text-slate-400 hover:text-white'
                : 'bg-white/80 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
            }`}
          >
            All Folders ({folders.length})
          </button>

          {sortedFolders.map((f) => {
            const count = allDisplayItems.filter((i) => i.folder === f).length;
            const isCurrent = activeFolder === f;
            const isDragged = draggedFolder === f;
            const isOver = dragOverFolder === f;

            return (
              <div
                key={f}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', f);
                  setDraggedFolder(f);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedFolder && draggedFolder !== f) {
                    setDragOverFolder(f);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverFolder === f) setDragOverFolder(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggedFolder || draggedFolder === f) return;
                  const currentList = [...folders];
                  const fromIdx = currentList.indexOf(draggedFolder);
                  const toIdx = currentList.indexOf(f);
                  if (fromIdx !== -1 && toIdx !== -1) {
                    currentList.splice(fromIdx, 1);
                    currentList.splice(toIdx, 0, draggedFolder);
                    onReorderFolders?.(currentList);
                  }
                  setDraggedFolder(null);
                  setDragOverFolder(null);
                }}
                onDragEnd={() => {
                  setDraggedFolder(null);
                  setDragOverFolder(null);
                }}
                className={`relative group shrink-0 flex items-center transition-transform ${
                  isDragged ? 'opacity-40 scale-95' : isOver ? 'scale-105 ring-2 ring-amber-400 rounded-full' : ''
                }`}
                title="Left click and drag to rearrange folders"
              >
                <button
                  onClick={() => handleSelectFolder(f)}
                  style={
                    isCurrent
                      ? {
                          backgroundColor: `${activePalette.primary}25`,
                          borderColor: activePalette.primary,
                          color: darkMode ? '#ffffff' : activePalette.primary,
                        }
                      : {}
                  }
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap border flex items-center gap-1.5 cursor-grab active:cursor-grabbing select-none ${
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
              </div>
            );
          })}
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" />
            <span>Sort:</span>
          </span>
          <select
            value={folderSortMode}
            onChange={(e) => handleSortChange(e.target.value as FolderSortMode)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer ${
              darkMode
                ? 'bg-slate-900 border-white/15 text-slate-200'
                : 'bg-white border-slate-300 text-slate-800 shadow-xs'
            }`}
          >
            <option value="name-asc">A to Z</option>
            <option value="name-desc">Z to A</option>
            <option value="count-desc">Most Items</option>
          </select>
        </div>
      </div>

      {/* Type Filter Controls (only shown when inside a specific folder) */}
      {activeFolder !== 'all' && (
        <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
          <div
            className={`flex items-center gap-1 p-0.5 rounded-lg border ${
              darkMode ? 'bg-slate-900/20 border-white/10' : 'bg-white/20 border-slate-200/50'
            }`}
          >
            {(['all', 'workspace', 'notebook', 'onenote', 'project', 'planner', 'document'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setFolderTransitionCount((c) => c + 1);
                  setActiveType(t);
                }}
                style={
                  activeType === t
                    ? {
                        backgroundColor: `${activePalette.primary}25`,
                        color: activePalette.primary,
                      }
                    : {}
                }
                className={`px-2.5 py-1 rounded-md capitalize transition font-medium cursor-pointer ${
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
            Showing {filteredItems.length} items in "{activeFolder}"
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA WITH SMOOTH BLUR TRANSITION SWEEP */}
      <div className="relative min-h-[300px]">
        {/* Smooth blur-sweep animation overlay on folder or sort change */}
        {folderTransitionCount > 0 && (
          <div
            key={`lib-blur-${folderTransitionCount}`}
            className="absolute inset-0 z-20 pointer-events-none onenote-page-blur-sweep"
            aria-hidden="true"
          />
        )}

        <div
          key={`content-${activeFolder}-${folderSortMode}-${activeType}-${folderTransitionCount}`}
          className="onenote-page-content-reveal"
        >
          {/* ================= IF ACTIVE FOLDER IS 'ALL', RENDER FOLDER CARDS (Task 3) ================= */}
          {activeFolder === 'all' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* New Folder Creation Card */}
              <div
                onClick={() => setShowNewFolderModal(true)}
                style={{ borderColor: `${activePalette.primary}70` }}
                className={`border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-3 transition-[translate,box-shadow,border-color,background-color] duration-200 cursor-pointer group min-h-[200px] hover:-translate-y-0.5 shadow-sm select-none ${
                  darkMode ? 'hover:bg-white/5 bg-slate-950/20' : 'hover:bg-slate-50 bg-white/40'
                }`}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition group-hover:scale-110 shadow-md"
                  style={{
                    backgroundColor: `${activePalette.primary}25`,
                    color: activePalette.primary,
                  }}
                >
                  <FolderPlus className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3
                    className="text-sm font-bold tracking-tight"
                    style={{ color: activePalette.id === 'black-night' ? '#ffffff' : activePalette.primary }}
                  >
                    + Create New Folder
                  </h3>
                  <p className={`text-xs mt-1 max-w-[220px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Add a dedicated repository to organize workspaces, notes, and planners.
                  </p>
                </div>
              </div>

              {/* Folder Cards */}
              {sortedFolders.map((folderName) => {
                const folderItems = allDisplayItems.filter((i) => i.folder === folderName);
                const folderWorkspaces = workspaces.filter((w) => w.folder === folderName);

                return (
                  <div
                    key={folderName}
                    onClick={() => handleSelectFolder(folderName)}
                    className="liquid-glass no-tilt rounded-3xl p-6 border shadow-xl flex flex-col justify-between group cursor-pointer transition-[translate,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5"
                    style={{
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                    }}
                  >
                    <div className="space-y-3 relative z-20">
                      <div className="flex items-center justify-between">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md"
                          style={{
                            backgroundColor: `${activePalette.primary}25`,
                            color: activePalette.primary,
                          }}
                        >
                          <Folder className="w-5 h-5" />
                        </div>

                        {folderName !== 'Assorted Workspaces' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderToDelete(folderName);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15"
                            title="Delete folder"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {folderName}
                        </h3>
                        <p className={`text-xs mt-1 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          {folderWorkspaces.length} workspace{folderWorkspaces.length !== 1 ? 's' : ''} · {folderItems.length} total asset{folderItems.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 relative z-20">
                      <span className="font-mono text-[11px]">Click to view contents</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ================= IF INSIDE A SPECIFIC FOLDER, RENDER WORKSPACES & ITEMS ================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Dotted border Add Workspace Card with matching theme hover glow */}
              <div
                onClick={() => setShowAddWorkspaceModal(true)}
                style={{
                  borderColor: `${activePalette.primary}80`,
                }}
                className={`border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-3 transition-[translate,box-shadow,border-color,background-color] duration-200 cursor-pointer group min-h-[220px] hover:-translate-y-0.5 shadow-sm select-none relative overflow-hidden ${
                  darkMode ? 'hover:bg-white/5 bg-slate-950/20' : 'hover:bg-slate-50 bg-white/40'
                }`}
                title={`Add or link a workspace to ${currentFolderTarget}`}
              >
                {/* Specular theme hover glow matching liquid-glass styling */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10"
                  style={{
                    background: `radial-gradient(circle at center, ${activePalette.primary}25 0%, transparent 70%)`,
                  }}
                />

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
                    Attach recently created workspaces or start a new synchronized suite in "{activeFolder}"
                  </p>
                </div>
              </div>

              {/* Items in Active Folder (with AnimatePresence for smooth permanent delete animation) */}
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item) => {
                  const isWorkspace = item.type === 'workspace';
                  const wsData = isWorkspace && workspaces.find((w) => w.id === item.workspaceId || w.name === item.title);

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{
                        opacity: 0,
                        scale: 0.85,
                        filter: 'blur(12px)',
                        transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                      }}
                      key={item.id}
                      onClick={() => {
                        if (isWorkspace && item.workspaceId && onSelectWorkspace) {
                          onSelectWorkspace(item.workspaceId);
                        } else {
                          onOpenItem(item);
                        }
                      }}
                      className={`liquid-glass no-tilt rounded-3xl p-5 shadow-xl gap-4 transition-[box-shadow,border-color,background-color] duration-200 cursor-pointer flex flex-col justify-between group overflow-hidden hover:-translate-y-0.5 ${
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
                      <div className="space-y-3 relative z-20">
                        {/* Type Badge, Star & Workspace Actions */}
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

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* Remove from folder action (moves back to Assorted Workspaces) */}
                            {isWorkspace && item.workspaceId && item.folder !== 'Assorted Workspaces' && (
                              <button
                                type="button"
                                onClick={() => onRemoveWorkspaceFromFolder?.(item.workspaceId!)}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 transition"
                                title="Remove workspace from folder (moves to Assorted Workspaces)"
                              >
                                <FolderMinus className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Permanently delete workspace from library */}
                            {isWorkspace && wsData && (
                              <button
                                type="button"
                                onClick={() => setWorkspaceToDelete(wsData)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition"
                                title="Permanently delete workspace from library"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onToggleStar(item.id)}
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
                                    : 'text-slate-400 hover:text-slate-900'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <div>
                          <h3
                            className={`text-base font-bold tracking-tight line-clamp-1 group-hover:text-cyan-300 transition-colors ${
                              darkMode ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {item.title}
                          </h3>
                          <p
                            className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                              darkMode ? 'text-slate-400' : 'text-slate-600'
                            }`}
                          >
                            {item.description}
                          </p>
                        </div>

                        {/* Synchronized Workspace Stats Deck */}
                        {isWorkspace && wsData && (
                          <div
                            className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] font-mono ${
                              darkMode ? 'bg-slate-950/40 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="flex items-center gap-1" title="Sources in NotebookLM">
                              <BookOpen className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                              <span>{wsData.sources?.length || 0} src</span>
                            </span>
                            <span className="flex items-center gap-1" title="Notebooks in OneNote">
                              <FileText className="w-3.5 h-3.5 text-cyan-400" />
                              <span>{wsData.notebooks?.length || 0} nb</span>
                            </span>
                            <span className="flex items-center gap-1" title="Gemini chats">
                              <Bot className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{wsData.conversations?.length || 0} chats</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Footer Row */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 relative z-20">
                        <span className="font-mono text-[11px]">{item.updatedAt}</span>
                        <span className="flex items-center gap-1 text-[11px] font-bold group-hover:translate-x-0.5 transition-transform">
                          <span>Open</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowNewFolderModal(false)}
          />
          <div
            className={`relative w-full max-w-md rounded-3xl p-6 border shadow-2xl z-10 space-y-4 acrylic-glass-panel ${
              darkMode ? 'bg-slate-900/95 border-white/20 text-slate-100' : 'bg-white/95 border-slate-300 text-slate-900'
            }`}
            style={{
              borderColor: `${activePalette.primary}60`,
              boxShadow: `0 24px 64px -12px rgba(0,0,0,0.7), 0 0 32px ${activePalette.primary}25`,
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FolderPlus className="w-5 h-5" style={{ color: activePalette.primary }} />
                <span>Create New Folder</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Theoretical Computer Science"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                    darkMode ? 'bg-slate-950/70 border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  style={{ borderColor: `${activePalette.primary}50` }}
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                    darkMode ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-50"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Link Workspace to Folder Modal */}
      {showAddWorkspaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowAddWorkspaceModal(false)}
          />
          <div
            className={`relative w-full max-w-lg rounded-3xl p-6 border shadow-2xl z-10 space-y-4 acrylic-glass-panel ${
              darkMode ? 'bg-slate-900/95 border-white/20 text-slate-100' : 'bg-white/95 border-slate-300 text-slate-900'
            }`}
            style={{
              borderColor: `${activePalette.primary}60`,
              boxShadow: `0 24px 64px -12px rgba(0,0,0,0.7), 0 0 32px ${activePalette.primary}25`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: `${activePalette.primary}25`, color: activePalette.primary }}
                >
                  <Layers className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Attach Workspace to Folder</h3>
                  <p className="text-xs text-slate-400">
                    Assign to folder: <span className="text-white font-semibold">"{currentFolderTarget}"</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
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
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      darkMode
                        ? 'bg-slate-950/40 border-white/10 hover:border-white/20'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white truncate">{ws.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                          {ws.folder || 'Assorted Workspaces'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{ws.sources?.length || 0} sources</span>
                        <span>·</span>
                        <span>{ws.notebooks?.length || 0} notebooks</span>
                        <span>·</span>
                        <span>{ws.conversations?.length || 0} chats</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
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
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                          isAlreadyInThisFolder
                            ? 'bg-white/5 border-white/10 text-slate-400 cursor-default'
                            : 'hover:scale-105 shadow-sm cursor-pointer'
                        }`}
                      >
                        {isAlreadyInThisFolder ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>In Folder</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {workspaces.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">
                  No existing workspaces found. Click below to create a new one!
                </p>
              )}
            </div>

            {/* Quick Create New Workspace inside this Folder */}
            <div className="pt-2 border-t border-white/10 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setShowAddWorkspaceModal(false);
                  onCreateWorkspaceInFolder?.(currentFolderTarget);
                }}
                style={{
                  backgroundColor: `${activePalette.primary}25`,
                  borderColor: `${activePalette.primary}60`,
                  color: darkMode ? '#ffffff' : activePalette.primary,
                }}
                className="w-full py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition hover:scale-[1.01] shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create Brand New Workspace in "{currentFolderTarget}"</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Full-Viewport Confirmation Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
            onClick={() => setFolderToDelete(null)}
          />
          <div
            className={`relative w-full max-w-md rounded-3xl p-6 border shadow-2xl z-10 space-y-4 acrylic-glass-panel ${
              darkMode ? 'bg-slate-900/95 border-rose-500/30 text-slate-100' : 'bg-white border-rose-300 text-slate-900'
            }`}
            style={{
              boxShadow: '0 24px 64px -12px rgba(225, 29, 72, 0.25)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete Folder</h3>
                <p className="text-xs text-slate-400">Permanently remove folder grouping</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              Are you sure you want to delete the folder <span className="font-bold text-white">"{folderToDelete}"</span>? Any workspaces and items inside will be safely moved to <span className="text-cyan-300 font-semibold">Assorted Workspaces</span>.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/10 text-slate-300 hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFolder}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50 transition cursor-pointer"
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Workspace Permanently Full-Viewport Confirmation Modal */}
      {workspaceToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
            onClick={() => setWorkspaceToDelete(null)}
          />
          <div
            className={`relative w-full max-w-md rounded-3xl p-6 border shadow-2xl z-10 space-y-4 acrylic-glass-panel ${
              darkMode ? 'bg-slate-900/95 border-rose-500/30 text-slate-100' : 'bg-white border-rose-300 text-slate-900'
            }`}
            style={{
              boxShadow: '0 24px 64px -12px rgba(225, 29, 72, 0.25)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Permanently Delete Workspace</h3>
                <p className="text-xs text-slate-400">Irreversible action</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              Are you sure you want to permanently delete workspace <span className="font-bold text-white">"{workspaceToDelete.name}"</span>? All associated sources, OneNote canvas blocks, and Gemini dialogs will be deleted.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setWorkspaceToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/10 text-slate-300 hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteWorkspace}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50 transition cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
} from 'lucide-react';
import { LibraryItem, ColorPalette } from '../types';

interface LibraryViewProps {
  items: LibraryItem[];
  folders: string[];
  onOpenItem: (item: LibraryItem) => void;
  onAddFolder: (name: string) => void;
  onToggleStar: (id: string) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  items,
  folders,
  onOpenItem,
  onAddFolder,
  onToggleStar,
  activePalette,
  darkMode,
}) => {
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [activeType, setActiveType] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const filteredItems = items.filter((item) => {
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
            Categorized research repositories, OneNote canvases, grounded notebooks, and planners.
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
              placeholder="Search library assets..."
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
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
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
          All Folders ({items.length})
        </button>

        {folders.map((f) => {
          const count = items.filter((i) => i.folder === f).length;
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
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap border ${
                isCurrent
                  ? 'shadow-sm font-bold'
                  : darkMode
                  ? 'liquid-glass text-slate-400 hover:text-white'
                  : 'bg-white/80 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
              }`}
            >
              <Folder className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
              <span>{f}</span>
              <span className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Type Filter Controls */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`font-mono ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Filter Type:
        </span>
        <div
          className={`flex items-center gap-1 p-0.5 rounded-lg border ${
            darkMode ? 'bg-slate-900/20 border-white/10' : 'bg-white/20 border-slate-200/50'
          }`}
        >
          {(['all', 'notebook', 'onenote', 'project', 'planner', 'document'] as const).map((t) => (
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
              className={`px-2.5 py-1 rounded-md capitalize transition ${
                activeType === t
                  ? 'font-bold'
                  : darkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'all' ? 'All' : t === 'notebook' ? 'NotebookLM' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Tiles of Liquid Glass */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => onOpenItem(item)}
            className="liquid-glass rounded-2xl p-5 shadow-xl gap-4 transition-all duration-200 cursor-pointer flex flex-col justify-between group overflow-hidden"
          >
            <div className="space-y-3">
              {/* Type Badge & Star */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: `${activePalette.primary}18`,
                    borderColor: `${activePalette.primary}40`,
                    color: activePalette.primary,
                  }}
                >
                  {item.type === 'notebook' ? 'NotebookLM' : item.type}
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
                  style={{ color: undefined }}
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

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                      darkMode
                        ? 'bg-white/5 text-slate-300 border-white/5'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Folder & Modified Date */}
            <div
              className={`pt-3 border-t flex items-center justify-between text-[11px] font-mono ${
                darkMode ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'
              }`}
            >
              <span
                className={`flex items-center gap-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                <Folder className="w-3 h-3" style={{ color: activePalette.primary }} />
                <span className="truncate max-w-[120px]">{item.folder}</span>
              </span>
              <span>{item.updatedAt}</span>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full text-center py-16 liquid-glass rounded-2xl space-y-2">
            <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              No assets match your current filters.
            </p>
            <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Try adjusting the search query or folder selection.
            </p>
          </div>
        )}
      </div>

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

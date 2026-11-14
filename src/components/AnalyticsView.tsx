import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  FolderOpen,
  ArrowUpRight,
  Activity,
  FileText,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Workspace, AuditLog, ColorPalette } from '../types';

interface AnalyticsViewProps {
  workspaces: Workspace[];
  folders: string[];
  activeWorkspaceId?: string | null;
  workspaceSeconds: Record<string, number>;
  workspaceInteractions: Record<string, number>;
  auditLogs: AuditLog[];
  onJumpToAudit: (log: AuditLog) => void;
  onOpenFolderInLibrary: (folderName: string) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
}

interface BreakdownItem {
  id: string;
  name: string;
  subtitle: string;
  targetFolder: string;
  seconds: number;
  interactions: number;
  percentage: number;
  color: string;
  isActive?: boolean;
  workspaceCount?: number;
}

function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function buildThemeSpectrum(primary: string, accent: string): string[] {
  const [ph, ps, pl] = hexToHsl(primary);
  const [ah, as, al] = hexToHsl(accent || primary);
  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
  const hsl = (h: number, s: number, l: number) =>
    `hsl(${((h % 360) + 360) % 360}, ${clamp(s, 18, 95)}%, ${clamp(l, 32, 76)}%)`;

  return [
    primary,
    accent && accent.toLowerCase() !== primary.toLowerCase()
      ? accent
      : hsl(ph + 14, ps, pl + 10),
    hsl(ph + 10, ps, clamp(pl + 13, 38, 74)),
    hsl(ah - 10, as, clamp(al + 10, 38, 72)),
    hsl(ph - 12, ps, clamp(pl - 8, 34, 68)),
    hsl(ah + 14, as, clamp(al - 8, 34, 68)),
    hsl(ph + 20, clamp(ps - 8, 20, 90), clamp(pl + 8, 40, 74)),
    hsl(ah - 18, clamp(as - 6, 20, 90), clamp(al + 14, 42, 75)),
    hsl((ph + ah) / 2, Math.max(ps, as), clamp((pl + al) / 2 + 6, 38, 72)),
  ];
}

const CONTEXT_LABELS: Record<NonNullable<AuditLog['targetContext']>, string> = {
  notebooklm: 'NotebookLM Studio',
  onenote: 'OneNote Canvas',
  gemini: 'Gemini Live Chat',
  library: 'My Library',
  dashboard: 'Dashboard',
  settings: 'Settings',
};

const PAGE_SIZE = 9; // 3x3 grid

function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const remSecs = secs % 60;

  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }
  if (mins > 0) {
    return `${mins}m ${String(remSecs).padStart(2, '0')}s`;
  }
  return `${remSecs}s`;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  workspaces,
  folders,
  activeWorkspaceId,
  workspaceSeconds,
  workspaceInteractions,
  auditLogs,
  onJumpToAudit,
  onOpenFolderInLibrary,
  activePalette,
  darkMode,
}) => {
  // Default remains 'workspaces' per requirement
  const [breakdownMode, setBreakdownMode] = useState<'workspaces' | 'folders'>('workspaces');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageDirection, setPageDirection] = useState<1 | -1>(1);
  const [logFilter, setLogFilter] = useState<'all' | 'system' | 'ai' | 'note' | 'source' | 'task'>('all');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const primaryAccent = activePalette.id === 'black-night' ? '#f1f5f9' : activePalette.primary;
  const themeColors = useMemo(
    () => buildThemeSpectrum(primaryAccent, activePalette.accent || primaryAccent),
    [primaryAccent, activePalette.accent]
  );

  // Compute total active seconds & interactions in real time
  const totalSeconds = useMemo(
    () => Object.values(workspaceSeconds).reduce((acc, s) => acc + (s || 0), 0),
    [workspaceSeconds]
  );

  const totalInteractions = useMemo(
    () => Object.values(workspaceInteractions).reduce((acc, c) => acc + (c || 0), 0),
    [workspaceInteractions]
  );

  // Build breakdown items for either Workspaces or Folders
  const breakdownItems = useMemo<BreakdownItem[]>(() => {
    if (breakdownMode === 'workspaces') {
      const items: Omit<BreakdownItem, 'percentage' | 'color'>[] = workspaces.map((ws) => {
        const wsFolder = ws.folder || 'Assorted Workspaces';
        return {
          id: ws.id,
          name: ws.name,
          subtitle: wsFolder,
          targetFolder: wsFolder,
          seconds: workspaceSeconds[ws.id] || 0,
          interactions: workspaceInteractions[ws.id] || 0,
          isActive: ws.id === activeWorkspaceId,
        };
      });

      // Include general session if any seconds or interactions occurred without an active workspace
      const generalSecs = workspaceSeconds['__general__'] || 0;
      const generalInts = workspaceInteractions['__general__'] || 0;
      if (generalSecs > 0 || generalInts > 0 || items.length === 0) {
        items.push({
          id: '__general__',
          name: 'General Session',
          subtitle: 'App-wide & Library',
          targetFolder: 'all',
          seconds: generalSecs,
          interactions: generalInts,
          isActive: !activeWorkspaceId,
        });
      }

      // Include any leftover tracked workspace IDs (e.g., deleted workspaces with recorded time)
      const knownIds = new Set(items.map((i) => i.id));
      Object.keys(workspaceSeconds).forEach((key) => {
        if (!knownIds.has(key) && ((workspaceSeconds[key] || 0) > 0 || (workspaceInteractions[key] || 0) > 0)) {
          items.push({
            id: key,
            name: 'Archived Workspace',
            subtitle: 'Previously Tracked',
            targetFolder: 'all',
            seconds: workspaceSeconds[key] || 0,
            interactions: workspaceInteractions[key] || 0,
            isActive: false,
          });
        }
      });

      const sorted = [...items].sort((a, b) => {
        if (b.seconds !== a.seconds) return b.seconds - a.seconds;
        if (b.interactions !== a.interactions) return b.interactions - a.interactions;
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return a.name.localeCompare(b.name);
      });

      const sumSecs = sorted.reduce((acc, i) => acc + i.seconds, 0);
      return sorted.map((item, idx) => ({
        ...item,
        color: themeColors[idx % themeColors.length],
        percentage: sumSecs > 0 ? Math.round((item.seconds / sumSecs) * 1000) / 10 : 0,
      }));
    }

    // Folders mode
    const folderMap = new Map<
      string,
      { seconds: number; interactions: number; workspaceCount: number; isActive: boolean }
    >();

    folders.forEach((folderName) => {
      folderMap.set(folderName, {
        seconds: 0,
        interactions: 0,
        workspaceCount: 0,
        isActive: false,
      });
    });

    workspaces.forEach((ws) => {
      const fName = ws.folder || 'Assorted Workspaces';
      const entry = folderMap.get(fName) || {
        seconds: 0,
        interactions: 0,
        workspaceCount: 0,
        isActive: false,
      };
      entry.seconds += workspaceSeconds[ws.id] || 0;
      entry.interactions += workspaceInteractions[ws.id] || 0;
      entry.workspaceCount += 1;
      if (ws.id === activeWorkspaceId) {
        entry.isActive = true;
      }
      folderMap.set(fName, entry);
    });

    const generalSecs = workspaceSeconds['__general__'] || 0;
    const generalInts = workspaceInteractions['__general__'] || 0;
    if (generalSecs > 0 || generalInts > 0 || folderMap.size === 0) {
      folderMap.set('General Session', {
        seconds: generalSecs,
        interactions: generalInts,
        workspaceCount: 0,
        isActive: !activeWorkspaceId,
      });
    }

    const entries: Omit<BreakdownItem, 'percentage' | 'color'>[] = Array.from(folderMap.entries()).map(
      ([folderName, data]) => ({
        id: `folder-${folderName}`,
        name: folderName,
        subtitle: `${data.workspaceCount} ${data.workspaceCount === 1 ? 'workspace' : 'workspaces'}`,
        targetFolder: folderName === 'General Session' ? 'all' : folderName,
        seconds: data.seconds,
        interactions: data.interactions,
        isActive: data.isActive,
        workspaceCount: data.workspaceCount,
      })
    );

    const sorted = entries.sort((a, b) => {
      if (b.seconds !== a.seconds) return b.seconds - a.seconds;
      if (b.interactions !== a.interactions) return b.interactions - a.interactions;
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.name.localeCompare(b.name);
    });

    const sumSecs = sorted.reduce((acc, i) => acc + i.seconds, 0);
    return sorted.map((item, idx) => ({
      ...item,
      color: themeColors[idx % themeColors.length],
      percentage: sumSecs > 0 ? Math.round((item.seconds / sumSecs) * 1000) / 10 : 0,
    }));
  }, [breakdownMode, workspaces, folders, workspaceSeconds, workspaceInteractions, activeWorkspaceId, themeColors]);

  const totalPages = Math.max(1, Math.ceil(breakdownItems.length / PAGE_SIZE));

  // Clamp page when switching slider or item count changes
  useEffect(() => {
    setCurrentPage(0);
  }, [breakdownMode]);

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  const pagedItems = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return breakdownItems.slice(start, start + PAGE_SIZE);
  }, [breakdownItems, currentPage]);

  const topFocus = useMemo(() => {
    if (breakdownItems.length === 0) return null;
    const top = breakdownItems[0];
    if (top.seconds === 0 && top.interactions === 0) return null;
    return top;
  }, [breakdownItems]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (logFilter === 'all') return true;
      return log.category === logFilter;
    });
  }, [auditLogs, logFilter]);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setPageDirection(-1);
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setPageDirection(1);
      setCurrentPage((p) => p + 1);
    }
  };

  const handleExportAudits = () => {
    const escapeCsv = (val?: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const header = 'Timestamp,FullTimestamp,Category,Action,Workspace,Folder,TargetContext,Detail';
    const rows = auditLogs.map((l) =>
      [
        escapeCsv(l.timestamp),
        escapeCsv(l.fullTimestamp || l.timestamp),
        escapeCsv(l.category),
        escapeCsv(l.action),
        escapeCsv(l.workspaceName || 'General Session'),
        escapeCsv(l.folderName || 'Assorted Workspaces'),
        escapeCsv(l.targetContext || 'notebooklm'),
        escapeCsv(l.detail),
      ].join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aether_learn_audit_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative min-h-screen pt-28 pb-16 px-4 sm:px-8 lg:px-12 max-w-[1720px] w-full mx-auto space-y-8 select-none transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: primaryAccent }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: primaryAccent }}
            />
            <span>Live Session Analytics · {activePalette.name}</span>
          </div>
          <h1
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            Learning Analytics &amp; Interaction Audits
          </h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Real-time session tracking across your workspaces, folders, and verified interaction logs.
          </p>
        </div>

        <button
          onClick={handleExportAudits}
          disabled={auditLogs.length === 0}
          style={{
            backgroundColor: `${activePalette.primary}25`,
            borderColor: `${activePalette.primary}60`,
            color: darkMode ? '#ffffff' : activePalette.primary,
          }}
          className="px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition hover:opacity-90 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span>Export Audit Ledger (CSV)</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="liquid-glass no-tilt rounded-2xl p-5 shadow-lg space-y-1 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono uppercase ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
              Active Study Time
            </span>
            <Clock className="w-4 h-4 opacity-70" style={{ color: primaryAccent }} />
          </div>
          <p
            className={`text-3xl font-extrabold tabular-nums ${darkMode ? 'text-white' : ''}`}
            style={!darkMode ? { color: activePalette.primary } : undefined}
          >
            {formatDuration(totalSeconds)}
          </p>
          <span className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {Math.floor(totalSeconds / 60)} min · updates every second live
          </span>
        </div>

        <div className="liquid-glass no-tilt rounded-2xl p-5 shadow-lg space-y-1 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono uppercase ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
              Top {breakdownMode === 'workspaces' ? 'Workspace' : 'Folder'} Focus
            </span>
            {breakdownMode === 'workspaces' ? (
              <Layers className="w-4 h-4 opacity-70" style={{ color: primaryAccent }} />
            ) : (
              <FolderOpen className="w-4 h-4 opacity-70" style={{ color: primaryAccent }} />
            )}
          </div>
          <p
            className={`text-2xl font-extrabold truncate ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {topFocus ? topFocus.name : 'No activity yet'}
          </p>
          <span
            className="text-[11px] font-semibold"
            style={{ color: darkMode ? '#cbd5e1' : activePalette.accent }}
          >
            {topFocus
              ? `${topFocus.percentage}% (${formatDuration(topFocus.seconds)})`
              : 'Interact or study to start tracking'}
          </span>
        </div>

        <div className="liquid-glass no-tilt rounded-2xl p-5 shadow-lg space-y-1 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Interaction Audits
            </span>
            <FileText className="w-4 h-4 opacity-70" style={{ color: primaryAccent }} />
          </div>
          <p
            className={`text-3xl font-extrabold tabular-nums ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {auditLogs.length} {auditLogs.length === 1 ? 'Record' : 'Records'}
          </p>
          <span className="text-[11px] text-emerald-500 font-medium">
            {auditLogs.length > 0 ? 'Click any log row for info & jump' : 'Ledger reset — awaiting events'}
          </span>
        </div>

        <div className="liquid-glass no-tilt rounded-2xl p-5 shadow-lg space-y-1 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Recorded Interactions
            </span>
            <Activity className="w-4 h-4 opacity-70" style={{ color: primaryAccent }} />
          </div>
          <p
            className={`text-3xl font-extrabold tabular-nums ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {totalInteractions.toLocaleString()}
          </p>
          <span className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Actions logged across {workspaces.length}{' '}
            {workspaces.length === 1 ? 'workspace' : 'workspaces'}
          </span>
        </div>
      </div>

      {/* Time Spent Across Workspaces / Folders Breakdown with Inline Word Toggle & 3x3 Pagination */}
      <div className="liquid-glass no-tilt rounded-2xl p-6 shadow-xl flex flex-col gap-5 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3
              className={`text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {breakdownMode === 'workspaces' ? (
                <Layers className="w-4 h-4 shrink-0" style={{ color: primaryAccent }} />
              ) : (
                <FolderOpen className="w-4 h-4 shrink-0" style={{ color: primaryAccent }} />
              )}
              <span className="inline-flex items-baseline gap-1.5 flex-wrap">
                <span>Time Spent Across</span>
                <button
                  type="button"
                  onClick={() =>
                    setBreakdownMode((prev) => (prev === 'workspaces' ? 'folders' : 'workspaces'))
                  }
                  title={`Click to switch to ${breakdownMode === 'workspaces' ? 'Folders' : 'Workspaces'}`}
                  aria-label={`Currently showing ${breakdownMode}. Click to switch to ${
                    breakdownMode === 'workspaces' ? 'Folders' : 'Workspaces'
                  }`}
                  className={`relative inline-flex items-center justify-center rounded-md px-1.5 py-0.5 -mx-0.5 transition-colors cursor-pointer overflow-hidden ${
                    darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-900/5'
                  }`}
                  style={{
                    color: primaryAccent,
                    borderBottom: `2px solid ${activePalette.primary}`,
                  }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={breakdownMode}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -12, opacity: 0 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="inline-block leading-tight"
                    >
                      {breakdownMode === 'workspaces' ? 'Workspaces' : 'Folders'}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </span>
            </h3>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Live session time and interaction breakdown grouped by{' '}
              {breakdownMode === 'workspaces' ? 'individual workspace' : 'workspace folder'} — click{' '}
              {breakdownMode === 'workspaces' ? 'Workspaces' : 'Folders'} above to switch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* 3x3 Pagination Arrows */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono mr-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {breakdownItems.length} {breakdownMode} · Page {currentPage + 1}/{totalPages}
              </span>
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                aria-label="Previous page"
                className={`p-1.5 rounded-lg border transition ${
                  darkMode
                    ? 'bg-slate-900/70 border-white/10 text-slate-200 hover:bg-white/10 disabled:opacity-30'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30 shadow-xs'
                } disabled:cursor-not-allowed`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages - 1}
                aria-label="Next page"
                className={`p-1.5 rounded-lg border transition ${
                  darkMode
                    ? 'bg-slate-900/70 border-white/10 text-slate-200 hover:bg-white/10 disabled:opacity-30'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30 shadow-xs'
                } disabled:cursor-not-allowed`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Visual Stacked Progress Bar */}
        <div
          className={`w-full h-3 rounded-full overflow-hidden flex ${
            darkMode ? 'bg-slate-900' : 'bg-slate-200'
          }`}
        >
          {totalSeconds > 0 ? (
            breakdownItems
              .filter((item) => item.seconds > 0)
              .map((item) => (
                <div
                  key={item.id}
                  className="h-full transition-all duration-300 hover:opacity-90"
                  style={{
                    width: `${Math.max(item.percentage, 1.5)}%`,
                    backgroundColor: item.color,
                  }}
                  title={`${item.name}: ${formatDuration(item.seconds)} (${item.percentage}%)`}
                />
              ))
          ) : (
            <div
              className="h-full w-full opacity-35"
              style={{ backgroundColor: activePalette.primary }}
            />
          )}
        </div>

        {/* 3x3 Workspace / Folder Cards Grid */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${breakdownMode}-${currentPage}`}
            initial={{ opacity: 0, x: pageDirection * 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: pageDirection * -18 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1"
          >
            {pagedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenFolderInLibrary(item.targetFolder)}
                title={`Open folder "${item.targetFolder === 'all' ? 'All Folders' : item.targetFolder}" in My Library`}
                className={`relative z-20 p-4 rounded-xl border space-y-2.5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
                  darkMode
                    ? 'bg-slate-900/65 border-white/10 hover:border-white/25'
                    : 'bg-white/85 border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
                style={
                  item.isActive
                    ? {
                        borderColor: `${activePalette.primary}75`,
                        boxShadow: `0 0 0 1px ${activePalette.primary}30`,
                      }
                    : undefined
                }
              >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4
                            className={`text-xs font-bold truncate ${
                              darkMode ? 'text-slate-100' : 'text-slate-900'
                            }`}
                          >
                            {item.name}
                          </h4>
                          {item.isActive && (
                            <span
                              className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold shrink-0"
                              style={{
                                backgroundColor: `${activePalette.primary}25`,
                                color: primaryAccent,
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-[11px] truncate ${
                            darkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-mono font-bold tabular-nums shrink-0 ${
                        darkMode ? 'text-slate-200' : 'text-slate-800'
                      }`}
                    >
                      {item.percentage}%
                    </span>
                  </div>

                  {/* Mini proportional bar */}
                  <div
                    className={`w-full h-1.5 rounded-full overflow-hidden ${
                      darkMode ? 'bg-slate-800' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>

                  <div
                    className={`flex items-center justify-between text-[11px] font-mono ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    <span className="tabular-nums font-semibold" style={{ color: item.seconds > 0 ? primaryAccent : undefined }}>
                      {formatDuration(item.seconds)}
                    </span>
                    <span className="tabular-nums">
                      {item.interactions} {item.interactions === 1 ? 'interaction' : 'interactions'}
                    </span>
                  </div>
                </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPageDirection(idx > currentPage ? 1 : -1);
                  setCurrentPage(idx);
                }}
                aria-label={`Go to page ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentPage
                    ? 'w-6'
                    : darkMode
                    ? 'w-2 bg-white/20 hover:bg-white/40'
                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
                style={idx === currentPage ? { backgroundColor: activePalette.primary } : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Interaction Audit Ledger */}
      <div className="liquid-glass no-tilt rounded-2xl p-6 shadow-xl flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3
              className={`text-base font-bold ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              Interaction Audit Ledger
            </h3>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Click any entry to inspect workspace metadata and jump directly to that context.
            </p>
          </div>

          {/* Filter Pills */}
          <div
            className={`flex flex-wrap items-center gap-1 p-0.5 rounded-lg border text-xs ${
              darkMode ? 'bg-slate-900/60 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}
          >
            {(['all', 'system', 'ai', 'note', 'source', 'task'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setLogFilter(cat)}
                style={
                  logFilter === cat
                    ? {
                        backgroundColor: `${activePalette.primary}25`,
                        color: primaryAccent,
                      }
                    : {}
                }
                className={`px-2.5 py-1 rounded-md uppercase font-mono text-[10px] transition ${
                  logFilter === cat
                    ? 'font-bold'
                    : darkMode
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Rows */}
        {filteredLogs.length === 0 ? (
          <div
            className={`rounded-xl border border-dashed py-12 px-6 text-center space-y-2 ${
              darkMode
                ? 'border-white/10 bg-slate-900/30 text-slate-400'
                : 'border-slate-300 bg-slate-50/70 text-slate-500'
            }`}
          >
            <Sparkles className="w-6 h-6 mx-auto opacity-60" style={{ color: primaryAccent }} />
            <p className={`text-sm font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {auditLogs.length === 0
                ? 'Audit ledger is clean'
                : `No "${logFilter}" interaction logs recorded yet`}
            </p>
            <p className="text-xs max-w-md mx-auto">
              Every workspace switch, AI prompt, OneNote edit, source upload, and task update will be
              logged here in real time.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => {
              const isExpanded = expandedAuditId === log.id;
              const contextLabel = log.targetContext
                ? CONTEXT_LABELS[log.targetContext]
                : 'NotebookLM Studio';

              return (
                <div
                  key={log.id}
                  onClick={() => setExpandedAuditId(isExpanded ? null : log.id)}
                  className={`relative z-20 rounded-xl border transition-colors cursor-pointer ${
                    darkMode
                      ? isExpanded
                        ? 'bg-slate-900/85 border-white/20'
                        : 'bg-slate-900/45 border-white/10 hover:border-white/20 hover:bg-slate-900/70'
                      : isExpanded
                      ? 'bg-white border-slate-300 shadow-md'
                      : 'bg-white/75 border-slate-200 hover:border-slate-300 hover:bg-white shadow-xs'
                  }`}
                >
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      <span
                        className={`font-mono whitespace-nowrap tabular-nums ${
                          darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {log.timestamp}
                      </span>

                      <span
                        className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border shrink-0"
                        style={{
                          backgroundColor: `${activePalette.primary}18`,
                          borderColor: `${activePalette.primary}40`,
                          color: primaryAccent,
                        }}
                      >
                        {log.category}
                      </span>

                      <span
                        className={`font-semibold whitespace-nowrap ${
                          darkMode ? 'text-slate-100' : 'text-slate-900'
                        }`}
                      >
                        {log.action}
                      </span>

                      <span
                        className={`truncate max-w-xl ${
                          darkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        {log.detail}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {log.workspaceName && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            darkMode
                              ? 'bg-white/5 border-white/10 text-slate-300'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {log.workspaceName}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        } ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                      />
                    </div>
                  </div>

                  {/* Expanded Audit Details & Jump Button */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div
                          className={`px-4 pb-4 pt-3 border-t flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs ${
                            darkMode
                              ? 'border-white/10 bg-black/25'
                              : 'border-slate-200/80 bg-slate-50/80'
                          }`}
                        >
                          <div className="space-y-2 flex-1 min-w-0">
                            <p
                              className={`leading-relaxed break-words ${
                                darkMode ? 'text-slate-200' : 'text-slate-800'
                              }`}
                            >
                              {log.detail}
                            </p>

                            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] font-mono">
                              <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                                Recorded:{' '}
                                <strong className={darkMode ? 'text-slate-200' : 'text-slate-800'}>
                                  {log.fullTimestamp || log.timestamp}
                                </strong>
                              </span>
                              <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                                Workspace:{' '}
                                <strong className={darkMode ? 'text-slate-200' : 'text-slate-800'}>
                                  {log.workspaceName || 'General Session'}
                                </strong>
                              </span>
                              <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                                Folder:{' '}
                                <strong className={darkMode ? 'text-slate-200' : 'text-slate-800'}>
                                  {log.folderName || 'Assorted Workspaces'}
                                </strong>
                              </span>
                              <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                                Context:{' '}
                                <strong className={darkMode ? 'text-slate-200' : 'text-slate-800'}>
                                  {contextLabel}
                                </strong>
                              </span>
                              <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                                ID:{' '}
                                <strong className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                                  {log.id}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onJumpToAudit(log);
                            }}
                            style={{
                              backgroundColor: `${activePalette.primary}25`,
                              borderColor: `${activePalette.primary}65`,
                              color: darkMode ? '#ffffff' : activePalette.primary,
                            }}
                            className="px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 shrink-0 transition hover:opacity-90 shadow-sm self-start lg:self-center"
                          >
                            <span>Jump to {contextLabel}</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

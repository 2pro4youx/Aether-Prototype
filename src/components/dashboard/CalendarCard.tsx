import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Pencil,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';
import { CalendarEventEntry, ColorPalette, TaskItem } from '../../types';
import { DashboardModal } from './DashboardModal';
import {
  CARD_ITEM_INITIAL,
  CARD_ITEM_ANIMATE,
  CARD_ITEM_EXIT,
  CARD_ITEM_TRANSITION,
} from './cardItemMotion';
import {
  deleteGoogleCalendarEventById,
  extractTimedTasksForCalendar,
  getGoogleCalendarAccessToken,
  mergeGoogleAndLocalEvents,
  pullGoogleCalendarEvents,
  pushDashboardItemsToGoogleCalendar,
  reauthorizeGoogleCalendar,
  subscribeGoogleCalendarToken,
} from '../../utils/googleCalendarSync';

interface CalendarCardProps {
  localEvents: CalendarEventEntry[];
  onChangeLocalEvents: (events: CalendarEventEntry[]) => void;
  tasks?: TaskItem[];
  onToggleTask?: (taskId: string) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  searchQuery?: string;
  cardTitle?: string;
  onEditTitle?: () => void;
}

const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const CalendarCard: React.FC<CalendarCardProps> = ({
  localEvents,
  onChangeLocalEvents,
  tasks = [],
  onToggleTask,
  activePalette,
  darkMode,
  searchQuery = '',
  cardTitle,
  onEditTitle,
}) => {
  const [todayKey, setTodayKey] = useState<string>(() => toDateKey(new Date()));

  useEffect(() => {
    const syncToday = () => {
      const nextKey = toDateKey(new Date());
      setTodayKey((prev) => (prev === nextKey ? prev : nextKey));
    };
    const interval = window.setInterval(syncToday, 30000);
    window.addEventListener('focus', syncToday);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncToday);
    };
  }, []);

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventEntry | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftDate, setDraftDate] = useState<string>(todayKey);
  const [draftTime, setDraftTime] = useState('');
  const [draftEndTime, setDraftEndTime] = useState('');
  const [draftAllDay, setDraftAllDay] = useState(false);
  const [draftLocation, setDraftLocation] = useState('');

  // Google Calendar sync state
  const [calendarToken, setCalendarToken] = useState<string | null>(() =>
    getGoogleCalendarAccessToken()
  );
  const [isFirebaseGoogleUser, setIsFirebaseGoogleUser] = useState<boolean>(() =>
    Boolean(auth.currentUser && !auth.currentUser.isAnonymous)
  );
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Explicit user confirmation modals before mutating Google Calendar
  const [showPushConfirm, setShowPushConfirm] = useState(false);
  const [pendingDeleteGoogleEvent, setPendingDeleteGoogleEvent] =
    useState<CalendarEventEntry | null>(null);
  const [isDeletingRemote, setIsDeletingRemote] = useState(false);

  useEffect(() => {
    setCalendarToken(getGoogleCalendarAccessToken());
    const unsubToken = subscribeGoogleCalendarToken((token) => {
      setCalendarToken(token);
    });
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsFirebaseGoogleUser(Boolean(user && !user.isAnonymous));
    });
    return () => {
      unsubToken();
      unsubAuth();
    };
  }, []);

  const closeEventModal = () => {
    setShowAddForm(false);
    setEditingEvent(null);
    setDraftTitle('');
    setDraftTime('');
    setDraftEndTime('');
    setDraftLocation('');
  };

  const openAddEvent = () => {
    setEditingEvent(null);
    setDraftTitle('');
    setDraftDate(selectedDate);
    setDraftTime('');
    setDraftEndTime('');
    setDraftAllDay(false);
    setDraftLocation('');
    setShowAddForm(true);
  };

  const openEditEvent = (ev: CalendarEventEntry) => {
    setEditingEvent(ev);
    setDraftTitle(ev.title);
    setDraftDate(ev.date);
    setDraftTime(ev.startTime || '');
    setDraftEndTime(ev.endTime || '');
    setDraftAllDay(Boolean(ev.allDay));
    setDraftLocation(ev.location || '');
    setShowAddForm(true);
  };

  const focusMonthForDateKey = (dateKey: string) => {
    const parts = dateKey.split('-').map(Number);
    if (parts.length === 3 && !parts.some(Number.isNaN)) {
      setViewMonth(new Date(parts[0], parts[1] - 1, 1));
    }
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim()) return;
    const targetDate = draftDate || selectedDate;

    const draftPayload = {
      title: draftTitle.trim(),
      date: targetDate,
      startTime: draftAllDay ? undefined : draftTime.trim() || undefined,
      endTime: draftAllDay ? undefined : draftEndTime.trim() || undefined,
      allDay: draftAllDay,
      location: draftLocation.trim() || undefined,
    };

    if (editingEvent) {
      onChangeLocalEvents(
        localEvents.map((item) =>
          item.id === editingEvent.id
            ? {
                ...item,
                ...draftPayload,
              }
            : item
        )
      );
      setSelectedDate(targetDate);
      focusMonthForDateKey(targetDate);
      closeEventModal();
      return;
    }

    const newLocal: CalendarEventEntry = {
      id: `loc-cal-${Date.now()}`,
      ...draftPayload,
      source: 'local',
    };
    onChangeLocalEvents([...localEvents, newLocal]);
    setSelectedDate(targetDate);
    focusMonthForDateKey(targetDate);
    closeEventModal();
  };

  const handleDeleteEvent = (ev: CalendarEventEntry) => {
    if (ev.source === 'google' && ev.googleEventId) {
      setPendingDeleteGoogleEvent(ev);
      return;
    }
    onChangeLocalEvents(localEvents.filter((item) => item.id !== ev.id));
  };

  const handleConfirmDeleteRemoteEvent = async (removeLocalOnly: boolean) => {
    if (!pendingDeleteGoogleEvent) return;
    const target = pendingDeleteGoogleEvent;

    if (removeLocalOnly || !target.googleEventId) {
      onChangeLocalEvents(localEvents.filter((item) => item.id !== target.id));
      setPendingDeleteGoogleEvent(null);
      return;
    }

    setSyncError(null);
    setIsDeletingRemote(true);
    try {
      const token = calendarToken || (await reauthorizeGoogleCalendar());
      await deleteGoogleCalendarEventById(token, target.googleEventId);
      onChangeLocalEvents(localEvents.filter((item) => item.id !== target.id));
      setSyncMessage(`Removed "${target.title}" from Google Calendar.`);
      setPendingDeleteGoogleEvent(null);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Unable to delete Google Calendar event.');
    } finally {
      setIsDeletingRemote(false);
    }
  };

  const handlePullFromGoogle = async () => {
    setSyncError(null);
    setSyncMessage(null);
    setIsSyncingCalendar(true);
    try {
      const token = calendarToken || (await reauthorizeGoogleCalendar());
      const pulled = await pullGoogleCalendarEvents(token);
      onChangeLocalEvents(mergeGoogleAndLocalEvents(localEvents, pulled));
      setSyncMessage(
        `Synced ${pulled.length} Google Calendar ${pulled.length === 1 ? 'event' : 'events'}.`
      );
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Google Calendar sync failed.');
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const localDraftEvents = useMemo(
    () => localEvents.filter((ev) => ev.source !== 'google'),
    [localEvents]
  );

  const timedTasksForSync = useMemo(
    () => extractTimedTasksForCalendar(tasks).filter((t) => !t.task.completed),
    [tasks]
  );

  const handleConfirmPushToGoogle = async () => {
    setShowPushConfirm(false);
    setSyncError(null);
    setSyncMessage(null);
    setIsSyncingCalendar(true);

    try {
      const token = calendarToken || (await reauthorizeGoogleCalendar());
      const { created, updated, mappedGoogleIds } = await pushDashboardItemsToGoogleCalendar({
        accessToken: token,
        localEvents,
        tasks,
      });

      const updatedLocal = localEvents.map((ev) => {
        const mappedId = mappedGoogleIds.get(ev.id);
        return mappedId ? { ...ev, googleEventId: mappedId } : ev;
      });
      const pulled = await pullGoogleCalendarEvents(token);
      onChangeLocalEvents(mergeGoogleAndLocalEvents(updatedLocal, pulled));

      setSyncMessage(
        `Synced to Google Calendar (${created} added, ${updated} updated).`
      );
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to push items to Google Calendar.');
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const visibleEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return localEvents.filter((ev) =>
      !q
        ? true
        : ev.title.toLowerCase().includes(q) ||
          (ev.location || '').toLowerCase().includes(q)
    );
  }, [localEvents, searchQuery]);

  const visibleTimedTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return extractTimedTasksForCalendar(tasks).filter(({ task }) =>
      !q
        ? true
        : task.title.toLowerCase().includes(q) ||
          task.category.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventEntry[]> = {};
    for (const ev of visibleEvents) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [visibleEvents]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Array<{ task: TaskItem; date: string; startTime: string }>> = {};
    for (const item of visibleTimedTasks) {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    }
    return map;
  }, [visibleTimedTasks]);

  const monthCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ dateKey: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ dateKey: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
      });
    }
    return cells;
  }, [viewMonth]);

  const selectedDayEvents = eventsByDate[selectedDate] || [];
  const selectedDayTasks = tasksByDate[selectedDate] || [];
  const googleEventCount = localEvents.filter((ev) => ev.source === 'google').length;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarIcon
              className="w-4 h-4 shrink-0"
              style={{ color: activePalette.primary }}
            />
            {onEditTitle ? (
              <button
                type="button"
                onClick={onEditTitle}
                title="Click to rename card"
                className="min-w-0 text-left cursor-pointer hover:opacity-80 transition"
              >
                <h3
                  className={`text-base font-bold truncate ${
                    darkMode ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  {cardTitle || 'Calendar'}
                </h3>
              </button>
            ) : (
              <h3
                className={`text-base font-bold truncate ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {cardTitle || 'Calendar'}
              </h3>
            )}
          </div>
          <p className={`text-xs truncate tabular-nums ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {localEvents.length} {localEvents.length === 1 ? 'event' : 'events'}
            {visibleTimedTasks.length > 0
              ? ` · ${visibleTimedTasks.length} timed ${
                  visibleTimedTasks.length === 1 ? 'task' : 'tasks'
                }`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isFirebaseGoogleUser && (
            <>
              <button
                type="button"
                onClick={handlePullFromGoogle}
                disabled={isSyncingCalendar}
                className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center gap-1.5 transition ${
                  darkMode
                    ? 'bg-slate-900/40 border-white/15 text-slate-200 hover:bg-white/10'
                    : 'bg-white/75 border-slate-300 text-slate-800 hover:bg-white'
                }`}
                title="Refresh events from Google Calendar"
              >
                {isSyncingCalendar ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: activePalette.primary }} />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                )}
                <span>{calendarToken || googleEventCount > 0 ? 'Google Synced' : 'Sync'}</span>
              </button>

              {(localDraftEvents.length > 0 || timedTasksForSync.length > 0) && (
                <button
                  type="button"
                  onClick={() => setShowPushConfirm(true)}
                  disabled={isSyncingCalendar}
                  className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center gap-1 transition ${
                    darkMode
                      ? 'bg-slate-900/40 border-white/15 text-slate-200 hover:bg-white/10'
                      : 'bg-white/75 border-slate-300 text-slate-800 hover:bg-white'
                  }`}
                  title="Push dashboard events and timed tasks to Google Calendar"
                >
                  <UploadCloud className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                  <span className="hidden sm:inline">Push</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={openAddEvent}
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
            className="w-8 h-8 rounded-xl text-slate-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition shrink-0"
            title="Add calendar event"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {syncError && (
        <div className="px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{syncError}</span>
          </div>
          <button type="button" onClick={() => setSyncError(null)} aria-label="Dismiss sync error">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {syncMessage && (
        <div
          className="px-3 py-1.5 rounded-xl border text-[11px] flex items-center justify-between gap-2 shrink-0"
          style={{
            borderColor: `${activePalette.primary}45`,
            backgroundColor: `${activePalette.primary}15`,
            color: activePalette.primary,
          }}
        >
          <span className="truncate">{syncMessage}</span>
          <button type="button" onClick={() => setSyncMessage(null)} aria-label="Dismiss sync message">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Month Controls */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <span className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
          {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
            }
            className={`p-1 rounded-lg border transition ${
              darkMode
                ? 'border-white/10 text-slate-300 hover:bg-white/10'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const liveKey = toDateKey(now);
              setTodayKey(liveKey);
              setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(liveKey);
            }}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
              darkMode
                ? 'border-white/10 text-slate-300 hover:bg-white/10'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() =>
              setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
            }
            className={`p-1 rounded-lg border transition ${
              darkMode
                ? 'border-white/10 text-slate-300 hover:bg-white/10'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Month Grid */}
      <div className="grid grid-cols-7 gap-1 text-center shrink-0">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, idx) => (
          <div
            key={idx}
            className={`text-[11px] font-semibold pb-1 ${
              darkMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {wd}
          </div>
        ))}
        {monthCells.map((cell, idx) => {
          if (!cell.dateKey || !cell.dayNum) {
            return <div key={`empty-${idx}`} className="h-7" />;
          }
          const isSelected = cell.dateKey === selectedDate;
          const isToday = cell.dateKey === todayKey;
          const dayEventCount = (eventsByDate[cell.dateKey] || []).length;
          const dayTaskCount = (tasksByDate[cell.dateKey] || []).length;
          const hasAnyItem = dayEventCount + dayTaskCount > 0;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => setSelectedDate(cell.dateKey!)}
              className={`relative h-8 rounded-lg text-xs font-mono tabular-nums flex flex-col items-center justify-center transition border ${
                isSelected
                  ? 'text-slate-950 font-bold border-transparent'
                  : isToday
                  ? 'font-bold border-current'
                  : darkMode
                  ? 'border-transparent text-slate-300 hover:bg-white/10'
                  : 'border-transparent text-slate-700 hover:bg-slate-200/60'
              }`}
              style={
                isSelected
                  ? {
                      background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                    }
                  : isToday
                  ? { color: activePalette.primary }
                  : {}
              }
            >
              <span>{cell.dayNum}</span>
              {hasAnyItem && (
                <span className="flex items-center gap-0.5 mt-0.5">
                  {dayEventCount > 0 && (
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{
                        backgroundColor: isSelected ? '#020617' : activePalette.primary,
                      }}
                    />
                  )}
                  {dayTaskCount > 0 && (
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{
                        backgroundColor: isSelected ? '#020617' : activePalette.accent,
                      }}
                    />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add / Edit Event Modal */}
      <DashboardModal
        isOpen={showAddForm}
        onClose={closeEventModal}
        title={
          editingEvent
            ? `Edit Event · ${draftDate || selectedDate}`
            : `New Event · ${draftDate || selectedDate}`
        }
        subtitle={
          editingEvent
            ? 'Update details for this calendar event.'
            : 'Add a calendar event for the selected date.'
        }
        icon={
          editingEvent ? (
            <Pencil className="w-4 h-4" style={{ color: activePalette.primary }} />
          ) : (
            <CalendarIcon className="w-4 h-4" style={{ color: activePalette.primary }} />
          )
        }
        activePalette={activePalette}
        darkMode={darkMode}
      >
        <form onSubmit={handleEventSubmit} className="space-y-3.5">
          <div className="flex items-center justify-between text-xs">
            <label
              className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}
            >
              Event Title
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={draftAllDay}
                onChange={(e) => setDraftAllDay(e.target.checked)}
              />
              <span>All day</span>
            </label>
          </div>

          <input
            type="text"
            required
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="e.g. Linear Algebra Review Session"
            className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none ${
              darkMode
                ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
            style={{ borderColor: `${activePalette.primary}40` }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Date
              </label>
              <input
                type="date"
                required
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Location
              </label>
              <input
                type="text"
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.target.value)}
                placeholder="Optional"
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {!draftAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Start Time <span className="opacity-60">(Optional)</span>
                </label>
                <input
                  type="time"
                  value={draftTime}
                  onChange={(e) => setDraftTime(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                    darkMode
                      ? 'bg-slate-950 border-white/10 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  End Time <span className="opacity-60">(Optional)</span>
                </label>
                <input
                  type="time"
                  value={draftEndTime}
                  onChange={(e) => setDraftEndTime(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                    darkMode
                      ? 'bg-slate-950 border-white/10 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeEventModal}
              className={`px-4 py-2 rounded-xl text-xs transition ${
                darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 shadow hover:opacity-90 transition"
              style={{
                background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
              }}
            >
              {editingEvent ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </form>
      </DashboardModal>

      {/* Push to Google Calendar Confirmation Modal */}
      <DashboardModal
        isOpen={showPushConfirm}
        onClose={() => setShowPushConfirm(false)}
        title="Sync Tasks & Events to Google Calendar"
        subtitle="Review items that will be added or updated in your primary Google Calendar."
        icon={<UploadCloud className="w-4 h-4" style={{ color: activePalette.primary }} />}
        activePalette={activePalette}
        darkMode={darkMode}
      >
        <div className="space-y-3 text-xs">
          <div
            className={`p-3 rounded-xl border space-y-1.5 ${
              darkMode ? 'bg-slate-950/60 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <p className="font-semibold">
              {localDraftEvents.length} dashboard {localDraftEvents.length === 1 ? 'event' : 'events'} &{' '}
              {timedTasksForSync.length} timed {timedTasksForSync.length === 1 ? 'task' : 'tasks'} ready to sync:
            </p>
            <ul className="space-y-1 max-h-40 overflow-y-auto pl-1">
              {localDraftEvents.slice(0, 5).map((ev) => (
                <li key={ev.id} className="truncate">
                  • Event: {ev.title} ({ev.date})
                </li>
              ))}
              {timedTasksForSync.slice(0, 5).map(({ task, date, startTime }) => (
                <li key={task.id} className="truncate">
                  • Task: {task.title} ({date} at {startTime})
                </li>
              ))}
              {localDraftEvents.length + timedTasksForSync.length > 10 && (
                <li className="opacity-70">
                  + {localDraftEvents.length + timedTasksForSync.length - 10} more items
                </li>
              )}
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowPushConfirm(false)}
              className={`px-4 py-2 rounded-xl text-xs transition ${
                darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmPushToGoogle}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 shadow hover:opacity-90 transition"
              style={{
                background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
              }}
            >
              Confirm Sync
            </button>
          </div>
        </div>
      </DashboardModal>

      {/* Delete Google Calendar Event Confirmation Modal */}
      <DashboardModal
        isOpen={Boolean(pendingDeleteGoogleEvent)}
        onClose={() => !isDeletingRemote && setPendingDeleteGoogleEvent(null)}
        title="Delete Google Calendar Event"
        subtitle="Confirm whether to delete this synced event from your Google Calendar."
        icon={<CalendarIcon className="w-4 h-4" style={{ color: activePalette.primary }} />}
        activePalette={activePalette}
        darkMode={darkMode}
      >
        {pendingDeleteGoogleEvent && (
          <div className="space-y-3 text-xs">
            <div
              className={`p-3 rounded-xl border ${
                darkMode ? 'bg-slate-950/60 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <p className="font-semibold">{pendingDeleteGoogleEvent.title}</p>
              <p className="opacity-75 mt-0.5">{pendingDeleteGoogleEvent.date}</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingRemote}
                onClick={() => setPendingDeleteGoogleEvent(null)}
                className={`px-3 py-2 rounded-xl text-xs transition ${
                  darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingRemote}
                onClick={() => handleConfirmDeleteRemoteEvent(true)}
                className={`px-3 py-2 rounded-xl text-xs border transition ${
                  darkMode
                    ? 'border-white/15 text-slate-200 hover:bg-white/10'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Hide Locally
              </button>
              <button
                type="button"
                disabled={isDeletingRemote}
                onClick={() => handleConfirmDeleteRemoteEvent(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 shadow hover:opacity-90 transition flex items-center gap-1.5"
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
              >
                {isDeletingRemote && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete from Google</span>
              </button>
            </div>
          </div>
        )}
      </DashboardModal>

      {/* Selected Day Agenda (Events + Timed Tasks) */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 relative pr-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {selectedDayEvents.map((ev) => (
            <motion.div
              key={ev.id}
              layout="position"
              initial={CARD_ITEM_INITIAL}
              animate={CARD_ITEM_ANIMATE}
              exit={CARD_ITEM_EXIT}
              transition={CARD_ITEM_TRANSITION}
              className="dashboard-item-motion"
            >
              <div className="group/item p-2.5 rounded-xl border transition liquid-glass-tile flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {ev.source === 'google' && (
                      <GoogleGIcon className="w-3 h-3 shrink-0" />
                    )}
                    <span className="text-xs font-semibold truncate">{ev.title}</span>
                  </div>
                  <div
                    className={`text-[11px] tabular-nums flex items-center gap-1.5 ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    <span>
                      {ev.allDay
                        ? 'All day'
                        : ev.startTime
                        ? `${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`
                        : ev.endTime
                        ? `Until ${ev.endTime}`
                        : 'No time set'}
                    </span>
                    {ev.location && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[160px]">{ev.location}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(ev)}
                    className={`p-1 rounded-lg opacity-60 group-hover/item:opacity-100 transition ${
                      darkMode
                        ? 'text-slate-400 hover:text-white hover:bg-white/10'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                    title="Remove event"
                    aria-label="Remove event"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditEvent(ev)}
                    className={`p-1 rounded-lg opacity-60 group-hover/item:opacity-100 transition ${
                      darkMode
                        ? 'text-slate-400 hover:text-white hover:bg-white/10'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                    title="Edit event"
                    aria-label="Edit event"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {selectedDayTasks.map(({ task, startTime }) => (
            <motion.div
              key={`cal-task-${task.id}`}
              layout="position"
              initial={CARD_ITEM_INITIAL}
              animate={CARD_ITEM_ANIMATE}
              exit={CARD_ITEM_EXIT}
              transition={CARD_ITEM_TRANSITION}
              className="dashboard-item-motion"
            >
              <div
                onClick={() => onToggleTask?.(task.id)}
                className={`p-2.5 rounded-xl border transition liquid-glass-tile flex items-center justify-between gap-2 ${
                  onToggleTask ? 'cursor-pointer' : ''
                } ${task.completed ? 'opacity-60' : ''}`}
                style={{ borderColor: `${activePalette.accent}35` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {task.completed ? (
                    <CheckCircle2
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: activePalette.primary }}
                    />
                  ) : (
                    <Circle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-xs font-semibold truncate ${
                          task.completed ? 'line-through' : ''
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] tabular-nums flex items-center gap-1.5 ${
                        darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      <span>{startTime}</span>
                      <span aria-hidden="true">·</span>
                      <span style={{ color: activePalette.primary }}>Task · {task.category}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {selectedDayEvents.length === 0 && selectedDayTasks.length === 0 && (
          <div className="text-center py-4 text-xs text-slate-500">
            No events or timed tasks on {selectedDate}.
          </div>
        )}
      </div>
    </div>
  );
};

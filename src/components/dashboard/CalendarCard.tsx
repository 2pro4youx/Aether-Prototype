import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { CalendarEventEntry, ColorPalette } from '../../types';
import { DashboardModal } from './DashboardModal';

interface CalendarCardProps {
  localEvents: CalendarEventEntry[];
  onChangeLocalEvents: (events: CalendarEventEntry[]) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  searchQuery?: string;
  cardTitle?: string;
  onEditTitle?: () => void;
}

function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const CalendarCard: React.FC<CalendarCardProps> = ({
  localEvents,
  onChangeLocalEvents,
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
  const [draftTime, setDraftTime] = useState('10:00');
  const [draftEndTime, setDraftEndTime] = useState('11:00');
  const [draftAllDay, setDraftAllDay] = useState(false);
  const [draftLocation, setDraftLocation] = useState('');

  const closeEventModal = () => {
    setShowAddForm(false);
    setEditingEvent(null);
    setDraftTitle('');
    setDraftLocation('');
  };

  const openAddEvent = () => {
    setEditingEvent(null);
    setDraftTitle('');
    setDraftDate(selectedDate);
    setDraftTime('10:00');
    setDraftEndTime('11:00');
    setDraftAllDay(false);
    setDraftLocation('');
    setShowAddForm(true);
  };

  const openEditEvent = (ev: CalendarEventEntry) => {
    setEditingEvent(ev);
    setDraftTitle(ev.title);
    setDraftDate(ev.date);
    setDraftTime(ev.startTime || '10:00');
    setDraftEndTime(ev.endTime || '11:00');
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
      startTime: draftAllDay ? undefined : draftTime,
      endTime: draftAllDay ? undefined : draftEndTime,
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
    onChangeLocalEvents(localEvents.filter((item) => item.id !== ev.id));
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

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventEntry[]> = {};
    for (const ev of visibleEvents) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [visibleEvents]);

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

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0">
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
            {localEvents.length} {localEvents.length === 1 ? 'event' : 'events'} scheduled
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
          const dayCount = (eventsByDate[cell.dateKey] || []).length;

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
              {dayCount > 0 && (
                <span
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{
                    backgroundColor: isSelected ? '#020617' : activePalette.primary,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

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
                  Start Time
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
                  End Time
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

      {/* Selected Day Agenda */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
        {selectedDayEvents.map((ev) => (
          <div
            key={ev.id}
            className="group p-2.5 rounded-xl border transition liquid-glass-tile flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
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
                    : 'Scheduled'}
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
                onClick={() => openEditEvent(ev)}
                className={`p-1 rounded-lg opacity-60 group-hover:opacity-100 transition ${
                  darkMode
                    ? 'text-slate-400 hover:text-white hover:bg-white/10'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
                title="Edit event"
                aria-label="Edit event"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteEvent(ev)}
                className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition ${
                  darkMode
                    ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                    : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                }`}
                title="Delete event"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {selectedDayEvents.length === 0 && (
          <div className="text-center py-4 text-xs text-slate-500">
            No events on {selectedDate}.
          </div>
        )}
      </div>
    </div>
  );
};

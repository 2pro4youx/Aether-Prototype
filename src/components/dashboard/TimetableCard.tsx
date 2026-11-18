import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarRange,
  Calendar as CalendarIcon,
  Plus,
  Upload,
  Loader2,
  X,
  Pencil,
  MapPin,
  Download,
  RefreshCw,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';
import {
  TimetableSlot,
  WeekdayShort,
  ColorPalette,
  CalendarEventEntry,
  TaskItem,
} from '../../types';
import { DashboardModal } from './DashboardModal';
import { decodeTimetableImage } from '../../utils/geminiClient';
import {
  extractTimedTasksForCalendar,
  getGoogleCalendarAccessToken,
  mergeGoogleAndLocalEvents,
  pullGoogleCalendarEvents,
  reauthorizeGoogleCalendar,
  subscribeGoogleCalendarToken,
} from '../../utils/googleCalendarSync';
import {
  CARD_ITEM_INITIAL,
  CARD_ITEM_ANIMATE,
  CARD_ITEM_EXIT,
  CARD_ITEM_TRANSITION,
} from './cardItemMotion';

interface TimetableCardProps {
  slots: TimetableSlot[];
  onChangeSlots: (slots: TimetableSlot[]) => void;
  calendarEvents?: CalendarEventEntry[];
  onChangeCalendarEvents?: (events: CalendarEventEntry[]) => void;
  tasks?: TaskItem[];
  activePalette: ColorPalette;
  darkMode: boolean;
  searchQuery?: string;
  cardTitle?: string;
  onEditTitle?: () => void;
}

const WEEKDAYS: WeekdayShort[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const JS_DAY_TO_WEEKDAY: WeekdayShort[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTodayShort(): WeekdayShort {
  return JS_DAY_TO_WEEKDAY[new Date().getDay()];
}

function dateKeyToWeekday(dateKey: string): WeekdayShort {
  const parts = dateKey.split('-').map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    if (!Number.isNaN(dt.getTime())) {
      return JS_DAY_TO_WEEKDAY[dt.getDay()];
    }
  }
  return getTodayShort();
}

function normalizeWeekday(raw: unknown, fallback: WeekdayShort): WeekdayShort {
  const s = String(raw || '').trim().toLowerCase();
  if (s.startsWith('mon')) return 'Mon';
  if (s.startsWith('tue')) return 'Tue';
  if (s.startsWith('wed')) return 'Wed';
  if (s.startsWith('thu')) return 'Thu';
  if (s.startsWith('fri')) return 'Fri';
  if (s.startsWith('sat')) return 'Sat';
  if (s.startsWith('sun')) return 'Sun';
  return fallback;
}

function normalizeSlotKind(raw: unknown): TimetableSlot['kind'] {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('lab') || s.includes('practical')) return 'Lab';
  if (s.includes('tut')) return 'Tutorial';
  if (s.includes('study') || s.includes('self') || s.includes('prep')) return 'Study';
  return 'Lecture';
}

interface SyncableCandidate {
  key: string;
  itemType: 'event' | 'task';
  isGoogleEvent: boolean;
  day: WeekdayShort;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  room?: string;
  kind: TimetableSlot['kind'];
  metaLabel: string;
}

export const TimetableCard: React.FC<TimetableCardProps> = ({
  slots,
  onChangeSlots,
  calendarEvents = [],
  onChangeCalendarEvents,
  tasks = [],
  activePalette,
  darkMode,
  searchQuery = '',
  cardTitle,
  onEditTitle,
}) => {
  const todayShort = getTodayShort();
  const [selectedDay, setSelectedDay] = useState<WeekdayShort>(todayShort);
  const [showAdd, setShowAdd] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  const [day, setDay] = useState<WeekdayShort>(todayShort);
  const [subject, setSubject] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [room, setRoom] = useState('');
  const [kind, setKind] = useState<TimetableSlot['kind']>('Lecture');

  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [decodeInfo, setDecodeInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Google Calendar & Tasks sync menu state
  const [showCalendarSyncModal, setShowCalendarSyncModal] = useState(false);
  const [syncTab, setSyncTab] = useState<'all' | 'events' | 'tasks'>('all');
  const [showSyncedInTimetable, setShowSyncedInTimetable] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aether_timetable_show_synced_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [selectedImportKeys, setSelectedImportKeys] = useState<Set<string>>(new Set());
  const [isRefreshingGoogle, setIsRefreshingGoogle] = useState(false);
  const [isFirebaseGoogleUser, setIsFirebaseGoogleUser] = useState<boolean>(() =>
    Boolean(auth.currentUser && !auth.currentUser.isAnonymous)
  );
  const [calendarToken, setCalendarToken] = useState<string | null>(() =>
    getGoogleCalendarAccessToken()
  );

  useEffect(() => {
    try {
      localStorage.setItem('aether_timetable_show_synced_v1', String(showSyncedInTimetable));
    } catch {
      // Ignore storage errors
    }
  }, [showSyncedInTimetable]);

  useEffect(() => {
    setCalendarToken(getGoogleCalendarAccessToken());
    const unsubToken = subscribeGoogleCalendarToken((token) => setCalendarToken(token));
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsFirebaseGoogleUser(Boolean(user && !user.isAnonymous));
    });
    return () => {
      unsubToken();
      unsubAuth();
    };
  }, []);

  const closeSlotModal = () => {
    setShowAdd(false);
    setEditingSlotId(null);
    setSubject('');
    setRoom('');
    setStartTime('');
    setEndTime('');
    setKind('Lecture');
  };

  const openAddSlot = () => {
    setEditingSlotId(null);
    setDay(selectedDay || todayShort);
    setSubject('');
    setStartTime('');
    setEndTime('');
    setRoom('');
    setKind('Lecture');
    setShowAdd(true);
  };

  const openEditSlot = (slot: TimetableSlot) => {
    setEditingSlotId(slot.id);
    setDay(slot.day);
    setSubject(slot.subject);
    setStartTime(slot.startTime || '');
    setEndTime(slot.endTime || '');
    setRoom(slot.room || '');
    setKind(slot.kind);
    setShowAdd(true);
  };

  const sortTimetableSlots = (list: TimetableSlot[]): TimetableSlot[] =>
    [...list].sort((a, b) => {
      const dayDiff = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    });

  const handleAddOrUpdateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    const slotFields = {
      day,
      subject: subject.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      room: room.trim() || undefined,
      kind,
    };

    const nextList = editingSlotId
      ? slots.map((s) => (s.id === editingSlotId ? { ...s, ...slotFields } : s))
      : [...slots, { id: `tt-${Date.now()}`, ...slotFields }];

    onChangeSlots(sortTimetableSlots(nextList));
    closeSlotModal();
    setSelectedDay(day);
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setDecodeError(null);
    setDecodeInfo(null);
    setIsDecoding(true);

    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read selected image file.'));
        reader.readAsDataURL(file);
      });

      const payload = await decodeTimetableImage({
        imageDataUrl: dataUrl,
        mimeType: file.type || 'image/png',
      });

      const decodedList = Array.isArray(payload.slots) ? payload.slots : [];
      if (decodedList.length === 0) {
        setDecodeError(
          'No timetable blocks could be detected in that photo. Try a clearer crop or add manually.'
        );
      } else {
        const created: TimetableSlot[] = decodedList.map((item: any, idx: number) => ({
          id: `tt-${Date.now()}-${idx}`,
          day: normalizeWeekday(item.day, selectedDay),
          subject: String(item.subject || 'Class').trim() || 'Class',
          startTime: String(item.startTime || '').trim(),
          endTime: String(item.endTime || '').trim(),
          room: item.room ? String(item.room).trim() || undefined : undefined,
          kind: normalizeSlotKind(item.kind),
        }));

        onChangeSlots(sortTimetableSlots([...slots, ...created]));
        if (!created.some((s) => s.day === selectedDay) && created[0]) {
          setSelectedDay(created[0].day);
        }
        setDecodeInfo(
          `Decoded ${created.length} timetable ${created.length === 1 ? 'session' : 'sessions'} from photo.`
        );
      }
    } catch (err: any) {
      setDecodeError(err?.message || 'Error decoding timetable image.');
    } finally {
      setIsDecoding(false);
    }
  };

  const handleDeleteSlot = (id: string) => {
    onChangeSlots(slots.filter((s) => s.id !== id));
  };

  // Build syncable candidates from Calendar events and Tasks
  const syncableCandidates = useMemo<SyncableCandidate[]>(() => {
    const items: SyncableCandidate[] = [];

    for (const ev of calendarEvents) {
      items.push({
        key: `ev:${ev.id}`,
        itemType: 'event',
        isGoogleEvent: ev.source === 'google',
        day: dateKeyToWeekday(ev.date),
        date: ev.date,
        title: ev.title,
        startTime: ev.allDay ? '' : ev.startTime || '',
        endTime: ev.allDay ? '' : ev.endTime || '',
        room: ev.location || undefined,
        kind: 'Lecture',
        metaLabel: ev.source === 'google' ? 'Google Event' : 'Calendar Event',
      });
    }

    const timedTasks = extractTimedTasksForCalendar(tasks);
    const timedIds = new Set(timedTasks.map((t) => t.task.id));

    for (const { task, date, startTime: taskStart } of timedTasks) {
      if (task.completed) continue;
      items.push({
        key: `task:${task.id}`,
        itemType: 'task',
        isGoogleEvent: false,
        day: dateKeyToWeekday(date),
        date,
        title: task.title,
        startTime: taskStart,
        endTime: '',
        room: task.category || undefined,
        kind: 'Study',
        metaLabel: `Task · ${task.category}`,
      });
    }

    // Also surface pending untimed tasks in the import modal so user can import any task
    for (const task of tasks) {
      if (task.completed || timedIds.has(task.id)) continue;
      items.push({
        key: `task:${task.id}`,
        itemType: 'task',
        isGoogleEvent: false,
        day: selectedDay,
        date: 'No due date',
        title: task.title,
        startTime: '',
        endTime: '',
        room: task.category || undefined,
        kind: 'Study',
        metaLabel: `Task · ${task.category}`,
      });
    }

    return items.sort((a, b) => {
      if (a.date === 'No due date' && b.date !== 'No due date') return 1;
      if (b.date === 'No due date' && a.date !== 'No due date') return -1;
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    });
  }, [calendarEvents, tasks, selectedDay]);

  const modalFilteredCandidates = useMemo(() => {
    return syncableCandidates.filter((item) => {
      if (syncTab === 'events' && item.itemType !== 'event') return false;
      if (syncTab === 'tasks' && item.itemType !== 'task') return false;
      return true;
    });
  }, [syncableCandidates, syncTab]);

  const isAlreadyInTimetable = (item: SyncableCandidate) =>
    slots.some(
      (s) =>
        s.day === item.day &&
        s.subject.trim().toLowerCase() === item.title.trim().toLowerCase() &&
        (s.startTime || '') === (item.startTime || '')
    );

  const importCandidatesToTimetable = (items: SyncableCandidate[]) => {
    const newSlots: TimetableSlot[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const duplicateInExisting = isAlreadyInTimetable(item);
      const duplicateInBatch = newSlots.some(
        (s) =>
          s.day === item.day &&
          s.subject.trim().toLowerCase() === item.title.trim().toLowerCase() &&
          (s.startTime || '') === (item.startTime || '')
      );
      if (duplicateInExisting || duplicateInBatch) continue;

      newSlots.push({
        id: `tt-imp-${Date.now()}-${i}`,
        day: item.day,
        subject: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        room: item.room,
        kind: item.kind,
      });
    }

    if (newSlots.length === 0) {
      setDecodeInfo('Selected events/tasks are already in your weekly timetable.');
      return;
    }

    onChangeSlots(sortTimetableSlots([...slots, ...newSlots]));
    setSelectedImportKeys(new Set());
    if (!newSlots.some((s) => s.day === selectedDay) && newSlots[0]) {
      setSelectedDay(newSlots[0].day);
    }
    setDecodeInfo(
      `Imported ${newSlots.length} ${newSlots.length === 1 ? 'item' : 'items'} into your weekly timetable.`
    );
  };

  const handleRefreshGoogleInModal = async () => {
    if (!onChangeCalendarEvents) return;
    setDecodeError(null);
    setDecodeInfo(null);
    setIsRefreshingGoogle(true);
    try {
      const token = calendarToken || (await reauthorizeGoogleCalendar());
      const pulled = await pullGoogleCalendarEvents(token);
      onChangeCalendarEvents(mergeGoogleAndLocalEvents(calendarEvents, pulled));
      setDecodeInfo(
        `Refreshed ${pulled.length} Google Calendar ${pulled.length === 1 ? 'event' : 'events'}.`
      );
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : 'Unable to refresh Google Calendar.');
    } finally {
      setIsRefreshingGoogle(false);
    }
  };

  const toggleSelectImportKey = (key: string) => {
    setSelectedImportKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredSlots = slots.filter((s) => {
    if (s.day !== selectedDay) return false;
    if (
      q &&
      !s.subject.toLowerCase().includes(q) &&
      !(s.room || '').toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  // Optional inline overlay items for the selected weekday when Show Synced is toggled on
  const inlineSyncedForSelectedDay = useMemo(() => {
    if (!showSyncedInTimetable) return [];
    return syncableCandidates.filter((item) => {
      if (item.day !== selectedDay) return false;
      if (item.date === 'No due date') return false;
      if (isAlreadyInTimetable(item)) return false;
      if (q && !item.title.toLowerCase().includes(q) && !(item.room || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [showSyncedInTimetable, syncableCandidates, selectedDay, slots, q]);

  const nowHHMM = `${String(new Date().getHours()).padStart(2, '0')}:${String(
    new Date().getMinutes()
  ).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-3 sm:gap-4 h-full min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      <div className="flex items-center justify-between gap-2 shrink-0 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <CalendarRange
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
                  className={`text-sm sm:text-base font-bold truncate ${
                    darkMode ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  {cardTitle || 'Weekly Timetable'}
                </h3>
              </button>
            ) : (
              <h3
                className={`text-sm sm:text-base font-bold truncate ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {cardTitle || 'Weekly Timetable'}
              </h3>
            )}
          </div>
          <p
            className={`text-[11px] sm:text-xs tabular-nums truncate ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <span className="sm:hidden">
              {slots.length} {slots.length === 1 ? 'session' : 'sessions'} · {todayShort}
            </span>
            <span className="hidden sm:inline">
              {slots.length} {slots.length === 1 ? 'session' : 'sessions'} · Today is {todayShort}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCalendarSyncModal(true)}
            className={`w-8 h-8 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border flex items-center justify-center sm:gap-1.5 transition whitespace-nowrap ${
              showSyncedInTimetable
                ? 'border-current'
                : darkMode
                ? 'bg-slate-900/40 border-white/15 text-slate-200 hover:bg-white/10'
                : 'bg-white/70 border-slate-300 text-slate-800 hover:bg-white'
            }`}
            style={
              showSyncedInTimetable
                ? {
                    borderColor: `${activePalette.primary}60`,
                    backgroundColor: `${activePalette.primary}18`,
                    color: activePalette.primary,
                  }
                : {}
            }
            title="Sync, view, or import Google Calendar events and tasks"
            aria-label="Google Calendar Sync"
          >
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" style={{ color: activePalette.primary }} />
            <span className="hidden sm:inline">Google Sync</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDecoding}
            className={`w-8 h-8 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border flex items-center justify-center sm:gap-1.5 transition whitespace-nowrap ${
              darkMode
                ? 'bg-slate-900/40 border-white/15 text-slate-200 hover:bg-white/10'
                : 'bg-white/70 border-slate-300 text-slate-800 hover:bg-white'
            }`}
            title="Upload timetable photo to decode automatically"
            aria-label="Upload Timetable Photo"
          >
            {isDecoding ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ color: activePalette.primary }} />
            ) : (
              <Upload className="w-3.5 h-3.5 shrink-0" style={{ color: activePalette.primary }} />
            )}
            <span className="hidden sm:inline">{isDecoding ? 'Decoding...' : 'Upload Photo'}</span>
          </button>

          <button
            type="button"
            onClick={openAddSlot}
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
            className="w-8 h-8 rounded-xl text-slate-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition shrink-0"
            title="Add timetable block"
            aria-label="Add timetable block"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {decodeError && (
        <div className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-between gap-2 shrink-0">
          <span>{decodeError}</span>
          <button type="button" onClick={() => setDecodeError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {decodeInfo && (
        <div
          className="px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 shrink-0"
          style={{
            borderColor: `${activePalette.primary}45`,
            backgroundColor: `${activePalette.primary}15`,
            color: activePalette.primary,
          }}
        >
          <span>{decodeInfo}</span>
          <button type="button" onClick={() => setDecodeInfo(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Day Filter Tabs (No Week Sort, No Scrollbar) */}
      <div
        className={`grid grid-cols-7 gap-0.5 sm:gap-1 p-1 rounded-xl border shrink-0 ${
          darkMode ? 'bg-slate-900/20 border-white/10' : 'bg-white/25 border-slate-200/60'
        }`}
      >
        {WEEKDAYS.map((d) => {
          const active = selectedDay === d;
          const countForDay = slots.filter((s) => s.day === d).length;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(d)}
              className={`px-0.5 sm:px-1 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition flex flex-col sm:flex-row items-center justify-center gap-0.5 min-w-0 leading-none ${
                active
                  ? ''
                  : darkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              style={
                active
                  ? {
                      backgroundColor: `${activePalette.primary}25`,
                      color: activePalette.primary,
                    }
                  : {}
              }
            >
              <span className="truncate">{d}</span>
              {countForDay > 0 && (
                <>
                  <span
                    className="sm:hidden w-1 h-1 rounded-full"
                    style={{ backgroundColor: active ? activePalette.primary : 'currentColor', opacity: 0.75 }}
                  />
                  <span className="hidden sm:inline text-[10px] opacity-80 tabular-nums">({countForDay})</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Add / Edit Slot Modal */}
      <DashboardModal
        isOpen={showAdd}
        onClose={closeSlotModal}
        title={editingSlotId ? 'Edit Timetable Class / Block' : 'Add Timetable Class / Block'}
        subtitle="Schedule a recurring weekday lecture, lab, tutorial, or study session."
        icon={
          editingSlotId ? (
            <Pencil className="w-4 h-4" style={{ color: activePalette.primary }} />
          ) : (
            <CalendarRange className="w-4 h-4" style={{ color: activePalette.primary }} />
          )
        }
        activePalette={activePalette}
        darkMode={darkMode}
      >
        <form onSubmit={handleAddOrUpdateSlot} className="space-y-3.5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Weekday
              </label>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value as WeekdayShort)}
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Subject / Course
              </label>
              <input
                type="text"
                required
                autoFocus
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Quantum Mechanics II"
                className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                style={{ borderColor: `${activePalette.primary}40` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-full px-2.5 py-2 rounded-xl text-xs border focus:outline-none ${
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
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-full px-2.5 py-2 rounded-xl text-xs border focus:outline-none ${
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
                Room
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Room"
                className={`w-full px-2.5 py-2 rounded-xl text-xs border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Type
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as TimetableSlot['kind'])}
                className={`w-full px-2.5 py-2 rounded-xl text-xs border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="Lecture">Lecture</option>
                <option value="Lab">Lab</option>
                <option value="Tutorial">Tutorial</option>
                <option value="Study">Study</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeSlotModal}
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
              {editingSlotId ? 'Save Changes' : 'Save Block'}
            </button>
          </div>
        </form>
      </DashboardModal>

      {/* Google Calendar Events & Tasks Sync Modal */}
      <DashboardModal
        isOpen={showCalendarSyncModal}
        onClose={() => setShowCalendarSyncModal(false)}
        title="Google Calendar & Tasks"
        subtitle="View your synced calendar events and tasks, display them inside the timetable, or import them."
        icon={<CalendarIcon className="w-4 h-4" style={{ color: activePalette.primary }} />}
        activePalette={activePalette}
        darkMode={darkMode}
      >
        <div className="space-y-3.5 text-xs">
          {/* Show Inline Toggle & Refresh Controls */}
          <div
            className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
              darkMode ? 'bg-slate-950/60 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowSyncedInTimetable((prev) => !prev)}
              className="flex items-center gap-2 text-left font-medium"
            >
              {showSyncedInTimetable ? (
                <Eye className="w-4 h-4 shrink-0" style={{ color: activePalette.primary }} />
              ) : (
                <EyeOff
                  className={`w-4 h-4 shrink-0 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                />
              )}
              <div>
                <div className={darkMode ? 'text-slate-100' : 'text-slate-900'}>
                  {showSyncedInTimetable
                    ? 'Showing Calendar events & tasks inside Timetable'
                    : 'Show Calendar events & tasks inside Timetable'}
                </div>
                <div className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Displays matching day events & timed tasks right alongside classes
                </div>
              </div>
            </button>

            {isFirebaseGoogleUser && onChangeCalendarEvents && (
              <button
                type="button"
                onClick={handleRefreshGoogleInModal}
                disabled={isRefreshingGoogle}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition ${
                  darkMode
                    ? 'border-white/15 text-slate-200 hover:bg-white/10'
                    : 'border-slate-300 text-slate-800 hover:bg-white'
                }`}
              >
                {isRefreshingGoogle ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: activePalette.primary }} />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                )}
                <span>Refresh</span>
              </button>
            )}
          </div>

          {/* Filter Tabs: All / Events / Tasks */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className={`inline-flex items-center gap-1 p-1 rounded-xl border ${
                darkMode ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100 border-slate-200'
              }`}
            >
              {(
                [
                  { id: 'all', label: `All (${syncableCandidates.length})` },
                  {
                    id: 'events',
                    label: `Events (${syncableCandidates.filter((c) => c.itemType === 'event').length})`,
                  },
                  {
                    id: 'tasks',
                    label: `Tasks (${syncableCandidates.filter((c) => c.itemType === 'task').length})`,
                  },
                ] as const
              ).map((tab) => {
                const active = syncTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSyncTab(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      active
                        ? ''
                        : darkMode
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: `${activePalette.primary}25`,
                            color: activePalette.primary,
                          }
                        : {}
                    }
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {selectedImportKeys.size > 0 && (
              <button
                type="button"
                onClick={() =>
                  importCandidatesToTimetable(
                    syncableCandidates.filter((item) => selectedImportKeys.has(item.key))
                  )
                }
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-950 flex items-center gap-1.5 shadow"
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Import Selected ({selectedImportKeys.size})</span>
              </button>
            )}
          </div>

          {/* List of Events & Tasks */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {modalFilteredCandidates.length === 0 ? (
              <div
                className={`py-8 text-center rounded-xl border ${
                  darkMode
                    ? 'border-white/10 text-slate-400'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                No synced calendar events or pending tasks found yet.
              </div>
            ) : (
              modalFilteredCandidates.map((item) => {
                const imported = isAlreadyInTimetable(item);
                const checked = selectedImportKeys.has(item.key);
                return (
                  <div
                    key={item.key}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                      darkMode
                        ? 'bg-slate-950/40 border-white/10'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        disabled={imported}
                        onClick={() => toggleSelectImportKey(item.key)}
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                          imported
                            ? 'opacity-40 cursor-not-allowed'
                            : checked
                            ? 'border-transparent text-slate-950'
                            : darkMode
                            ? 'border-white/25 hover:border-white/50'
                            : 'border-slate-300 hover:border-slate-500'
                        }`}
                        style={
                          checked && !imported
                            ? { backgroundColor: activePalette.primary }
                            : {}
                        }
                        aria-label={`Select ${item.title}`}
                      >
                        {(checked || imported) && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>

                      <div className="min-w-0">
                        <p
                          className={`font-semibold truncate ${
                            darkMode ? 'text-slate-100' : 'text-slate-900'
                          }`}
                        >
                          {item.title}
                        </p>
                        <div
                          className={`text-[11px] flex flex-wrap items-center gap-x-1.5 ${
                            darkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          <span style={{ color: activePalette.primary }}>{item.day}</span>
                          <span>·</span>
                          <span>{item.date}</span>
                          {item.startTime && (
                            <>
                              <span>·</span>
                              <span className="tabular-nums">
                                {item.startTime}
                                {item.endTime ? `–${item.endTime}` : ''}
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span>{item.metaLabel}</span>
                        </div>
                      </div>
                    </div>

                    {imported ? (
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => importCandidatesToTimetable([item])}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition shrink-0 flex items-center gap-1 ${
                          darkMode
                            ? 'border-white/15 text-slate-200 hover:bg-white/10'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Download className="w-3 h-3" style={{ color: activePalette.primary }} />
                        <span>Import</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bulk Import Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={
                  syncableCandidates.filter((c) => c.itemType === 'event' && !isAlreadyInTimetable(c))
                    .length === 0
                }
                onClick={() =>
                  importCandidatesToTimetable(
                    syncableCandidates.filter((c) => c.itemType === 'event')
                  )
                }
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition disabled:opacity-40 ${
                  darkMode
                    ? 'border-white/15 text-slate-200 hover:bg-white/10'
                    : 'border-slate-300 text-slate-800 hover:bg-slate-100'
                }`}
              >
                Import All Events
              </button>
              <button
                type="button"
                disabled={
                  syncableCandidates.filter((c) => c.itemType === 'task' && !isAlreadyInTimetable(c))
                    .length === 0
                }
                onClick={() =>
                  importCandidatesToTimetable(
                    syncableCandidates.filter((c) => c.itemType === 'task')
                  )
                }
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition disabled:opacity-40 ${
                  darkMode
                    ? 'border-white/15 text-slate-200 hover:bg-white/10'
                    : 'border-slate-300 text-slate-800 hover:bg-slate-100'
                }`}
              >
                Import All Tasks
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCalendarSyncModal(false)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold ${
                darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </DashboardModal>

      <div className="flex flex-col gap-2 relative flex-1 min-h-0 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {filteredSlots.map((slot) => {
            const isNow = Boolean(
              slot.day === todayShort &&
                slot.startTime &&
                slot.endTime &&
                nowHHMM >= slot.startTime &&
                nowHHMM <= slot.endTime
            );
            const timeLabel =
              slot.startTime && slot.endTime
                ? `${slot.startTime}–${slot.endTime}`
                : slot.startTime
                ? `From ${slot.startTime}`
                : slot.endTime
                ? `Until ${slot.endTime}`
                : 'Flexible';

            return (
              <motion.div
                key={slot.id}
                layout="position"
                initial={CARD_ITEM_INITIAL}
                animate={CARD_ITEM_ANIMATE}
                exit={CARD_ITEM_EXIT}
                transition={CARD_ITEM_TRANSITION}
                className="dashboard-item-motion"
              >
                <div
                  className="group/item p-2.5 sm:p-3 rounded-xl border transition liquid-glass-tile flex items-center justify-between gap-2 sm:gap-3"
                  style={isNow ? { borderColor: activePalette.primary } : {}}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="text-[11px] sm:text-xs font-mono font-semibold tabular-nums shrink-0 w-[72px] sm:w-24">
                      <div style={{ color: activePalette.primary }} className="truncate">{timeLabel}</div>
                      <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
                        {slot.kind}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <p
                          className={`text-xs sm:text-sm font-semibold truncate ${
                            darkMode ? 'text-slate-100' : 'text-slate-900'
                          }`}
                        >
                          {slot.subject}
                        </p>
                        {isNow && (
                          <span
                            className="text-[10px] sm:text-[11px] font-bold shrink-0"
                            style={{ color: activePalette.primary }}
                          >
                            Now
                          </span>
                        )}
                      </div>
                      {slot.room && (
                        <p
                          className={`text-[11px] sm:text-xs flex items-center gap-1 truncate ${
                            darkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{slot.room}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDeleteSlot(slot.id)}
                      className={`p-1 rounded-lg opacity-60 group-hover/item:opacity-100 transition ${
                        darkMode
                          ? 'text-slate-400 hover:text-white hover:bg-white/10'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                      }`}
                      title="Remove class block"
                      aria-label="Remove class block"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditSlot(slot)}
                      className={`p-1 rounded-lg opacity-60 group-hover/item:opacity-100 transition ${
                        darkMode
                          ? 'text-slate-400 hover:text-white hover:bg-white/10'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                      }`}
                      title="Edit class block"
                      aria-label="Edit class block"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {inlineSyncedForSelectedDay.map((item) => (
            <motion.div
              key={`tt-inline-${item.key}`}
              layout="position"
              initial={CARD_ITEM_INITIAL}
              animate={CARD_ITEM_ANIMATE}
              exit={CARD_ITEM_EXIT}
              transition={CARD_ITEM_TRANSITION}
              className="dashboard-item-motion"
            >
              <div
                className="p-2.5 sm:p-3 rounded-xl border border-dashed transition liquid-glass-tile flex items-center justify-between gap-2 sm:gap-3"
                style={{ borderColor: `${activePalette.primary}45` }}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="text-[11px] sm:text-xs font-mono font-semibold tabular-nums shrink-0 w-[72px] sm:w-24">
                    <div style={{ color: activePalette.primary }} className="truncate">
                      {item.startTime
                        ? item.endTime
                          ? `${item.startTime}–${item.endTime}`
                          : item.startTime
                        : 'All day'}
                    </div>
                    <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
                      {item.itemType === 'event' ? 'Event' : 'Task'}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs sm:text-sm font-semibold truncate ${
                        darkMode ? 'text-slate-200' : 'text-slate-800'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p
                      className={`text-[10px] sm:text-[11px] truncate ${
                        darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {item.metaLabel} · {item.date}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => importCandidatesToTimetable([item])}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition shrink-0 flex items-center gap-1 ${
                    darkMode
                      ? 'border-white/15 text-slate-200 hover:bg-white/10'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Import into weekly timetable"
                >
                  <Download className="w-3 h-3" style={{ color: activePalette.primary }} />
                  <span className="hidden sm:inline">Import</span>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredSlots.length === 0 && inlineSyncedForSelectedDay.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-4 sm:py-8 px-2 sm:px-4 gap-2.5 sm:gap-3">
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {`No timetable sessions for ${selectedDay} yet.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowCalendarSyncModal(true)}
                className={`px-2.5 py-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-semibold border transition flex items-center gap-1.5 ${
                  darkMode
                    ? 'bg-slate-900/40 border-white/15 text-slate-200 hover:bg-white/10'
                    : 'bg-white/70 border-slate-300 text-slate-800 hover:bg-white'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                <span className="sm:hidden">Sync</span>
                <span className="hidden sm:inline">Sync Google Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isDecoding}
                className={`px-2.5 py-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-semibold border transition flex items-center gap-1.5 ${
                  darkMode
                    ? 'bg-slate-900/40 border-white/15 text-slate-200 hover:bg-white/10'
                    : 'bg-white/70 border-slate-300 text-slate-800 hover:bg-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                <span className="sm:hidden">Photo</span>
                <span className="hidden sm:inline">Upload Timetable Photo</span>
              </button>
              <button
                type="button"
                onClick={openAddSlot}
                className="px-3 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-950 transition hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
              >
                <span className="sm:hidden">+ Add Block</span>
                <span className="hidden sm:inline">Add Class / Block</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

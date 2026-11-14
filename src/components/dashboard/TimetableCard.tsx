import React, { useState } from 'react';
import { CalendarRange, Plus, Trash2, Pencil, MapPin } from 'lucide-react';
import { TimetableSlot, WeekdayShort, ColorPalette } from '../../types';
import { DashboardModal } from './DashboardModal';

interface TimetableCardProps {
  slots: TimetableSlot[];
  onChangeSlots: (slots: TimetableSlot[]) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  searchQuery?: string;
  cardTitle?: string;
  onEditTitle?: () => void;
}

const WEEKDAYS: WeekdayShort[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getTodayShort(): WeekdayShort {
  const map: WeekdayShort[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return map[new Date().getDay()];
}

export const TimetableCard: React.FC<TimetableCardProps> = ({
  slots,
  onChangeSlots,
  activePalette,
  darkMode,
  searchQuery = '',
  cardTitle,
  onEditTitle,
}) => {
  const todayShort = getTodayShort();
  const [selectedDay, setSelectedDay] = useState<WeekdayShort | 'ALL'>(todayShort);
  const [showAdd, setShowAdd] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  const [day, setDay] = useState<WeekdayShort>(todayShort);
  const [subject, setSubject] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');
  const [kind, setKind] = useState<TimetableSlot['kind']>('Lecture');

  const closeSlotModal = () => {
    setShowAdd(false);
    setEditingSlotId(null);
    setSubject('');
    setRoom('');
    setStartTime('09:00');
    setEndTime('10:00');
    setKind('Lecture');
  };

  const openAddSlot = () => {
    setEditingSlotId(null);
    setDay(selectedDay !== 'ALL' ? selectedDay : todayShort);
    setSubject('');
    setStartTime('09:00');
    setEndTime('10:00');
    setRoom('');
    setKind('Lecture');
    setShowAdd(true);
  };

  const openEditSlot = (slot: TimetableSlot) => {
    setEditingSlotId(slot.id);
    setDay(slot.day);
    setSubject(slot.subject);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setRoom(slot.room || '');
    setKind(slot.kind);
    setShowAdd(true);
  };

  const handleAddOrUpdateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    const slotFields = {
      day,
      subject: subject.trim(),
      startTime: startTime || '09:00',
      endTime: endTime || '10:00',
      room: room.trim() || undefined,
      kind,
    };

    const nextList = editingSlotId
      ? slots.map((s) => (s.id === editingSlotId ? { ...s, ...slotFields } : s))
      : [...slots, { id: `tt-${Date.now()}`, ...slotFields }];

    const sorted = [...nextList].sort((a, b) => {
      const dayDiff = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
    onChangeSlots(sorted);
    closeSlotModal();
    setSelectedDay(day);
  };

  const handleDeleteSlot = (id: string) => {
    onChangeSlots(slots.filter((s) => s.id !== id));
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredSlots = slots.filter((s) => {
    if (selectedDay !== 'ALL' && s.day !== selectedDay) return false;
    if (
      q &&
      !s.subject.toLowerCase().includes(q) &&
      !(s.room || '').toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const nowHHMM = `${String(new Date().getHours()).padStart(2, '0')}:${String(
    new Date().getMinutes()
  ).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
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
                  className={`text-base font-bold truncate ${
                    darkMode ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  {cardTitle || 'Weekly Timetable'}
                </h3>
              </button>
            ) : (
              <h3
                className={`text-base font-bold truncate ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {cardTitle || 'Weekly Timetable'}
              </h3>
            )}
          </div>
          <p
            className={`text-xs tabular-nums ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {slots.length} {slots.length === 1 ? 'session' : 'sessions'} · Today is {todayShort}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openAddSlot}
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
            className="w-8 h-8 rounded-xl text-slate-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition shrink-0"
            title="Add timetable block"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Day Filter Tabs */}
      <div
        className={`flex items-center gap-1 p-1 rounded-xl border overflow-x-auto shrink-0 ${
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
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
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
              {d}
              {countForDay > 0 ? ` (${countForDay})` : ''}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSelectedDay('ALL')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            selectedDay === 'ALL'
              ? ''
              : darkMode
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          style={
            selectedDay === 'ALL'
              ? {
                  backgroundColor: `${activePalette.primary}25`,
                  color: activePalette.primary,
                }
              : {}
          }
        >
          Week
        </button>
      </div>

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
                Start Time
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
                End Time
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

      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
        {filteredSlots.map((slot) => {
          const isNow =
            slot.day === todayShort &&
            nowHHMM >= slot.startTime &&
            nowHHMM <= slot.endTime;

          return (
            <div
              key={slot.id}
              className="group p-3 rounded-xl border transition liquid-glass-tile flex items-center justify-between gap-3"
              style={isNow ? { borderColor: activePalette.primary } : {}}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-xs font-mono font-semibold tabular-nums shrink-0 w-24">
                  <div style={{ color: activePalette.primary }}>
                    {slot.startTime}–{slot.endTime}
                  </div>
                  <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
                    {selectedDay === 'ALL' ? `${slot.day} · ${slot.kind}` : slot.kind}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-semibold truncate ${
                        darkMode ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      {slot.subject}
                    </p>
                    {isNow && (
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: activePalette.primary }}
                      >
                        Now
                      </span>
                    )}
                  </div>
                  {slot.room && (
                    <p
                      className={`text-xs flex items-center gap-1 ${
                        darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      <span>{slot.room}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditSlot(slot)}
                  className={`p-1 rounded-lg opacity-60 group-hover:opacity-100 transition ${
                    darkMode
                      ? 'text-slate-400 hover:text-white hover:bg-white/10'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                  title="Edit class block"
                  aria-label="Edit class block"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSlot(slot.id)}
                  className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition ${
                    darkMode
                      ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="Remove class block"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredSlots.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-3">
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {selectedDay === 'ALL'
                ? 'No weekly classes or study blocks scheduled yet.'
                : `No timetable sessions for ${selectedDay} yet.`}
            </p>
            <button
              type="button"
              onClick={openAddSlot}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-950 transition hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
              }}
            >
              Add Class / Block
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

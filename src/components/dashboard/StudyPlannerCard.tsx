import React, { useState } from 'react';
import { Clock, Plus, Trash2, Pencil, ArrowUpRight } from 'lucide-react';
import { PlannerEntry, ColorPalette } from '../../types';
import { DashboardModal } from './DashboardModal';

interface StudyPlannerCardProps {
  planners: PlannerEntry[];
  onAddPlanner: (entry: Omit<PlannerEntry, 'id'>) => void;
  onUpdateProgress: (id: string, progress: number) => void;
  onUpdatePlanner?: (id: string, updates: Partial<Omit<PlannerEntry, 'id'>>) => void;
  onDeletePlanner: (id: string) => void;
  onOpenStudio?: () => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  searchQuery?: string;
  cardTitle?: string;
  onEditTitle?: () => void;
}

export const StudyPlannerCard: React.FC<StudyPlannerCardProps> = ({
  planners,
  onAddPlanner,
  onUpdateProgress,
  onUpdatePlanner,
  onDeletePlanner,
  onOpenStudio,
  activePalette,
  darkMode,
  searchQuery = '',
  cardTitle,
  onEditTitle,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingPlannerId, setEditingPlannerId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [date, setDate] = useState('');
  const [milestone, setMilestone] = useState('');

  const q = searchQuery.trim().toLowerCase();
  const filtered = planners.filter((p) =>
    !q
      ? true
      : p.title.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.milestone.toLowerCase().includes(q)
  );

  const closePlannerModal = () => {
    setShowAdd(false);
    setEditingPlannerId(null);
    setTitle('');
    setSubject('');
    setTimeSlot('');
    setDate('');
    setMilestone('');
  };

  const openAddPlanner = () => {
    setEditingPlannerId(null);
    setTitle('');
    setSubject('');
    setTimeSlot('');
    setDate('');
    setMilestone('');
    setShowAdd(true);
  };

  const openEditPlanner = (p: PlannerEntry) => {
    setEditingPlannerId(p.id);
    setTitle(p.title);
    setSubject(p.subject);
    setTimeSlot(p.timeSlot);
    setDate(p.date);
    setMilestone(p.milestone);
    setShowAdd(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (editingPlannerId && onUpdatePlanner) {
      onUpdatePlanner(editingPlannerId, {
        title: title.trim(),
        subject: subject.trim() || 'General',
        timeSlot: timeSlot.trim() || 'Flexible',
        date: date.trim() || 'Ongoing',
        milestone: milestone.trim() || 'Complete target review',
      });
    } else {
      onAddPlanner({
        title: title.trim(),
        subject: subject.trim() || 'General',
        timeSlot: timeSlot.trim() || 'Flexible',
        date: date.trim() || 'Ongoing',
        milestone: milestone.trim() || 'Complete target review',
        progress: 0,
      });
    }
    closePlannerModal();
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 shrink-0" style={{ color: activePalette.primary }} />
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
                {cardTitle || 'Study Planner'}
              </h3>
            </button>
          ) : (
            <h3
              className={`text-base font-bold truncate ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {cardTitle || 'Study Planner'}
            </h3>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenStudio && (
            <button
              type="button"
              onClick={onOpenStudio}
              style={{ color: activePalette.primary }}
              className="text-xs font-semibold flex items-center gap-1 transition hover:opacity-80 whitespace-nowrap"
            >
              <span>Studio</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={openAddPlanner}
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
            className="w-8 h-8 rounded-xl text-slate-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition shrink-0"
            title="Add study sprint or plan"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

      <DashboardModal
        isOpen={showAdd}
        onClose={closePlannerModal}
        title={editingPlannerId ? 'Edit Study Sprint / Plan' : 'Add Study Sprint / Plan'}
        subtitle="Define a subject block, schedule window, and measurable target milestone."
        icon={
          editingPlannerId ? (
            <Pencil className="w-4 h-4" style={{ color: activePalette.primary }} />
          ) : (
            <Clock className="w-4 h-4" style={{ color: activePalette.primary }} />
          )
        }
        activePalette={activePalette}
        darkMode={darkMode}
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label
              className={`block text-xs font-medium mb-1 ${
                darkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Study Sprint / Plan Title
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Transformer Architecture Revision"
              className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none ${
                darkMode
                  ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
              style={{ borderColor: `${activePalette.primary}40` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
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
                Time Slot
              </label>
              <input
                type="text"
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                placeholder="09:00 - 11:00"
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
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
                Target Date
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. Nov 18"
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-xs font-medium mb-1 ${
                darkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Target Milestone
            </label>
            <input
              type="text"
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
              placeholder="Specific outcome or problem set to finish..."
              className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                darkMode
                  ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={closePlannerModal}
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
              {editingPlannerId ? 'Save Changes' : 'Save Study Plan'}
            </button>
          </div>
        </form>
      </DashboardModal>

      <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="p-4 rounded-xl border space-y-2.5 transition group liquid-glass-tile"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <h4
                  className={`text-sm font-semibold truncate ${
                    darkMode ? 'text-slate-200' : 'text-slate-800'
                  }`}
                >
                  {p.title}
                </h4>
                <p className="text-xs font-medium truncate" style={{ color: activePalette.primary }}>
                  {p.subject} · {p.timeSlot}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-xs font-mono font-bold tabular-nums mr-0.5 ${
                    darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {p.progress}%
                </span>
                <button
                  type="button"
                  onClick={() => openEditPlanner(p)}
                  className={`p-1 rounded-lg opacity-60 group-hover:opacity-100 transition ${
                    darkMode
                      ? 'text-slate-400 hover:text-white hover:bg-white/10'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                  title="Edit study plan"
                  aria-label="Edit study plan"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePlanner(p.id)}
                  className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition ${
                    darkMode
                      ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="Delete study plan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                  darkMode ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${p.progress}%`,
                    background: `linear-gradient(to right, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={p.progress}
                onChange={(e) => onUpdateProgress(p.id, Number(e.target.value))}
                className="w-20 accent-current cursor-pointer"
                style={{ color: activePalette.primary }}
                aria-label={`Update progress for ${p.title}`}
              />
            </div>

            <div
              className={`flex items-center justify-between text-[11px] pt-0.5 ${
                darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <span className="truncate max-w-[240px]">Target: {p.milestone}</span>
              <span className="font-mono tabular-nums">{p.date}</span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-3">
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              No active study plans yet. Create sprints with time slots and milestone tracking.
            </p>
            <button
              type="button"
              onClick={openAddPlanner}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-950 transition hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
              }}
            >
              Create First Study Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

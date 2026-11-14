import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Circle, Trash2, Clock, Pencil } from 'lucide-react';
import confetti from 'canvas-confetti';
import { TaskItem, ColorPalette } from '../../types';
import { DashboardModal } from './DashboardModal';

interface TasksCardProps {
  tasks: TaskItem[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (
    title: string,
    category: string,
    priority: 'low' | 'medium' | 'high',
    dueAt?: string | null
  ) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Omit<TaskItem, 'id'>>) => void;
  onUpdateTaskDueAt?: (taskId: string, dueAt: string | null) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  searchQuery?: string;
  cardTitle?: string;
  onEditTitle?: () => void;
}

function formatTimeRemaining(dueAt: string, nowMs: number, completed: boolean): {
  label: string;
  tone: 'normal' | 'soon' | 'overdue' | 'done';
} {
  const targetMs = new Date(dueAt).getTime();
  if (Number.isNaN(targetMs)) {
    return { label: 'No time until completion', tone: 'normal' };
  }
  if (completed) {
    return {
      label: `Target ${new Date(targetMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · Completed`,
      tone: 'done',
    };
  }
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    const overdueMin = Math.floor(Math.abs(diffMs) / 60000);
    if (overdueMin < 60) {
      return { label: `Overdue by ${Math.max(1, overdueMin)}m`, tone: 'overdue' };
    }
    const overdueHrs = Math.floor(overdueMin / 60);
    if (overdueHrs < 24) {
      return { label: `Overdue by ${overdueHrs}h ${overdueMin % 60}m`, tone: 'overdue' };
    }
    const overdueDays = Math.floor(overdueHrs / 24);
    return { label: `Overdue by ${overdueDays}d`, tone: 'overdue' };
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) {
    return { label: `${days}d ${hrs}h left until completion`, tone: 'normal' };
  }
  if (hrs > 0) {
    return {
      label: `${hrs}h ${mins}m left until completion`,
      tone: hrs < 2 ? 'soon' : 'normal',
    };
  }
  return {
    label: `${mins}m ${String(secs).padStart(2, '0')}s left until completion`,
    tone: 'soon',
  };
}

export const TasksCard: React.FC<TasksCardProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  activePalette,
  darkMode,
  searchQuery = '',
  cardTitle,
  onEditTitle,
}) => {
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Study');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [enableDeadline, setEnableDeadline] = useState(false);
  const [newTaskDueAt, setNewTaskDueAt] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const hasTimedTask = tasks.some((t) => Boolean(t.dueAt) && !t.completed);

  useEffect(() => {
    if (!hasTimedTask) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [hasTimedTask]);

  const completedTasks = tasks.filter((t) => t.completed).length;
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const q = searchQuery.trim().toLowerCase();
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'pending' && t.completed) return false;
    if (taskFilter === 'completed' && !t.completed) return false;
    if (q && !t.title.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  const handleTaskCheck = (taskId: string, wasCompleted: boolean) => {
    onToggleTask(taskId);
    if (!wasCompleted) {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.8 },
        colors: [activePalette.primary, activePalette.accent, '#ffffff'],
      });
    }
  };

  const applyPresetHours = (hours: number) => {
    const dt = new Date(Date.now() + hours * 3600 * 1000);
    const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEnableDeadline(true);
    setNewTaskDueAt(localIso);
  };

  const closeTaskModal = () => {
    setShowAddTaskModal(false);
    setEditingTaskId(null);
    setNewTaskTitle('');
    setNewTaskCategory('Study');
    setNewTaskPriority('medium');
    setEnableDeadline(false);
    setNewTaskDueAt('');
  };

  const openAddTaskModal = () => {
    setEditingTaskId(null);
    setNewTaskTitle('');
    setNewTaskCategory('Study');
    setNewTaskPriority('medium');
    setEnableDeadline(false);
    setNewTaskDueAt('');
    setShowAddTaskModal(true);
  };

  const openEditTaskModal = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskCategory(task.category || 'Study');
    setNewTaskPriority(task.priority);
    if (task.dueAt) {
      const dt = new Date(task.dueAt);
      if (!Number.isNaN(dt.getTime())) {
        const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setEnableDeadline(true);
        setNewTaskDueAt(localIso);
      } else {
        setEnableDeadline(false);
        setNewTaskDueAt('');
      }
    } else {
      setEnableDeadline(false);
      setNewTaskDueAt('');
    }
    setShowAddTaskModal(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const finalDueAt =
      enableDeadline && newTaskDueAt ? new Date(newTaskDueAt).toISOString() : null;
    if (editingTaskId && onUpdateTask) {
      onUpdateTask(editingTaskId, {
        title: newTaskTitle.trim(),
        category: newTaskCategory.trim() || 'General',
        priority: newTaskPriority,
        dueDate: finalDueAt ? 'Timed' : 'No time until completion',
        dueAt: finalDueAt,
      });
    } else {
      onAddTask(
        newTaskTitle.trim(),
        newTaskCategory.trim() || 'General',
        newTaskPriority,
        finalDueAt
      );
    }
    closeTaskModal();
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: activePalette.primary }} />
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
                  {cardTitle || 'Daily Study Tasks & Chores'}
                </h3>
              </button>
            ) : (
              <h3
                className={`text-base font-bold truncate ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {cardTitle || 'Daily Study Tasks & Chores'}
              </h3>
            )}
          </div>
          <p
            className={`text-xs tabular-nums ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {completedTasks} of {tasks.length} tasks completed ({taskProgress}%)
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`flex items-center gap-1 p-0.5 rounded-lg border text-xs ${
              darkMode ? 'bg-slate-900/20 border-white/10' : 'bg-white/20 border-slate-200/50'
            }`}
          >
            <button
              type="button"
              onClick={() => setTaskFilter('all')}
              className={`px-2.5 py-1 rounded-md transition whitespace-nowrap ${
                taskFilter === 'all'
                  ? 'font-semibold'
                  : darkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              style={
                taskFilter === 'all'
                  ? { backgroundColor: `${activePalette.primary}25`, color: activePalette.primary }
                  : {}
              }
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTaskFilter('pending')}
              className={`px-2.5 py-1 rounded-md transition whitespace-nowrap ${
                taskFilter === 'pending'
                  ? 'font-semibold'
                  : darkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              style={
                taskFilter === 'pending'
                  ? { backgroundColor: `${activePalette.primary}25`, color: activePalette.primary }
                  : {}
              }
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setTaskFilter('completed')}
              className={`px-2.5 py-1 rounded-md transition whitespace-nowrap ${
                taskFilter === 'completed'
                  ? 'font-semibold'
                  : darkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              style={
                taskFilter === 'completed'
                  ? { backgroundColor: `${activePalette.primary}25`, color: activePalette.primary }
                  : {}
              }
            >
              Done
            </button>
          </div>

          <button
            type="button"
            onClick={openAddTaskModal}
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
            className="w-8 h-8 rounded-xl text-slate-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition shrink-0"
            title="Add Chore or Study Task"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className={`w-full h-1.5 rounded-full overflow-hidden shrink-0 ${
          darkMode ? 'bg-slate-800/80' : 'bg-slate-200'
        }`}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${taskProgress}%`,
            background: `linear-gradient(to right, ${activePalette.primary}, ${activePalette.accent})`,
          }}
        />
      </div>

      {/* Task List */}
      <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {filteredTasks.map((task) => {
          const countdown = task.dueAt
            ? formatTimeRemaining(task.dueAt, nowMs, task.completed)
            : { label: 'No time until completion', tone: 'normal' as const };

          return (
            <div
              key={task.id}
              onClick={() => handleTaskCheck(task.id, task.completed)}
              className={`group flex items-start justify-between gap-3 p-3.5 rounded-xl border transition cursor-pointer select-none liquid-glass-tile ${
                task.completed ? 'opacity-65' : ''
              }`}
              style={!task.completed ? { borderColor: `${activePalette.primary}25` } : {}}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  className="mt-0.5 shrink-0 transition"
                  style={{ color: activePalette.primary }}
                  aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Circle
                      className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}
                    />
                  )}
                </button>

                <div className="space-y-1 min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium leading-snug truncate ${
                      task.completed
                        ? darkMode
                          ? 'line-through text-slate-500'
                          : 'line-through text-slate-400'
                        : darkMode
                        ? 'text-slate-200'
                        : 'text-slate-800'
                    }`}
                  >
                    {task.title}
                  </p>
                  <div
                    className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    <span className="font-semibold" style={{ color: activePalette.primary }}>
                      {task.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span
                        className={
                          countdown.tone === 'overdue'
                            ? 'text-red-400 font-medium'
                            : countdown.tone === 'soon'
                            ? 'text-amber-400 font-medium'
                            : ''
                        }
                      >
                        {countdown.label}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                <span
                  className={`text-[11px] font-semibold capitalize mr-0.5 ${
                    task.priority === 'high'
                      ? 'text-red-400'
                      : task.priority === 'medium'
                      ? 'text-amber-400'
                      : darkMode
                      ? 'text-slate-400'
                      : 'text-slate-500'
                  }`}
                >
                  {task.priority}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditTaskModal(task);
                  }}
                  className={`p-1 rounded-lg opacity-60 group-hover:opacity-100 transition ${
                    darkMode
                      ? 'text-slate-400 hover:text-white hover:bg-white/10'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                  title="Edit task"
                  aria-label="Edit task"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition ${
                    darkMode
                      ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-3">
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {tasks.length === 0
                ? 'No study tasks or chores yet. Add your first task with optional completion countdown.'
                : 'No tasks match the selected filter.'}
            </p>
            {tasks.length === 0 && (
              <button
                type="button"
                onClick={openAddTaskModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-950 transition hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
              >
                Add First Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Chore / Task Full-Page Modal */}
      <DashboardModal
        isOpen={showAddTaskModal}
        onClose={closeTaskModal}
        title={editingTaskId ? 'Edit Chore / Study Task' : 'Add Chore / Study Task'}
        subtitle="Optionally attach a deadline countdown or keep no time until completion."
        icon={
          editingTaskId ? (
            <Pencil className="w-4 h-4" style={{ color: activePalette.primary }} />
          ) : (
            <Plus className="w-4 h-4" style={{ color: activePalette.primary }} />
          )
        }
        activePalette={activePalette}
        darkMode={darkMode}
      >
        <form onSubmit={handleSaveTask} className="space-y-3.5">
          <div>
            <label
              className={`block text-xs font-medium mb-1 ${
                darkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Task Title
            </label>
            <input
              type="text"
              required
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="e.g. Derive Backpropagation for LayerNorm..."
              className={`w-full px-3 py-2 rounded-xl text-sm focus:outline-none border ${
                darkMode
                  ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400'
              }`}
              style={{ borderColor: `${activePalette.primary}40` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Subject / Category
              </label>
              <input
                type="text"
                value={newTaskCategory}
                onChange={(e) => setNewTaskCategory(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none border ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Priority
              </label>
              <select
                value={newTaskPriority}
                onChange={(e) =>
                  setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')
                }
                className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none border ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Time Until Completion (defaulted to No time until completion) */}
          <div
            className={`p-3 rounded-xl border space-y-2.5 ${
              darkMode ? 'bg-slate-950/60 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-medium flex items-center gap-1.5 ${
                  darkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                <span>Time until completion</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !enableDeadline;
                  setEnableDeadline(next);
                  if (next && !newTaskDueAt) {
                    applyPresetHours(2);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                  enableDeadline
                    ? 'text-slate-950 border-transparent'
                    : darkMode
                    ? 'bg-slate-900 border-white/10 text-slate-300'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
                style={
                  enableDeadline
                    ? {
                        background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                      }
                    : {}
                }
              >
                {enableDeadline ? 'Target Set' : 'No time until completion'}
              </button>
            </div>

            {enableDeadline && (
              <div className="space-y-2">
                <input
                  type="datetime-local"
                  value={newTaskDueAt}
                  onChange={(e) => setNewTaskDueAt(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none border ${
                    darkMode
                      ? 'bg-slate-900 border-white/15 text-slate-100'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '+1h', hrs: 1 },
                    { label: '+3h', hrs: 3 },
                    { label: '+24h', hrs: 24 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPresetHours(p.hrs)}
                      className={`px-2 py-0.5 rounded-md text-[11px] border transition ${
                        darkMode
                          ? 'border-white/10 text-slate-300 hover:bg-white/10'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeTaskModal}
              className={`px-4 py-2 rounded-xl text-xs transition ${
                darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
              }}
              className="px-4 py-2 rounded-xl text-slate-950 font-bold text-xs shadow hover:opacity-90 transition"
            >
              {editingTaskId ? 'Save Changes' : 'Add Chore'}
            </button>
          </div>
        </form>
      </DashboardModal>
    </div>
  );
};

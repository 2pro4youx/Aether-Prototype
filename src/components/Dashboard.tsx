import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Flame,
  ArrowUpRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StudyDay, TaskItem, PlannerEntry, ColorPalette } from '../types';

interface DashboardProps {
  studyDays: StudyDay[];
  tasks: TaskItem[];
  planners: PlannerEntry[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (title: string, category: string, priority: 'low' | 'medium' | 'high') => void;
  onOpenNotebookLM: () => void;
  onOpenOneNote: () => void;
  onSearchSelect: (query: string) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  studyDays,
  tasks,
  planners,
  onToggleTask,
  onAddTask,
  onOpenNotebookLM,
  onOpenOneNote,
  onSearchSelect,
  activePalette,
  darkMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Deep Learning');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('high');
  const [hoveredDay, setHoveredDay] = useState<StudyDay | null>(null);
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Study hours summary calculations
  const { totalHours, maxStreak, currentStreak } = useMemo(() => {
    let hours = 0;
    let days = 0;
    let streak = 0;
    let max = 0;
    let curStreak = 0;

    for (const d of studyDays) {
      if (d.hours > 0) {
        hours += d.hours;
        days++;
        streak++;
        if (streak > max) max = streak;
      } else {
        streak = 0;
      }
    }

    for (let i = studyDays.length - 1; i >= 0; i--) {
      if (studyDays[i].hours > 0) curStreak++;
      else break;
    }

    return {
      totalHours: +hours.toFixed(1),
      totalDaysStudied: days,
      maxStreak: max,
      currentStreak: curStreak,
    };
  }, [studyDays]);

  const completedTasks = tasks.filter((t) => t.completed).length;
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'pending') return !t.completed;
    if (taskFilter === 'completed') return t.completed;
    return true;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(newTaskTitle.trim(), newTaskCategory, newTaskPriority);
    setNewTaskTitle('');
    setShowAddTaskModal(false);
  };

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

  return (
    <div className="relative min-h-screen pt-28 pb-16 px-4 sm:px-8 lg:px-12 max-w-[1720px] w-full mx-auto space-y-8 transition-colors duration-300">
      {/* Top Welcome & Search Header */}
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
            <span>Neural Research Command · {activePalette.name}</span>
          </div>
          <h1
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            Student Knowledge Dashboard
          </h1>
          <p
            className={`text-sm mt-1 ${
              darkMode ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            Grounded synthesis, daily study hour telemetry, and fluid OneNote workspaces.
          </p>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-full md:w-88">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearchSelect(e.target.value);
            }}
            placeholder="Search notes, sources, planners..."
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 liquid-glass shadow-inner transition ${
              darkMode
                ? 'bg-slate-950/20 border-white/10 text-slate-100 placeholder-slate-400'
                : 'bg-white/90 border-slate-300 text-slate-900 placeholder-slate-500'
            }`}
            style={{ borderColor: `${activePalette.primary}40` }}
          />
        </div>
      </div>

      {/* GitHub-style 365-Day Study Hours Heatmap Tile */}
      <div className="liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: activePalette.primary }} />
              <h2
                className={`text-lg font-bold ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                Annual Study Activity & Hours Matrix
              </h2>
            </div>
            <p
              className={`text-xs ${
                darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              365-day continuous learning velocity ledger tracking deep study intervals.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                darkMode ? 'bg-slate-900/20 border-white/10 text-slate-300' : 'bg-white/25 border-slate-200/60 text-slate-700'
              }`}
            >
              <span className="font-bold tabular-nums" style={{ color: activePalette.primary }}>
                {totalHours}h
              </span>{' '}
              Total
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                darkMode ? 'bg-slate-900/20 border-white/10 text-slate-300' : 'bg-white/25 border-slate-200/60 text-slate-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" style={{ color: activePalette.accent }} />
              <span className="font-bold tabular-nums" style={{ color: activePalette.primary }}>
                {currentStreak}
              </span>{' '}
              Day Streak
            </div>
          </div>
        </div>

        {/* Heatmap Grid (52 weeks horizontal, 7 days vertical) */}
        <div className="overflow-x-auto pb-2 pt-1">
          <div className="min-w-[760px]">
            <div className="grid grid-flow-col grid-rows-7 gap-1">
              {studyDays.map((day) => {
                let cellStyle: React.CSSProperties = {
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)',
                  borderColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)',
                };

                if (day.count === 1) {
                  cellStyle = {
                    backgroundColor: `${activePalette.primary}35`,
                    borderColor: `${activePalette.primary}50`,
                  };
                } else if (day.count === 2) {
                  cellStyle = {
                    backgroundColor: `${activePalette.primary}70`,
                    borderColor: `${activePalette.primary}90`,
                  };
                } else if (day.count === 3) {
                  cellStyle = {
                    backgroundColor: activePalette.primary,
                    borderColor: activePalette.primary,
                    boxShadow: `0 0 8px ${activePalette.primary}40`,
                  };
                } else if (day.count === 4) {
                  cellStyle = {
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                    borderColor: activePalette.accent,
                    boxShadow: `0 0 10px ${activePalette.accent}60`,
                  };
                }

                return (
                  <div
                    key={day.date}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="w-3.5 h-3.5 rounded-[3px] border transition-transform duration-150 hover:scale-125 cursor-pointer"
                    style={cellStyle}
                    title={`${day.date}: ${day.hours} study hours`}
                  />
                );
              })}
            </div>

            {/* Hover Tooltip bar & legend */}
            <div
              className={`flex items-center justify-between pt-3 text-xs ${
                darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <div className="min-h-[20px] font-mono">
                {hoveredDay ? (
                  <span style={{ color: activePalette.primary }} className="font-medium">
                    {hoveredDay.date} — {hoveredDay.hours} hours logged ({hoveredDay.count > 0 ? 'Active Session' : 'Rest Day'})
                  </span>
                ) : (
                  <span>Hover over any tile to inspect daily study hours</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span>Less</span>
                <span
                  className="w-3 h-3 rounded-[2px] border"
                  style={{
                    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)',
                  }}
                />
                <span
                  className="w-3 h-3 rounded-[2px] border"
                  style={{ backgroundColor: `${activePalette.primary}40` }}
                />
                <span
                  className="w-3 h-3 rounded-[2px] border"
                  style={{ backgroundColor: `${activePalette.primary}80` }}
                />
                <span
                  className="w-3 h-3 rounded-[2px] border"
                  style={{ backgroundColor: activePalette.primary }}
                />
                <span
                  className="w-3 h-3 rounded-[2px] border"
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                />
                <span>More</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout (Interactive Checklist & Active Planners) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Tasks & Chore Checklist (7 cols) */}
        <div className="lg:col-span-7 liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-5 overflow-hidden smooth-scroll-contain">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: activePalette.primary }} />
                <h3
                  className={`text-base font-bold ${
                    darkMode ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  Daily Study Tasks & Chores
                </h3>
              </div>
              <p
                className={`text-xs ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {completedTasks} of {tasks.length} tasks completed ({taskProgress}%)
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter tabs */}
              <div
                className={`flex items-center gap-1 p-0.5 rounded-lg border text-xs ${
                  darkMode ? 'bg-slate-900/20 border-white/10' : 'bg-white/20 border-slate-200/50'
                }`}
              >
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition ${
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
                  onClick={() => setTaskFilter('pending')}
                  className={`px-2.5 py-1 rounded-md transition ${
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
                  onClick={() => setTaskFilter('completed')}
                  className={`px-2.5 py-1 rounded-md transition ${
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

              {/* Dominant '+' icon to add chore to checklist */}
              <button
                onClick={() => setShowAddTaskModal(true)}
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
                className="w-8 h-8 rounded-xl text-slate-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition"
                title="Add Chore or Task to Checklist"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            className={`w-full h-1.5 rounded-full overflow-hidden ${
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
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleTaskCheck(task.id, task.completed)}
                className={`group flex items-start justify-between gap-3 p-3.5 rounded-xl border transition cursor-pointer select-none liquid-glass-tile ${
                  task.completed
                    ? 'opacity-60'
                    : ''
                }`}
                style={
                  !task.completed
                    ? { borderColor: `${activePalette.primary}25` }
                    : {}
                }
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    className="mt-0.5 shrink-0 transition"
                    style={{ color: activePalette.primary }}
                    aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Circle className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0">
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
                      className={`flex items-center gap-2 text-xs ${
                        darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      <span className="font-semibold" style={{ color: activePalette.primary }}>
                        {task.category}
                      </span>
                      <span>·</span>
                      <span>Due {task.dueDate}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      task.priority === 'high'
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : task.priority === 'medium'
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}

            {filteredTasks.length === 0 && (
              <div
                className={`text-center py-8 text-xs ${
                  darkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                No tasks match the selected filter.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Weekly Planners & Study Milestones (5 cols) */}
        <div className="lg:col-span-5 liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-5 overflow-hidden smooth-scroll-contain">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: activePalette.primary }} />
              <h3
                className={`text-base font-bold ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                Active Study Planners
              </h3>
            </div>
            <button
              onClick={onOpenNotebookLM}
              style={{ color: activePalette.primary }}
              className="text-xs font-semibold flex items-center gap-1 transition hover:opacity-80"
            >
              <span>Open Studio</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {planners.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border space-y-3 transition group liquid-glass-tile"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4
                      className={`text-sm font-semibold transition ${
                        darkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-800 group-hover:text-slate-950'
                      }`}
                    >
                      {p.title}
                    </h4>
                    <p className="text-xs font-medium" style={{ color: activePalette.primary }}>
                      {p.subject} · {p.timeSlot}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold tabular-nums ${
                      darkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {p.progress}%
                  </span>
                </div>

                <div
                  className={`w-full h-1.5 rounded-full overflow-hidden ${
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

                <div
                  className={`flex items-center justify-between text-[11px] pt-0.5 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <span className="truncate max-w-[200px]">Target: {p.milestone}</span>
                  <span className="font-mono">{p.date}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Launch Cards */}
          <div className="pt-2 grid grid-cols-2 gap-3">
            <button
              onClick={onOpenNotebookLM}
              className="p-3.5 rounded-xl border text-left space-y-1 transition group liquid-glass-tile cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <BookOpen className="w-4 h-4" style={{ color: activePalette.primary }} />
                <ArrowUpRight
                  className="w-3.5 h-3.5 transition group-hover:translate-x-0.5"
                  style={{ color: activePalette.primary }}
                />
              </div>
              <p className={`text-xs font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                Google NotebookLM
              </p>
              <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Grounded Multi-Source AI
              </p>
            </button>

            <button
              onClick={onOpenOneNote}
              className="p-3.5 rounded-xl border text-left space-y-1 transition group liquid-glass-tile cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <Sparkles className="w-4 h-4" style={{ color: activePalette.accent }} />
                <ArrowUpRight
                  className="w-3.5 h-3.5 transition group-hover:translate-x-0.5"
                  style={{ color: activePalette.accent }}
                />
              </div>
              <p className={`text-xs font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                OneNote Rich Blocks
              </p>
              <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Hyprland Slide Canvas
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Add Chore Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className={`liquid-glass rounded-2xl p-6 border w-full max-w-md shadow-2xl flex flex-col gap-4 ${
              darkMode ? 'bg-slate-900/95 border-white/20' : 'bg-white/95 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3
                className={`text-base font-bold flex items-center gap-2 ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                <Plus className="w-4 h-4" style={{ color: activePalette.primary }} />
                <span>Add Chore / Study Task</span>
              </h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className={`text-xs ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
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
                    onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
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

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
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
                  Add Chore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

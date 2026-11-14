import React, { useState } from 'react';
import { BookOpen, Plus, CheckCircle2, Circle, Trash2, Pencil } from 'lucide-react';
import { SyllabusCourse, ColorPalette } from '../../types';
import { DashboardModal } from './DashboardModal';

interface SyllabusCardProps {
  courses: SyllabusCourse[];
  onChangeCourses: (courses: SyllabusCourse[]) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  searchQuery?: string;
  cardTitle?: string;
  onEditTitle?: () => void;
}

export const SyllabusCard: React.FC<SyllabusCardProps> = ({
  courses,
  onChangeCourses,
  activePalette,
  darkMode,
  searchQuery = '',
  cardTitle,
  onEditTitle,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<{
    courseId: string;
    topicId: string;
    title: string;
  } | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [topicsInput, setTopicsInput] = useState('');
  const [inlineTopic, setInlineTopic] = useState('');

  const activeCourse =
    courses.find((c) => c.id === selectedCourseId) || courses[0] || null;

  const totalTopics = courses.reduce((sum, c) => sum + c.topics.length, 0);
  const completedTopics = courses.reduce(
    (sum, c) => sum + c.topics.filter((t) => t.completed).length,
    0
  );
  const overallPct =
    totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const closeCourseModal = () => {
    setShowAddCourse(false);
    setEditingCourseId(null);
    setCourseName('');
    setCourseCode('');
    setTopicsInput('');
  };

  const openAddCourse = () => {
    setEditingCourseId(null);
    setCourseName('');
    setCourseCode('');
    setTopicsInput('');
    setShowAddCourse(true);
  };

  const openEditCourse = (course: SyllabusCourse) => {
    setEditingCourseId(course.id);
    setCourseName(course.name);
    setCourseCode(course.code || '');
    setTopicsInput('');
    setShowAddCourse(true);
  };

  const handleAddOrUpdateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;

    if (editingCourseId) {
      onChangeCourses(
        courses.map((c) =>
          c.id === editingCourseId
            ? {
                ...c,
                name: courseName.trim(),
                code: courseCode.trim() || undefined,
              }
            : c
        )
      );
      closeCourseModal();
      return;
    }

    const rawLines = topicsInput
      .split(/\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const newCourse: SyllabusCourse = {
      id: `syl-${Date.now()}`,
      name: courseName.trim(),
      code: courseCode.trim() || undefined,
      topics: rawLines.map((title, idx) => ({
        id: `top-${Date.now()}-${idx}`,
        title,
        completed: false,
      })),
    };

    const next = [...courses, newCourse];
    onChangeCourses(next);
    setSelectedCourseId(newCourse.id);
    closeCourseModal();
  };

  const handleSaveTopicTitle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic || !editingTopic.title.trim()) return;
    onChangeCourses(
      courses.map((c) =>
        c.id === editingTopic.courseId
          ? {
              ...c,
              topics: c.topics.map((t) =>
                t.id === editingTopic.topicId ? { ...t, title: editingTopic.title.trim() } : t
              ),
            }
          : c
      )
    );
    setEditingTopic(null);
  };

  const handleAddTopicToCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !inlineTopic.trim()) return;
    const items = inlineTopic
      .split(/\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = courses.map((c) =>
      c.id === activeCourse.id
        ? {
            ...c,
            topics: [
              ...c.topics,
              ...items.map((title, i) => ({
                id: `top-${Date.now()}-${i}`,
                title,
                completed: false,
              })),
            ],
          }
        : c
    );
    onChangeCourses(updated);
    setInlineTopic('');
  };

  const handleToggleTopic = (courseId: string, topicId: string) => {
    onChangeCourses(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              topics: c.topics.map((t) =>
                t.id === topicId ? { ...t, completed: !t.completed } : t
              ),
            }
          : c
      )
    );
  };

  const handleDeleteTopic = (courseId: string, topicId: string) => {
    onChangeCourses(
      courses.map((c) =>
        c.id === courseId
          ? { ...c, topics: c.topics.filter((t) => t.id !== topicId) }
          : c
      )
    );
  };

  const handleDeleteCourse = (courseId: string) => {
    const next = courses.filter((c) => c.id !== courseId);
    onChangeCourses(next);
    if (selectedCourseId === courseId) {
      setSelectedCourseId(next[0]?.id || '');
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const visibleTopics = (activeCourse?.topics || []).filter((t) =>
    !q ? true : t.title.toLowerCase().includes(q)
  );

  const coursePct =
    activeCourse && activeCourse.topics.length > 0
      ? Math.round(
          (activeCourse.topics.filter((t) => t.completed).length /
            activeCourse.topics.length) *
            100
        )
      : 0;

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 shrink-0" style={{ color: activePalette.primary }} />
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
                  {cardTitle || 'Syllabus Tracker'}
                </h3>
              </button>
            ) : (
              <h3
                className={`text-base font-bold truncate ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {cardTitle || 'Syllabus Tracker'}
              </h3>
            )}
          </div>
          <p
            className={`text-xs tabular-nums ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {courses.length} {courses.length === 1 ? 'course' : 'courses'} · {completedTopics}/
            {totalTopics} topics ({overallPct}%)
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openAddCourse}
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
            className="w-8 h-8 rounded-xl text-slate-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition shrink-0"
            title="Add course syllabus"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

      <DashboardModal
        isOpen={showAddCourse}
        onClose={closeCourseModal}
        title={editingCourseId ? 'Edit Course Details' : 'Add Course Syllabus'}
        subtitle={
          editingCourseId
            ? 'Update the course code or course title.'
            : 'Enter a course code, title, and syllabus units separated by commas or newlines.'
        }
        icon={
          editingCourseId ? (
            <Pencil className="w-4 h-4" style={{ color: activePalette.primary }} />
          ) : (
            <BookOpen className="w-4 h-4" style={{ color: activePalette.primary }} />
          )
        }
        activePalette={activePalette}
        darkMode={darkMode}
      >
        <form onSubmit={handleAddOrUpdateCourse} className="space-y-3.5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Course Code
              </label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. CS301"
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
            <div className="col-span-2">
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Course Name
              </label>
              <input
                type="text"
                required
                autoFocus
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g. Algorithms & Data Structures"
                className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                style={{ borderColor: `${activePalette.primary}40` }}
              />
            </div>
          </div>

          {!editingCourseId && (
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Syllabus Topics / Units (Optional)
              </label>
              <textarea
                rows={4}
                value={topicsInput}
                onChange={(e) => setTopicsInput(e.target.value)}
                placeholder="Paste syllabus units or chapters separated by commas or newlines..."
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none resize-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeCourseModal}
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
              {editingCourseId ? 'Save Changes' : 'Add Course'}
            </button>
          </div>
        </form>
      </DashboardModal>

      {/* Edit Syllabus Topic Modal */}
      <DashboardModal
        isOpen={Boolean(editingTopic)}
        onClose={() => setEditingTopic(null)}
        title="Edit Syllabus Topic"
        subtitle="Update the topic or unit title for this course."
        icon={<Pencil className="w-4 h-4" style={{ color: activePalette.primary }} />}
        activePalette={activePalette}
        darkMode={darkMode}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveTopicTitle} className="space-y-3.5">
          <div>
            <label
              className={`block text-xs font-medium mb-1 ${
                darkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Topic / Unit Title
            </label>
            <input
              type="text"
              required
              autoFocus
              value={editingTopic?.title || ''}
              onChange={(e) =>
                setEditingTopic((prev) => (prev ? { ...prev, title: e.target.value } : prev))
              }
              className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none ${
                darkMode
                  ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
              style={{ borderColor: `${activePalette.primary}40` }}
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingTopic(null)}
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
              Save Topic
            </button>
          </div>
        </form>
      </DashboardModal>

      {courses.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
            {courses.map((c) => {
              const active = activeCourse?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCourseId(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap transition flex items-center gap-1.5 ${
                    active
                      ? ''
                      : darkMode
                      ? 'bg-slate-900/30 border-white/10 text-slate-400 hover:text-white'
                      : 'bg-white/40 border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: `${activePalette.primary}20`,
                          borderColor: `${activePalette.primary}60`,
                          color: activePalette.primary,
                        }
                      : {}
                  }
                >
                  <span>{c.code ? `${c.code} · ${c.name}` : c.name}</span>
                </button>
              );
            })}
          </div>

          {activeCourse && (
            <div className="flex flex-col gap-2.5 flex-1 min-h-0">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div
                  className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                    darkMode ? 'bg-slate-800/80' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${coursePct}%`,
                      background: `linear-gradient(to right, ${activePalette.primary}, ${activePalette.accent})`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums" style={{ color: activePalette.primary }}>
                  {coursePct}%
                </span>
                <button
                  type="button"
                  onClick={() => openEditCourse(activeCourse)}
                  className={`p-1 rounded-lg transition ${
                    darkMode
                      ? 'text-slate-400 hover:text-white hover:bg-white/10'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                  title="Edit course"
                  aria-label="Edit course"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCourse(activeCourse.id)}
                  className={`p-1 rounded-lg transition ${
                    darkMode
                      ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="Delete course"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleAddTopicToCourse} className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={inlineTopic}
                  onChange={(e) => setInlineTopic(e.target.value)}
                  placeholder="Add syllabus topic or unit..."
                  className={`flex-1 px-3 py-1.5 rounded-xl text-xs border focus:outline-none ${
                    darkMode
                      ? 'bg-slate-950/60 border-white/10 text-slate-100 placeholder-slate-500'
                      : 'bg-white/70 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-950 shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  }}
                >
                  Add
                </button>
              </form>

              <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
                {visibleTopics.map((topic) => (
                  <div
                    key={topic.id}
                    onClick={() => handleToggleTopic(activeCourse.id, topic.id)}
                    className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer transition liquid-glass-tile ${
                      topic.completed ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {topic.completed ? (
                        <CheckCircle2
                          className="w-4 h-4 shrink-0"
                          style={{ color: activePalette.primary }}
                        />
                      ) : (
                        <Circle
                          className={`w-4 h-4 shrink-0 ${
                            darkMode ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        />
                      )}
                      <span
                        className={`text-xs font-medium truncate ${
                          topic.completed ? 'line-through text-slate-500' : ''
                        }`}
                      >
                        {topic.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTopic({
                            courseId: activeCourse.id,
                            topicId: topic.id,
                            title: topic.title,
                          });
                        }}
                        className={`p-1 rounded opacity-60 group-hover:opacity-100 transition ${
                          darkMode
                            ? 'text-slate-400 hover:text-white hover:bg-white/10'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                        }`}
                        title="Edit topic"
                        aria-label="Edit topic"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTopic(activeCourse.id, topic.id);
                        }}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition ${
                          darkMode ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-600'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {visibleTopics.length === 0 && (
                  <p className={`text-xs text-center py-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    No topics added in {activeCourse.name} yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {courses.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-3 flex-1">
          <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Add courses and paste or enter syllabus units to track coverage.
          </p>
          <button
            type="button"
            onClick={openAddCourse}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-950 transition hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
          >
            Add First Course
          </button>
        </div>
      )}
    </div>
  );
};

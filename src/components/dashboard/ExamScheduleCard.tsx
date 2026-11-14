import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Upload,
  Trash2,
  X,
  Loader2,
  Calendar,
  MapPin,
  Pencil,
} from 'lucide-react';
import { ExamScheduleEntry, ColorPalette } from '../../types';
import { DashboardModal } from './DashboardModal';
import { decodeExamScheduleImage } from '../../utils/geminiClient';

interface ExamScheduleCardProps {
  exams: ExamScheduleEntry[];
  onChangeExams: (exams: ExamScheduleEntry[]) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  searchQuery?: string;
  cardTitle?: string;
  onEditTitle?: () => void;
}

function getDaysUntilExam(dateStr: string): string | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const examStart = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  ).getTime();
  const diffDays = Math.round((examStart - todayStart) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1) return `In ${diffDays}d`;
  return `${Math.abs(diffDays)}d ago`;
}

export const ExamScheduleCard: React.FC<ExamScheduleCardProps> = ({
  exams,
  onChangeExams,
  activePalette,
  darkMode,
  searchQuery = '',
  cardTitle,
  onEditTitle,
}) => {
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [course, setCourse] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [notes, setNotes] = useState('');

  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [decodeInfo, setDecodeInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const closeManualModal = () => {
    setShowManualForm(false);
    setEditingExamId(null);
    setCourse('');
    setTitle('');
    setDate('');
    setTime('');
    setVenue('');
    setNotes('');
  };

  const openAddExam = () => {
    setEditingExamId(null);
    setCourse('');
    setTitle('');
    setDate('');
    setTime('');
    setVenue('');
    setNotes('');
    setShowManualForm(true);
  };

  const openEditExam = (ex: ExamScheduleEntry) => {
    setEditingExamId(ex.id);
    setCourse(ex.course);
    setTitle(ex.title);
    setDate(ex.date === 'TBD' ? '' : ex.date);
    setTime(ex.time === 'TBD' ? '' : ex.time);
    setVenue(ex.venue || '');
    setNotes(ex.notes || '');
    setShowManualForm(true);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course.trim() && !title.trim()) return;
    const entryFields = {
      course: course.trim() || 'Exam',
      title: title.trim() || course.trim(),
      date: date.trim() || 'TBD',
      time: time.trim() || 'TBD',
      venue: venue.trim() || '',
      notes: notes.trim() || undefined,
    };

    if (editingExamId) {
      onChangeExams(
        exams
          .map((ex) => (ex.id === editingExamId ? { ...ex, ...entryFields } : ex))
          .sort((a, b) => a.date.localeCompare(b.date))
      );
    } else {
      const newEntry: ExamScheduleEntry = {
        id: `exam-${Date.now()}`,
        ...entryFields,
      };
      onChangeExams(
        [...exams, newEntry].sort((a, b) => a.date.localeCompare(b.date))
      );
    }
    closeManualModal();
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

      const payload = await decodeExamScheduleImage({
        imageDataUrl: dataUrl,
        mimeType: file.type || 'image/png',
      });

      const decodedList = Array.isArray(payload.exams) ? payload.exams : [];
      if (decodedList.length === 0) {
        setDecodeError('No exam rows could be detected in that photo. Try a clearer crop or add manually.');
      } else {
        const created: ExamScheduleEntry[] = decodedList.map((item: any, idx: number) => ({
          id: `exam-${Date.now()}-${idx}`,
          course: String(item.course || 'Course'),
          title: String(item.title || 'Exam'),
          date: String(item.date || 'TBD'),
          time: String(item.time || 'TBD'),
          venue: String(item.venue || ''),
          notes: item.notes ? String(item.notes) : undefined,
        }));
        onChangeExams(
          [...exams, ...created].sort((a, b) => a.date.localeCompare(b.date))
        );
        setDecodeInfo(`Decoded ${created.length} exam ${created.length === 1 ? 'entry' : 'entries'} from photo.`);
      }
    } catch (err: any) {
      setDecodeError(err?.message || 'Error decoding exam schedule image.');
    } finally {
      setIsDecoding(false);
    }
  };

  const handleDeleteExam = (id: string) => {
    onChangeExams(exams.filter((ex) => ex.id !== id));
  };

  const q = searchQuery.trim().toLowerCase();
  const visibleExams = exams.filter((ex) =>
    !q
      ? true
      : ex.course.toLowerCase().includes(q) ||
        ex.title.toLowerCase().includes(q) ||
        ex.venue.toLowerCase().includes(q) ||
        ex.date.toLowerCase().includes(q)
  );

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet
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
                  {cardTitle || 'Exam Schedule'}
                </h3>
              </button>
            ) : (
              <h3
                className={`text-base font-bold truncate ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {cardTitle || 'Exam Schedule'}
              </h3>
            )}
          </div>
          <p
            className={`text-xs tabular-nums ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {exams.length} {exams.length === 1 ? 'exam' : 'exams'} scheduled
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDecoding}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition whitespace-nowrap ${
              darkMode
                ? 'bg-slate-900/40 border-white/15 text-slate-200 hover:bg-white/10'
                : 'bg-white/70 border-slate-300 text-slate-800 hover:bg-white'
            }`}
            title="Upload schedule photo to decode automatically"
          >
            {isDecoding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: activePalette.primary }} />
            ) : (
              <Upload className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
            )}
            <span>{isDecoding ? 'Decoding...' : 'Upload Photo'}</span>
          </button>

          <button
            type="button"
            onClick={openAddExam}
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
            className="w-8 h-8 rounded-xl text-slate-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition shrink-0"
            title="Add exam manually"
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

      <DashboardModal
        isOpen={showManualForm}
        onClose={closeManualModal}
        title={editingExamId ? 'Edit Exam Entry' : 'Add Exam Schedule Entry'}
        subtitle={
          editingExamId
            ? 'Update exam date, time window, room, or seat notes.'
            : 'Enter exam details manually or upload a schedule photo from the card header.'
        }
        icon={
          editingExamId ? (
            <Pencil className="w-4 h-4" style={{ color: activePalette.primary }} />
          ) : (
            <FileSpreadsheet className="w-4 h-4" style={{ color: activePalette.primary }} />
          )
        }
        activePalette={activePalette}
        darkMode={darkMode}
      >
        <form onSubmit={handleManualSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Course / Subject
              </label>
              <input
                type="text"
                required
                autoFocus
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. MATH 204"
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                style={{ borderColor: `${activePalette.primary}40` }}
              />
            </div>
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Exam Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Final Paper"
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Exam Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
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
                Time Window
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="09:00 - 12:00"
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
                Room / Hall
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Hall B / Room 104"
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
              Seat / Reporting Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional seat number or instructions..."
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
              onClick={closeManualModal}
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
              {editingExamId ? 'Save Changes' : 'Add Exam'}
            </button>
          </div>
        </form>
      </DashboardModal>

      <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {visibleExams.map((ex) => {
          const daysLeft = getDaysUntilExam(ex.date);
          return (
            <div
              key={ex.id}
              className="group p-3.5 rounded-xl border transition liquid-glass-tile flex items-start justify-between gap-3"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold truncate" style={{ color: activePalette.primary }}>
                    {ex.course}
                  </span>
                  <span aria-hidden="true" className="text-slate-500">·</span>
                  <span
                    className={`text-sm font-medium truncate ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    {ex.title}
                  </span>
                </div>

                <div
                  className={`flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs tabular-nums ${
                    darkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{ex.date}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{ex.time}</span>
                  {ex.venue && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{ex.venue}</span>
                      </span>
                    </>
                  )}
                </div>

                {ex.notes && (
                  <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    {ex.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {daysLeft && (
                  <span
                    className="text-xs font-mono font-semibold tabular-nums mr-0.5"
                    style={{ color: activePalette.primary }}
                  >
                    {daysLeft}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openEditExam(ex)}
                  className={`p-1 rounded-lg opacity-60 group-hover:opacity-100 transition ${
                    darkMode
                      ? 'text-slate-400 hover:text-white hover:bg-white/10'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                  title="Edit exam"
                  aria-label="Edit exam"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteExam(ex.id)}
                  className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition ${
                    darkMode
                      ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="Remove exam"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {visibleExams.length === 0 && !isDecoding && (
          <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-3">
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Add upcoming exams manually or upload an exam schedule photo to decode dates automatically.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
                  darkMode
                    ? 'bg-slate-900/50 border-white/15 text-slate-200 hover:bg-white/10'
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Upload className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                <span>Upload Schedule Photo</span>
              </button>
              <button
                type="button"
                onClick={openAddExam}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-950 transition hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
              >
                Add Manually
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

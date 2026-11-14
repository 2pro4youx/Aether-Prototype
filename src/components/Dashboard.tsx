import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  Box,
  Plus,
  Calendar,
  Flame,
  CheckCircle2,
  Clock,
  BookOpen,
  FileSpreadsheet,
  CalendarRange,
  Pencil,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  StudyDay,
  TaskItem,
  PlannerEntry,
  ColorPalette,
  DashboardCardType,
  DashboardCardInstance,
  SyllabusCourse,
  ExamScheduleEntry,
  TimetableSlot,
  CalendarEventEntry,
} from '../types';
import { TasksCard } from './dashboard/TasksCard';
import { StudyPlannerCard } from './dashboard/StudyPlannerCard';
import { SyllabusCard } from './dashboard/SyllabusCard';
import { ExamScheduleCard } from './dashboard/ExamScheduleCard';
import { TimetableCard } from './dashboard/TimetableCard';
import { CalendarCard } from './dashboard/CalendarCard';
import { DashboardModal } from './dashboard/DashboardModal';
import { resizeLenis } from '../hooks/useSmoothScroll';

interface DashboardProps {
  studyDays: StudyDay[];
  tasks: TaskItem[];
  planners: PlannerEntry[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (
    title: string,
    category: string,
    priority: 'low' | 'medium' | 'high',
    dueAt?: string | null
  ) => void;
  onUpdateTask: (taskId: string, updates: Partial<Omit<TaskItem, 'id'>>) => void;
  onDeleteTask: (taskId: string) => void;
  onAddPlanner: (entry: Omit<PlannerEntry, 'id'>) => void;
  onUpdatePlanner: (id: string, updates: Partial<Omit<PlannerEntry, 'id'>>) => void;
  onUpdatePlannerProgress: (id: string, progress: number) => void;
  onDeletePlanner: (id: string) => void;
  onOpenNotebookLM: () => void;
  onOpenOneNote: () => void;
  onSearchSelect?: (query: string) => void;
  onMetaverseEditChange?: (active: boolean) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  cards?: DashboardCardInstance[];
  onUpdateCards?: (cards: DashboardCardInstance[]) => void;
  syllabusCourses?: SyllabusCourse[];
  onUpdateSyllabusCourses?: (courses: SyllabusCourse[]) => void;
  examSchedules?: ExamScheduleEntry[];
  onUpdateExamSchedules?: (entries: ExamScheduleEntry[]) => void;
  timetableSlots?: TimetableSlot[];
  onUpdateTimetableSlots?: (slots: TimetableSlot[]) => void;
  localCalendarEvents?: CalendarEventEntry[];
  onUpdateLocalCalendarEvents?: (events: CalendarEventEntry[]) => void;
}

const DEFAULT_CARD_TITLES: Record<DashboardCardType, string> = {
  tasks: 'Daily Study Tasks & Chores',
  planner: 'Study Planner',
  syllabus: 'Syllabus Tracker',
  exam_schedule: 'Exam Schedule',
  timetable: 'Weekly Timetable',
  calendar: 'Calendar',
};

function getCardDisplayTitle(card: DashboardCardInstance): string {
  return card.title?.trim() || DEFAULT_CARD_TITLES[card.type] || 'Dashboard Card';
}

function getCardWidthPct(card: DashboardCardInstance): number {
  if (typeof card.widthPct === 'number' && !Number.isNaN(card.widthPct)) {
    return clamp(card.widthPct, 25, 100);
  }
  return clamp(Math.floor(((card.colSpan || 6) / 12) * 10000) / 100, 25, 100);
}

const CARD_CATALOG: Array<{
  type: DashboardCardType;
  title: string;
  description: string;
  defaultColSpan: number;
  defaultWidthPct: number;
  defaultHeight: number;
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
}> = [
  {
    type: 'tasks',
    title: 'Daily Study Tasks + Chores',
    description: 'Track daily tasks and chores with optional completion countdowns.',
    defaultColSpan: 7,
    defaultWidthPct: 58.33,
    defaultHeight: 460,
    icon: CheckCircle2,
  },
  {
    type: 'planner',
    title: 'Study Planner',
    description: 'Plan study sprints, time slots, milestones, and live progress.',
    defaultColSpan: 5,
    defaultWidthPct: 41.66,
    defaultHeight: 460,
    icon: Clock,
  },
  {
    type: 'syllabus',
    title: 'Syllabus Tracker',
    description: 'Organize courses, syllabus topics, and unit completion progress.',
    defaultColSpan: 6,
    defaultWidthPct: 50,
    defaultHeight: 440,
    icon: BookOpen,
  },
  {
    type: 'exam_schedule',
    title: 'Exam Schedule',
    description: 'Add exam dates manually or upload a schedule photo to decode automatically.',
    defaultColSpan: 6,
    defaultWidthPct: 50,
    defaultHeight: 440,
    icon: FileSpreadsheet,
  },
  {
    type: 'timetable',
    title: 'Timetable',
    description: 'Weekly class and study schedule sorted cleanly by day and time.',
    defaultColSpan: 6,
    defaultWidthPct: 50,
    defaultHeight: 440,
    icon: CalendarRange,
  },
  {
    type: 'calendar',
    title: 'Calendar',
    description: 'Monthly schedule grid with local event creation and editing.',
    defaultColSpan: 6,
    defaultWidthPct: 50,
    defaultHeight: 500,
    icon: Calendar,
  },
];

export const DEFAULT_DASHBOARD_CARDS: DashboardCardInstance[] = [
  {
    id: 'card-tasks-default',
    type: 'tasks',
    colSpan: 7,
    widthPct: 58.33,
    height: 460,
  },
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const CARD_GAP = 24;

type ResizeDirection = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';

interface FreeCardRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CLEAN_WIDTH_RATIOS = [25, 33.33, 50, 66.67, 75, 100];

function snapToClosestRatio(rawPct: number): { widthPct: number; colSpan: number } {
  let best = CLEAN_WIDTH_RATIOS[0];
  let minDiff = Math.abs(rawPct - best);
  for (let i = 1; i < CLEAN_WIDTH_RATIOS.length; i++) {
    const diff = Math.abs(rawPct - CLEAN_WIDTH_RATIOS[i]);
    if (diff < minDiff) {
      minDiff = diff;
      best = CLEAN_WIDTH_RATIOS[i];
    }
  }
  return {
    widthPct: best,
    colSpan: clamp(Math.round((best / 100) * 12), 3, 12),
  };
}

interface PlacedCardRect {
  card: DashboardCardInstance;
  x: number;
  y: number;
  slotW: number;
  cardW: number;
  h: number;
}

function computeCornerPackedLayout(
  cards: DashboardCardInstance[],
  containerWidth: number
): { rects: PlacedCardRect[]; totalHeight: number } {
  const virtualWidth = Math.max(320, containerWidth + CARD_GAP);
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  const rects: PlacedCardRect[] = [];
  const EPS = 0.75;
  let maxBottom = 0;

  for (const card of cards) {
    const widthPct = getCardWidthPct(card);
    const slotW = Math.min(virtualWidth, Math.max(240, (widthPct / 100) * virtualWidth));
    const slotH = card.height + CARD_GAP;

    const candidateXs = new Set<number>([0]);
    for (const p of placed) {
      candidateXs.add(p.x + p.w);
      if (p.x - slotW >= -EPS) {
        candidateXs.add(Math.max(0, p.x - slotW));
      }
    }
    if (virtualWidth - slotW >= 0) {
      candidateXs.add(virtualWidth - slotW);
    }

    const sortedByY = [...placed].sort((a, b) => a.y - b.y);

    let bestX = 0;
    let bestY = Infinity;

    for (const rawX of candidateXs) {
      const cx = Math.max(0, rawX);
      if (cx + slotW > virtualWidth + EPS) continue;

      let cy = 0;
      for (const r of sortedByY) {
        if (r.y >= cy + slotH - EPS) break;
        const overlapsX = cx < r.x + r.w - EPS && cx + slotW > r.x + EPS;
        const overlapsY = cy < r.y + r.h - EPS && cy + slotH > r.y + EPS;
        if (overlapsX && overlapsY) {
          cy = r.y + r.h;
        }
      }

      if (cy < bestY - EPS || (Math.abs(cy - bestY) <= EPS && cx < bestX)) {
        bestY = cy;
        bestX = cx;
      }
    }

    if (!Number.isFinite(bestY)) {
      bestX = 0;
      bestY = maxBottom;
    }

    placed.push({ x: bestX, y: bestY, w: slotW, h: slotH });
    maxBottom = Math.max(maxBottom, bestY + slotH);
    rects.push({
      card,
      x: bestX,
      y: bestY,
      slotW,
      cardW: Math.max(200, slotW - CARD_GAP),
      h: card.height,
    });
  }

  return {
    rects,
    totalHeight: Math.max(0, maxBottom - CARD_GAP),
  };
}

let lastKnownDashboardGridWidth = 0;

export const Dashboard: React.FC<DashboardProps> = ({
  studyDays,
  tasks,
  planners,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onAddPlanner,
  onUpdatePlanner,
  onUpdatePlannerProgress,
  onDeletePlanner,
  onOpenNotebookLM,
  onMetaverseEditChange,
  activePalette,
  darkMode,
  cards: controlledCards,
  onUpdateCards,
  syllabusCourses: controlledSyllabusCourses,
  onUpdateSyllabusCourses,
  examSchedules: controlledExamSchedules,
  onUpdateExamSchedules,
  timetableSlots: controlledTimetableSlots,
  onUpdateTimetableSlots,
  localCalendarEvents: controlledLocalCalendarEvents,
  onUpdateLocalCalendarEvents,
}) => {
  const [hoveredDay, setHoveredDay] = useState<StudyDay | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [cardPendingDelete, setCardPendingDelete] = useState<DashboardCardInstance | null>(null);
  const [editingTitleCard, setEditingTitleCard] = useState<DashboardCardInstance | null>(null);
  const [draftCardTitle, setDraftCardTitle] = useState('');
  const [isMetaverseEdit, setIsMetaverseEdit] = useState(false);
  const [freeLayoutMap, setFreeLayoutMap] = useState<Record<string, FreeCardRect>>({});
  const [freeZOrder, setFreeZOrder] = useState<Record<string, number>>({});
  const [activeFreeDragId, setActiveFreeDragId] = useState<string | null>(null);
  const topZCounterRef = useRef<number>(10);

  useEffect(() => {
    return () => {
      onMetaverseEditChange?.(false);
    };
  }, [onMetaverseEditChange]);

  // Modular Dashboard Cards layout (default: Daily Study Tasks + Chores)
  const [internalCards, setInternalCards] = useState<DashboardCardInstance[]>(() => {
    try {
      const saved = localStorage.getItem('aether_dashboard_cards_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback to default
    }
    return DEFAULT_DASHBOARD_CARDS;
  });
  const cards = controlledCards !== undefined ? controlledCards : internalCards;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const setCards = (
    updater: DashboardCardInstance[] | ((prev: DashboardCardInstance[]) => DashboardCardInstance[])
  ) => {
    const next = typeof updater === 'function' ? updater(cardsRef.current) : updater;
    if (onUpdateCards) {
      onUpdateCards(next);
    } else {
      setInternalCards(next);
    }
  };

  useEffect(() => {
    if (onUpdateCards) return;
    try {
      localStorage.setItem('aether_dashboard_cards_v1', JSON.stringify(cards));
    } catch {
      // ignore quota issues
    }
  }, [cards, onUpdateCards]);

  // Persistent Card Data Stores (zero dummy data)
  const [internalSyllabusCourses, setInternalSyllabusCourses] = useState<SyllabusCourse[]>(() => {
    try {
      const saved = localStorage.getItem('aether_syllabus_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const syllabusCourses =
    controlledSyllabusCourses !== undefined ? controlledSyllabusCourses : internalSyllabusCourses;
  const syllabusRef = useRef(syllabusCourses);
  syllabusRef.current = syllabusCourses;
  const setSyllabusCourses = (
    updater: SyllabusCourse[] | ((prev: SyllabusCourse[]) => SyllabusCourse[])
  ) => {
    const next = typeof updater === 'function' ? updater(syllabusRef.current) : updater;
    if (onUpdateSyllabusCourses) {
      onUpdateSyllabusCourses(next);
    } else {
      setInternalSyllabusCourses(next);
    }
  };
  useEffect(() => {
    if (onUpdateSyllabusCourses) return;
    localStorage.setItem('aether_syllabus_v1', JSON.stringify(syllabusCourses));
  }, [syllabusCourses, onUpdateSyllabusCourses]);

  const [internalExamSchedules, setInternalExamSchedules] = useState<ExamScheduleEntry[]>(() => {
    try {
      const saved = localStorage.getItem('aether_exam_schedule_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const examSchedules =
    controlledExamSchedules !== undefined ? controlledExamSchedules : internalExamSchedules;
  const examSchedulesRef = useRef(examSchedules);
  examSchedulesRef.current = examSchedules;
  const setExamSchedules = (
    updater: ExamScheduleEntry[] | ((prev: ExamScheduleEntry[]) => ExamScheduleEntry[])
  ) => {
    const next = typeof updater === 'function' ? updater(examSchedulesRef.current) : updater;
    if (onUpdateExamSchedules) {
      onUpdateExamSchedules(next);
    } else {
      setInternalExamSchedules(next);
    }
  };
  useEffect(() => {
    if (onUpdateExamSchedules) return;
    localStorage.setItem('aether_exam_schedule_v1', JSON.stringify(examSchedules));
  }, [examSchedules, onUpdateExamSchedules]);

  const [internalTimetableSlots, setInternalTimetableSlots] = useState<TimetableSlot[]>(() => {
    try {
      const saved = localStorage.getItem('aether_timetable_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const timetableSlots =
    controlledTimetableSlots !== undefined ? controlledTimetableSlots : internalTimetableSlots;
  const timetableSlotsRef = useRef(timetableSlots);
  timetableSlotsRef.current = timetableSlots;
  const setTimetableSlots = (
    updater: TimetableSlot[] | ((prev: TimetableSlot[]) => TimetableSlot[])
  ) => {
    const next = typeof updater === 'function' ? updater(timetableSlotsRef.current) : updater;
    if (onUpdateTimetableSlots) {
      onUpdateTimetableSlots(next);
    } else {
      setInternalTimetableSlots(next);
    }
  };
  useEffect(() => {
    if (onUpdateTimetableSlots) return;
    localStorage.setItem('aether_timetable_v1', JSON.stringify(timetableSlots));
  }, [timetableSlots, onUpdateTimetableSlots]);

  const [internalLocalCalendarEvents, setInternalLocalCalendarEvents] = useState<CalendarEventEntry[]>(() => {
    try {
      const saved = localStorage.getItem('aether_local_calendar_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const localCalendarEvents =
    controlledLocalCalendarEvents !== undefined
      ? controlledLocalCalendarEvents
      : internalLocalCalendarEvents;
  const localCalendarEventsRef = useRef(localCalendarEvents);
  localCalendarEventsRef.current = localCalendarEvents;
  const setLocalCalendarEvents = (
    updater: CalendarEventEntry[] | ((prev: CalendarEventEntry[]) => CalendarEventEntry[])
  ) => {
    const next =
      typeof updater === 'function' ? updater(localCalendarEventsRef.current) : updater;
    if (onUpdateLocalCalendarEvents) {
      onUpdateLocalCalendarEvents(next);
    } else {
      setInternalLocalCalendarEvents(next);
    }
  };
  useEffect(() => {
    if (onUpdateLocalCalendarEvents) return;
    localStorage.setItem('aether_local_calendar_v1', JSON.stringify(localCalendarEvents));
  }, [localCalendarEvents, onUpdateLocalCalendarEvents]);

  // Drag-and-drop card reordering (no drag icon)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragReadyCardId, setDragReadyCardId] = useState<string | null>(null);

  // Corner resizing & responsive 2D corner-packing layout measurement
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [resizingCardId, setResizingCardId] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState<number>(() => lastKnownDashboardGridWidth);
  const [layoutTransitionReady, setLayoutTransitionReady] = useState<boolean>(false);
  const [isDesktopGrid, setIsDesktopGrid] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useLayoutEffect(() => {
    const updateMeasure = () => {
      if (gridRef.current) {
        const w = gridRef.current.clientWidth;
        if (w > 0) {
          lastKnownDashboardGridWidth = w;
          setGridWidth(w);
        }
      }
      setIsDesktopGrid(window.innerWidth >= 1024);
    };
    updateMeasure();

    let settleRaf2 = 0;
    const settleRaf1 = window.requestAnimationFrame(() => {
      settleRaf2 = window.requestAnimationFrame(() => {
        setLayoutTransitionReady(true);
      });
    });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && gridRef.current) {
      ro = new ResizeObserver(() => {
        if (gridRef.current) {
          const w = gridRef.current.clientWidth;
          if (w > 0) {
            lastKnownDashboardGridWidth = w;
            setGridWidth(w);
          }
        }
        setIsDesktopGrid(window.innerWidth >= 1024);
      });
      ro.observe(gridRef.current);
    }
    window.addEventListener('resize', updateMeasure);
    return () => {
      window.cancelAnimationFrame(settleRaf1);
      if (settleRaf2) window.cancelAnimationFrame(settleRaf2);
      ro?.disconnect();
      window.removeEventListener('resize', updateMeasure);
    };
  }, []);

  const packedLayout = useMemo(() => {
    if (!isDesktopGrid || gridWidth <= 0) return null;
    return computeCornerPackedLayout(cards, gridWidth);
  }, [cards, gridWidth, isDesktopGrid]);

  const metaverseTotalHeight = useMemo(() => {
    if (!isMetaverseEdit || cards.length === 0) return 0;
    let maxB = 0;
    for (const card of cards) {
      const r = freeLayoutMap[card.id];
      if (r) {
        maxB = Math.max(maxB, r.y + r.h);
      }
    }
    return Math.max(240, maxB);
  }, [isMetaverseEdit, cards, freeLayoutMap]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      resizeLenis();
    });
    const timer = window.setTimeout(() => {
      resizeLenis();
    }, 340);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [cards.length, packedLayout?.totalHeight, metaverseTotalHeight, isMetaverseEdit]);

  const bringCardToFront = (cardId: string) => {
    topZCounterRef.current += 1;
    const nextZ = topZCounterRef.current;
    setFreeZOrder((prev) => ({ ...prev, [cardId]: nextZ }));
  };

  const enterMetaverseEdit = () => {
    const cw = gridRef.current?.clientWidth || gridWidth || 1000;
    const initialMap: Record<string, FreeCardRect> = {};
    const initialZ: Record<string, number> = {};
    let fallbackY = 0;

    cards.forEach((card, index) => {
      const matched = packedLayout?.rects.find((r) => r.card.id === card.id);
      if (matched) {
        initialMap[card.id] = {
          x: Math.round(matched.x),
          y: Math.round(matched.y),
          w: Math.round(matched.cardW),
          h: Math.round(matched.h),
        };
      } else {
        const w = Math.max(240, Math.round(cw));
        initialMap[card.id] = {
          x: 0,
          y: fallbackY,
          w,
          h: card.height,
        };
        fallbackY += card.height + CARD_GAP;
      }
      initialZ[card.id] = index + 1;
    });

    topZCounterRef.current = cards.length + 2;
    setFreeLayoutMap(initialMap);
    setFreeZOrder(initialZ);
    setDragReadyCardId(null);
    setDraggingCardId(null);
    setIsMetaverseEdit(true);
    onMetaverseEditChange?.(true);
  };

  const exitMetaverseEdit = () => {
    const cw = gridRef.current?.clientWidth || gridWidth || 1200;
    const virtualWidth = Math.max(320, cw + CARD_GAP);

    const cardsWithRects = cards.map((card, idx) => {
      const fallbackW = clamp((getCardWidthPct(card) / 100) * virtualWidth - CARD_GAP, 220, cw);
      const rect = freeLayoutMap[card.id] ?? {
        x: 0,
        y: idx * (card.height + CARD_GAP),
        w: fallbackW,
        h: card.height,
      };
      return { card, rect };
    });

    cardsWithRects.sort((a, b) => {
      const rowA = Math.round(a.rect.y / 48);
      const rowB = Math.round(b.rect.y / 48);
      if (rowA !== rowB) return rowA - rowB;
      if (Math.abs(a.rect.x - b.rect.x) > 12) return a.rect.x - b.rect.x;
      return a.rect.y - b.rect.y;
    });

    const fittedCards: DashboardCardInstance[] = cardsWithRects.map(({ card, rect }) => {
      const rawWidthPct = clamp(((rect.w + CARD_GAP) / virtualWidth) * 100, 25, 100);
      const { widthPct, colSpan } = snapToClosestRatio(rawWidthPct);
      const snappedHeight = clamp(Math.round(rect.h / 20) * 20, 280, 920);
      return {
        ...card,
        widthPct,
        colSpan,
        height: snappedHeight,
      };
    });

    setCards(fittedCards);
    setIsMetaverseEdit(false);
    setActiveFreeDragId(null);
    setResizingCardId(null);
    onMetaverseEditChange?.(false);
  };

  const toggleMetaverseEdit = () => {
    if (isMetaverseEdit) {
      exitMetaverseEdit();
    } else {
      enterMetaverseEdit();
    }
  };

  const startResize = (
    e: React.PointerEvent,
    card: DashboardCardInstance,
    direction: ResizeDirection
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const rawGridW = gridRef.current?.clientWidth || gridWidth || 1200;
    const containerWidth = rawGridW + CARD_GAP;

    setResizingCardId(card.id);
    setDragReadyCardId(null);

    const prevBodyCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor =
      direction === 'n' || direction === 's'
        ? 'ns-resize'
        : direction === 'w' || direction === 'e'
        ? 'ew-resize'
        : direction === 'ne' || direction === 'sw'
        ? 'nesw-resize'
        : 'nwse-resize';
    document.body.style.userSelect = 'none';

    if (isMetaverseEdit) {
      bringCardToFront(card.id);
      const fallbackW = clamp((getCardWidthPct(card) / 100) * containerWidth - CARD_GAP, 220, rawGridW);
      const startRect: FreeCardRect = freeLayoutMap[card.id] ?? {
        x: 0,
        y: 0,
        w: fallbackW,
        h: card.height,
      };
      const minW = 220;
      const maxW = Math.max(rawGridW, 320);
      const minH = 200;
      const maxH = 1100;

      let latestClientX = startX;
      let latestClientY = startY;
      let rafId: number | null = null;

      const applyFreeResize = () => {
        rafId = null;
        const dx = latestClientX - startX;
        const dy = latestClientY - startY;

        let nextW = startRect.w;
        let nextX = startRect.x;
        let nextH = startRect.h;
        let nextY = startRect.y;

        if (direction === 'w' || direction === 'nw' || direction === 'sw') {
          const maxLeftGrow = startRect.x + startRect.w;
          nextW = clamp(startRect.w - dx, minW, Math.min(maxW, maxLeftGrow));
          nextX = startRect.x + (startRect.w - nextW);
        } else if (direction === 'e' || direction === 'ne' || direction === 'se') {
          nextW = clamp(startRect.w + dx, minW, Math.max(minW, maxW - startRect.x));
        }

        if (direction === 'n' || direction === 'nw' || direction === 'ne') {
          const maxTopGrow = startRect.y + startRect.h;
          nextH = clamp(startRect.h - dy, minH, Math.min(maxH, maxTopGrow));
          nextY = startRect.y + (startRect.h - nextH);
        } else if (direction === 's' || direction === 'sw' || direction === 'se') {
          nextH = clamp(startRect.h + dy, minH, maxH);
        }

        setFreeLayoutMap((prev) => ({
          ...prev,
          [card.id]: {
            x: Math.round(nextX),
            y: Math.round(nextY),
            w: Math.round(nextW),
            h: Math.round(nextH),
          },
        }));
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        latestClientX = moveEvent.clientX;
        latestClientY = moveEvent.clientY;
        if (rafId === null) {
          rafId = window.requestAnimationFrame(applyFreeResize);
        }
      };

      const handlePointerUp = () => {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
          applyFreeResize();
        }
        document.body.style.cursor = prevBodyCursor;
        document.body.style.userSelect = prevUserSelect;
        setResizingCardId(null);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
      return;
    }

    const startWidthPct = getCardWidthPct(card);
    const startWidthPx = (startWidthPct / 100) * containerWidth;
    const startHeightPx = card.height;

    let latestClientX = startX;
    let latestClientY = startY;
    let rafId: number | null = null;

    const applyResize = () => {
      rafId = null;
      const rawDx = latestClientX - startX;
      const rawDy = latestClientY - startY;

      const signedDx =
        direction === 'ne' || direction === 'se' || direction === 'e'
          ? rawDx
          : direction === 'nw' || direction === 'sw' || direction === 'w'
          ? -rawDx
          : 0;
      const signedDy =
        direction === 'se' || direction === 'sw' || direction === 's'
          ? rawDy
          : direction === 'nw' || direction === 'ne' || direction === 'n'
          ? -rawDy
          : 0;

      const targetWidthPx = startWidthPx + signedDx;
      const nextWidthPct = clamp(
        Math.round(((targetWidthPx / containerWidth) * 100) * 100) / 100,
        25,
        100
      );
      const nextColSpan = clamp(Math.round((nextWidthPct / 100) * 12), 3, 12);
      const nextHeight = clamp(Math.round(startHeightPx + signedDy), 280, 920);

      setCards((prev) =>
        prev.map((c) =>
          c.id === card.id
            ? { ...c, widthPct: nextWidthPct, colSpan: nextColSpan, height: nextHeight }
            : c
        )
      );
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      latestClientX = moveEvent.clientX;
      latestClientY = moveEvent.clientY;
      if (rafId === null) {
        rafId = window.requestAnimationFrame(applyResize);
      }
    };

    const handlePointerUp = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        applyResize();
      }
      document.body.style.cursor = prevBodyCursor;
      document.body.style.userSelect = prevUserSelect;
      setResizingCardId(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const startFreeDrag = (e: React.PointerEvent, card: DashboardCardInstance) => {
    if (!isMetaverseEdit || resizingCardId !== null || e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'button, input, textarea, select, label, a, [data-resize-corner], [data-resize-edge], [data-no-drag]'
      )
    ) {
      return;
    }

    bringCardToFront(card.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const rawGridW = gridRef.current?.clientWidth || gridWidth || 1200;
    const fallbackW = clamp((getCardWidthPct(card) / 100) * (rawGridW + CARD_GAP) - CARD_GAP, 220, rawGridW);
    const startRect: FreeCardRect = freeLayoutMap[card.id] ?? {
      x: 0,
      y: 0,
      w: fallbackW,
      h: card.height,
    };

    let hasActivatedDrag = false;
    let latestClientX = startX;
    let latestClientY = startY;
    let rafId: number | null = null;
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;

    const applyFreeMove = () => {
      rafId = null;
      const dx = latestClientX - startX;
      const dy = latestClientY - startY;
      const maxX = Math.max(0, rawGridW - startRect.w);
      const nextX = clamp(Math.round(startRect.x + dx), 0, maxX);
      const nextY = Math.max(0, Math.round(startRect.y + dy));

      setFreeLayoutMap((prev) => ({
        ...prev,
        [card.id]: {
          ...startRect,
          x: nextX,
          y: nextY,
        },
      }));
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      latestClientX = moveEvent.clientX;
      latestClientY = moveEvent.clientY;

      if (!hasActivatedDrag) {
        const dist = Math.hypot(latestClientX - startX, latestClientY - startY);
        if (dist < 4) return;
        hasActivatedDrag = true;
        setActiveFreeDragId(card.id);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }

      if (rafId === null) {
        rafId = window.requestAnimationFrame(applyFreeMove);
      }
    };

    const handlePointerUp = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        if (hasActivatedDrag) applyFreeMove();
      }
      if (hasActivatedDrag) {
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
        setActiveFreeDragId(null);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleAddCard = (type: DashboardCardType) => {
    const meta = CARD_CATALOG.find((c) => c.type === type);
    if (!meta) return;
    const nextCard: DashboardCardInstance = {
      id: `card-${type}-${Date.now()}`,
      type,
      colSpan: meta.defaultColSpan,
      widthPct: meta.defaultWidthPct,
      height: meta.defaultHeight,
    };
    if (isMetaverseEdit) {
      const cw = gridRef.current?.clientWidth || gridWidth || 1000;
      const virtualW = Math.max(320, cw + CARD_GAP);
      const cardW = clamp(Math.round((meta.defaultWidthPct / 100) * virtualW - CARD_GAP), 220, cw);
      let maxB = 0;
      let activeFreeCount = 0;
      cards.forEach((existingCard) => {
        const r = freeLayoutMap[existingCard.id];
        if (r) {
          activeFreeCount += 1;
          maxB = Math.max(maxB, r.y + r.h);
        }
      });
      const spawnY = activeFreeCount > 0 ? maxB + CARD_GAP : 0;
      topZCounterRef.current += 1;
      const nextZ = topZCounterRef.current;
      setFreeLayoutMap((prev) => ({
        ...prev,
        [nextCard.id]: {
          x: Math.max(0, Math.round((cw - cardW) / 2)),
          y: spawnY,
          w: cardW,
          h: meta.defaultHeight,
        },
      }));
      setFreeZOrder((prev) => ({ ...prev, [nextCard.id]: nextZ }));
    }
    setCards((prev) => [...prev, nextCard]);
    setShowAddCardModal(false);

    window.setTimeout(() => {
      resizeLenis();
      const addedEl = gridRef.current?.querySelector<HTMLElement>(
        `[data-card-id="${nextCard.id}"]`
      );
      addedEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 90);
  };

  const handleConfirmDeleteCard = () => {
    if (!cardPendingDelete) return;
    const idToDelete = cardPendingDelete.id;
    setCardPendingDelete(null);
    setCards((prev) => prev.filter((c) => c.id !== idToDelete));
    setFreeLayoutMap((prev) => {
      if (!(idToDelete in prev)) return prev;
      const next = { ...prev };
      delete next[idToDelete];
      return next;
    });
    setFreeZOrder((prev) => {
      if (!(idToDelete in prev)) return prev;
      const next = { ...prev };
      delete next[idToDelete];
      return next;
    });
  };

  const handleOpenEditTitle = (card: DashboardCardInstance) => {
    setEditingTitleCard(card);
    setDraftCardTitle(getCardDisplayTitle(card));
  };

  const handleSaveCardTitle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTitleCard) return;
    const trimmed = draftCardTitle.trim();
    const defaultTitle = DEFAULT_CARD_TITLES[editingTitleCard.type];
    const nextTitle = trimmed && trimmed !== defaultTitle ? trimmed : undefined;
    setCards((prev) =>
      prev.map((c) => (c.id === editingTitleCard.id ? { ...c, title: nextTitle } : c))
    );
    setEditingTitleCard(null);
    setDraftCardTitle('');
  };

  // Real-time study hours summary calculations (0 initially, increments cleanly with real study time)
  const { totalHours, currentStreak } = useMemo(() => {
    let hours = 0;
    let curStreak = 0;

    for (const d of studyDays) {
      if (d.hours > 0) {
        hours += d.hours;
      }
    }

    for (let i = studyDays.length - 1; i >= 0; i--) {
      if (studyDays[i].hours > 0) curStreak++;
      else break;
    }

    return {
      totalHours: +hours.toFixed(1),
      currentStreak: curStreak,
    };
  }, [studyDays]);

  return (
    <div className="relative min-h-[100dvh] md:min-h-screen pt-5 pb-24 md:pt-28 md:pb-16 px-3.5 md:px-8 lg:px-12 max-w-[1720px] w-full mx-auto space-y-8 transition-colors duration-300">
      {/* Dark Spatial Metaverse Depth Scrim (dims entire background, header & heatmap cleanly) */}
      <AnimatePresence>
        {isMetaverseEdit && (
          <motion.div
            key="metaverse-spatial-void"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
            className="fixed inset-0 z-[210] pointer-events-auto overflow-hidden"
            style={{
              background: `radial-gradient(ellipse 75% 58% at 50% 42%, ${activePalette.primary}12 0%, rgba(3, 6, 14, 0.90) 48%, rgba(1, 2, 6, 0.97) 100%)`,
              backdropFilter: 'blur(12px) saturate(0.7) brightness(0.42)',
              WebkitBackdropFilter: 'blur(12px) saturate(0.7) brightness(0.42)',
            }}
          >
            {/* Deep perspective floor grid for Z-axis spatial depth */}
            <div
              className="absolute inset-x-[-20%] bottom-[-10%] h-[62vh] pointer-events-none"
              style={{
                transform: 'perspective(900px) rotateX(68deg)',
                transformOrigin: 'center bottom',
                backgroundImage: `
                  linear-gradient(to right, ${activePalette.primary}1c 1px, transparent 1px),
                  linear-gradient(to bottom, ${activePalette.primary}14 1px, transparent 1px)
                `,
                backgroundSize: '56px 56px',
                maskImage: 'radial-gradient(ellipse 72% 80% at 50% 60%, black 0%, transparent 78%)',
                WebkitMaskImage: 'radial-gradient(ellipse 72% 80% at 50% 60%, black 0%, transparent 78%)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Welcome & Metaverse Edit Control */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="pr-14 md:pr-0">
          <div
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: activePalette.primary }}
          >
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
            Modular study command center — resize any card from its corners and drag to reorder.
          </p>
        </div>

        {/* METAVERSE Freeform Edit Button */}
        <button
          type="button"
          onClick={toggleMetaverseEdit}
          aria-pressed={isMetaverseEdit}
          title={isMetaverseEdit ? 'Exit Metaverse mode and fit cards to closest ratio' : 'Enter Metaverse freeform layout mode'}
          className={`relative px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-extrabold tracking-wider uppercase inline-flex items-center justify-center gap-2 border shrink-0 self-start md:self-auto transition-all duration-300 cursor-pointer focus:outline-none ${
            isMetaverseEdit
              ? 'z-[220] text-white'
              : `liquid-glass shadow-inner ${
                  darkMode
                    ? 'bg-slate-950/20 border-white/10 text-slate-100 hover:bg-slate-900/40'
                    : 'bg-white/90 border-slate-300 text-slate-900 hover:bg-white'
                }`
          }`}
          style={
            isMetaverseEdit
              ? {
                  background: `linear-gradient(135deg, color-mix(in srgb, ${activePalette.primary} 34%, rgba(8, 12, 24, 0.94)), color-mix(in srgb, ${activePalette.accent} 28%, rgba(8, 12, 24, 0.96)))`,
                  borderColor: activePalette.primary,
                  boxShadow: `0 0 26px ${activePalette.primary}80, 0 0 60px ${activePalette.accent}42, 0 18px 36px -6px rgba(0, 0, 0, 0.92), inset 0 1px 0 rgba(255, 255, 255, 0.35)`,
                }
              : {
                  borderColor: `${activePalette.primary}45`,
                  boxShadow: `0 6px 20px -8px ${activePalette.primary}35`,
                }
          }
        >
          <Box
            className="w-4 h-4 shrink-0 transition-transform duration-300"
            style={{
              color: isMetaverseEdit ? '#ffffff' : activePalette.primary,
              filter: isMetaverseEdit ? `drop-shadow(0 0 8px ${activePalette.primary})` : undefined,
              transform: isMetaverseEdit ? 'scale(1.12) rotate(12deg)' : 'scale(1)',
            }}
          />
          <span>METAVERSE</span>
        </button>
      </div>

      {/* Real-Time 365-Day Study Hours Heatmap Tile (Zero Dummy Data) */}
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
              Live 365-day learning ledger recording real workspace and study activity.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                darkMode
                  ? 'bg-slate-900/20 border-white/10 text-slate-300'
                  : 'bg-white/25 border-slate-200/60 text-slate-700'
              }`}
            >
              <span className="font-bold tabular-nums" style={{ color: activePalette.primary }}>
                {totalHours}h
              </span>{' '}
              Total
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                darkMode
                  ? 'bg-slate-900/20 border-white/10 text-slate-300'
                  : 'bg-white/25 border-slate-200/60 text-slate-700'
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

        <div className="overflow-x-auto pb-2 pt-1">
          <div className="min-w-[760px]">
            <div className="grid grid-flow-col grid-rows-7 gap-1">
              {studyDays.map((day) => {
                let cellStyle: React.CSSProperties = {
                  backgroundColor: darkMode
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.06)',
                  borderColor: darkMode
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.08)',
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

            <div
              className={`flex items-center justify-between pt-3 text-xs ${
                darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <div className="min-h-[20px] font-mono">
                {hoveredDay ? (
                  <span style={{ color: activePalette.primary }} className="font-medium tabular-nums">
                    {hoveredDay.date} — {hoveredDay.hours} hours logged (
                    {hoveredDay.hours > 0 ? 'Active Session' : 'No Activity'})
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
                    backgroundColor: darkMode
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.06)',
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

      {/* Modular Resizable & Drag-Reorderable Cards Grid (2D Corner-Fitting Packing in Normal Mode / Freeform Floating in Metaverse Edit) */}
      <div
        ref={gridRef}
        style={
          isMetaverseEdit
            ? { height: `${metaverseTotalHeight}px`, perspective: '1400px' }
            : packedLayout
            ? { height: `${packedLayout.totalHeight}px` }
            : undefined
        }
        className={`relative w-full ${
          isMetaverseEdit
            ? `z-[220]${layoutTransitionReady ? ' transition-[height] duration-300 ease-out' : ''}`
            : packedLayout
            ? layoutTransitionReady
              ? 'transition-[height] duration-300 ease-out'
              : ''
            : 'flex flex-col gap-6'
        }`}
      >
        <AnimatePresence initial={false}>
          {cards.map((card, idx) => {
            const rect = !isMetaverseEdit ? packedLayout?.rects[idx] : undefined;
            const freeRect = isMetaverseEdit ? freeLayoutMap[card.id] : undefined;
            const widthPct = getCardWidthPct(card);
            const isDragging = draggingCardId === card.id || activeFreeDragId === card.id;
            const isResizing = resizingCardId === card.id;
            const isAnyResizing = resizingCardId !== null;
            const isActiveFreeAction = activeFreeDragId === card.id || (isMetaverseEdit && isResizing);
            const displayHeight = freeRect ? freeRect.h : rect ? rect.h : card.height;
            const cardZIndex = isMetaverseEdit ? (freeZOrder[card.id] ?? idx + 1) : undefined;

            const positionedStyle: React.CSSProperties = freeRect
              ? {
                  position: 'absolute',
                  left: `${freeRect.x}px`,
                  top: `${freeRect.y}px`,
                  width: `${freeRect.w}px`,
                  height: `${freeRect.h}px`,
                  zIndex: isActiveFreeAction ? topZCounterRef.current + 10 : cardZIndex,
                }
              : rect
              ? {
                  position: 'absolute',
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.cardW}px`,
                  height: `${rect.h}px`,
                }
              : ({
                  '--card-width-pct': `${widthPct}%`,
                } as React.CSSProperties);

            const depthVisualStyle: React.CSSProperties = isMetaverseEdit
              ? {
                  height: `${displayHeight}px`,
                  background: darkMode
                    ? 'linear-gradient(145deg, rgba(22, 32, 54, 0.94) 0%, rgba(11, 17, 32, 0.94) 100%)'
                    : 'linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, rgba(244, 247, 252, 0.94) 100%)',
                  borderColor: isActiveFreeAction
                    ? activePalette.primary
                    : `${activePalette.primary}55`,
                  boxShadow: isActiveFreeAction
                    ? `0 38px 90px -14px rgba(0, 0, 0, 0.95), 0 0 42px -4px ${activePalette.primary}60, inset 0 1px 0 rgba(255, 255, 255, 0.35)`
                    : `0 26px 64px -14px rgba(0, 0, 0, 0.88), 0 0 26px -8px ${activePalette.primary}38, inset 0 1px 0 rgba(255, 255, 255, 0.22)`,
                  transform: isActiveFreeAction
                    ? 'translateY(-4px) scale(1.012)'
                    : 'translateY(0px) scale(1)',
                }
              : {
                  height: `${displayHeight}px`,
                  ...(isDragging
                    ? {
                        borderColor: activePalette.primary,
                        opacity: 0.68,
                      }
                    : {}),
                };

            return (
              <motion.div
                key={card.id}
                data-dashboard-card="true"
                data-card-id={card.id}
                initial={{ opacity: 0, scale: 0.94, filter: 'blur(14px)' }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  filter: 'blur(0px)',
                  transitionEnd: { filter: 'none' },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.9,
                  filter: 'blur(16px)',
                }}
                transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                onContextMenu={(e) => {
                  if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) {
                    return;
                  }
                  e.preventDefault();
                  e.stopPropagation();
                  setCardPendingDelete(card);
                }}
                draggable={!isMetaverseEdit && dragReadyCardId === card.id && resizingCardId === null}
                onPointerDown={(e) => {
                  if (isMetaverseEdit) {
                    startFreeDrag(e, card);
                  }
                }}
                onPointerDownCapture={(e) => {
                  if (isMetaverseEdit) return;
                  const target = e.target as HTMLElement;
                  if (
                    target.closest(
                      'button, input, textarea, select, label, a, [data-resize-corner], [data-resize-edge], [data-no-drag]'
                    )
                  ) {
                    setDragReadyCardId(null);
                  } else {
                    setDragReadyCardId(card.id);
                  }
                }}
                onDragStart={(e: any) => {
                  if (isMetaverseEdit || resizingCardId !== null) {
                    e.preventDefault();
                    return;
                  }
                  setDraggingCardId(card.id);
                  if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', card.id);
                  }
                }}
                onDragOver={(e: any) => {
                  if (isMetaverseEdit) return;
                  e.preventDefault();
                  if (!draggingCardId || draggingCardId === card.id) return;
                  setCards((prev) => {
                    const fromIdx = prev.findIndex((c) => c.id === draggingCardId);
                    const toIdx = prev.findIndex((c) => c.id === card.id);
                    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
                    const next = [...prev];
                    const [moved] = next.splice(fromIdx, 1);
                    next.splice(toIdx, 0, moved);
                    return next;
                  });
                }}
                onDragEnd={() => {
                  setDraggingCardId(null);
                  setDragReadyCardId(null);
                }}
                style={positionedStyle}
                className={
                  isMetaverseEdit
                    ? activeFreeDragId === card.id || isResizing
                      ? 'cursor-grabbing touch-none'
                      : 'cursor-grab touch-none'
                    : rect
                    ? isAnyResizing || !layoutTransitionReady
                      ? ''
                      : 'transition-[left,top,width,height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'
                    : 'w-full shrink-0'
                }
              >
                <div
                  style={depthVisualStyle}
                  className={`w-full group/card relative liquid-glass rounded-2xl p-6 shadow-xl flex flex-col overflow-hidden ${
                    isResizing || activeFreeDragId === card.id ? 'select-none no-tilt' : ''
                  }`}
                >
                  {/* All 4 Corner Resize Hitzones (NW, NE, SW, SE) */}
                  <div
                    data-resize-corner="true"
                    onPointerDown={(e) => startResize(e, card, 'nw')}
                    className="group/corner absolute top-0 left-0 w-7 h-7 md:w-4 md:h-4 z-30 cursor-nwse-resize touch-none flex items-start justify-start p-1"
                    title="Drag corner to resize"
                  >
                    <span
                      className={`w-2 h-2 border-t-2 border-l-2 rounded-tl transition-opacity ${
                        isMetaverseEdit
                          ? 'opacity-45 group-hover/card:opacity-90'
                          : 'opacity-0 group-hover/corner:opacity-80'
                      }`}
                      style={{ borderColor: activePalette.primary }}
                    />
                  </div>
                  <div
                    data-resize-corner="true"
                    onPointerDown={(e) => startResize(e, card, 'ne')}
                    className="group/corner absolute top-0 right-0 w-7 h-7 md:w-4 md:h-4 z-30 cursor-nesw-resize touch-none flex items-start justify-end p-1"
                    title="Drag corner to resize"
                  >
                    <span
                      className={`w-2 h-2 border-t-2 border-r-2 rounded-tr transition-opacity ${
                        isMetaverseEdit
                          ? 'opacity-45 group-hover/card:opacity-90'
                          : 'opacity-0 group-hover/corner:opacity-80'
                      }`}
                      style={{ borderColor: activePalette.primary }}
                    />
                  </div>
                  <div
                    data-resize-corner="true"
                    onPointerDown={(e) => startResize(e, card, 'sw')}
                    className="group/corner absolute bottom-0 left-0 w-7 h-7 md:w-4 md:h-4 z-30 cursor-nesw-resize touch-none flex items-end justify-start p-1"
                    title="Drag corner to resize"
                  >
                    <span
                      className={`w-2 h-2 border-b-2 border-l-2 rounded-bl transition-opacity ${
                        isMetaverseEdit
                          ? 'opacity-45 group-hover/card:opacity-90'
                          : 'opacity-0 group-hover/corner:opacity-80'
                      }`}
                      style={{ borderColor: activePalette.primary }}
                    />
                  </div>
                  <div
                    data-resize-corner="true"
                    onPointerDown={(e) => startResize(e, card, 'se')}
                    className="group/corner absolute bottom-0 right-0 w-7 h-7 md:w-4 md:h-4 z-30 cursor-nwse-resize touch-none flex items-end justify-end p-1"
                    title="Drag corner to resize"
                  >
                    <span
                      className={`w-2 h-2 border-b-2 border-r-2 rounded-br transition-opacity ${
                        isMetaverseEdit
                          ? 'opacity-45 group-hover/card:opacity-90'
                          : 'opacity-0 group-hover/corner:opacity-80'
                      }`}
                      style={{ borderColor: activePalette.primary }}
                    />
                  </div>

                  {/* Pure Vertical & Horizontal Edge Resize Handles in Metaverse Edit */}
                  {isMetaverseEdit && (
                    <>
                      <div
                        data-resize-edge="true"
                        onPointerDown={(e) => startResize(e, card, 'n')}
                        className="group/edge absolute top-0 left-7 right-7 md:left-5 md:right-5 h-4 md:h-2.5 z-30 cursor-ns-resize touch-none flex items-start justify-center"
                        title="Drag top edge vertically"
                      >
                        <span
                          className="mt-0.5 w-10 h-1 rounded-full opacity-0 group-hover/card:opacity-65 group-hover/edge:opacity-100 transition-opacity"
                          style={{ backgroundColor: activePalette.primary }}
                        />
                      </div>
                      <div
                        data-resize-edge="true"
                        onPointerDown={(e) => startResize(e, card, 's')}
                        className="group/edge absolute bottom-0 left-7 right-7 md:left-5 md:right-5 h-4 md:h-2.5 z-30 cursor-ns-resize touch-none flex items-end justify-center"
                        title="Drag bottom edge vertically"
                      >
                        <span
                          className="mb-0.5 w-10 h-1 rounded-full opacity-0 group-hover/card:opacity-65 group-hover/edge:opacity-100 transition-opacity"
                          style={{ backgroundColor: activePalette.primary }}
                        />
                      </div>
                      <div
                        data-resize-edge="true"
                        onPointerDown={(e) => startResize(e, card, 'w')}
                        className="group/edge absolute left-0 top-7 bottom-7 md:top-5 md:bottom-5 w-4 md:w-2.5 z-30 cursor-ew-resize touch-none flex items-center justify-start"
                        title="Drag left edge horizontally"
                      >
                        <span
                          className="ml-0.5 h-10 w-1 rounded-full opacity-0 group-hover/card:opacity-65 group-hover/edge:opacity-100 transition-opacity"
                          style={{ backgroundColor: activePalette.primary }}
                        />
                      </div>
                      <div
                        data-resize-edge="true"
                        onPointerDown={(e) => startResize(e, card, 'e')}
                        className="group/edge absolute right-0 top-7 bottom-7 md:top-5 md:bottom-5 w-4 md:w-2.5 z-30 cursor-ew-resize touch-none flex items-center justify-end"
                        title="Drag right edge horizontally"
                      >
                        <span
                          className="mr-0.5 h-10 w-1 rounded-full opacity-0 group-hover/card:opacity-65 group-hover/edge:opacity-100 transition-opacity"
                          style={{ backgroundColor: activePalette.primary }}
                        />
                      </div>
                    </>
                  )}

                  {card.type === 'tasks' && (
                    <TasksCard
                      tasks={tasks}
                      onToggleTask={onToggleTask}
                      onAddTask={onAddTask}
                      onUpdateTask={onUpdateTask}
                      onDeleteTask={onDeleteTask}
                      activePalette={activePalette}
                      darkMode={darkMode}
                      searchQuery=""
                      cardTitle={card.title}
                      onEditTitle={() => handleOpenEditTitle(card)}
                    />
                  )}

                  {card.type === 'planner' && (
                    <StudyPlannerCard
                      planners={planners}
                      onAddPlanner={onAddPlanner}
                      onUpdatePlanner={onUpdatePlanner}
                      onUpdateProgress={onUpdatePlannerProgress}
                      onDeletePlanner={onDeletePlanner}
                      onOpenStudio={onOpenNotebookLM}
                      activePalette={activePalette}
                      darkMode={darkMode}
                      searchQuery=""
                      cardTitle={card.title}
                      onEditTitle={() => handleOpenEditTitle(card)}
                    />
                  )}

                  {card.type === 'syllabus' && (
                    <SyllabusCard
                      courses={syllabusCourses}
                      onChangeCourses={setSyllabusCourses}
                      activePalette={activePalette}
                      darkMode={darkMode}
                      searchQuery=""
                      cardTitle={card.title}
                      onEditTitle={() => handleOpenEditTitle(card)}
                    />
                  )}

                  {card.type === 'exam_schedule' && (
                    <ExamScheduleCard
                      exams={examSchedules}
                      onChangeExams={setExamSchedules}
                      activePalette={activePalette}
                      darkMode={darkMode}
                      searchQuery=""
                      cardTitle={card.title}
                      onEditTitle={() => handleOpenEditTitle(card)}
                    />
                  )}

                  {card.type === 'timetable' && (
                    <TimetableCard
                      slots={timetableSlots}
                      onChangeSlots={setTimetableSlots}
                      activePalette={activePalette}
                      darkMode={darkMode}
                      searchQuery=""
                      cardTitle={card.title}
                      onEditTitle={() => handleOpenEditTitle(card)}
                    />
                  )}

                  {card.type === 'calendar' && (
                    <CalendarCard
                      localEvents={localCalendarEvents}
                      onChangeLocalEvents={setLocalCalendarEvents}
                      activePalette={activePalette}
                      darkMode={darkMode}
                      searchQuery=""
                      cardTitle={card.title}
                      onEditTitle={() => handleOpenEditTitle(card)}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Outlined '+' Card Below to Add Dashboard Cards */}
      <button
        type="button"
        onClick={() => setShowAddCardModal(true)}
        style={
          isMetaverseEdit
            ? {
                borderColor: `${activePalette.primary}90`,
                background: darkMode
                  ? 'linear-gradient(145deg, rgba(16, 24, 42, 0.94), rgba(10, 15, 28, 0.96))'
                  : 'linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(244, 247, 252, 0.94))',
                boxShadow: `0 24px 60px -12px rgba(0, 0, 0, 0.9), 0 0 28px -8px ${activePalette.primary}45`,
              }
            : {
                borderColor: `${activePalette.primary}45`,
              }
        }
        className={`relative w-full rounded-2xl border-2 border-dashed p-4 md:p-6 transition-[transform,box-shadow,border-color,background-color] duration-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-left cursor-pointer group backdrop-blur-md hover:scale-[1.004] active:scale-[0.996] ${
          isMetaverseEdit ? 'z-[220]' : ''
        } ${
          darkMode
            ? 'bg-slate-900/30 hover:bg-slate-900/50'
            : 'bg-white/55 hover:bg-white/80 shadow-sm hover:shadow-md'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-11 h-11 rounded-xl border-2 border-dashed flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shrink-0"
            style={{
              borderColor: activePalette.primary,
              color: activePalette.primary,
            }}
          >
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <p
              className={`text-sm font-bold ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              Add Dashboard Card
            </p>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Tasks & Chores · Study Planner · Syllabus · Exam Schedule · Timetable · Calendar
            </p>
          </div>
        </div>

        <span
          className="text-xs font-semibold px-3.5 py-2 rounded-xl border transition shrink-0 group-hover:opacity-90"
          style={{
            borderColor: `${activePalette.primary}55`,
            backgroundColor: `${activePalette.primary}15`,
            color: activePalette.primary,
          }}
        >
          Choose Card
        </span>
      </button>

      {/* Card Picker Modal */}
      <DashboardModal
        isOpen={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
        title="Add Card to Dashboard"
        subtitle="Select a workspace module. Every card can be dragged to reorder and resized from any corner."
        icon={<Plus className="w-4 h-4" style={{ color: activePalette.primary }} />}
        activePalette={activePalette}
        darkMode={darkMode}
        maxWidthClass="max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CARD_CATALOG.map((item) => {
            const Icon = item.icon;
            const countInGrid = cards.filter((c) => c.type === item.type).length;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => handleAddCard(item.type)}
                className={`p-4 rounded-2xl border text-left transition-all duration-150 flex items-start gap-3 cursor-pointer hover:scale-[1.01] active:scale-[0.985] ${
                  darkMode
                    ? 'border-white/15 bg-white/[0.04] hover:bg-white/[0.09] hover:border-white/30'
                    : 'border-slate-200/80 bg-white/60 hover:bg-white/90 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${activePalette.primary}15`,
                    borderColor: `${activePalette.primary}35`,
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color: activePalette.primary }} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-bold truncate ${
                        darkMode ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      {item.title}
                    </span>
                    {countInGrid > 0 && (
                      <span
                        className="text-[11px] font-mono tabular-nums shrink-0"
                        style={{ color: activePalette.primary }}
                      >
                        {countInGrid} active
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs leading-relaxed ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DashboardModal>

      {/* Right-Click Card Delete Confirmation Modal */}
      <DashboardModal
        isOpen={Boolean(cardPendingDelete)}
        onClose={() => setCardPendingDelete(null)}
        title="Delete Dashboard Card"
        subtitle="Right-click confirmation"
        icon={<Trash2 className="w-4 h-4 text-red-400" />}
        activePalette={activePalette}
        darkMode={darkMode}
        maxWidthClass="max-w-md"
      >
        {cardPendingDelete && (
          <div className="space-y-4">
            <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Do you want to remove the entire{' '}
              <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                {getCardDisplayTitle(cardPendingDelete)}
              </span>{' '}
              card from your dashboard? Your underlying items stay saved, and you can re-add this module anytime from the <span className="font-semibold">+</span> card below.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCardPendingDelete(null)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
                  darkMode ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCard}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 shadow transition"
              >
                Delete Card
              </button>
            </div>
          </div>
        )}
      </DashboardModal>

      {/* Edit Card Name Modal */}
      <DashboardModal
        isOpen={Boolean(editingTitleCard)}
        onClose={() => {
          setEditingTitleCard(null);
          setDraftCardTitle('');
        }}
        title="Edit Card Name"
        subtitle={
          editingTitleCard
            ? `Customize the heading displayed on this ${DEFAULT_CARD_TITLES[editingTitleCard.type]} card.`
            : undefined
        }
        icon={<Pencil className="w-4 h-4" style={{ color: activePalette.primary }} />}
        activePalette={activePalette}
        darkMode={darkMode}
        maxWidthClass="max-w-md"
      >
        {editingTitleCard && (
          <form onSubmit={handleSaveCardTitle} className="space-y-4">
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Card Name
              </label>
              <input
                type="text"
                autoFocus
                value={draftCardTitle}
                onChange={(e) => setDraftCardTitle(e.target.value)}
                placeholder={DEFAULT_CARD_TITLES[editingTitleCard.type]}
                className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-white/10 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                style={{ borderColor: `${activePalette.primary}45` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDraftCardTitle(DEFAULT_CARD_TITLES[editingTitleCard.type])}
                className={`text-xs transition ${
                  darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Reset to default
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTitleCard(null);
                    setDraftCardTitle('');
                  }}
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
                  Save Name
                </button>
              </div>
            </div>
          </form>
        )}
      </DashboardModal>
    </div>
  );
};

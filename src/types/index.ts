export type ActiveTab = 'lander' | 'dashboard' | 'library' | 'notebooklm' | 'onenote' | 'gemini' | 'analytics' | 'settings';

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  type: string;
  isImage: boolean;
  dataUrl?: string;
  textContent?: string;
}

export interface GeminiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  thinking?: string;
  attachments?: ChatAttachment[];
}

export interface GeminiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: GeminiChatMessage[];
  model?: string;
  pinned?: boolean;
}

export interface StudyDay {
  date: string; // YYYY-MM-DD
  count: number; // 0 to 4 intensity
  hours: number;
}

export interface TaskItem {
  id: string;
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  dueDate: string;
  dueAt?: string | null; // ISO timestamp; null/undefined = No time until completion
}

export interface PlannerEntry {
  id: string;
  title: string;
  subject: string;
  timeSlot: string;
  date: string;
  milestone: string;
  progress: number; // 0-100
}

export type DashboardCardType =
  | 'tasks'
  | 'planner'
  | 'syllabus'
  | 'exam_schedule'
  | 'timetable'
  | 'calendar';

export interface DashboardCardInstance {
  id: string;
  type: DashboardCardType;
  title?: string; // optional custom card display name
  colSpan: number; // legacy 4 to 12 fallback in 12-col desktop grid
  widthPct?: number; // continuous percentage width (25 to 100) for smooth horizontal resize
  height: number; // card height in px
}

export interface SyllabusTopic {
  id: string;
  title: string;
  completed: boolean;
}

export interface SyllabusCourse {
  id: string;
  name: string;
  code?: string;
  topics: SyllabusTopic[];
}

export interface ExamScheduleEntry {
  id: string;
  course: string;
  title: string;
  date: string; // YYYY-MM-DD or descriptive date
  time: string;
  venue: string;
  notes?: string;
}

export type WeekdayShort = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface TimetableSlot {
  id: string;
  day: WeekdayShort;
  subject: string;
  startTime: string; // HH:MM (24h)
  endTime: string; // HH:MM (24h)
  room?: string;
  kind: 'Lecture' | 'Lab' | 'Tutorial' | 'Study';
}

export interface CalendarEventEntry {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  allDay?: boolean;
  location?: string;
  description?: string;
  source?: 'local';
}

export interface NotebookSource {
  id: string;
  title: string;
  type: 'pdf' | 'text' | 'web' | 'notes';
  excerpt: string;
  fullContent: string;
  words: number;
  selected: boolean;
  dateAdded: string;
  dataUrl?: string;
  mimeType?: string;
  isImage?: boolean;
  isGenerated?: boolean;
}

export type BlockType = 'h1' | 'h2' | 'h3' | 'paragraph' | 'todo' | 'bullet' | 'numbered' | 'code' | 'callout' | 'quote' | 'image' | 'table' | 'math';

export interface NoteBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  indent?: number; // 0, 1, 2, 3 levels of indentation / sub-bullets
  language?: string;
  tag?: string;
  // Math equation block properties
  mathDescription?: string;
  mathDisplayMode?: boolean;
  // Table block properties
  tableHeaders?: string[];
  tableRows?: string[][];
  tableCellColors?: Record<string, string>; // cell key (e.g. '0-1' or 'th-0') mapped to color theme ID
  todoItems?: Array<{ id: string; text: string; checked: boolean }>;
  bulletItems?: Array<{ id: string; text: string; indent: number }>;
  numberedItems?: Array<{ id: string; text: string }>;
  textColor?: string;
  fontFamily?: 'default' | 'mono' | 'serif' | 'display';
  imageUrl?: string;
  caption?: string;
  width?: number; // width percentage (20 to 100)
  height?: number; // vertical height in px (150 to 900)
  sideMode?: 'none' | 'left' | 'right'; // parallel side-by-side: 'left' (image on left), 'right' (image on right)
  sideBlockType?: BlockType; // type of parallel companion block: 'code' | 'paragraph' | 'todo' | 'callout' | 'quote' | 'h1' | 'h2' | 'image' | 'table'
  sideBlockName?: string; // custom editable name/label for parallel companion block
  sideImageUrl?: string;
  sideCaption?: string;
  sideContent?: string;
  sideTitle?: string;
  sideCitation?: string;
  sideCodeContent?: string;
  sideCodeLanguage?: string;
  sideChecked?: boolean;
}

export interface OneNotePage {
  id: string;
  title: string;
  updatedAt: string;
  blocks: NoteBlock[];
}

export interface OneNoteSection {
  id: string;
  title: string;
  color: string;
  pages: OneNotePage[];
}

export interface OneNoteNotebook {
  id: string;
  title: string;
  description: string;
  icon?: string;
  sections: OneNoteSection[];
}

export interface LibraryItem {
  id: string;
  title: string;
  type: 'project' | 'notebook' | 'document' | 'planner' | 'onenote' | 'workspace';
  folder: string;
  updatedAt: string;
  tags: string[];
  description: string;
  star?: boolean;
  workspaceId?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  folder: string; // e.g. 'Assorted Workspaces', 'NotebookLM Research', etc.
  mode?: 'full' | 'onenote-only';
  createdAt: string;
  updatedAt: string;
  color?: string;
  sources: NotebookSource[];
  notebooks: OneNoteNotebook[];
  conversations: GeminiConversation[];
  chatMessages?: GeminiChatMessage[];
  isClosed?: boolean;
  lastOpenedAt?: string;
}

export interface SubjectAnalytics {
  subject: string;
  minutes: number;
  percentage: number;
  color: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  fullTimestamp?: string;
  action: string;
  detail: string;
  category: 'system' | 'note' | 'source' | 'ai' | 'task';
  workspaceId?: string;
  workspaceName?: string;
  folderName?: string;
  targetContext?: 'notebooklm' | 'onenote' | 'gemini' | 'library' | 'dashboard' | 'settings';
}

export type ColorPaletteId =
  | 'gold-obsidian'
  | 'crimson-velvet'
  | 'nordic-frost'
  | 'emerald-solarium'
  | 'cyberpunk-amber'
  | 'midnight-sapphire'
  | 'travertine-minimal'
  | 'amethyst-royal'
  | 'tokyo-neon'
  | 'titanium-mono'
  | 'autumn'
  | 'black-night'
  | 'custom';

export interface CustomPaletteConfig {
  name: string;
  primary: string;
  accent: string;
  bgDark: string;
}

export interface ColorPalette {
  id: ColorPaletteId;
  name: string;
  description: string;
  primary: string;
  accent: string;
  gradient: string;
  bgDark: string;
  textAccent: string;
}

export type CursorStyleId =
  | 'arrow'
  | 'chevron'
  | 'circle'
  | 'crosshair'
  | 'cross'
  | 'pen'
  | 'default'
  | 'white-circle'
  | 'white-plus'
  | 'white-pen'
  | 'white-crosshair'
  | 'white-cross';


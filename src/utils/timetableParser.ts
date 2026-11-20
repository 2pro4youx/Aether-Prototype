export type DecodedWeekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type DecodedSlotKind = 'Lecture' | 'Lab' | 'Tutorial' | 'Study';

export interface DecodedTimetableSlot {
  day: DecodedWeekday;
  subject: string;
  startTime: string;
  endTime: string;
  room: string;
  kind: DecodedSlotKind;
}

export interface DecodedTimeColumn {
  colIndex?: number;
  startTime?: string;
  endTime?: string;
  isBreak?: boolean;
}

const BARE_SLOT_CODE_RE = /^(?:[A-Z]{1,3}\d{1,2}(?:\s*[+/,-]\s*[A-Z]{1,3}\d{1,2})*)$/i;
const COURSE_CODE_RE = /^[A-Z]{2,6}\d{3,4}[A-Z]?$/i;
const TYPE_TAG_RE = /^(?:LT|LTP|LP|TP|P|L|T|PJ|LO|TH|ETP|ETH|ELA|EPJ|SS|PR|TR)$/i;
const TRAILING_BATCH_RE = /^(?:ALL|ONLY|BATCH\s*[A-Z0-9]*|SEC(?:TION)?\s*[A-Z0-9]+|G\d{1,2}|B\d{1,2})$/i;
const CHROME_OR_EMPTY_RE =
  /^(?:lunch|break|recess|free|empty|blank|none|n\/a|nil|null|-+|—+|theory|lab|start|end|mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)$/i;

export function normalizeDecodedWeekday(raw: unknown): DecodedWeekday | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('mon')) return 'Mon';
  if (s.startsWith('tue')) return 'Tue';
  if (s.startsWith('wed')) return 'Wed';
  if (s.startsWith('thu')) return 'Thu';
  if (s.startsWith('fri')) return 'Fri';
  if (s.startsWith('sat')) return 'Sat';
  if (s.startsWith('sun')) return 'Sun';
  return null;
}

export function normalizeDecodedTime(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s || CHROME_OR_EMPTY_RE.test(s)) return '';

  const ampmMatch = s.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toLowerCase();
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  const hhmmMatch = s.match(/^(\d{1,2})[:.](\d{2})$/);
  if (hhmmMatch) {
    const h = parseInt(hhmmMatch[1], 10);
    const m = parseInt(hhmmMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  const compactMatch = s.match(/^(\d{2})(\d{2})$/);
  if (compactMatch) {
    const h = parseInt(compactMatch[1], 10);
    const m = parseInt(compactMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  return '';
}

function inferKindFromTag(tag: string): DecodedSlotKind {
  const upper = tag.trim().toUpperCase();
  if (upper === 'P' || upper === 'LP' || upper === 'LO' || upper === 'ELA' || upper === 'TP' || upper === 'PR') {
    return 'Lab';
  }
  if (upper === 'T' || upper === 'TR') {
    return 'Tutorial';
  }
  return 'Lecture';
}

export function normalizeDecodedKind(raw: unknown, fallback: DecodedSlotKind = 'Lecture'): DecodedSlotKind {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return fallback;
  if (
    s === 'p' ||
    s === 'lp' ||
    s === 'lo' ||
    s === 'ela' ||
    s === 'pr' ||
    s.includes('lab') ||
    s.includes('practical')
  ) {
    return 'Lab';
  }
  if (s === 't' || s === 'tr' || s.includes('tut')) return 'Tutorial';
  if (s.includes('study') || s.includes('self') || s.includes('prep')) return 'Study';
  if (s === 'lt' || s === 'ltp' || s === 'l' || s.includes('lec') || s.includes('theory')) {
    return 'Lecture';
  }
  return fallback;
}

function cleanStandaloneRoom(rawRoom: string): string {
  let cleaned = rawRoom.trim();
  if (!cleaned || CHROME_OR_EMPTY_RE.test(cleaned)) {
    return '';
  }

  cleaned = cleaned.replace(/^(?:LT|LTP|LP|TP|P|L|T|PJ|LO|TH|ETH|ELA)\s*-\s*/i, '');
  cleaned = cleaned.replace(/\s*-\s*(?:ALL|ONLY)\s*$/i, '');
  cleaned = cleaned.replace(/\s+(?:ALL|ONLY)\s*$/i, '');
  cleaned = cleaned.trim();

  if (
    !cleaned ||
    CHROME_OR_EMPTY_RE.test(cleaned) ||
    BARE_SLOT_CODE_RE.test(cleaned) ||
    TYPE_TAG_RE.test(cleaned) ||
    TRAILING_BATCH_RE.test(cleaned)
  ) {
    return '';
  }

  return cleaned;
}

function parseTokenSequence(
  tokens: string[],
  roomText: string,
  rawKind: unknown
): { subject: string; room: string; kind: DecodedSlotKind } | null {
  if (tokens.length === 0) return null;

  // Find explicit course code anywhere in tokens (e.g. MAT3003, EEE1001, CSA2001)
  let courseIdx = tokens.findIndex((t) => COURSE_CODE_RE.test(t));

  // If no explicit course code pattern found, treat first non-slot, non-type, non-batch token as subject if structured
  if (courseIdx === -1) {
    const hasStructuredMarkers =
      BARE_SLOT_CODE_RE.test(tokens[0]) ||
      tokens.some((t) => TYPE_TAG_RE.test(t)) ||
      TRAILING_BATCH_RE.test(tokens[tokens.length - 1]);

    if (!hasStructuredMarkers) return null;

    const firstCandidate = tokens.findIndex(
      (t) =>
        !BARE_SLOT_CODE_RE.test(t) &&
        !TYPE_TAG_RE.test(t) &&
        !TRAILING_BATCH_RE.test(t) &&
        !CHROME_OR_EMPTY_RE.test(t)
    );
    if (firstCandidate === -1) return null;
    courseIdx = firstCandidate;
  }

  const courseCode = tokens[courseIdx].trim();
  if (!courseCode || BARE_SLOT_CODE_RE.test(courseCode) || CHROME_OR_EMPTY_RE.test(courseCode)) {
    return null;
  }

  // Tokens before courseIdx are slot prefixes (A11, A13, A21, TAA1, L31+L32, etc.) -> drop all
  const tail = tokens.slice(courseIdx + 1);

  // Drop trailing batch marker(s) like ALL, ONLY
  while (tail.length > 0 && TRAILING_BATCH_RE.test(tail[tail.length - 1])) {
    tail.pop();
  }

  let inferredKind: DecodedSlotKind = normalizeDecodedKind(rawKind, 'Lecture');
  const typeIdx = tail.findIndex((t) => TYPE_TAG_RE.test(t));
  let roomTokens: string[] = [];

  if (typeIdx !== -1) {
    inferredKind = inferKindFromTag(tail[typeIdx]);
    // Anything before typeIdx is another slot marker; everything after typeIdx is the room (e.g. AB02-418, AB-303)
    roomTokens = tail.slice(typeIdx + 1);
  } else {
    // Drop leading slot markers if any precede the room
    const work = [...tail];
    while (work.length > 1 && BARE_SLOT_CODE_RE.test(work[0]) && !/^\d{2,4}$/.test(work[1])) {
      work.shift();
    }
    roomTokens = work;
  }

  const parsedRoom = cleanStandaloneRoom(roomTokens.join('-'));
  const fallbackRoom = cleanStandaloneRoom(roomText);

  return {
    subject: COURSE_CODE_RE.test(courseCode) ? courseCode.toUpperCase() : courseCode,
    room: parsedRoom || fallbackRoom,
    kind: inferredKind,
  };
}

/**
 * Normalizes a timetable cell from university slot-grid or standard timetables:
 * - Drops empty slots (A11, A13, A21, B13, A23, TAA1, L31+L32, Lunch, THEORY)
 * - Unpacks compound strings in flexible token orders (e.g. A11-MAT3003-LT-AB02-418-ALL -> subject: MAT3003, room: AB02-418)
 */
export function normalizeTimetableCell(
  rawSubject: unknown,
  rawRoom?: unknown,
  rawKind?: unknown
): { subject: string; room: string; kind: DecodedSlotKind } | null {
  const subjectText = String(rawSubject ?? '').trim();
  const roomText = String(rawRoom ?? '').trim();

  if (!subjectText || CHROME_OR_EMPTY_RE.test(subjectText) || BARE_SLOT_CODE_RE.test(subjectText)) {
    return null;
  }

  if (subjectText.includes('-')) {
    const tokens = subjectText
      .split(/\s*-\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
    const parsed = parseTokenSequence(tokens, roomText, rawKind);
    if (parsed) return parsed;
    if (tokens.every((t) => BARE_SLOT_CODE_RE.test(t) || CHROME_OR_EMPTY_RE.test(t))) {
      return null;
    }
  }

  const spaceTokens = subjectText.split(/\s+/).filter(Boolean);
  if (
    spaceTokens.length >= 2 &&
    (BARE_SLOT_CODE_RE.test(spaceTokens[0]) ||
      spaceTokens.some((t) => COURSE_CODE_RE.test(t) && spaceTokens.some((m) => TYPE_TAG_RE.test(m) || TRAILING_BATCH_RE.test(m))))
  ) {
    const parsed = parseTokenSequence(spaceTokens, roomText, rawKind);
    if (parsed) return parsed;
  }

  const cleanSubject = subjectText
    .replace(/^(?:[A-Z]{1,3}\d{1,2}(?:\+[A-Z]{1,3}\d{1,2})*)\s*[-:]\s*/i, '')
    .replace(/\s*-\s*(?:ALL|ONLY)\s*$/i, '')
    .trim();

  if (!cleanSubject || BARE_SLOT_CODE_RE.test(cleanSubject) || CHROME_OR_EMPTY_RE.test(cleanSubject)) {
    return null;
  }

  return {
    subject: COURSE_CODE_RE.test(cleanSubject) ? cleanSubject.toUpperCase() : cleanSubject,
    room: cleanStandaloneRoom(roomText),
    kind: normalizeDecodedKind(rawKind, 'Lecture'),
  };
}

export function sanitizeDecodedTimetableSlots(
  rawSlots: unknown,
  fallbackDay: DecodedWeekday = 'Mon',
  timeColumns?: DecodedTimeColumn[]
): DecodedTimetableSlot[] {
  if (!Array.isArray(rawSlots)) return [];

  const colLookup = new Map<number, { startTime: string; endTime: string; isBreak: boolean }>();
  if (Array.isArray(timeColumns)) {
    for (const col of timeColumns) {
      if (!col || typeof col !== 'object') continue;
      const idx = Number(col.colIndex);
      if (!Number.isFinite(idx) || idx < 1) continue;
      colLookup.set(idx, {
        startTime: normalizeDecodedTime(col.startTime),
        endTime: normalizeDecodedTime(col.endTime),
        isBreak: Boolean(col.isBreak),
      });
    }
  }

  const seen = new Set<string>();
  const cleaned: DecodedTimetableSlot[] = [];

  for (const item of rawSlots) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;

    const rawTextCandidate = String(rec.rawCellText ?? '').trim();
    const subjectCandidate = String(rec.subject ?? rec.courseCode ?? '').trim();

    // Prefer rawCellText if it retains compound structure, else parse subject
    const parsedCell =
      (rawTextCandidate ? normalizeTimetableCell(rawTextCandidate, rec.room, rec.kind) : null) ||
      normalizeTimetableCell(subjectCandidate, rec.room, rec.kind);

    if (!parsedCell) continue;

    const day = normalizeDecodedWeekday(rec.day) || fallbackDay;
    let startTime = normalizeDecodedTime(rec.startTime);
    let endTime = normalizeDecodedTime(rec.endTime);

    const colIdx = Number(rec.colIndex);
    if (Number.isFinite(colIdx) && colLookup.has(colIdx)) {
      const colInfo = colLookup.get(colIdx)!;
      if (!colInfo.isBreak && colInfo.startTime) {
        if (!startTime) startTime = colInfo.startTime;
        if (!endTime && colInfo.endTime) endTime = colInfo.endTime;
      }
    }

    const dedupeKey = `${day}|${startTime}|${endTime}|${parsedCell.subject.toUpperCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    cleaned.push({
      day,
      subject: parsedCell.subject,
      startTime,
      endTime,
      room: parsedCell.room,
      kind: parsedCell.kind,
    });
  }

  return cleaned;
}

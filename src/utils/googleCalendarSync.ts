import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { CalendarEventEntry, TaskItem } from '../types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// Strictly in-memory OAuth access token cache (never persisted to localStorage or sessionStorage)
let cachedCalendarAccessToken: string | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

export function setGoogleCalendarAccessToken(token: string | null): void {
  const normalized = token && token.trim() ? token.trim() : null;
  if (cachedCalendarAccessToken === normalized) return;
  cachedCalendarAccessToken = normalized;
  tokenListeners.forEach((listener) => listener(cachedCalendarAccessToken));
}

export function getGoogleCalendarAccessToken(): string | null {
  return cachedCalendarAccessToken;
}

export function subscribeGoogleCalendarToken(
  listener: (token: string | null) => void
): () => void {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

export async function reauthorizeGoogleCalendar(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  if (!token) {
    throw new Error('Google sign-in succeeded, but Calendar permission was not granted.');
  }
  setGoogleCalendarAccessToken(token);
  return token;
}

function toLocalDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

interface GoogleCalendarApiEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

function mapGoogleEventToEntry(ev: GoogleCalendarApiEvent): CalendarEventEntry | null {
  if (!ev.id || ev.status === 'cancelled') return null;

  const isAllDay = Boolean(ev.start?.date && !ev.start?.dateTime);
  let dateKey = '';
  let startTime: string | undefined;
  let endTime: string | undefined;

  if (isAllDay && ev.start?.date) {
    dateKey = ev.start.date.slice(0, 10);
  } else if (ev.start?.dateTime) {
    const startDt = new Date(ev.start.dateTime);
    if (Number.isNaN(startDt.getTime())) return null;
    dateKey = toLocalDateKey(startDt);
    startTime = toLocalHHMM(startDt);
    if (ev.end?.dateTime) {
      const endDt = new Date(ev.end.dateTime);
      if (!Number.isNaN(endDt.getTime())) {
        endTime = toLocalHHMM(endDt);
      }
    }
  } else {
    return null;
  }

  return {
    id: `gcal-${ev.id}`,
    googleEventId: ev.id,
    title: ev.summary?.trim() || '(Untitled event)',
    date: dateKey,
    startTime,
    endTime,
    allDay: isAllDay,
    location: ev.location || undefined,
    description: ev.description || undefined,
    source: 'google',
  };
}

export async function pullGoogleCalendarEvents(accessToken: string): Promise<CalendarEventEntry[]> {
  const now = new Date();
  const minDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 6, 0, 23, 59, 59);

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    timeMin: minDate.toISOString(),
    timeMax: maxDate.toISOString(),
  });

  const res = await fetch(`${CALENDAR_API_BASE}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    setGoogleCalendarAccessToken(null);
    throw new Error('Google Calendar session expired. Please reconnect your Google account.');
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error?.message || `Google Calendar sync failed (${res.status})`);
  }

  const data = (await res.json()) as { items?: GoogleCalendarApiEvent[] };
  const items = Array.isArray(data.items) ? data.items : [];
  const mapped: CalendarEventEntry[] = [];
  for (const item of items) {
    const entry = mapGoogleEventToEntry(item);
    if (entry) mapped.push(entry);
  }
  return mapped;
}

export function mergeGoogleAndLocalEvents(
  existingEvents: CalendarEventEntry[],
  pulledGoogleEvents: CalendarEventEntry[]
): CalendarEventEntry[] {
  const localOnly = existingEvents.filter((ev) => ev.source !== 'google');
  const pulledByGoogleId = new Map<string, CalendarEventEntry>();
  for (const gev of pulledGoogleEvents) {
    if (gev.googleEventId) {
      pulledByGoogleId.set(gev.googleEventId, gev);
    }
  }
  // Filter out any local item whose googleEventId now has a canonical pulled Google event
  const cleanLocal = localOnly.filter(
    (ev) => !ev.googleEventId || !pulledByGoogleId.has(ev.googleEventId)
  );
  return [...cleanLocal, ...pulledGoogleEvents];
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days);
  return toLocalDateKey(dt);
}

function buildGoogleEventPayload(ev: {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  aetherKey: string;
}): Record<string, unknown> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const payload: Record<string, unknown> = {
    summary: ev.title,
    location: ev.location || undefined,
    description: ev.description || undefined,
    extendedProperties: {
      private: {
        aetherKey: ev.aetherKey,
      },
    },
  };

  if (ev.allDay || !ev.startTime) {
    payload.start = { date: ev.date };
    payload.end = { date: addDaysToDateKey(ev.date, 1) };
  } else {
    const [y, m, d] = ev.date.split('-').map(Number);
    const [sh, sm] = ev.startTime.split(':').map(Number);
    const startDt = new Date(y, (m || 1) - 1, d || 1, sh || 9, sm || 0, 0);
    let endDt: Date;
    if (ev.endTime) {
      const [eh, em] = ev.endTime.split(':').map(Number);
      endDt = new Date(y, (m || 1) - 1, d || 1, eh || 10, em || 0, 0);
      if (endDt <= startDt) {
        endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
      }
    } else {
      endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
    }
    payload.start = { dateTime: startDt.toISOString(), timeZone: tz };
    payload.end = { dateTime: endDt.toISOString(), timeZone: tz };
  }

  return payload;
}

export function extractTimedTasksForCalendar(tasks: TaskItem[]): Array<{
  task: TaskItem;
  date: string;
  startTime: string;
}> {
  const out: Array<{ task: TaskItem; date: string; startTime: string }> = [];
  for (const task of tasks) {
    if (!task.dueAt) continue;
    const dt = new Date(task.dueAt);
    if (Number.isNaN(dt.getTime())) continue;
    out.push({
      task,
      date: toLocalDateKey(dt),
      startTime: toLocalHHMM(dt),
    });
  }
  return out;
}

export async function pushDashboardItemsToGoogleCalendar(options: {
  accessToken: string;
  localEvents: CalendarEventEntry[];
  tasks: TaskItem[];
}): Promise<{ created: number; updated: number; mappedGoogleIds: Map<string, string> }> {
  const { accessToken, localEvents, tasks } = options;

  // First read existing upcoming events so we can update matched aetherKeys cleanly
  const existingParams = new URLSearchParams({
    singleEvents: 'true',
    maxResults: '250',
  });
  const listRes = await fetch(`${CALENDAR_API_BASE}?${existingParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.status === 401 || listRes.status === 403) {
    setGoogleCalendarAccessToken(null);
    throw new Error('Google Calendar session expired. Please reconnect your Google account.');
  }
  if (!listRes.ok) {
    const errBody = await listRes.json().catch(() => null);
    throw new Error(errBody?.error?.message || `Failed to inspect Google Calendar (${listRes.status})`);
  }

  const listData = (await listRes.json()) as { items?: GoogleCalendarApiEvent[] };
  const existingByAetherKey = new Map<string, string>();
  for (const item of listData.items || []) {
    const key = item.extendedProperties?.private?.aetherKey;
    if (key && item.id) {
      existingByAetherKey.set(key, item.id);
    }
  }

  let created = 0;
  let updated = 0;
  const mappedGoogleIds = new Map<string, string>();

  const pendingItems: Array<{
    localId: string;
    existingGoogleId?: string;
    payload: Record<string, unknown>;
  }> = [];

  for (const ev of localEvents) {
    if (ev.source === 'google') continue;
    const aetherKey = `event:${ev.id}`;
    const existingGoogleId = ev.googleEventId || existingByAetherKey.get(aetherKey);
    pendingItems.push({
      localId: ev.id,
      existingGoogleId,
      payload: buildGoogleEventPayload({
        title: ev.title,
        date: ev.date,
        startTime: ev.startTime,
        endTime: ev.endTime,
        allDay: ev.allDay,
        location: ev.location,
        description: ev.description,
        aetherKey,
      }),
    });
  }

  const timedTasks = extractTimedTasksForCalendar(tasks);
  for (const { task, date, startTime } of timedTasks) {
    if (task.completed) continue;
    const aetherKey = `task:${task.id}`;
    const existingGoogleId = existingByAetherKey.get(aetherKey);
    pendingItems.push({
      localId: `task:${task.id}`,
      existingGoogleId,
      payload: buildGoogleEventPayload({
        title: `[Task] ${task.title}`,
        date,
        startTime,
        allDay: false,
        description: `Category: ${task.category} · Priority: ${task.priority}`,
        aetherKey,
      }),
    });
  }

  for (const item of pendingItems) {
    const url = item.existingGoogleId
      ? `${CALENDAR_API_BASE}/${encodeURIComponent(item.existingGoogleId)}`
      : CALENDAR_API_BASE;
    const method = item.existingGoogleId ? 'PATCH' : 'POST';

    const resp = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item.payload),
    });

    if (resp.status === 401 || resp.status === 403) {
      setGoogleCalendarAccessToken(null);
      throw new Error('Google Calendar session expired. Please reconnect your Google account.');
    }
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => null);
      throw new Error(errBody?.error?.message || `Failed syncing event (${resp.status})`);
    }
    const saved = (await resp.json()) as { id?: string };
    if (saved.id) {
      mappedGoogleIds.set(item.localId, saved.id);
    }
    if (item.existingGoogleId) updated += 1;
    else created += 1;
  }

  return { created, updated, mappedGoogleIds };
}

export async function deleteGoogleCalendarEventById(
  accessToken: string,
  googleEventId: string
): Promise<void> {
  const resp = await fetch(`${CALENDAR_API_BASE}/${encodeURIComponent(googleEventId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (resp.status === 401 || resp.status === 403) {
    setGoogleCalendarAccessToken(null);
    throw new Error('Google Calendar session expired. Please reconnect your Google account.');
  }
  if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
    const errBody = await resp.json().catch(() => null);
    throw new Error(errBody?.error?.message || `Failed to delete Google Calendar event (${resp.status})`);
  }
}

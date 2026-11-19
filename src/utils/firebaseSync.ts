import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AuditLog,
  CalendarEventEntry,
  ColorPaletteId,
  CursorStyleId,
  CustomPaletteConfig,
  DashboardCardInstance,
  ExamScheduleEntry,
  LibraryItem,
  PlannerEntry,
  SyllabusCourse,
  TaskItem,
  TimetableSlot,
  Workspace,
} from '../types';
import type { LearnedMemoryItem } from './personalization';

export interface FloatingChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export type AppStateKey = 'dashboard' | 'analytics' | 'preferences' | 'floatingChat';

export interface DashboardStatePayload {
  cards: DashboardCardInstance[];
  tasks: TaskItem[];
  planners: PlannerEntry[];
  syllabusCourses: SyllabusCourse[];
  examSchedules: ExamScheduleEntry[];
  timetableSlots: TimetableSlot[];
  localCalendarEvents: CalendarEventEntry[];
}

export interface AnalyticsStatePayload {
  dailyStudySeconds: Record<string, number>;
  workspaceSeconds: Record<string, number>;
  workspaceInteractions: Record<string, number>;
  auditLogs: AuditLog[];
  folders: string[];
  libraryItems: LibraryItem[];
  activeWorkspaceId: string;
}

export interface PreferencesStatePayload {
  darkMode: boolean;
  activePaletteId: ColorPaletteId;
  customPaletteConfig: CustomPaletteConfig;
  selectedModel: string;
  enableThinking: boolean;
  cursorStyle: CursorStyleId;
  cursorColorAdapter: number;
  smoothScroll: boolean;
  glowMultiplier: number;
  canvasQuality?: string;
  geminiApiKey?: string;
  customUserName?: string;
  geminiMemoryLevel?: number;
  geminiLearnedMemories?: LearnedMemoryItem[];
  geminiCustomInstructions?: string;
}

export interface FloatingChatStatePayload {
  messages: FloatingChatMessage[];
}

export interface LoadedCloudState {
  hasCloudData: boolean;
  workspaces: Workspace[];
  dashboard?: DashboardStatePayload;
  analytics?: AnalyticsStatePayload;
  preferences?: PreferencesStatePayload;
  floatingChat?: FloatingChatStatePayload;
  knownWorkspaceIds: Set<string>;
  knownStateKeys: Set<AppStateKey>;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function utf8ByteLength(str: string): number {
  if (textEncoder) {
    return textEncoder.encode(str).length;
  }
  return str.length * 2;
}

const LEGACY_QUOTA_COOLDOWN_STORAGE_KEY = 'aether_firestore_quota_paused_until_v1';
const DEFAULT_QUOTA_COOLDOWN_MS = 15 * 60 * 1000;
let memoryQuotaPausedUntil = 0;

// Clear any legacy cross-reload cooldown so every app start/reload attempts fresh auto-sync
try {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(LEGACY_QUOTA_COOLDOWN_STORAGE_KEY);
  }
} catch {
  // ignore sessionStorage errors
}

function extractRawErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Unknown sync error');
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed?.error) return String(parsed.error);
  } catch {
    // Plain error string
  }
  return raw;
}

export function isQuotaExceededError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '').toLowerCase();
  if (code.includes('resource-exhausted')) return true;
  const msg = extractRawErrorMessage(err).toLowerCase();
  return (
    msg.includes('quota exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota metric') ||
    msg.includes('free daily read units') ||
    msg.includes('free daily write units') ||
    msg.includes('too many requests')
  );
}

export function isOfflineSyncError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '').toLowerCase();
  if (code.includes('unavailable') || code.includes('network-request-failed')) return true;
  const msg = extractRawErrorMessage(err).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('failed to get document because the client is offline') ||
    msg.includes('network-request-failed') ||
    msg.includes('failed to fetch')
  );
}

export function getQuotaUpgradeUrl(): string {
  const cfg = firebaseConfig as { projectId?: string; firestoreDatabaseId?: string };
  const projectId = cfg.projectId || 'daw-9be97';
  const dbId = cfg.firestoreDatabaseId || '(default)';
  return `https://console.firebase.google.com/project/${encodeURIComponent(
    projectId
  )}/firestore/databases/${encodeURIComponent(dbId)}/data?openUpgradeDialog=true`;
}

export function getSyncQuotaPausedUntil(): number {
  return memoryQuotaPausedUntil;
}

export function isSyncQuotaPaused(): boolean {
  return Date.now() < memoryQuotaPausedUntil;
}

export function markSyncQuotaExceeded(cooldownMs = DEFAULT_QUOTA_COOLDOWN_MS): number {
  const until = Date.now() + cooldownMs;
  memoryQuotaPausedUntil = until;
  return until;
}

export function clearSyncQuotaPause(): void {
  memoryQuotaPausedUntil = 0;
}

export function formatCloudSyncError(err: unknown): string {
  if (isQuotaExceededError(err)) {
    return 'Firestore daily free-tier quota exceeded. Changes remain saved locally; cloud auto-sync is paused and quota resets tomorrow.';
  }
  if (isOfflineSyncError(err)) {
    return 'Device appears offline — changes are saved locally and will auto-sync when reconnected.';
  }
  const raw = err instanceof Error ? err.message : String(err || 'Unknown sync error');
  try {
    const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
    if (parsed?.error) {
      if (parsed.error.includes('permission-denied') || parsed.error.includes('Missing or insufficient permissions')) {
        return `Firestore permission denied on ${parsed.path || 'user data'}.`;
      }
      if (parsed.error.toLowerCase().includes('offline')) {
        return 'Device appears offline — changes are saved locally and will auto-sync when reconnected.';
      }
      return parsed.error;
    }
  } catch {
    // Plain error string
  }
  if (raw.toLowerCase().includes('offline')) {
    return 'Device appears offline — changes are saved locally and will auto-sync when reconnected.';
  }
  return raw.slice(0, 180);
}

export function sanitizeFirestoreId(raw: string, prefix = 'id'): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .slice(0, 120);
  if (cleaned && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}-${Date.now()}`;
}

export const GENERAL_SESSION_KEY = 'general_session';

export function migrateAnalyticsRecord(record: unknown): Record<string, number> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
  const result: Record<string, number> = {};
  for (const [rawKey, rawVal] of Object.entries(record as Record<string, unknown>)) {
    const num = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : 0;
    const safeKey =
      rawKey === '__general__'
        ? GENERAL_SESSION_KEY
        : rawKey.startsWith('__') && rawKey.endsWith('__')
        ? rawKey.replace(/^_+/, '').replace(/_+$/, '') || 'field'
        : rawKey || 'empty_key';
    result[safeKey] = (result[safeKey] || 0) + num;
  }
  return result;
}

function sanitizeFirestoreObjectKey(key: string): string {
  if (!key) return 'empty_key';
  if (key === '__general__') return GENERAL_SESSION_KEY;
  if (key.startsWith('__') && key.endsWith('__')) {
    const trimmed = key.replace(/^_+/, '').replace(/_+$/, '');
    return trimmed || 'reserved_field';
  }
  return key;
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        const safeKey = sanitizeFirestoreObjectKey(k);
        const sanitizedVal = stripUndefined(v);
        if (
          safeKey !== k &&
          typeof out[safeKey] === 'number' &&
          typeof sanitizedVal === 'number'
        ) {
          out[safeKey] = (out[safeKey] as number) + sanitizedVal;
        } else if (!(safeKey in out) || safeKey === k) {
          out[safeKey] = sanitizedVal;
        }
      }
    }
    return out as T;
  }
  return value;
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val : fallback;
  return str.slice(0, maxLen);
}

function trimAttachmentDataUrls<T extends { dataUrl?: string }>(
  attachments: T[] | undefined,
  maxDataUrlLen: number
): T[] | undefined {
  if (!Array.isArray(attachments)) return attachments;
  return attachments.map((att) =>
    att?.dataUrl && att.dataUrl.length > maxDataUrlLen
      ? { ...att, dataUrl: undefined }
      : att
  );
}

export function serializeWorkspaceForFirestore(uid: string, ws: Workspace) {
  const safeId = sanitizeFirestoreId(ws.id, 'ws');
  const safeName = clampString(ws.name?.trim() || 'Untitled Workspace', 200, 'Untitled Workspace');
  const safeFolder = clampString(ws.folder?.trim() || 'Assorted Workspaces', 160, 'Assorted Workspaces');

  let sources = Array.isArray(ws.sources) ? stripUndefined(ws.sources).slice(0, 200) : [];
  let notebooks = Array.isArray(ws.notebooks) ? stripUndefined(ws.notebooks).slice(0, 50) : [];
  let conversations = Array.isArray(ws.conversations) ? stripUndefined(ws.conversations).slice(0, 100) : [];
  let chatMessages = Array.isArray(ws.chatMessages) ? stripUndefined(ws.chatMessages).slice(-300) : [];

  const buildPayload = () => {
    const base: Record<string, unknown> = {
      uid,
      id: safeId,
      name: safeName,
      folder: safeFolder,
      mode: ws.mode === 'onenote-only' ? 'onenote-only' : 'full',
      isClosed: Boolean(ws.isClosed),
      sources,
      notebooks,
      conversations,
      chatMessages,
    };

    if (typeof ws.description === 'string' && ws.description.length > 0) {
      base.description = clampString(ws.description, 1000);
    }
    if (typeof ws.color === 'string' && ws.color.length > 0) {
      base.color = clampString(ws.color, 64);
    }
    if (typeof ws.lastOpenedAt === 'string' && ws.lastOpenedAt.length > 0) {
      base.lastOpenedAt = clampString(ws.lastOpenedAt, 64);
    }
    if (typeof ws.createdAt === 'string' && ws.createdAt.length > 0) {
      base.createdAtLabel = clampString(ws.createdAt, 64);
    }
    if (typeof ws.updatedAt === 'string' && ws.updatedAt.length > 0) {
      base.updatedAtLabel = clampString(ws.updatedAt, 64);
    }
    return base;
  };

  let payload = buildPayload();
  // Stage 1: Trim large inline binary dataUrl blobs when approaching Firestore's 1 MiB document limit
  if (utf8ByteLength(JSON.stringify(payload)) > 800_000) {
    sources = stripUndefined(
      sources.map((s) =>
        s.dataUrl && s.dataUrl.length > 50_000 ? { ...s, dataUrl: undefined } : s
      )
    );
    chatMessages = stripUndefined(
      chatMessages.map((msg) => ({
        ...msg,
        attachments: trimAttachmentDataUrls(msg.attachments, 35_000),
      }))
    );
    conversations = stripUndefined(
      conversations.map((conv) => ({
        ...conv,
        messages: (conv.messages || []).map((msg) => ({
          ...msg,
          attachments: trimAttachmentDataUrls(msg.attachments, 35_000),
        })),
      }))
    );
    notebooks = stripUndefined(
      notebooks.map((nb) => ({
        ...nb,
        sections: (nb.sections || []).map((sec) => ({
          ...sec,
          pages: (sec.pages || []).map((page) => ({
            ...page,
            blocks: (page.blocks || []).map((b) => ({
              ...b,
              imageUrl: b.imageUrl && b.imageUrl.length > 100_000 ? undefined : b.imageUrl,
              sideImageUrl: b.sideImageUrl && b.sideImageUrl.length > 100_000 ? undefined : b.sideImageUrl,
            })),
          })),
        })),
      }))
    );
    payload = buildPayload();
  }

  // Stage 2: If many medium dataUrls still keep payload > 850KB, strip remaining base64 blobs
  if (utf8ByteLength(JSON.stringify(payload)) > 850_000) {
    sources = stripUndefined(
      sources.map((s) => (s.dataUrl ? { ...s, dataUrl: undefined } : s))
    );
    chatMessages = stripUndefined(
      chatMessages.map((msg) => ({
        ...msg,
        attachments: trimAttachmentDataUrls(msg.attachments, 0),
      }))
    );
    conversations = stripUndefined(
      conversations.map((conv) => ({
        ...conv,
        messages: (conv.messages || []).map((msg) => ({
          ...msg,
          attachments: trimAttachmentDataUrls(msg.attachments, 0),
        })),
      }))
    );
    notebooks = stripUndefined(
      notebooks.map((nb) => ({
        ...nb,
        sections: (nb.sections || []).map((sec) => ({
          ...sec,
          pages: (sec.pages || []).map((page) => ({
            ...page,
            blocks: (page.blocks || []).map((b) => ({
              ...b,
              imageUrl: b.imageUrl?.startsWith('data:') ? undefined : b.imageUrl,
              sideImageUrl: b.sideImageUrl?.startsWith('data:') ? undefined : b.sideImageUrl,
            })),
          })),
        })),
      }))
    );
    payload = buildPayload();
  }

  // Stage 3: If pure text/history still exceeds 880KB, clamp verbose source fullContent & oldest messages
  if (utf8ByteLength(JSON.stringify(payload)) > 880_000) {
    sources = stripUndefined(
      sources.map((s) => ({
        ...s,
        fullContent: typeof s.fullContent === 'string' ? s.fullContent.slice(0, 12_000) : s.fullContent,
      }))
    );
    chatMessages = chatMessages.slice(-120);
    conversations = conversations.slice(0, 50).map((conv) => ({
      ...conv,
      messages: (conv.messages || []).slice(-80),
    }));
    payload = buildPayload();
  }

  return { safeId, payload };
}

export function deserializeWorkspaceFromFirestore(data: Record<string, unknown>): Workspace {
  return {
    id: String(data.id || ''),
    name: String(data.name || 'Untitled Workspace'),
    description: typeof data.description === 'string' ? data.description : undefined,
    folder: String(data.folder || 'Assorted Workspaces'),
    mode: data.mode === 'onenote-only' ? 'onenote-only' : 'full',
    color: typeof data.color === 'string' ? data.color : undefined,
    isClosed: Boolean(data.isClosed),
    lastOpenedAt: typeof data.lastOpenedAt === 'string' ? data.lastOpenedAt : undefined,
    createdAt: typeof data.createdAtLabel === 'string' ? data.createdAtLabel : 'Just now',
    updatedAt: typeof data.updatedAtLabel === 'string' ? data.updatedAtLabel : 'Just now',
    sources: Array.isArray(data.sources) ? (data.sources as Workspace['sources']) : [],
    notebooks: Array.isArray(data.notebooks) ? (data.notebooks as Workspace['notebooks']) : [],
    conversations: Array.isArray(data.conversations) ? (data.conversations as Workspace['conversations']) : [],
    chatMessages: Array.isArray(data.chatMessages) ? (data.chatMessages as Workspace['chatMessages']) : [],
  };
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const email = clampString(user.email || `${user.uid}@gmail.com`, 320);
  const displayName = clampString(user.displayName || email.split('@')[0] || 'Aether Learner', 160);
  const photoURL = user.photoURL ? clampString(user.photoURL, 1000) : undefined;

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    if (isQuotaExceededError(error)) markSyncQuotaExceeded();
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!existingSnap.exists()) {
    const profileCreate: Record<string, unknown> = {
      uid: user.uid,
      email,
      displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (photoURL) {
      profileCreate.photoURL = photoURL;
    }
    try {
      await setDoc(userRef, profileCreate);
    } catch (error) {
      if (isQuotaExceededError(error)) markSyncQuotaExceeded();
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    const existingData = existingSnap.data() as Record<string, unknown> | undefined;
    const needsProfileUpdate =
      existingData?.email !== email ||
      existingData?.displayName !== displayName ||
      (photoURL ? existingData?.photoURL !== photoURL : false);

    if (!needsProfileUpdate) {
      return;
    }

    const profileUpdate: Record<string, unknown> = {
      email,
      displayName,
      updatedAt: serverTimestamp(),
    };
    if (photoURL) {
      profileUpdate.photoURL = photoURL;
    }
    try {
      await updateDoc(userRef, profileUpdate);
    } catch (error) {
      if (isQuotaExceededError(error)) markSyncQuotaExceeded();
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function loadUserCloudData(
  user: User,
  writtenHashes?: Map<string, string>
): Promise<LoadedCloudState> {
  await ensureUserProfile(user);

  const workspacesPath = `users/${user.uid}/workspaces`;
  const appStatePath = `users/${user.uid}/appState`;

  let wsSnap;
  try {
    const wsQuery = query(
      collection(db, 'users', user.uid, 'workspaces'),
      where('uid', '==', user.uid)
    );
    wsSnap = await getDocs(wsQuery);
  } catch (error) {
    if (isQuotaExceededError(error)) markSyncQuotaExceeded();
    handleFirestoreError(error, OperationType.LIST, workspacesPath);
  }

  let stateSnap;
  try {
    const stateQuery = query(
      collection(db, 'users', user.uid, 'appState'),
      where('uid', '==', user.uid)
    );
    stateSnap = await getDocs(stateQuery);
  } catch (error) {
    if (isQuotaExceededError(error)) markSyncQuotaExceeded();
    handleFirestoreError(error, OperationType.LIST, appStatePath);
  }

  const knownWorkspaceIds = new Set<string>();
  const workspaces: Workspace[] = [];
  wsSnap.forEach((docSnap) => {
    knownWorkspaceIds.add(docSnap.id);
    const ws = deserializeWorkspaceFromFirestore(docSnap.data() as Record<string, unknown>);
    workspaces.push(ws);
    if (writtenHashes) {
      const { payload } = serializeWorkspaceForFirestore(user.uid, ws);
      writtenHashes.set(`ws:${ws.id}`, JSON.stringify(payload));
    }
  });

  const knownStateKeys = new Set<AppStateKey>();
  let dashboard: DashboardStatePayload | undefined;
  let analytics: AnalyticsStatePayload | undefined;
  let preferences: PreferencesStatePayload | undefined;
  let floatingChat: FloatingChatStatePayload | undefined;

  stateSnap.forEach((docSnap) => {
    const key = docSnap.id as AppStateKey;
    const raw = docSnap.data() as Record<string, unknown>;
    const payload = stripUndefined((raw.payload || {}) as Record<string, unknown>);
    knownStateKeys.add(key);

    if (writtenHashes) {
      writtenHashes.set(`state:${key}`, JSON.stringify(payload));
    }

    if (key === 'dashboard') {
      dashboard = payload as unknown as DashboardStatePayload;
    } else if (key === 'analytics') {
      analytics = payload as unknown as AnalyticsStatePayload;
    } else if (key === 'preferences') {
      preferences = payload as unknown as PreferencesStatePayload;
    } else if (key === 'floatingChat') {
      floatingChat = payload as unknown as FloatingChatStatePayload;
    }
  });

  const hasCloudData = workspaces.length > 0 || knownStateKeys.size > 0;

  return {
    hasCloudData,
    workspaces,
    dashboard,
    analytics,
    preferences,
    floatingChat,
    knownWorkspaceIds,
    knownStateKeys,
  };
}

export async function upsertWorkspaceDoc(
  uid: string,
  ws: Workspace,
  knownWorkspaceIds: Set<string>,
  writtenHashes?: Map<string, string>,
  options?: { force?: boolean }
): Promise<void> {
  if (!options?.force && isSyncQuotaPaused()) {
    return;
  }

  const { safeId, payload } = serializeWorkspaceForFirestore(uid, ws);
  const hash = JSON.stringify(payload);
  if (writtenHashes && writtenHashes.get(`ws:${safeId}`) === hash) {
    return;
  }

  const path = `users/${uid}/workspaces/${safeId}`;
  const docRef = doc(db, 'users', uid, 'workspaces', safeId);

  if (knownWorkspaceIds.has(safeId)) {
    const { uid: _u, id: _i, ...mutableFields } = payload;
    try {
      await updateDoc(docRef, {
        ...mutableFields,
        updatedAt: serverTimestamp(),
      });
      if (writtenHashes) {
        writtenHashes.set(`ws:${safeId}`, hash);
      }
      return;
    } catch (error: unknown) {
      if (isQuotaExceededError(error)) {
        markSyncQuotaExceeded();
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      const code = (error as { code?: string })?.code;
      if (code !== 'not-found') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  }

  try {
    await setDoc(docRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    knownWorkspaceIds.add(safeId);
    if (writtenHashes) {
      writtenHashes.set(`ws:${safeId}`, hash);
    }
  } catch (error) {
    if (isQuotaExceededError(error)) markSyncQuotaExceeded();
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteWorkspaceDoc(
  uid: string,
  workspaceId: string,
  knownWorkspaceIds: Set<string>,
  writtenHashes?: Map<string, string>,
  options?: { force?: boolean }
): Promise<void> {
  if (!options?.force && isSyncQuotaPaused()) {
    return;
  }
  const safeId = sanitizeFirestoreId(workspaceId, 'ws');
  const path = `users/${uid}/workspaces/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'workspaces', safeId));
    knownWorkspaceIds.delete(safeId);
    writtenHashes?.delete(`ws:${safeId}`);
  } catch (error) {
    if (isQuotaExceededError(error)) markSyncQuotaExceeded();
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertAppStateDoc(
  uid: string,
  stateKey: AppStateKey,
  rawPayload: unknown,
  knownStateKeys: Set<AppStateKey>,
  writtenHashes?: Map<string, string>,
  options?: { force?: boolean }
): Promise<void> {
  if (!options?.force && isSyncQuotaPaused()) {
    return;
  }

  let sanitizedPayload = stripUndefined(rawPayload) as Record<string, unknown>;
  let hash = JSON.stringify(sanitizedPayload);

  if (utf8ByteLength(hash) > 850_000) {
    if (stateKey === 'analytics' && Array.isArray(sanitizedPayload.auditLogs)) {
      sanitizedPayload = {
        ...sanitizedPayload,
        auditLogs: (sanitizedPayload.auditLogs as unknown[]).slice(0, 40),
      };
      hash = JSON.stringify(sanitizedPayload);
    } else if (stateKey === 'floatingChat' && Array.isArray(sanitizedPayload.messages)) {
      sanitizedPayload = {
        ...sanitizedPayload,
        messages: (sanitizedPayload.messages as unknown[]).slice(-60),
      };
      hash = JSON.stringify(sanitizedPayload);
    }
  }

  if (writtenHashes && writtenHashes.get(`state:${stateKey}`) === hash) {
    return;
  }

  const path = `users/${uid}/appState/${stateKey}`;
  const docRef = doc(db, 'users', uid, 'appState', stateKey);

  if (knownStateKeys.has(stateKey)) {
    try {
      await updateDoc(docRef, {
        payload: sanitizedPayload,
        updatedAt: serverTimestamp(),
      });
      if (writtenHashes) {
        writtenHashes.set(`state:${stateKey}`, hash);
      }
      return;
    } catch (error: unknown) {
      if (isQuotaExceededError(error)) {
        markSyncQuotaExceeded();
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      const code = (error as { code?: string })?.code;
      if (code !== 'not-found') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  }

  try {
    await setDoc(docRef, {
      uid,
      stateKey,
      payload: sanitizedPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    knownStateKeys.add(stateKey);
    if (writtenHashes) {
      writtenHashes.set(`state:${stateKey}`, hash);
    }
  } catch (error) {
    if (isQuotaExceededError(error)) markSyncQuotaExceeded();
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToUserCloudData(
  uid: string,
  knownWorkspaceIds: Set<string>,
  knownStateKeys: Set<AppStateKey>,
  writtenHashes: Map<string, string>,
  callbacks: {
    onWorkspacesRemoteChange: (workspaces: Workspace[]) => void;
    onDashboardRemoteChange: (data: DashboardStatePayload) => void;
    onAnalyticsRemoteChange: (data: AnalyticsStatePayload) => void;
    onPreferencesRemoteChange: (data: PreferencesStatePayload) => void;
    onFloatingChatRemoteChange: (data: FloatingChatStatePayload) => void;
    onError?: (err: Error) => void;
  }
): Unsubscribe {
  const wsPath = `users/${uid}/workspaces`;
  const statePath = `users/${uid}/appState`;

  const wsQuery = query(
    collection(db, 'users', uid, 'workspaces'),
    where('uid', '==', uid)
  );
  const unsubWorkspaces = onSnapshot(
    wsQuery,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      let hasActualRemoteDelta = false;
      const nextWorkspaces: Workspace[] = [];

      snapshot.forEach((docSnap) => {
        knownWorkspaceIds.add(docSnap.id);
        const ws = deserializeWorkspaceFromFirestore(docSnap.data() as Record<string, unknown>);
        nextWorkspaces.push(ws);
        const { payload } = serializeWorkspaceForFirestore(uid, ws);
        const nextHash = JSON.stringify(payload);
        if (writtenHashes.get(`ws:${ws.id}`) !== nextHash) {
          writtenHashes.set(`ws:${ws.id}`, nextHash);
          hasActualRemoteDelta = true;
        }
      });

      // Detect deletions performed on another device
      const liveIds = new Set(nextWorkspaces.map((w) => w.id));
      for (const prevId of Array.from(knownWorkspaceIds)) {
        if (!liveIds.has(prevId)) {
          knownWorkspaceIds.delete(prevId);
          writtenHashes.delete(`ws:${prevId}`);
          hasActualRemoteDelta = true;
        }
      }

      if (hasActualRemoteDelta) {
        callbacks.onWorkspacesRemoteChange(nextWorkspaces);
      }
    },
    (error) => {
      if (isQuotaExceededError(error)) markSyncQuotaExceeded();
      try {
        handleFirestoreError(error, OperationType.LIST, wsPath);
      } catch (wrapped) {
        callbacks.onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const stateQuery = query(
    collection(db, 'users', uid, 'appState'),
    where('uid', '==', uid)
  );
  const unsubState = onSnapshot(
    stateQuery,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;

      snapshot.forEach((docSnap) => {
        const key = docSnap.id as AppStateKey;
        knownStateKeys.add(key);
        const raw = docSnap.data() as Record<string, unknown>;
        const payload = stripUndefined((raw.payload || {}) as Record<string, unknown>);
        const nextHash = JSON.stringify(payload);
        if (writtenHashes.get(`state:${key}`) === nextHash) {
          return;
        }
        writtenHashes.set(`state:${key}`, nextHash);

        if (key === 'dashboard') {
          callbacks.onDashboardRemoteChange(payload as unknown as DashboardStatePayload);
        } else if (key === 'analytics') {
          callbacks.onAnalyticsRemoteChange(payload as unknown as AnalyticsStatePayload);
        } else if (key === 'preferences') {
          callbacks.onPreferencesRemoteChange(payload as unknown as PreferencesStatePayload);
        } else if (key === 'floatingChat') {
          callbacks.onFloatingChatRemoteChange(payload as unknown as FloatingChatStatePayload);
        }
      });
    },
    (error) => {
      if (isQuotaExceededError(error)) markSyncQuotaExceeded();
      try {
        handleFirestoreError(error, OperationType.LIST, statePath);
      } catch (wrapped) {
        callbacks.onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubWorkspaces();
    unsubState();
  };
}

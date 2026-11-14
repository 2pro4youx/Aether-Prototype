import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
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

export function sanitizeFirestoreId(raw: string, prefix = 'id'): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .slice(0, 120);
  if (cleaned && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}-${Date.now()}`;
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
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

export function serializeWorkspaceForFirestore(uid: string, ws: Workspace) {
  const safeId = sanitizeFirestoreId(ws.id, 'ws');
  const safeName = clampString(ws.name?.trim() || 'Untitled Workspace', 200, 'Untitled Workspace');
  const safeFolder = clampString(ws.folder?.trim() || 'Assorted Workspaces', 160, 'Assorted Workspaces');

  let sources = Array.isArray(ws.sources) ? stripUndefined(ws.sources).slice(0, 200) : [];
  let notebooks = Array.isArray(ws.notebooks) ? stripUndefined(ws.notebooks).slice(0, 50) : [];
  const conversations = Array.isArray(ws.conversations) ? stripUndefined(ws.conversations).slice(0, 100) : [];
  const chatMessages = Array.isArray(ws.chatMessages) ? stripUndefined(ws.chatMessages).slice(0, 300) : [];

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
  // Guard Firestore 1MB document limit by trimming huge inline base64 dataUrl blobs if needed
  if (JSON.stringify(payload).length > 820_000) {
    sources = sources.map((s) =>
      s.dataUrl && s.dataUrl.length > 100_000 ? { ...s, dataUrl: undefined } : s
    );
    sources = stripUndefined(sources);
    notebooks = notebooks.map((nb) => ({
      ...nb,
      sections: (nb.sections || []).map((sec) => ({
        ...sec,
        pages: (sec.pages || []).map((page) => ({
          ...page,
          blocks: (page.blocks || []).map((b) => ({
            ...b,
            imageUrl: b.imageUrl && b.imageUrl.length > 150_000 ? undefined : b.imageUrl,
            sideImageUrl: b.sideImageUrl && b.sideImageUrl.length > 150_000 ? undefined : b.sideImageUrl,
          })),
        })),
      })),
    }));
    notebooks = stripUndefined(notebooks);
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
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
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
    wsSnap = await getDocs(collection(db, 'users', user.uid, 'workspaces'));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, workspacesPath);
  }

  let stateSnap;
  try {
    stateSnap = await getDocs(collection(db, 'users', user.uid, 'appState'));
  } catch (error) {
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
    const payload = (raw.payload || {}) as Record<string, unknown>;
    knownStateKeys.add(key);

    if (writtenHashes) {
      writtenHashes.set(`state:${key}`, JSON.stringify(stripUndefined(payload)));
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
  writtenHashes?: Map<string, string>
): Promise<void> {
  const { safeId, payload } = serializeWorkspaceForFirestore(uid, ws);
  const hash = JSON.stringify(payload);
  if (writtenHashes && writtenHashes.get(`ws:${safeId}`) === hash) {
    return;
  }
  if (writtenHashes) {
    writtenHashes.set(`ws:${safeId}`, hash);
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
      return;
    } catch (error: unknown) {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteWorkspaceDoc(
  uid: string,
  workspaceId: string,
  knownWorkspaceIds: Set<string>,
  writtenHashes?: Map<string, string>
): Promise<void> {
  const safeId = sanitizeFirestoreId(workspaceId, 'ws');
  const path = `users/${uid}/workspaces/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'workspaces', safeId));
    knownWorkspaceIds.delete(safeId);
    writtenHashes?.delete(`ws:${safeId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertAppStateDoc(
  uid: string,
  stateKey: AppStateKey,
  rawPayload: unknown,
  knownStateKeys: Set<AppStateKey>,
  writtenHashes?: Map<string, string>
): Promise<void> {
  const sanitizedPayload = stripUndefined(rawPayload) as Record<string, unknown>;
  const hash = JSON.stringify(sanitizedPayload);
  if (writtenHashes && writtenHashes.get(`state:${stateKey}`) === hash) {
    return;
  }
  if (writtenHashes) {
    writtenHashes.set(`state:${stateKey}`, hash);
  }

  const path = `users/${uid}/appState/${stateKey}`;
  const docRef = doc(db, 'users', uid, 'appState', stateKey);

  if (knownStateKeys.has(stateKey)) {
    try {
      await updateDoc(docRef, {
        payload: sanitizedPayload,
        updatedAt: serverTimestamp(),
      });
      return;
    } catch (error: unknown) {
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
  } catch (error) {
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
  }
): Unsubscribe {
  const wsPath = `users/${uid}/workspaces`;
  const statePath = `users/${uid}/appState`;

  const unsubWorkspaces = onSnapshot(
    collection(db, 'users', uid, 'workspaces'),
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
      handleFirestoreError(error, OperationType.GET, wsPath);
    }
  );

  const unsubState = onSnapshot(
    collection(db, 'users', uid, 'appState'),
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
      handleFirestoreError(error, OperationType.GET, statePath);
    }
  );

  return () => {
    unsubWorkspaces();
    unsubState();
  };
}

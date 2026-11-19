/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sliders, Sparkles, MoveVertical } from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signOut, signInWithPopup, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import {
  setActiveGeminiApiKey,
  getActiveGeminiApiKey,
  getRememberedGoogleApiKey,
  setRememberedGoogleApiKey,
} from './utils/geminiClient';
import {
  getGoogleCalendarAccessToken,
  mergeGoogleAndLocalEvents,
  pullGoogleCalendarEvents,
  setGoogleCalendarAccessToken,
  subscribeGoogleCalendarToken,
} from './utils/googleCalendarSync';
import {
  AppStateKey,
  AnalyticsStatePayload,
  DashboardStatePayload,
  FloatingChatMessage,
  FloatingChatStatePayload,
  GENERAL_SESSION_KEY,
  LoadedCloudState,
  PreferencesStatePayload,
  clearSyncQuotaPause,
  deleteWorkspaceDoc,
  formatCloudSyncError,
  isQuotaExceededError,
  isSyncQuotaPaused,
  loadUserCloudData,
  markSyncQuotaExceeded,
  migrateAnalyticsRecord,
  subscribeToUserCloudData,
  upsertAppStateDoc,
  upsertWorkspaceDoc,
} from './utils/firebaseSync';
import {
  ActiveTab,
  TaskItem,
  PlannerEntry,
  NotebookSource,
  OneNoteNotebook,
  GeminiConversation,
  LibraryItem,
  Workspace,
  AuditLog,
  ColorPaletteId,
  ColorPalette,
  CustomPaletteConfig,
  CursorStyleId,
  DashboardCardInstance,
  SyllabusCourse,
  ExamScheduleEntry,
  TimetableSlot,
  CalendarEventEntry,
} from './types';
import { getCursorCss, getCursorGradient } from './utils/cursorUtils';
import {
  INITIAL_TASKS,
  INITIAL_PLANNERS,
  INITIAL_SOURCES,
  INITIAL_ONENOTE_NOTEBOOKS,
  INITIAL_GEMINI_CONVERSATIONS,
  INITIAL_LIBRARY,
  INITIAL_WORKSPACES,
  INITIAL_AUDIT_LOGS,
  generateYearStudyData,
  PALETTES,
  DEFAULT_CUSTOM_PALETTE_CONFIG,
  buildCustomPalette,
} from './data/mockData';

import { PolygonCanvas } from './components/PolygonCanvas';
import { Header } from './components/Header';
import { WorkspaceSelectorBar } from './components/WorkspaceSelectorBar';
import { Dashboard, DEFAULT_DASHBOARD_CARDS, normalizeDashboardCards } from './components/Dashboard';
import { NotebookLMView } from './components/NotebookLMView';
import { OneNoteWorkspace } from './components/OneNoteWorkspace';
import { GeminiWorkspace } from './components/GeminiWorkspace';
import { LibraryView } from './components/LibraryView';
import { CreateModal, CreationItemType } from './components/CreateModal';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { FloatingGeminiChat } from './components/FloatingGeminiChat';
import { AuthOnboardingModal } from './components/AuthOnboardingModal';
import { SmoothCursor } from './components/SmoothCursor';
import { WindowTransitionOverlay } from './components/WindowTransitionOverlay';
import { useSmoothScroll, getLenis, resizeLenis } from './hooks/useSmoothScroll';
import {
  DEFAULT_GEMINI_PERSONALIZATION,
  GeminiPersonalizationConfig,
  getGeminiPersonalization,
  PERSONALIZATION_EVENT,
  PERSONALIZATION_STORAGE_KEY,
  resolvePreferredNames,
  setActiveAccountBaseName,
  setGeminiPersonalization,
} from './utils/personalization';
import {
  MANUAL_DELETED_SOURCE_EXCERPT,
  pruneExpiredWorkspaceSources,
  RemovedExpiredSourceInfo,
  SOURCE_TOUCH_DEBOUNCE_MS,
} from './utils/sourceRetention';

const DEFAULT_FLOATING_MESSAGES: FloatingChatMessage[] = [
  {
    id: 'm-0',
    role: 'assistant',
    text: 'Hey! How can I help you today?',
    timestamp: 'Just now',
  },
];

interface SavedAuthProfile {
  email?: string;
  name?: string;
  isGuest?: boolean;
}

function getSavedAuthProfile(): SavedAuthProfile {
  try {
    const raw = localStorage.getItem('aether_auth_user');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed?.email === 'string' ? parsed.email : undefined,
      name: typeof parsed?.name === 'string' ? parsed.name : undefined,
      isGuest: Boolean(parsed?.isGuest),
    };
  } catch {
    return {};
  }
}

function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const firebaseUserRef = useRef<User | null>(firebaseUser);
  firebaseUserRef.current = firebaseUser;
  const [authProfile, setAuthProfile] = useState<SavedAuthProfile>(() => getSavedAuthProfile());
  const authProfileRef = useRef<SavedAuthProfile>(authProfile);
  authProfileRef.current = authProfile;
  const [isCloudSyncReady, setIsCloudSyncReady] = useState(false);
  const isCloudSyncReadyRef = useRef(isCloudSyncReady);
  isCloudSyncReadyRef.current = isCloudSyncReady;
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const cloudSyncStatusRef = useRef(cloudSyncStatus);
  cloudSyncStatusRef.current = cloudSyncStatus;
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const savedUser = localStorage.getItem('aether_auth_user');
    const savedKey = localStorage.getItem('aether_gemini_api_key');
    return Boolean(savedUser && savedKey);
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const savedUser = localStorage.getItem('aether_auth_user');
    const savedKey = localStorage.getItem('aether_gemini_api_key');
    return savedUser && savedKey ? 'dashboard' : 'lander';
  });
  const activeTabRef = useRef(activeTab);
  const previousTabBeforeSettingsRef = useRef<ActiveTab>('dashboard');
  const previousTabBeforeWorkspaceRef = useRef<ActiveTab>('dashboard');

  const [isOneNoteOpen, setIsOneNoteOpen] = useState(false);
  const [isGeminiWorkspaceOpen, setIsGeminiWorkspaceOpen] = useState(false);
  const [isMetaverseEdit, setIsMetaverseEdit] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const isAuthModalOpenRef = useRef(isAuthModalOpen);
  isAuthModalOpenRef.current = isAuthModalOpen;

  const cloudUnsubRef = useRef<(() => void) | null>(null);
  const knownWorkspaceIdsRef = useRef<Set<string>>(new Set());
  const knownStateKeysRef = useRef<Set<AppStateKey>>(new Set());
  const writtenHashesRef = useRef<Map<string, string>>(new Map());
  const hydratingUidRef = useRef<string | null>(null);
  const hydratingPromiseRef = useRef<Promise<{ syncedGeminiKey?: string; error?: string } | void> | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const remoteApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnalyticsCloudSyncAtRef = useRef<number>(0);
  const isSigningOutRef = useRef(false);
  const prevSyncedWorkspaceIdsRef = useRef<Set<string>>(new Set());
  const pendingSyncTimersRef = useRef<{
    workspaces?: ReturnType<typeof setTimeout>;
    dashboard?: ReturnType<typeof setTimeout>;
    analytics?: ReturnType<typeof setTimeout>;
    preferences?: ReturnType<typeof setTimeout>;
    floatingChat?: ReturnType<typeof setTimeout>;
  }>({});

  const scheduleClearApplyingRemote = useCallback(() => {
    if (remoteApplyTimerRef.current) {
      clearTimeout(remoteApplyTimerRef.current);
    }
    remoteApplyTimerRef.current = setTimeout(() => {
      isApplyingRemoteRef.current = false;
      remoteApplyTimerRef.current = null;
    }, 80);
  }, []);

  useEffect(() => {
    return () => {
      if (remoteApplyTimerRef.current) {
        clearTimeout(remoteApplyTimerRef.current);
        remoteApplyTimerRef.current = null;
      }
    };
  }, []);

  const clearPendingSyncTimers = useCallback(() => {
    const timers = pendingSyncTimersRef.current;
    if (timers.workspaces) clearTimeout(timers.workspaces);
    if (timers.dashboard) clearTimeout(timers.dashboard);
    if (timers.analytics) clearTimeout(timers.analytics);
    if (timers.preferences) clearTimeout(timers.preferences);
    if (timers.floatingChat) clearTimeout(timers.floatingChat);
    pendingSyncTimersRef.current = {};
  }, []);

  const markCloudSyncOk = useCallback(() => {
    setCloudSyncStatus('synced');
    setCloudSyncError(null);
    setLastCloudSyncAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, []);

  const markCloudSyncError = useCallback(
    (err: unknown) => {
      const msg = formatCloudSyncError(err);
      console.error('Firestore cloud sync write error:', err);
      if (isQuotaExceededError(err)) {
        markSyncQuotaExceeded();
        clearPendingSyncTimers();
        if (cloudUnsubRef.current) {
          cloudUnsubRef.current();
          cloudUnsubRef.current = null;
        }
      }
      setCloudSyncStatus('error');
      setCloudSyncError(msg);
    },
    [clearPendingSyncTimers]
  );

  const flushAllCloudSync = useCallback(
    async (
      explicitUid?: string,
      options?: { force?: boolean; includeAnalytics?: boolean }
    ): Promise<boolean> => {
      const uid = explicitUid || firebaseUserRef.current?.uid || auth.currentUser?.uid;
      if (!uid || !isCloudSyncReadyRef.current) return false;
      if (!options?.force && isSyncQuotaPaused()) return false;

      clearPendingSyncTimers();
      setCloudSyncStatus('syncing');
      setCloudSyncError(null);

      try {
        const currentWorkspaces = workspacesRef.current;
        const currentIds = new Set(currentWorkspaces.map((w) => w.id));
        const ops: Promise<unknown>[] = [];
        const opOpts = options?.force ? { force: true } : undefined;

        for (const prevId of prevSyncedWorkspaceIdsRef.current) {
          if (!currentIds.has(prevId)) {
            ops.push(
              deleteWorkspaceDoc(
                uid,
                prevId,
                knownWorkspaceIdsRef.current,
                writtenHashesRef.current,
                opOpts
              )
            );
          }
        }

        for (const ws of currentWorkspaces) {
          ops.push(
            upsertWorkspaceDoc(
              uid,
              ws,
              knownWorkspaceIdsRef.current,
              writtenHashesRef.current,
              opOpts
            )
          );
        }

        ops.push(
          upsertAppStateDoc(
            uid,
            'dashboard',
            latestSlicesRef.current.dashboard,
            knownStateKeysRef.current,
            writtenHashesRef.current,
            opOpts
          ),
          upsertAppStateDoc(
            uid,
            'preferences',
            latestSlicesRef.current.preferences,
            knownStateKeysRef.current,
            writtenHashesRef.current,
            opOpts
          ),
          upsertAppStateDoc(
            uid,
            'floatingChat',
            latestSlicesRef.current.floatingChat,
            knownStateKeysRef.current,
            writtenHashesRef.current,
            opOpts
          )
        );

        if (options?.includeAnalytics !== false) {
          ops.push(
            upsertAppStateDoc(
              uid,
              'analytics',
              latestSlicesRef.current.analytics,
              knownStateKeysRef.current,
              writtenHashesRef.current,
              opOpts
            ).then(() => {
              lastAnalyticsCloudSyncAtRef.current = Date.now();
            })
          );
        }

        const results = await Promise.allSettled(ops);
        prevSyncedWorkspaceIdsRef.current = currentIds;

        const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (failed) {
          markCloudSyncError(failed.reason);
          return false;
        }
        markCloudSyncOk();
        return true;
      } catch (err) {
        markCloudSyncError(err);
        return false;
      }
    },
    [clearPendingSyncTimers, markCloudSyncError, markCloudSyncOk]
  );

  const handleSignOut = useCallback(async () => {
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;
    setIsSigningOut(true);

    try {
      clearPendingSyncTimers();

      // Flush every pending workspace, folder, note, dashboard, and preference write to Firestore BEFORE signing out & clearing local cache
      const activeFbUser = firebaseUserRef.current || auth.currentUser;
      if (activeFbUser && !isSyncQuotaPaused()) {
        if (!isCloudSyncReadyRef.current) {
          // Ensure user profile & doc existence sets exist before flushing if hydration hadn't completed
          try {
            const preload = await loadUserCloudData(activeFbUser);
            knownWorkspaceIdsRef.current = preload.knownWorkspaceIds;
            knownStateKeysRef.current = preload.knownStateKeys;
            isCloudSyncReadyRef.current = true;
          } catch {
            // Proceed to attempt flush / sign out cleanly
          }
        }
        await flushAllCloudSync(activeFbUser.uid);
      }

      if (cloudUnsubRef.current) {
        cloudUnsubRef.current();
        cloudUnsubRef.current = null;
      }
      hydratingUidRef.current = null;
      hydratingPromiseRef.current = null;
      knownWorkspaceIdsRef.current.clear();
      knownStateKeysRef.current.clear();
      writtenHashesRef.current.clear();
      prevSyncedWorkspaceIdsRef.current.clear();
      setIsCloudSyncReady(false);
      setCloudSyncStatus('idle');
      setCloudSyncError(null);
      setLastCloudSyncAt(null);
      setGoogleCalendarAccessToken(null);
      setFirebaseUser(null);
      setAuthProfile({});

      await signOut(auth).catch(() => {});

      // Clear only local browser cache on sign-out so cloud Firestore data remains untouched across devices
      [
        'aether_auth_user',
        'aether_gemini_api_key',
        'aether_gemini_api_mode',
        'aether_workspaces_v2',
        'aether_active_workspace_v2',
        'aether_sources',
        'aether_onenote',
        'aether_gemini_conversations',
        'aether_tasks',
        'aether_planners_v1',
        'aether_dashboard_cards_v1',
        'aether_syllabus_v1',
        'aether_exam_schedule_v1',
        'aether_timetable_v1',
        'aether_local_calendar_v1',
        'aether_daily_study_seconds_v1',
        'aether_workspace_seconds_v1',
        'aether_workspace_interactions_v1',
        'aether_audit_logs_v2',
        'aether_folders_v3',
        'aether_library_v2',
        'aether_floating_chat_v1',
        PERSONALIZATION_STORAGE_KEY,
      ].forEach((k) => localStorage.removeItem(k));

      setActiveGeminiApiKey('');
      setSyncedGeminiKey('');
      setGeminiPersonalization(DEFAULT_GEMINI_PERSONALIZATION, { silent: true });
      setGeminiPersonalizationState(DEFAULT_GEMINI_PERSONALIZATION);
      setActiveAccountBaseName('');
      setTasks([]);
      setPlanners([]);
      setDashboardCards(DEFAULT_DASHBOARD_CARDS);
      setSyllabusCourses([]);
      setExamSchedules([]);
      setTimetableSlots([]);
      setLocalCalendarEvents([]);
      setDailyStudySeconds({});
      setWorkspaces([]);
      setExpiredSourcesNotice([]);
      setActiveWorkspaceId('');
      setLibraryItems([]);
      setFolders(['Assorted Workspaces']);
      setWorkspaceSeconds({});
      setWorkspaceInteractions({});
      setAuditLogs([]);
      setFloatingChatMessages(DEFAULT_FLOATING_MESSAGES);

      setIsAuthenticated(false);
      setActiveTab('lander');
      setIsWorkspaceSelectorOpen(false);
      setIsOneNoteOpen(false);
      setIsGeminiWorkspaceOpen(false);
    } finally {
      isSigningOutRef.current = false;
      setIsSigningOut(false);
    }
  }, [clearPendingSyncTimers, flushAllCloudSync]);

  // Optional nonce for transitions that don't change tab/workspace props (e.g., dark mode toggle)
  const [transitionNonce, setTransitionNonce] = useState(0);

  // Sync ref & scroll to top when changing windows/tabs (except full-height canvases)
  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab !== 'dashboard') {
      setIsMetaverseEdit(false);
    }
    if (activeTab !== 'notebooklm' && activeTab !== 'lander') {
      const lenis = getLenis();
      if (lenis) {
        lenis.resize();
        lenis.scrollTo(0, { immediate: true });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
  }, [activeTab]);

  // Core application data stores (zero dummy data; real-time study tracking)
  const [dailyStudySeconds, setDailyStudySeconds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('aether_daily_study_seconds_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('aether_daily_study_seconds_v1', JSON.stringify(dailyStudySeconds));
    } catch {
      // ignore storage quota errors
    }
  }, [dailyStudySeconds]);

  const studyDays = useMemo(() => {
    const hoursMap: Record<string, number> = {};
    for (const [dateKey, secs] of Object.entries(dailyStudySeconds)) {
      hoursMap[dateKey] = Number(secs) / 3600;
    }
    return generateYearStudyData(hoursMap);
  }, [dailyStudySeconds]);

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const isReset = localStorage.getItem('aether_dashboard_reset_v1');
      if (!isReset) return [];
      const saved = localStorage.getItem('aether_tasks');
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return [];
    }
  });
  useEffect(() => {
    safeSetLocalStorage('aether_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const [planners, setPlanners] = useState<PlannerEntry[]>(() => {
    try {
      const saved = localStorage.getItem('aether_planners_v1');
      return saved ? JSON.parse(saved) : INITIAL_PLANNERS;
    } catch {
      return [];
    }
  });
  useEffect(() => {
    safeSetLocalStorage('aether_planners_v1', JSON.stringify(planners));
  }, [planners]);

  // Lifted Dashboard Card Layout, Curriculum & Calendar states for unified cross-device cloud sync
  const [dashboardCards, setDashboardCards] = useState<DashboardCardInstance[]>(() => {
    try {
      const saved = localStorage.getItem('aether_dashboard_cards_v1');
      if (saved) {
        return normalizeDashboardCards(JSON.parse(saved));
      }
    } catch {
      // fallback
    }
    return DEFAULT_DASHBOARD_CARDS;
  });
  useEffect(() => {
    try {
      localStorage.setItem('aether_dashboard_cards_v1', JSON.stringify(dashboardCards));
    } catch {
      // ignore quota issues
    }
  }, [dashboardCards]);

  const [syllabusCourses, setSyllabusCourses] = useState<SyllabusCourse[]>(() => {
    try {
      const saved = localStorage.getItem('aether_syllabus_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    safeSetLocalStorage('aether_syllabus_v1', JSON.stringify(syllabusCourses));
  }, [syllabusCourses]);

  const [examSchedules, setExamSchedules] = useState<ExamScheduleEntry[]>(() => {
    try {
      const saved = localStorage.getItem('aether_exam_schedule_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    safeSetLocalStorage('aether_exam_schedule_v1', JSON.stringify(examSchedules));
  }, [examSchedules]);

  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>(() => {
    try {
      const saved = localStorage.getItem('aether_timetable_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    safeSetLocalStorage('aether_timetable_v1', JSON.stringify(timetableSlots));
  }, [timetableSlots]);

  const [localCalendarEvents, setLocalCalendarEvents] = useState<CalendarEventEntry[]>(() => {
    try {
      const saved = localStorage.getItem('aether_local_calendar_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    safeSetLocalStorage('aether_local_calendar_v1', JSON.stringify(localCalendarEvents));
  }, [localCalendarEvents]);

  // Lifted Floating Gemini Neural Assistant conversation history
  const [floatingChatMessages, setFloatingChatMessages] = useState<FloatingChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('aether_floating_chat_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_FLOATING_MESSAGES;
  });
  useEffect(() => {
    try {
      localStorage.setItem('aether_floating_chat_v1', JSON.stringify(floatingChatMessages));
    } catch {
      // ignore quota issues
    }
  }, [floatingChatMessages]);

  // Reactive Gemini API key tracker so Settings or Onboarding key updates sync to cloud preferences immediately
  const [syncedGeminiKey, setSyncedGeminiKey] = useState<string>(() => getActiveGeminiApiKey());
  useEffect(() => {
    const handleKeyUpdate = (e: Event) => {
      const custom = e as CustomEvent<string>;
      const nextKey = (typeof custom.detail === 'string' ? custom.detail : getActiveGeminiApiKey()).trim();
      setSyncedGeminiKey(nextKey);
      const currentUser = auth.currentUser;
      if (currentUser && nextKey) {
        setRememberedGoogleApiKey(currentUser.uid, nextKey);
        latestSlicesRef.current.preferences.geminiApiKey = nextKey;
        if (
          !isSyncQuotaPaused() &&
          (knownStateKeysRef.current.has('preferences') || hydratingUidRef.current === currentUser.uid)
        ) {
          void upsertAppStateDoc(
            currentUser.uid,
            'preferences',
            latestSlicesRef.current.preferences,
            knownStateKeysRef.current,
            writtenHashesRef.current
          ).catch((err) => {
            if (isQuotaExceededError(err)) {
              markCloudSyncError(err);
            }
          });
        }
      }
    };
    window.addEventListener('aether-gemini-key-updated', handleKeyUpdate);
    return () => window.removeEventListener('aether-gemini-key-updated', handleKeyUpdate);
  }, [markCloudSyncError]);

  // Reactive Gemini Personalization state (custom name, functional memory slider + learned facts, instructions)
  const [geminiPersonalization, setGeminiPersonalizationState] = useState<GeminiPersonalizationConfig>(() =>
    getGeminiPersonalization()
  );

  useEffect(() => {
    const handlePersonalizationUpdated = (e: Event) => {
      const custom = e as CustomEvent<GeminiPersonalizationConfig>;
      const next = custom.detail || getGeminiPersonalization();
      setGeminiPersonalizationState(next);
    };
    window.addEventListener(PERSONALIZATION_EVENT, handlePersonalizationUpdated);
    return () => window.removeEventListener(PERSONALIZATION_EVENT, handlePersonalizationUpdated);
  }, []);

  const handleUpdatePersonalization = useCallback(
    (
      updater:
        | Partial<GeminiPersonalizationConfig>
        | ((prev: GeminiPersonalizationConfig) => GeminiPersonalizationConfig)
    ) => {
      setGeminiPersonalizationState((prev) => {
        const rawNext = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        return setGeminiPersonalization(rawNext, { silent: true });
      });
    },
    []
  );

  // One-time reset of legacy seeded dummy dashboard tasks
  useEffect(() => {
    if (!localStorage.getItem('aether_dashboard_reset_v1')) {
      localStorage.removeItem('aether_tasks');
      localStorage.removeItem('aether_planners_v1');
      localStorage.setItem('aether_dashboard_reset_v1', 'true');
      setTasks([]);
      setPlanners([]);
    }
  }, []);

  // Synchronized Multi-Workspace Studio Store (auto-prunes sources inactive for >14 days)
  const [initialPruneState] = useState(() => {
    try {
      const saved = localStorage.getItem('aether_workspaces_v2');
      const parsed: Workspace[] = saved ? JSON.parse(saved) : INITIAL_WORKSPACES;
      return pruneExpiredWorkspaceSources(Array.isArray(parsed) ? parsed : INITIAL_WORKSPACES);
    } catch {
      return { workspaces: INITIAL_WORKSPACES, changed: false, normalized: false, removed: [] as RemovedExpiredSourceInfo[] };
    }
  });
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => initialPruneState.workspaces);
  const [expiredSourcesNotice, setExpiredSourcesNotice] = useState<RemovedExpiredSourceInfo[]>(
    () => initialPruneState.removed
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('aether_active_workspace_v2') || '';
  });
  const [isWorkspaceSelectorOpen, setIsWorkspaceSelectorOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('aether_workspaces_v2', JSON.stringify(workspaces));
    } catch (err) {
      // Fallback: strip large base64 dataUrl payloads from persisted copy if storage quota is exceeded
      try {
        const lightweight = workspaces.map((w) => ({
          ...w,
          sources: w.sources.map((s) =>
            s.dataUrl && s.dataUrl.length > 50000 ? { ...s, dataUrl: undefined } : s
          ),
        }));
        localStorage.setItem('aether_workspaces_v2', JSON.stringify(lightweight));
      } catch {
        console.warn('Workspace localStorage quota exceeded; keeping full media in memory.', err);
      }
    }
  }, [workspaces]);

  useEffect(() => {
    if (!activeWorkspaceId && workspaces.length > 0) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, workspaces]);

  useEffect(() => {
    safeSetLocalStorage('aether_active_workspace_v2', activeWorkspaceId);
  }, [activeWorkspaceId]);

  const activeWorkspace = useMemo(() => {
    return (
      workspaces.find((w) => w.id === activeWorkspaceId) ||
      workspaces[0] ||
      null
    );
  }, [workspaces, activeWorkspaceId]);

  const sources = activeWorkspace?.sources || [];
  const oneNoteNotebooks = activeWorkspace?.notebooks || [];
  const geminiConversations = activeWorkspace?.conversations || [];

  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(() => {
    try {
      const saved = localStorage.getItem('aether_library_v2');
      return saved ? JSON.parse(saved) : INITIAL_LIBRARY;
    } catch {
      return INITIAL_LIBRARY;
    }
  });
  const [folders, setFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('aether_folders_v3');
      return saved ? JSON.parse(saved) : ['Assorted Workspaces'];
    } catch {
      return ['Assorted Workspaces'];
    }
  });

  useEffect(() => {
    safeSetLocalStorage('aether_folders_v3', JSON.stringify(folders));
  }, [folders]);

  // One-time clean slate migration: purge all dummy workspaces, folders, sources, and cached library items
  useEffect(() => {
    const isCleaned = localStorage.getItem('aether_clean_slate_v6');
    if (!isCleaned) {
      localStorage.removeItem('aether_workspaces');
      localStorage.removeItem('aether_workspaces_v2');
      localStorage.removeItem('aether_library');
      localStorage.removeItem('aether_library_v2');
      localStorage.removeItem('aether_sources');
      localStorage.removeItem('aether_onenote');
      localStorage.removeItem('aether_gemini_conversations');
      localStorage.removeItem('aether_active_workspace');
      localStorage.removeItem('aether_active_workspace_v2');
      localStorage.removeItem('aether_folders');
      localStorage.removeItem('aether_folders_v2');
      localStorage.removeItem('aether_folders_v3');
      localStorage.setItem('aether_clean_slate_v6', 'true');
      setWorkspaces([]);
      setActiveWorkspaceId('');
      setLibraryItems([]);
      setFolders(['Assorted Workspaces']);
    }
  }, []);

  // Real-time Workspace Analytics & Interaction Audit state (starts clean with 0 dummy entries)
  const [workspaceSeconds, setWorkspaceSeconds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('aether_workspace_seconds_v1');
      return saved ? migrateAnalyticsRecord(JSON.parse(saved)) : {};
    } catch {
      return {};
    }
  });
  const [workspaceInteractions, setWorkspaceInteractions] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('aether_workspace_interactions_v1');
      return saved ? migrateAnalyticsRecord(JSON.parse(saved)) : {};
    } catch {
      return {};
    }
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const isReset = localStorage.getItem('aether_analytics_reset_v1');
      if (!isReset) return [];
      const saved = localStorage.getItem('aether_audit_logs_v2');
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return [];
    }
  });

  // One-time reset of legacy dummy analytics & audit logs
  useEffect(() => {
    if (!localStorage.getItem('aether_analytics_reset_v1')) {
      localStorage.removeItem('aether_workspace_seconds_v1');
      localStorage.removeItem('aether_workspace_interactions_v1');
      localStorage.removeItem('aether_audit_logs_v2');
      localStorage.setItem('aether_analytics_reset_v1', 'true');
      setWorkspaceSeconds({});
      setWorkspaceInteractions({});
      setAuditLogs([]);
    }
  }, []);

  useEffect(() => {
    safeSetLocalStorage('aether_workspace_seconds_v1', JSON.stringify(workspaceSeconds));
  }, [workspaceSeconds]);

  useEffect(() => {
    safeSetLocalStorage('aether_workspace_interactions_v1', JSON.stringify(workspaceInteractions));
  }, [workspaceInteractions]);

  useEffect(() => {
    safeSetLocalStorage('aether_audit_logs_v2', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const [libraryFolderSignal, setLibraryFolderSignal] = useState<{ folder: string; nonce: number } | null>(null);

  // Settings, Theme & Palettes
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('aether_dark_mode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const lastLocalPaletteChangeAtRef = useRef<number>(0);

  const handleToggleDarkMode = useCallback(
    (newDark: boolean) => {
      if (newDark === darkMode) return;
      lastLocalPaletteChangeAtRef.current = Date.now();

      // Flowy blur veil when toggling light/dark theme (theme swaps right at the 20% frost crest)
      setTransitionNonce((c) => c + 1);
      setTimeout(() => {
        setDarkMode(newDark);
      }, 95);
    },
    [darkMode]
  );

  const [activePaletteId, setActivePaletteId] = useState<ColorPaletteId>(() => {
    const saved = localStorage.getItem('aether_palette') as string | null;
    if (!saved || saved === 'atom') return 'gold-obsidian';
    return saved as ColorPaletteId;
  });

  const [customPaletteConfig, setCustomPaletteConfig] = useState<CustomPaletteConfig>(() => {
    try {
      const saved = localStorage.getItem('aether_custom_palette');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.primary === 'string' && typeof parsed.accent === 'string') {
          return { ...DEFAULT_CUSTOM_PALETTE_CONFIG, ...parsed };
        }
      }
    } catch {
      // ignore malformed saved custom palette
    }
    return DEFAULT_CUSTOM_PALETTE_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('aether_custom_palette', JSON.stringify(customPaletteConfig));
  }, [customPaletteConfig]);

  // Top-to-bottom glowing blur morph animation state on color theme palette change
  const [paletteMorph, setPaletteMorph] = useState<{
    id: number;
    palette: ColorPalette;
  } | null>(null);
  const paletteMorphTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelectPalette = useCallback((id: ColorPaletteId) => {
    if (id === activePaletteId) return;
    lastLocalPaletteChangeAtRef.current = Date.now();
    const nextPalette =
      id === 'custom'
        ? buildCustomPalette(customPaletteConfig)
        : PALETTES.find((p) => p.id === id) || PALETTES[0];

    // Trigger top-to-bottom glowing blur morph animation (only when not on lander page)
    if (activeTabRef.current !== 'lander') {
      setPaletteMorph({
        id: Date.now(),
        palette: nextPalette,
      });

      // Update palette state safely behind peak blur curtain
      setTimeout(() => {
        setActivePaletteId(id);
      }, 140);

      if (paletteMorphTimeoutRef.current) {
        clearTimeout(paletteMorphTimeoutRef.current);
      }
      paletteMorphTimeoutRef.current = setTimeout(() => {
        setPaletteMorph(null);
      }, 900);
    } else {
      setActivePaletteId(id);
    }
  }, [activePaletteId, customPaletteConfig]);

  const handleLanderPaletteChange = useCallback((id: ColorPaletteId) => {
    lastLocalPaletteChangeAtRef.current = Date.now();
    setActivePaletteId(id);
  }, []);

  const handleUpdateCustomPalette = useCallback(
    (updates: Partial<CustomPaletteConfig>, activate: boolean = true) => {
      lastLocalPaletteChangeAtRef.current = Date.now();
      setCustomPaletteConfig((prev) => ({ ...prev, ...updates }));
      if (activate && activePaletteId !== 'custom') {
        setActivePaletteId('custom');
      }
    },
    [activePaletteId]
  );
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash-lite');
  const [enableThinking, setEnableThinking] = useState<boolean>(false);

  // Precision Cursor Style & Dynamic Color Adapter Slider (0 to 100)
  const [cursorStyle, setCursorStyle] = useState<CursorStyleId>(() => {
    const saved = localStorage.getItem('aether_cursor_style') as CursorStyleId;
    const migratedDefault = localStorage.getItem('aether_cursor_default_v2');
    if (!migratedDefault) {
      localStorage.setItem('aether_cursor_default_v2', '1');
      if (!saved || saved === 'chevron') return 'circle';
    }
    if (saved === 'default') return 'arrow';
    if (saved === 'white-circle') return 'circle';
    if (saved === 'white-plus' || saved === 'white-crosshair') return 'crosshair';
    if (saved === 'white-cross') return 'cross';
    if (saved === 'white-pen') return 'pen';
    return saved || 'circle';
  });
  const [cursorColorAdapter, setCursorColorAdapter] = useState<number>(() => {
    const saved = localStorage.getItem('aether_cursor_adapter');
    return saved !== null ? Math.max(0, Math.min(100, parseInt(saved, 10))) : 70;
  });

  const activePalette = useMemo(
    () =>
      activePaletteId === 'custom'
        ? buildCustomPalette(customPaletteConfig)
        : PALETTES.find((p) => p.id === activePaletteId) || PALETTES[0],
    [activePaletteId, customPaletteConfig]
  );

  useEffect(() => {
    localStorage.setItem('aether_cursor_style', cursorStyle);
  }, [cursorStyle]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('aether_cursor_adapter', cursorColorAdapter.toString());
    }, 200);
    return () => clearTimeout(timer);
  }, [cursorColorAdapter]);

  // Smooth Scrolling Support (Default: ON, persisted in localStorage, toggleable in Settings)
  const [smoothScroll, setSmoothScroll] = useState<boolean>(() => {
    const saved = localStorage.getItem('aether_smooth_scroll');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('aether_smooth_scroll', JSON.stringify(smoothScroll));
  }, [smoothScroll]);

  // Activate Smooth Momentum Scrolling
  useSmoothScroll(smoothScroll);

  // Pause main window Lenis while full-screen OneNote or Gemini workspace is open
  useEffect(() => {
    const lenis = getLenis();
    if (isOneNoteOpen || isGeminiWorkspaceOpen) {
      lenis?.stop();
    } else if (smoothScroll) {
      lenis?.start();
      lenis?.resize();
    }
  }, [isOneNoteOpen, isGeminiWorkspaceOpen, smoothScroll]);

  // Sync CSS variables on :root for instantaneous hardware-accelerated cursor colors
  useEffect(() => {
    const { color1, color2 } = getCursorGradient(activePalette, cursorColorAdapter);
    document.documentElement.style.setProperty('--cursor-color-1', color1);
    document.documentElement.style.setProperty('--cursor-color-2', color2);
  }, [activePalette, cursorColorAdapter]);

  // Generate hardware-accelerated cursor CSS with dynamic gradient adaptation
  const cursorCss = useMemo(() => {
    return getCursorCss(cursorStyle, activePalette, cursorColorAdapter);
  }, [cursorStyle, activePalette, cursorColorAdapter]);

  // Glow Opacity Multiplier (Default 0.95 = 15% reduction from 1.12)
  const [glowMultiplier, setGlowMultiplier] = useState<number>(() => {
    const saved = localStorage.getItem('aether_glow_multiplier_v3');
    return saved ? Math.max(0.15, Math.min(2.5, parseFloat(saved))) : 0.95;
  });
  const [isHudMounted, setIsHudMounted] = useState(false);
  const [isHudVisible, setIsHudVisible] = useState(false);
  const isHudMountedRef = useRef(false);
  isHudMountedRef.current = isHudMounted;
  const [isAdjustingGlow, setIsAdjustingGlow] = useState(false);

  const glowMultiplierRef = useRef(glowMultiplier);
  glowMultiplierRef.current = glowMultiplier;

  const isRightClickHeldRef = useRef(false);
  const dragStartYRef = useRef(0);
  const startMultiplierRef = useRef(0.95);
  const hasDraggedRef = useRef(false);
  const hideHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerRafRef = useRef<number | null>(null);
  const lastPointerPosRef = useRef<{ clientX: number; clientY: number; target: EventTarget | null; buttons?: number } | null>(null);
  const activeHoverTileRef = useRef<HTMLElement | null>(null);
  const activeParentCardRef = useRef<HTMLElement | null>(null);
  const pressedTileRef = useRef<HTMLElement | null>(null);
  const pressedCandidateRef = useRef<HTMLElement | null>(null);
  const isLeftClickDownRef = useRef(false);
  const wasHoldTriggeredRef = useRef(false);
  const leftClickHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollGlowRafRef = useRef<number | null>(null);

  const showHud = useCallback(() => {
    if (hideHudTimerRef.current) {
      clearTimeout(hideHudTimerRef.current);
      hideHudTimerRef.current = null;
    }
    if (unmountHudTimerRef.current) {
      clearTimeout(unmountHudTimerRef.current);
      unmountHudTimerRef.current = null;
    }
    if (!isHudMountedRef.current) {
      isHudMountedRef.current = true;
      setIsHudMounted(true);
      setIsHudVisible(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsHudVisible(true);
        });
      });
    } else {
      setIsHudVisible(true);
    }
  }, []);

  const dismissHud = useCallback((delayMs = 0) => {
    if (hideHudTimerRef.current) {
      clearTimeout(hideHudTimerRef.current);
      hideHudTimerRef.current = null;
    }
    if (unmountHudTimerRef.current) {
      clearTimeout(unmountHudTimerRef.current);
      unmountHudTimerRef.current = null;
    }
    if (delayMs <= 0) {
      setIsHudVisible(false);
      unmountHudTimerRef.current = setTimeout(() => {
        isHudMountedRef.current = false;
        setIsHudMounted(false);
      }, 300);
      return;
    }
    hideHudTimerRef.current = setTimeout(() => {
      setIsHudVisible(false);
      unmountHudTimerRef.current = setTimeout(() => {
        isHudMountedRef.current = false;
        setIsHudMounted(false);
      }, 300);
    }, delayMs);
  }, []);
  const clickedCardRef = useRef<HTMLElement | null>(null);

  // Performance DOM refs for zero-re-render HUD updates
  const hudBadgeRef = useRef<HTMLSpanElement | null>(null);
  const hudInputRef = useRef<HTMLInputElement | null>(null);
  const hudRafRef = useRef<number | null>(null);

  // Synchronize CSS variable across document
  const updateGlowMultiplier = (val: number) => {
    const clamped = Math.max(0.15, Math.min(2.5, Math.round(val * 100) / 100));
    document.documentElement.style.setProperty('--glow-opacity-multiplier', String(clamped));
    return clamped;
  };

  useEffect(() => {
    updateGlowMultiplier(glowMultiplier);
  }, []);

  // Simple Right-Click Glow Wave Ripple Across All Visible Surfaces / Cards / Tiles
  const triggerAllSurfacesGlowRipple = (clientX: number, clientY: number) => {
    try {
      const allSurfaces = Array.from(
        document.querySelectorAll<HTMLElement>('.liquid-glass, .liquid-glass-tile')
      );
      if (!allSurfaces || allSurfaces.length === 0) return;

      // Filter out redundant nested child tiles whose parent container is already rippling,
      // and skip surfaces in the main bottom right workspace editor canvas
      const cards = allSurfaces.filter((el) => {
        // Skip void or input elements that cannot hold ripple overlays
        if (el instanceof HTMLInputElement || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          return false;
        }
        if (el.closest('.onenote-editor-canvas, .gemini-chat-canvas')) {
          return false;
        }
        const parentGlass = el.parentElement?.closest('.liquid-glass');
        return !parentGlass || parentGlass === el;
      });

      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      cards.forEach((card) => {
        // Skip hidden or collapsed elements
        if (card.offsetParent === null) return;
        const rect = card.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        // Viewport Culling: Skip surfaces completely outside the visible viewport
        if (
          rect.bottom < 0 ||
          rect.top > winHeight ||
          rect.right < 0 ||
          rect.left > winWidth
        ) {
          return;
        }

        // Concurrent Ripple Limiting: Cap active ripples to 2 per card, removing older ones upon rapid clicks
        const existingRipples = card.querySelectorAll('.card-glow-ripple');
        if (existingRipples.length >= 2) {
          existingRipples[0].remove();
        }

        const clickX = clientX - rect.left;
        const clickY = clientY - rect.top;

        // Calculate maximum radius to ensure the wave sweeps across the entire card surface
        const maxDist = Math.hypot(
          Math.max(clickX, rect.width - clickX),
          Math.max(clickY, rect.height - clickY)
        );
        const rippleDiameter = Math.max(rect.width, rect.height, maxDist * 2.2);

        const ripple = document.createElement('span');
        ripple.className = 'card-glow-ripple';
        ripple.setAttribute('aria-hidden', 'true');
        ripple.style.position = 'absolute';
        ripple.style.left = `${Math.round(clickX)}px`;
        ripple.style.top = `${Math.round(clickY)}px`;
        ripple.style.width = `${Math.round(rippleDiameter)}px`;
        ripple.style.height = `${Math.round(rippleDiameter)}px`;
        ripple.style.margin = '0px';
        ripple.style.marginTop = '0px';
        ripple.style.marginBottom = '0px';

        const prevPosition = window.getComputedStyle(card).position;
        if (prevPosition === 'static') {
          card.style.position = 'relative';
        }
        if (!card.classList.contains('overflow-hidden') && card.style.overflow !== 'hidden') {
          card.style.overflow = 'hidden';
        }

        // Prepend so that in legacy space-y containers, bottom children never lose :last-child status
        card.prepend(ripple);

        const cleanupTimeoutMs = 1000;
        const cleanup = () => {
          if (ripple.parentNode === card) {
            card.removeChild(ripple);
          }
        };

        ripple.addEventListener('animationend', cleanup, { once: true });
        setTimeout(cleanup, cleanupTimeoutMs);
      });
    } catch {
      // Graceful fallback
    }
  };

  // Dynamically synchronize theme (dark/light) & palette variables
  useEffect(() => {
    localStorage.setItem('aether_dark_mode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.setProperty('--palette-bg', activePalette.bgDark);
      document.documentElement.style.setProperty('--card-bg', 'rgba(15, 23, 42, 0.08)');
      document.documentElement.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.1)');
      document.documentElement.style.setProperty('--text-main', '#f8fafc');
      document.documentElement.style.setProperty('--text-muted', '#94a3b8');
      document.body.style.backgroundColor = activePalette.bgDark;
      document.body.style.color = '#f8fafc';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.setProperty('--palette-bg', '#f8fafc');
      document.documentElement.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.65)');
      document.documentElement.style.setProperty('--card-border', 'rgba(226, 232, 240, 0.85)');
      document.documentElement.style.setProperty('--text-main', '#0f172a');
      document.documentElement.style.setProperty('--text-muted', '#475569');
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.color = '#0f172a';
    }
  }, [darkMode, activePalette]);

  useEffect(() => {
    localStorage.setItem('aether_palette', activePaletteId);

    document.documentElement.style.setProperty('--palette-primary', activePalette.primary);
    document.documentElement.style.setProperty('--palette-accent', activePalette.accent);
    document.documentElement.style.setProperty(
      '--palette-gradient',
      `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`
    );

    const hex = activePalette.primary.replace('#', '');
    const pr = parseInt(hex.substring(0, 2), 16);
    const pg = parseInt(hex.substring(2, 4), 16);
    const pb = parseInt(hex.substring(4, 6), 16);
    const r = Number.isNaN(pr) ? 245 : pr;
    const g = Number.isNaN(pg) ? 158 : pg;
    const b = Number.isNaN(pb) ? 11 : pb;
    const shadowColor = activePalette.id === 'black-night'
      ? 'rgba(0, 0, 0, 0.98)'
      : `rgba(${r}, ${g}, ${b}, ${darkMode ? 0.35 : 0.2})`;
    document.documentElement.style.setProperty('--palette-shadow', shadowColor);

    // Aaron Iker adaptive design tokens
    document.documentElement.style.setProperty(
      '--button-shine-left',
      activePalette.id === 'black-night' ? '#18181b' : activePalette.primary
    );
    document.documentElement.style.setProperty(
      '--button-shine-right',
      activePalette.id === 'black-night' ? '#09090b' : activePalette.accent
    );
    document.documentElement.style.setProperty(
      '--button-glow-start',
      activePalette.id === 'black-night' ? '#000000' : activePalette.primary
    );
    document.documentElement.style.setProperty(
      '--button-glow-end',
      activePalette.id === 'black-night' ? '#000000' : activePalette.accent
    );
    document.documentElement.style.setProperty('--button-shadow', shadowColor);

    if (darkMode) {
      document.documentElement.style.setProperty('--palette-bg', activePalette.bgDark);
      document.body.style.backgroundColor = activePalette.bgDark;
    }
  }, [activePaletteId, activePalette, darkMode]);

  // Interactive Pointer Spotlight Glow, Right-Click Drag Opacity Calibrator & Windows Start Menu Hit Animation
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      // 1. Automatically dismiss glow slider HUD immediately when a right click is initiated
      if (e.button === 2) {
        dismissHud(0);
      }

      // Disable calibrator/ripple and HUD on the Aether home page (lander)
      if (activeTabRef.current === 'lander') {
        return;
      }

      // Left-click observation: smooth 1s glow surge on simple click + hold detection
      if (e.button === 0) {
        if (leftClickHoldTimerRef.current) {
          clearTimeout(leftClickHoldTimerRef.current);
          leftClickHoldTimerRef.current = null;
        }
        isLeftClickDownRef.current = true;
        wasHoldTriggeredRef.current = false;

        const isInteractiveInput = Boolean(
          (e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]')
        );
        if (!isInteractiveInput) {
          const card = (e.target as HTMLElement | null)?.closest?.(
            '.liquid-glass-tile'
          ) as HTMLElement | null;
          if (
            card &&
            !card.classList.contains('no-lift') &&
            !card.closest('.onenote-editor-canvas')
          ) {
            card.classList.remove('card-rebound');
            pressedCandidateRef.current = card;

            // Only engage 3D displacement animation when holding left click (>110ms)
            const clickClientX = e.clientX;
            const clickClientY = e.clientY;
            leftClickHoldTimerRef.current = setTimeout(() => {
              if (isLeftClickDownRef.current && pressedCandidateRef.current === card) {
                wasHoldTriggeredRef.current = true;
                card.classList.add('card-pressed');
                pressedTileRef.current = card;

                const rect = card.getBoundingClientRect();
                const x = clickClientX - rect.left;
                const y = clickClientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const normX = Math.max(-1, Math.min(1, (x - centerX) / (centerX || 1)));
                const normY = Math.max(-1, Math.min(1, (y - centerY) / (centerY || 1)));
                // 3D tile tilt: 0.5deg
                const tiltX = Math.round(normY * 0.5 * 1000) / 1000;
                const tiltY = Math.round(-normX * 0.5 * 1000) / 1000;
                card.style.setProperty('--tilt-x', `${tiltX}deg`);
                card.style.setProperty('--tilt-y', `${tiltY}deg`);
              }
            }, 110);
          }
        }
      }

      if (e.button === 2) {
        // Do not trigger right-click glow ripple or calibrator when interacting with table blocks
        const isTable = Boolean(
          (e.target as HTMLElement | null)?.closest?.('.onenote-table-block, [data-table-block]')
        );
        if (isTable) {
          return;
        }

        // Immediately dismiss glow slider HUD upon right click initiation
        dismissHud(0);
        isRightClickHeldRef.current = true;
        dragStartYRef.current = e.clientY;
        startMultiplierRef.current = glowMultiplierRef.current;
        hasDraggedRef.current = false;

        // Find the card/tile under the click point
        const card = (e.target as HTMLElement | null)?.closest?.(
          '.liquid-glass, .liquid-glass-tile'
        ) as HTMLElement | null;
        clickedCardRef.current = card;
      }
    };

    const finishRightClick = (e: MouseEvent | PointerEvent) => {
      if (!isRightClickHeldRef.current) return;
      isRightClickHeldRef.current = false;
      document.body.classList.remove('glow-tuning-active', 'glow-rightclick-tuning');
      setIsAdjustingGlow(false);
      dismissHud(0);

      if (hasDraggedRef.current) {
        // Drag occurred: save adjusted opacity setting ONCE upon drag completion
        const finalVal = glowMultiplierRef.current;
        setGlowMultiplier(finalVal);
        localStorage.setItem('aether_glow_multiplier_v3', String(finalVal));
      } else {
        // Simple right-click (no drag)!
        // Trigger radiant glow ripple wave spreading across all visible surfaces/cards/tiles
        const isInteractiveInput = (e.target as HTMLElement | null)?.closest?.(
          'input, textarea, select, a, button'
        );
        const isTable = Boolean(
          (e.target as HTMLElement | null)?.closest?.('.onenote-table-block, [data-table-block]')
        );
        if (!isInteractiveInput && !isTable) {
          triggerAllSurfacesGlowRipple(e.clientX, e.clientY);
        }
      }
      clickedCardRef.current = null;
    };

    const resolveTargetElement = (t: EventTarget | null): HTMLElement | null => {
      if (!t) return null;
      if (t instanceof HTMLElement) return t;
      if (t instanceof Element) return t as unknown as HTMLElement;
      return (t as Node).parentElement || null;
    };

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      if ('pointerType' in e && e.pointerType === 'touch') {
        return;
      }

      const isLander = activeTabRef.current === 'lander';
      const targetElem = resolveTargetElement(e.target);

      // Windows Start Menu hit animation: maintain & transfer pressed state as user hovers while holding left click
      if (!isLander && (e.buttons & 1) && !isRightClickHeldRef.current) {
        const isInteractiveInput = Boolean(
          targetElem?.closest?.('input, textarea, [contenteditable="true"]')
        );
        const tileUnderCursor = isInteractiveInput
          ? null
          : (targetElem?.closest?.('.liquid-glass-tile') as HTMLElement | null);

        if (tileUnderCursor !== pressedTileRef.current) {
          if (pressedTileRef.current) {
            pressedTileRef.current.classList.remove('card-pressed');
            pressedTileRef.current.style.setProperty('--tilt-x', '0deg');
            pressedTileRef.current.style.setProperty('--tilt-y', '0deg');
          }
          if (
            tileUnderCursor &&
            !tileUnderCursor.classList.contains('no-lift') &&
            !tileUnderCursor.closest('.onenote-editor-canvas, .gemini-chat-canvas')
          ) {
            tileUnderCursor.classList.add('card-pressed');
            pressedTileRef.current = tileUnderCursor;
          } else {
            pressedTileRef.current = null;
          }
        }
      }

      // 1. Right-Click Drag Opacity Adjustment (Up = increase, Down = decrease)
      if (!isLander && isRightClickHeldRef.current) {
        if (e.buttons !== undefined && !(e.buttons & 2)) {
          finishRightClick(e);
          return;
        }

        const deltaY = dragStartYRef.current - e.clientY; // UP is positive, DOWN is negative
        if (Math.abs(deltaY) > 2) {
          if (!hasDraggedRef.current) {
            hasDraggedRef.current = true;
            document.body.classList.add('glow-tuning-active', 'glow-rightclick-tuning');
            showHud();
            setIsAdjustingGlow(true);
          }
        }

        if (hasDraggedRef.current) {
          // 150px cursor vertical displacement maps smoothly to 1.0 change in multiplier
          const change = deltaY / 150;
          const clamped = Math.max(
            0.15,
            Math.min(2.5, Math.round((startMultiplierRef.current + change) * 100) / 100)
          );
          glowMultiplierRef.current = clamped;

          // 1. Direct GPU compositor CSS variable update (Zero React re-render of App)
          document.documentElement.style.setProperty('--glow-opacity-multiplier', String(clamped));

          // 2. Direct DOM update for HUD badge and slider input in requestAnimationFrame
          if (!hudRafRef.current) {
            hudRafRef.current = requestAnimationFrame(() => {
              hudRafRef.current = null;
              const cur = glowMultiplierRef.current;
              if (hudBadgeRef.current) {
                hudBadgeRef.current.textContent = `${Math.round(cur * 100)}%`;
              }
              if (hudInputRef.current) {
                hudInputRef.current.value = String(cur);
                const pct = Math.round(((cur - 0.15) / 2.35) * 100);
                hudInputRef.current.style.background = `linear-gradient(to right, ${activePalette.primary} 0%, ${activePalette.accent} ${pct}%, rgba(100, 116, 139, 0.25) ${pct}%)`;
              }
            });
          }
        }

        // Return immediately during drag to eliminate layout thrashing and hover card tracking
        return;
      }

      // 2. High-Performance GPU-Synced Cursor Position Tracking (120 FPS, Zero Layout Thrashing)
      lastPointerPosRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        target: e.target,
        buttons: e.buttons,
      };

      if (!pointerRafRef.current) {
        pointerRafRef.current = requestAnimationFrame(() => {
          pointerRafRef.current = null;
          const pos = lastPointerPosRef.current;
          if (!pos) return;

          const targetEl = resolveTargetElement(pos.target);
          if (!targetEl) return;

          // O(1) single-lookup for closest tile, card, or button under cursor
          const tile = targetEl.closest?.(
            '.liquid-glass-tile, .liquid-glass, .glow-button'
          ) as HTMLElement | null;

          if (activeHoverTileRef.current && activeHoverTileRef.current !== tile) {
            // Reset only 3D tilt on exit; leave --pointer-x/--pointer-y in place so CSS opacity fades out without streaking to -999px
            activeHoverTileRef.current.style.setProperty('--tilt-x', '0deg');
            activeHoverTileRef.current.style.setProperty('--tilt-y', '0deg');
          }
          activeHoverTileRef.current = tile;

          if (tile) {
            const rect = tile.getBoundingClientRect();
            const x = pos.clientX - rect.left;
            const y = pos.clientY - rect.top;
            const ratio = rect.width > 0 ? Math.max(0, Math.min(1, x / rect.width)) : 0.5;

            tile.style.setProperty('--pointer-x', `${Math.round(x)}px`);
            tile.style.setProperty('--pointer-y', `${Math.round(y)}px`);
            tile.style.setProperty('--pointer-ratio', `${Math.round(ratio * 1000) / 1000}`);

            // 3D Fluent Tilt Displacement: only takes place when the user is HOLDING left click
            const isLeftClickHeld = Boolean(
              activeTabRef.current !== 'lander' &&
                ((pos.buttons ?? 0) & 1) &&
                tile.classList.contains('card-pressed')
            );

            if (
              isLeftClickHeld &&
              !tile.classList.contains('no-lift') &&
              !tile.classList.contains('no-tilt') &&
              !tile.closest('.onenote-editor-canvas, .gemini-chat-canvas')
            ) {
              const centerX = rect.width / 2;
              const centerY = rect.height / 2;
              const normX = Math.max(-1, Math.min(1, (x - centerX) / (centerX || 1)));
              const normY = Math.max(-1, Math.min(1, (y - centerY) / (centerY || 1)));

              const maxAngle = 0.5;
              const tiltX = Math.round(normY * maxAngle * 1000) / 1000;
              const tiltY = Math.round(-normX * maxAngle * 1000) / 1000;

              tile.style.setProperty('--tilt-x', `${tiltX}deg`);
              tile.style.setProperty('--tilt-y', `${tiltY}deg`);
            } else {
              tile.style.setProperty('--tilt-x', '0deg');
              tile.style.setProperty('--tilt-y', '0deg');
            }

            // Propagate to outer card if hovering inside an inner sub-tile
            const parentCard = tile.parentElement?.closest?.('.liquid-glass') as HTMLElement | null;
            const nextParent = parentCard && parentCard !== tile ? parentCard : null;
            if (activeParentCardRef.current && activeParentCardRef.current !== nextParent) {
              activeParentCardRef.current.style.setProperty('--tilt-x', '0deg');
              activeParentCardRef.current.style.setProperty('--tilt-y', '0deg');
            }
            activeParentCardRef.current = nextParent;
            if (activeParentCardRef.current) {
              const pRect = activeParentCardRef.current.getBoundingClientRect();
              const px = pos.clientX - pRect.left;
              const py = pos.clientY - pRect.top;
              const pRatio = pRect.width > 0 ? Math.max(0, Math.min(1, px / pRect.width)) : 0.5;
              activeParentCardRef.current.style.setProperty('--pointer-x', `${Math.round(px)}px`);
              activeParentCardRef.current.style.setProperty('--pointer-y', `${Math.round(py)}px`);
              activeParentCardRef.current.style.setProperty('--pointer-ratio', `${Math.round(pRatio * 1000) / 1000}`);
            }
          } else if (activeParentCardRef.current) {
            activeParentCardRef.current.style.setProperty('--tilt-x', '0deg');
            activeParentCardRef.current.style.setProperty('--tilt-y', '0deg');
            activeParentCardRef.current = null;
          }
        });
      }
    };

    let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScrollGlow = () => {
      // 1. High-frequency GPU-bound tile tracking (sub-0.01ms, zero document layout tree recalculation)
      if (!scrollGlowRafRef.current) {
        scrollGlowRafRef.current = requestAnimationFrame(() => {
          scrollGlowRafRef.current = null;
          const pos = lastPointerPosRef.current;
          if (!pos) return;

          const tile = activeHoverTileRef.current;
          if (tile && tile.isConnected) {
            const rect = tile.getBoundingClientRect();
            // Validate if cursor is still within the active card footprint
            if (
              pos.clientX >= rect.left &&
              pos.clientX <= rect.right &&
              pos.clientY >= rect.top &&
              pos.clientY <= rect.bottom
            ) {
              const y = pos.clientY - rect.top;
              tile.style.setProperty('--pointer-y', `${Math.round(y)}px`);

              const parentCard = activeParentCardRef.current;
              if (parentCard && parentCard.isConnected) {
                const pRect = parentCard.getBoundingClientRect();
                parentCard.style.setProperty('--pointer-y', `${Math.round(pos.clientY - pRect.top)}px`);
              }
              return;
            } else {
              activeHoverTileRef.current = null;
              activeParentCardRef.current = null;
            }
          }
        });
      }

      // 2. Debounce single settle hit-test when scroll comes to rest
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        const pos = lastPointerPosRef.current;
        if (!pos) return;
        const currentTarget = document.elementFromPoint(pos.clientX, pos.clientY);
        const tile = currentTarget?.closest?.(
          '.liquid-glass-tile, .liquid-glass, .glow-button'
        ) as HTMLElement | null;

        activeHoverTileRef.current = tile;
        if (tile) {
          const rect = tile.getBoundingClientRect();
          const x = pos.clientX - rect.left;
          const y = pos.clientY - rect.top;
          const ratio = rect.width > 0 ? Math.max(0, Math.min(1, x / rect.width)) : 0.5;

          tile.style.setProperty('--pointer-x', `${Math.round(x)}px`);
          tile.style.setProperty('--pointer-y', `${Math.round(y)}px`);
          tile.style.setProperty('--pointer-ratio', `${Math.round(ratio * 1000) / 1000}`);
        }
      }, 100);
    };

    const handlePointerUp = (e: MouseEvent | PointerEvent) => {
      if (leftClickHoldTimerRef.current) {
        clearTimeout(leftClickHoldTimerRef.current);
        leftClickHoldTimerRef.current = null;
      }
      isLeftClickDownRef.current = false;
      const clickedCard = pressedCandidateRef.current;
      const wasHeld = wasHoldTriggeredRef.current;
      pressedCandidateRef.current = null;

      if (activeTabRef.current === 'lander') {
        return;
      }

      if (e.button === 2 || isRightClickHeldRef.current) {
        finishRightClick(e);
      }

      // Simple left click glow opacity surge (1 second smooth enter & exit)
      if (e.button === 0 && !wasHeld && clickedCard) {
        clickedCard.classList.remove('card-glow-surge');
        void clickedCard.offsetWidth; // trigger reflow for smooth animation restart
        clickedCard.classList.add('card-glow-surge');
        setTimeout(() => {
          clickedCard.classList.remove('card-glow-surge');
        }, 1000);
      }

      // Windows Start Menu hit animation release: trigger smooth spring rebound to normal state
      if (e.button === 0 || !(e.buttons & 1)) {
        if (pressedTileRef.current) {
          const tile = pressedTileRef.current;
          const curTiltX = tile.style.getPropertyValue('--tilt-x') || '0deg';
          const curTiltY = tile.style.getPropertyValue('--tilt-y') || '0deg';
          tile.style.setProperty('--release-tilt-x', curTiltX);
          tile.style.setProperty('--release-tilt-y', curTiltY);
          tile.classList.remove('card-pressed');
          tile.classList.remove('card-rebound');
          void tile.offsetWidth; // trigger reflow for smooth spring rebound transition
          tile.classList.add('card-rebound');
          setTimeout(() => {
            tile.classList.remove('card-rebound');
            tile.style.setProperty('--tilt-x', '0deg');
            tile.style.setProperty('--tilt-y', '0deg');
          }, 420);
          pressedTileRef.current = null;
        }
        document.querySelectorAll<HTMLElement>('.card-pressed').forEach((el) => {
          el.classList.remove('card-pressed');
          el.style.setProperty('--tilt-x', '0deg');
          el.style.setProperty('--tilt-y', '0deg');
        });
      }
    };

    const handlePointerCancel = () => {
      if (leftClickHoldTimerRef.current) {
        clearTimeout(leftClickHoldTimerRef.current);
        leftClickHoldTimerRef.current = null;
      }
      isLeftClickDownRef.current = false;
      pressedCandidateRef.current = null;
      wasHoldTriggeredRef.current = false;

      if (pressedTileRef.current) {
        const tile = pressedTileRef.current;
        const curTiltX = tile.style.getPropertyValue('--tilt-x') || '0deg';
        const curTiltY = tile.style.getPropertyValue('--tilt-y') || '0deg';
        tile.style.setProperty('--release-tilt-x', curTiltX);
        tile.style.setProperty('--release-tilt-y', curTiltY);
        tile.classList.remove('card-pressed');
        tile.classList.remove('card-rebound');
        void tile.offsetWidth;
        tile.classList.add('card-rebound');
        setTimeout(() => {
          tile.classList.remove('card-rebound');
          tile.style.setProperty('--tilt-x', '0deg');
          tile.style.setProperty('--tilt-y', '0deg');
        }, 420);
        pressedTileRef.current = null;
      }
      if (activeHoverTileRef.current) {
        activeHoverTileRef.current.style.setProperty('--tilt-x', '0deg');
        activeHoverTileRef.current.style.setProperty('--tilt-y', '0deg');
      }
      if (activeParentCardRef.current) {
        activeParentCardRef.current.style.setProperty('--tilt-x', '0deg');
        activeParentCardRef.current.style.setProperty('--tilt-y', '0deg');
      }
      document.querySelectorAll<HTMLElement>('.card-pressed').forEach((el) => {
        el.classList.remove('card-pressed');
        el.style.setProperty('--tilt-x', '0deg');
        el.style.setProperty('--tilt-y', '0deg');
      });
    };

    const handleContextMenu = (e: MouseEvent) => {
      const targetEl = resolveTargetElement(e.target);
      const isInput = targetEl?.closest?.('input, textarea');

      // On Lander, prevent native menu without stopping propagation so PolygonCanvas handles theme-flip contextmenu fallback cleanly
      if (activeTabRef.current === 'lander') {
        if (!isInput) {
          e.preventDefault();
        }
        return;
      }

      const isTable = Boolean(
        targetEl?.closest?.('.onenote-table-block, [data-table-block]')
      );
      if (isTable) {
        // Prevent browser native menu so custom OneNote cell highlight context menu displays cleanly
        e.preventDefault();
        return;
      }

      // Allow right-click on Dashboard cards to reach React's onContextMenu (delete confirmation modal)
      const isDashboardCard = Boolean(targetEl?.closest?.('[data-dashboard-card]'));
      if (isDashboardCard && !hasDraggedRef.current && !isInput) {
        e.preventDefault();
        return;
      }

      // Prevent browser context menu except on interactive text inputs
      if (hasDraggedRef.current || !isInput) {
        e.preventDefault();
        e.stopPropagation();
        hasDraggedRef.current = false;
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: true });
    window.addEventListener('scroll', handleScrollGlow, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('pointercancel', handlePointerCancel, { capture: true });
    window.addEventListener('blur', handlePointerCancel);
    document.addEventListener('mouseleave', handlePointerCancel);
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('scroll', handleScrollGlow);
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerCancel, { capture: true });
      window.removeEventListener('blur', handlePointerCancel);
      document.removeEventListener('mouseleave', handlePointerCancel);
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      if (hideHudTimerRef.current) clearTimeout(hideHudTimerRef.current);
      if (unmountHudTimerRef.current) clearTimeout(unmountHudTimerRef.current);
      if (hudRafRef.current) cancelAnimationFrame(hudRafRef.current);
      if (pointerRafRef.current) cancelAnimationFrame(pointerRafRef.current);
      if (scrollGlowRafRef.current) cancelAnimationFrame(scrollGlowRafRef.current);
    };
  }, []);

  // Sync persistence
  useEffect(() => {
    try {
      localStorage.setItem('aether_sources', JSON.stringify(sources));
    } catch {
      // Keep runtime sources intact if binary dataUrl exceeds quota
    }
  }, [sources]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('aether_onenote', JSON.stringify(oneNoteNotebooks));
      } catch (err) {
        console.error('Failed to save onenote notebooks to localStorage', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [oneNoteNotebooks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('aether_gemini_conversations', JSON.stringify(geminiConversations));
      } catch (err) {
        console.error('Failed to save gemini conversations to localStorage', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [geminiConversations]);

  useEffect(() => {
    try {
      localStorage.setItem('aether_library_v2', JSON.stringify(libraryItems));
    } catch (err) {
      console.warn('Library localStorage quota exceeded; keeping items in memory.', err);
    }
  }, [libraryItems]);

  // Refs to detect meaningful deltas in chats and OneNote for live audit logging
  const oneNoteAuditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  const libraryItemsRef = useRef(libraryItems);
  libraryItemsRef.current = libraryItems;
  const activeWorkspaceRef = useRef(activeWorkspace);
  activeWorkspaceRef.current = activeWorkspace;
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  activeWorkspaceIdRef.current = activeWorkspaceId;
  const isGeminiOpenRef = useRef(isGeminiWorkspaceOpen);
  isGeminiOpenRef.current = isGeminiWorkspaceOpen;

  // Refs holding latest state slices for initial seeding upon first-ever Google sign-in
  const latestSlicesRef = useRef({
    dashboard: {
      cards: dashboardCards,
      tasks,
      planners,
      syllabusCourses,
      examSchedules,
      timetableSlots,
      localCalendarEvents,
    } as DashboardStatePayload,
    analytics: {
      dailyStudySeconds,
      workspaceSeconds,
      workspaceInteractions,
      auditLogs: auditLogs.slice(0, 150),
      folders,
      libraryItems,
      activeWorkspaceId,
    } as AnalyticsStatePayload,
    preferences: {
      darkMode,
      activePaletteId,
      customPaletteConfig,
      selectedModel,
      enableThinking,
      cursorStyle,
      cursorColorAdapter,
      smoothScroll,
      glowMultiplier,
      geminiApiKey: syncedGeminiKey,
      customUserName: geminiPersonalization.customName,
      geminiMemoryLevel: geminiPersonalization.memoryLevel,
      geminiLearnedMemories: geminiPersonalization.memories,
      geminiCustomInstructions: geminiPersonalization.customInstructions,
    } as PreferencesStatePayload,
    floatingChat: {
      messages: floatingChatMessages,
    } as FloatingChatStatePayload,
  });
  latestSlicesRef.current = {
    dashboard: {
      cards: dashboardCards,
      tasks,
      planners,
      syllabusCourses,
      examSchedules,
      timetableSlots,
      localCalendarEvents,
    },
    analytics: {
      dailyStudySeconds,
      workspaceSeconds,
      workspaceInteractions,
      auditLogs: auditLogs.slice(0, 150),
      folders,
      libraryItems,
      activeWorkspaceId,
    },
    preferences: {
      darkMode,
      activePaletteId,
      customPaletteConfig,
      selectedModel,
      enableThinking,
      cursorStyle,
      cursorColorAdapter,
      smoothScroll,
      glowMultiplier,
      geminiApiKey: syncedGeminiKey,
      customUserName: geminiPersonalization.customName,
      geminiMemoryLevel: geminiPersonalization.memoryLevel,
      geminiLearnedMemories: geminiPersonalization.memories,
      geminiCustomInstructions: geminiPersonalization.customInstructions,
    },
    floatingChat: {
      messages: floatingChatMessages,
    },
  };

  const applyDashboardRemote = useCallback((d: DashboardStatePayload) => {
    isApplyingRemoteRef.current = true;
    if (Array.isArray(d.cards) && d.cards.length > 0) {
      setDashboardCards(normalizeDashboardCards(d.cards));
    }
    if (Array.isArray(d.tasks)) setTasks(d.tasks);
    if (Array.isArray(d.planners)) setPlanners(d.planners);
    if (Array.isArray(d.syllabusCourses)) setSyllabusCourses(d.syllabusCourses);
    if (Array.isArray(d.examSchedules)) setExamSchedules(d.examSchedules);
    if (Array.isArray(d.timetableSlots)) setTimetableSlots(d.timetableSlots);
    if (Array.isArray(d.localCalendarEvents)) setLocalCalendarEvents(d.localCalendarEvents);
    scheduleClearApplyingRemote();
  }, [scheduleClearApplyingRemote]);

  const applyAnalyticsRemote = useCallback((a: AnalyticsStatePayload) => {
    isApplyingRemoteRef.current = true;
    if (a.dailyStudySeconds && typeof a.dailyStudySeconds === 'object') {
      setDailyStudySeconds(migrateAnalyticsRecord(a.dailyStudySeconds));
    }
    if (a.workspaceSeconds && typeof a.workspaceSeconds === 'object') {
      setWorkspaceSeconds(migrateAnalyticsRecord(a.workspaceSeconds));
    }
    if (a.workspaceInteractions && typeof a.workspaceInteractions === 'object') {
      setWorkspaceInteractions(migrateAnalyticsRecord(a.workspaceInteractions));
    }
    if (Array.isArray(a.auditLogs)) setAuditLogs(a.auditLogs);
    if (Array.isArray(a.folders) && a.folders.length > 0) setFolders(a.folders);
    if (Array.isArray(a.libraryItems)) setLibraryItems(a.libraryItems);
    if (typeof a.activeWorkspaceId === 'string' && a.activeWorkspaceId) {
      setActiveWorkspaceId(a.activeWorkspaceId);
    }
    scheduleClearApplyingRemote();
  }, [scheduleClearApplyingRemote]);

  const applyPreferencesRemote = useCallback((p: PreferencesStatePayload) => {
    isApplyingRemoteRef.current = true;
    const hasRecentLocalThemeEdit =
      Boolean(pendingSyncTimersRef.current.preferences) ||
      Date.now() - lastLocalPaletteChangeAtRef.current < 6000;
    if (!hasRecentLocalThemeEdit) {
      if (typeof p.darkMode === 'boolean') setDarkMode(p.darkMode);
      if (typeof p.activePaletteId === 'string') setActivePaletteId(p.activePaletteId);
      if (p.customPaletteConfig && typeof p.customPaletteConfig.primary === 'string') {
        setCustomPaletteConfig(p.customPaletteConfig);
      }
    }
    if (typeof p.selectedModel === 'string' && p.selectedModel) setSelectedModel(p.selectedModel);
    if (typeof p.enableThinking === 'boolean') setEnableThinking(p.enableThinking);
    if (typeof p.cursorStyle === 'string') setCursorStyle(p.cursorStyle);
    if (typeof p.cursorColorAdapter === 'number') setCursorColorAdapter(p.cursorColorAdapter);
    if (typeof p.smoothScroll === 'boolean') setSmoothScroll(p.smoothScroll);
    if (typeof p.glowMultiplier === 'number') {
      setGlowMultiplier(p.glowMultiplier);
      updateGlowMultiplier(p.glowMultiplier);
    }
    if (typeof p.geminiApiKey === 'string' && p.geminiApiKey.trim()) {
      setActiveGeminiApiKey(p.geminiApiKey.trim());
    }
    if (
      typeof p.customUserName === 'string' ||
      typeof p.geminiMemoryLevel === 'number' ||
      Array.isArray(p.geminiLearnedMemories) ||
      typeof p.geminiCustomInstructions === 'string'
    ) {
      setGeminiPersonalizationState((prev) => {
        const merged = setGeminiPersonalization(
          {
            customName: typeof p.customUserName === 'string' ? p.customUserName : prev.customName,
            memoryLevel: typeof p.geminiMemoryLevel === 'number' ? p.geminiMemoryLevel : prev.memoryLevel,
            memories: Array.isArray(p.geminiLearnedMemories) ? p.geminiLearnedMemories : prev.memories,
            customInstructions:
              typeof p.geminiCustomInstructions === 'string'
                ? p.geminiCustomInstructions
                : prev.customInstructions,
          },
          { silent: true }
        );
        return merged;
      });
    }
    scheduleClearApplyingRemote();
  }, [scheduleClearApplyingRemote]);

  const applyFloatingChatRemote = useCallback((f: FloatingChatStatePayload) => {
    isApplyingRemoteRef.current = true;
    if (Array.isArray(f.messages) && f.messages.length > 0) {
      setFloatingChatMessages(f.messages);
    }
    scheduleClearApplyingRemote();
  }, [scheduleClearApplyingRemote]);

  const applyLoadedCloudState = useCallback(
    (loaded: LoadedCloudState, options?: { mergeLocal?: boolean }) => {
      isApplyingRemoteRef.current = true;

      let finalWorkspaces = loaded.workspaces;
      if (options?.mergeLocal && workspacesRef.current.length > 0) {
        const cloudIds = new Set(loaded.workspaces.map((w) => w.id));
        const localOnlyWorkspaces = workspacesRef.current.filter((w) => !cloudIds.has(w.id));
        if (localOnlyWorkspaces.length > 0) {
          finalWorkspaces = [...loaded.workspaces, ...localOnlyWorkspaces];
        }
      }

      setWorkspaces(finalWorkspaces);
      prevSyncedWorkspaceIdsRef.current = new Set(loaded.workspaces.map((w) => w.id));

      const wsDerivedFolders = finalWorkspaces
        .map((w) => w.folder)
        .filter((f): f is string => typeof f === 'string' && f.trim().length > 0);

      if (loaded.analytics) {
        const mergedFolders = Array.from(
          new Set([
            'Assorted Workspaces',
            ...(Array.isArray(loaded.analytics.folders) ? loaded.analytics.folders : []),
            ...(options?.mergeLocal ? foldersRef.current : []),
            ...wsDerivedFolders,
          ])
        );

        let mergedLibrary = Array.isArray(loaded.analytics.libraryItems)
          ? loaded.analytics.libraryItems
          : [];
        if (options?.mergeLocal && libraryItemsRef.current.length > 0) {
          const cloudLibIds = new Set(mergedLibrary.map((it) => it.id));
          const localLibOnly = libraryItemsRef.current.filter((it) => !cloudLibIds.has(it.id));
          if (localLibOnly.length > 0) {
            mergedLibrary = [...mergedLibrary, ...localLibOnly];
          }
        }

        applyAnalyticsRemote({
          ...loaded.analytics,
          folders: mergedFolders,
          libraryItems: mergedLibrary,
          activeWorkspaceId:
            loaded.analytics.activeWorkspaceId &&
            finalWorkspaces.some((w) => w.id === loaded.analytics?.activeWorkspaceId)
              ? loaded.analytics.activeWorkspaceId
              : finalWorkspaces[0]?.id || loaded.analytics.activeWorkspaceId || '',
        });
      } else {
        if (wsDerivedFolders.length > 0 || (options?.mergeLocal && foldersRef.current.length > 0)) {
          setFolders((prev) =>
            Array.from(
              new Set([
                'Assorted Workspaces',
                ...(options?.mergeLocal ? prev : []),
                ...wsDerivedFolders,
              ])
            )
          );
        }
        if (finalWorkspaces.length > 0) {
          setActiveWorkspaceId((prev) =>
            finalWorkspaces.some((w) => w.id === prev) ? prev : finalWorkspaces[0].id
          );
        }
      }

      if (loaded.dashboard) applyDashboardRemote(loaded.dashboard);
      if (loaded.preferences) applyPreferencesRemote(loaded.preferences);
      if (loaded.floatingChat) applyFloatingChatRemote(loaded.floatingChat);
      scheduleClearApplyingRemote();
    },
    [
      applyAnalyticsRemote,
      applyDashboardRemote,
      applyPreferencesRemote,
      applyFloatingChatRemote,
      scheduleClearApplyingRemote,
    ]
  );

  const hydrateAndSubscribeUser = useCallback(
    async (
      user: User,
      options?: { force?: boolean }
    ): Promise<{ syncedGeminiKey?: string; error?: string } | void> => {
      if (options?.force) {
        clearSyncQuotaPause();
      } else if (isSyncQuotaPaused()) {
        const msg = formatCloudSyncError(new Error('resource-exhausted'));
        setIsCloudSyncReady(false);
        setCloudSyncStatus('error');
        setCloudSyncError(msg);
        return { error: msg };
      }

      if (hydratingUidRef.current === user.uid && hydratingPromiseRef.current) {
        return hydratingPromiseRef.current;
      }

      hydratingUidRef.current = user.uid;
      const run = async () => {
        try {
          setIsCloudSyncReady(false);
          setCloudSyncStatus('syncing');
          setCloudSyncError(null);
          if (cloudUnsubRef.current) {
            cloudUnsubRef.current();
            cloudUnsubRef.current = null;
          }
          writtenHashesRef.current.clear();

          const loaded = await loadUserCloudData(user, writtenHashesRef.current);
          knownWorkspaceIdsRef.current = loaded.knownWorkspaceIds;
          knownStateKeysRef.current = loaded.knownStateKeys;

          const hasUnsyncedLocalData =
            workspacesRef.current.length > 0 ||
            foldersRef.current.some((f) => f && f !== 'Assorted Workspaces');
          const shouldMergeGuestLocal = Boolean(authProfileRef.current.isGuest && hasUnsyncedLocalData);

          if (loaded.hasCloudData) {
            const cloudPrune = pruneExpiredWorkspaceSources(loaded.workspaces);
            const cleanedLoaded: LoadedCloudState =
              cloudPrune.workspaces !== loaded.workspaces
                ? { ...loaded, workspaces: cloudPrune.workspaces }
                : loaded;
            applyLoadedCloudState(cleanedLoaded, { mergeLocal: shouldMergeGuestLocal });

            if (cloudPrune.removed.length > 0) {
              setExpiredSourcesNotice((prev) => {
                const existing = new Set(prev.map((r) => `${r.workspaceId}:${r.sourceId}`));
                const fresh = cloudPrune.removed.filter(
                  (r) => !existing.has(`${r.workspaceId}:${r.sourceId}`)
                );
                return [...fresh, ...prev].slice(0, 20);
              });
              logAudit(
                'Expired Sources Archived',
                `Auto-cleared stored data for ${cloudPrune.removed.length} NotebookLM source${
                  cloudPrune.removed.length === 1 ? '' : 's'
                } inactive for over 14 days`,
                'source'
              );
            }

            if (cloudPrune.changed) {
              for (const ws of cloudPrune.workspaces) {
                await upsertWorkspaceDoc(
                  user.uid,
                  ws,
                  knownWorkspaceIdsRef.current,
                  writtenHashesRef.current
                );
              }
            }

            // If linking from Guest session with local workspaces/folders, immediately push merged workspaces & folders to cloud
            if (shouldMergeGuestLocal) {
              const cloudWsIds = new Set(cleanedLoaded.workspaces.map((w) => w.id));
              for (const ws of workspacesRef.current) {
                if (!cloudWsIds.has(ws.id)) {
                  await upsertWorkspaceDoc(
                    user.uid,
                    ws,
                    knownWorkspaceIdsRef.current,
                    writtenHashesRef.current
                  );
                }
              }
              prevSyncedWorkspaceIdsRef.current = new Set([
                ...cleanedLoaded.workspaces.map((w) => w.id),
                ...workspacesRef.current.map((w) => w.id),
              ]);
              const mergedFolders = Array.from(
                new Set([
                  'Assorted Workspaces',
                  ...(loaded.analytics?.folders || []),
                  ...foldersRef.current,
                ])
              );
              await upsertAppStateDoc(
                user.uid,
                'analytics',
                {
                  ...latestSlicesRef.current.analytics,
                  folders: mergedFolders,
                },
                knownStateKeysRef.current,
                writtenHashesRef.current
              );
            }
          } else {
            // First-ever cloud login for this Google user: upload local workspaces/notes/settings
            for (const ws of workspacesRef.current) {
              await upsertWorkspaceDoc(
                user.uid,
                ws,
                knownWorkspaceIdsRef.current,
                writtenHashesRef.current
              );
            }
            prevSyncedWorkspaceIdsRef.current = new Set(workspacesRef.current.map((w) => w.id));
            await upsertAppStateDoc(
              user.uid,
              'dashboard',
              latestSlicesRef.current.dashboard,
              knownStateKeysRef.current,
              writtenHashesRef.current
            );
            await upsertAppStateDoc(
              user.uid,
              'analytics',
              latestSlicesRef.current.analytics,
              knownStateKeysRef.current,
              writtenHashesRef.current
            );
            await upsertAppStateDoc(
              user.uid,
              'preferences',
              latestSlicesRef.current.preferences,
              knownStateKeysRef.current,
              writtenHashesRef.current
            );
            await upsertAppStateDoc(
              user.uid,
              'floatingChat',
              latestSlicesRef.current.floatingChat,
              knownStateKeysRef.current,
              writtenHashesRef.current
            );
          }

          lastAnalyticsCloudSyncAtRef.current = Date.now();
          setIsCloudSyncReady(true);
          markCloudSyncOk();

          // Real-time cross-device listener
          cloudUnsubRef.current = subscribeToUserCloudData(
            user.uid,
            knownWorkspaceIdsRef.current,
            knownStateKeysRef.current,
            writtenHashesRef.current,
            {
              onWorkspacesRemoteChange: (remoteWorkspaces) => {
                isApplyingRemoteRef.current = true;
                const { workspaces: cleanedRemote, removed } =
                  pruneExpiredWorkspaceSources(remoteWorkspaces);
                setWorkspaces(cleanedRemote);
                prevSyncedWorkspaceIdsRef.current = new Set(cleanedRemote.map((w) => w.id));
                if (removed.length > 0) {
                  setExpiredSourcesNotice((prev) => {
                    const existing = new Set(prev.map((r) => `${r.workspaceId}:${r.sourceId}`));
                    const fresh = removed.filter(
                      (r) => !existing.has(`${r.workspaceId}:${r.sourceId}`)
                    );
                    return [...fresh, ...prev].slice(0, 20);
                  });
                }
                const wsFolders = cleanedRemote
                  .map((w) => w.folder)
                  .filter((f): f is string => typeof f === 'string' && f.trim().length > 0);
                if (wsFolders.length > 0) {
                  setFolders((prev) => Array.from(new Set([...prev, ...wsFolders])));
                }
                scheduleClearApplyingRemote();
              },
              onDashboardRemoteChange: applyDashboardRemote,
              onAnalyticsRemoteChange: applyAnalyticsRemote,
              onPreferencesRemoteChange: applyPreferencesRemote,
              onFloatingChatRemoteChange: applyFloatingChatRemote,
              onError: markCloudSyncError,
            }
          );

          const cloudKey = loaded.preferences?.geminiApiKey?.trim() || '';
          const rememberedLocalKey = getRememberedGoogleApiKey(user.uid);
          const effectiveGeminiKey = cloudKey || rememberedLocalKey;

          if (effectiveGeminiKey) {
            setRememberedGoogleApiKey(user.uid, effectiveGeminiKey);
            setActiveGeminiApiKey(effectiveGeminiKey);
            if (!cloudKey && loaded.hasCloudData && !isSyncQuotaPaused()) {
              await upsertAppStateDoc(
                user.uid,
                'preferences',
                {
                  ...(loaded.preferences || latestSlicesRef.current.preferences),
                  geminiApiKey: effectiveGeminiKey,
                },
                knownStateKeysRef.current,
                writtenHashesRef.current
              );
            }
          }

          return {
            syncedGeminiKey: effectiveGeminiKey || undefined,
          };
        } catch (err) {
          console.error('Firebase cloud sync hydration error:', err);
          if (isQuotaExceededError(err)) {
            markSyncQuotaExceeded();
          }
          // Reset hydration lock so transient errors can be retried cleanly
          hydratingUidRef.current = null;
          hydratingPromiseRef.current = null;
          setIsCloudSyncReady(false);
          const msg = formatCloudSyncError(err);
          setCloudSyncStatus('error');
          setCloudSyncError(msg);
          return {
            error: msg,
          };
        }
      };

      const promise = run();
      hydratingPromiseRef.current = promise;
      return promise;
    },
    [
      applyLoadedCloudState,
      applyDashboardRemote,
      applyAnalyticsRemote,
      applyPreferencesRemote,
      applyFloatingChatRemote,
      markCloudSyncError,
      markCloudSyncOk,
      scheduleClearApplyingRemote,
    ]
  );

  // Firebase Auth listener: restores Google session & auto-syncs cloud data on startup/reload
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (isSigningOutRef.current) return;
      setFirebaseUser(user);
      if (user) {
        const email = user.email || `${user.uid}@gmail.com`;
        const displayName = user.displayName || email.split('@')[0] || 'Aether Learner';
        const result = await hydrateAndSubscribeUser(user, { force: true });
        safeSetLocalStorage(
          'aether_auth_user',
          JSON.stringify({
            uid: user.uid,
            email,
            name: displayName,
            photoURL: user.photoURL || undefined,
            isGuest: false,
          })
        );
        setAuthProfile({ email, name: displayName, isGuest: false });

        const restoredKey =
          result?.syncedGeminiKey?.trim() ||
          getRememberedGoogleApiKey(user.uid) ||
          getActiveGeminiApiKey();

        if (!isAuthModalOpenRef.current && restoredKey) {
          setRememberedGoogleApiKey(user.uid, restoredKey);
          setActiveGeminiApiKey(restoredKey);
          setIsAuthenticated(true);
          if (activeTabRef.current === 'lander') {
            setActiveTab('dashboard');
          }
        }
      } else {
        if (cloudUnsubRef.current) {
          cloudUnsubRef.current();
          cloudUnsubRef.current = null;
        }
        hydratingUidRef.current = null;
        hydratingPromiseRef.current = null;
        setIsCloudSyncReady(false);
        setCloudSyncStatus('idle');
        setCloudSyncError(null);
        setGoogleCalendarAccessToken(null);

        // If saved profile was a Google account (e.g. from another project/expired session) rather than Guest,
        // prompt re-authentication on the Lander page without wiping any local user data
        const saved = getSavedAuthProfile();
        if (!saved.isGuest && saved.email) {
          setIsAuthenticated(false);
          setActiveTab('lander');
        }
      }
    });

    return () => {
      unsub();
      if (cloudUnsubRef.current) {
        cloudUnsubRef.current();
        cloudUnsubRef.current = null;
      }
    };
  }, [hydrateAndSubscribeUser]);

  // Automatic Google Calendar sync right after Google Sign-In (zero extra auth prompt)
  const [calendarOAuthToken, setCalendarOAuthToken] = useState<string | null>(() =>
    getGoogleCalendarAccessToken()
  );
  const autoSyncedCalendarTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setCalendarOAuthToken(getGoogleCalendarAccessToken());
    return subscribeGoogleCalendarToken((token) => {
      setCalendarOAuthToken(token);
      if (!token) {
        autoSyncedCalendarTokenRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!calendarOAuthToken) return;
    if (firebaseUser && !isCloudSyncReady) return;
    if (autoSyncedCalendarTokenRef.current === calendarOAuthToken) return;

    autoSyncedCalendarTokenRef.current = calendarOAuthToken;
    let cancelled = false;

    void pullGoogleCalendarEvents(calendarOAuthToken)
      .then((pulled) => {
        if (cancelled) return;
        setLocalCalendarEvents((prev) => mergeGoogleAndLocalEvents(prev, pulled));
      })
      .catch((err) => {
        console.warn('Automatic Google Calendar pull skipped:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [calendarOAuthToken, firebaseUser, isCloudSyncReady]);

  // Connect Google account directly from Settings while keeping current workspaces/folders
  const handleConnectGoogleFromSettings = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleCalendarAccessToken(credential.accessToken);
      }
      const user = result.user;
      const email = user.email || `${user.uid}@gmail.com`;
      const displayName = user.displayName || email.split('@')[0] || 'Aether Learner';
      setFirebaseUser(user);
      const hydration = await hydrateAndSubscribeUser(user, { force: true });
      safeSetLocalStorage(
        'aether_auth_user',
        JSON.stringify({
          uid: user.uid,
          email,
          name: displayName,
          photoURL: user.photoURL || undefined,
          isGuest: false,
        })
      );
      setAuthProfile({ email, name: displayName, isGuest: false });
      const activeKey = getActiveGeminiApiKey();
      if (activeKey) {
        setRememberedGoogleApiKey(user.uid, activeKey);
      }
      if (hydration?.error) {
        return { ok: false, error: hydration.error };
      }
      return { ok: true };
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return { ok: false, error: 'Google sign-in popup was closed before completing.' };
      }
      if (code === 'auth/popup-blocked') {
        return { ok: false, error: 'Pop-up was blocked by your browser. Please allow pop-ups and try again.' };
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to connect Google account.',
      };
    }
  }, [hydrateAndSubscribeUser]);

  const handleForceCloudSync = useCallback(async () => {
    const activeFbUser = firebaseUserRef.current || auth.currentUser;
    if (!activeFbUser) return;
    clearSyncQuotaPause();
    if (!isCloudSyncReadyRef.current || !cloudUnsubRef.current) {
      await hydrateAndSubscribeUser(activeFbUser, { force: true });
      return;
    }
    await flushAllCloudSync(activeFbUser.uid, { force: true });
  }, [flushAllCloudSync, hydrateAndSubscribeUser]);

  // Flush pending writes when hiding tab & auto-retry sync when returning online/foregrounded
  useEffect(() => {
    const maybeFlushOnHide = () => {
      if (!firebaseUserRef.current || !isCloudSyncReadyRef.current || isSyncQuotaPaused()) return;
      const timers = pendingSyncTimersRef.current;
      const hasNonTimerPending = Boolean(
        timers.workspaces ||
          timers.dashboard ||
          timers.analytics ||
          timers.preferences ||
          timers.floatingChat
      );
      const analyticsDue = Date.now() - lastAnalyticsCloudSyncAtRef.current >= 60_000;
      if (!hasNonTimerPending && !analyticsDue) return;
      void flushAllCloudSync(firebaseUserRef.current.uid, {
        includeAnalytics: analyticsDue,
      });
    };

    const maybeRetryAutoSync = (forceOnReconnect: boolean) => {
      const user = firebaseUserRef.current || auth.currentUser;
      if (!user || isSigningOutRef.current) return;
      if (!forceOnReconnect && isSyncQuotaPaused()) return;
      if (!isCloudSyncReadyRef.current || cloudSyncStatusRef.current === 'error') {
        if (forceOnReconnect) clearSyncQuotaPause();
        if (!isCloudSyncReadyRef.current || !cloudUnsubRef.current) {
          void hydrateAndSubscribeUser(user, { force: forceOnReconnect });
        } else {
          void flushAllCloudSync(user.uid, { force: forceOnReconnect });
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        maybeFlushOnHide();
      } else if (document.visibilityState === 'visible') {
        maybeRetryAutoSync(false);
      }
    };
    const handleOnline = () => {
      maybeRetryAutoSync(true);
    };
    const handlePageHide = () => {
      maybeFlushOnHide();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushAllCloudSync, hydrateAndSubscribeUser]);

  // Continuous debounced Cloud Sync: Workspaces (notes, sources, NotebookLM chats, Gemini conversations)
  useEffect(() => {
    if (
      !firebaseUser ||
      !isCloudSyncReady ||
      isApplyingRemoteRef.current ||
      isSigningOutRef.current ||
      isSyncQuotaPaused()
    )
      return;
    const uid = firebaseUser.uid;
    const timer = setTimeout(() => {
      if (isSyncQuotaPaused()) return;
      const currentIds = new Set(workspaces.map((w) => w.id));
      const ops: Promise<unknown>[] = [];
      for (const prevId of prevSyncedWorkspaceIdsRef.current) {
        if (!currentIds.has(prevId)) {
          ops.push(
            deleteWorkspaceDoc(uid, prevId, knownWorkspaceIdsRef.current, writtenHashesRef.current)
          );
        }
      }
      prevSyncedWorkspaceIdsRef.current = currentIds;

      for (const ws of workspaces) {
        ops.push(
          upsertWorkspaceDoc(uid, ws, knownWorkspaceIdsRef.current, writtenHashesRef.current)
        );
      }
      if (ops.length > 0) {
        setCloudSyncStatus('syncing');
        void Promise.all(ops)
          .then(() => {
            if (!isSyncQuotaPaused()) markCloudSyncOk();
          })
          .catch((err) => markCloudSyncError(err));
      }
    }, 3000);
    pendingSyncTimersRef.current.workspaces = timer;
    return () => {
      clearTimeout(timer);
      if (pendingSyncTimersRef.current.workspaces === timer) {
        pendingSyncTimersRef.current.workspaces = undefined;
      }
    };
  }, [workspaces, firebaseUser, isCloudSyncReady, markCloudSyncError, markCloudSyncOk]);

  // Continuous debounced Cloud Sync: Dashboard cards, tasks, planners, syllabus, exams, timetable, calendar
  useEffect(() => {
    if (
      !firebaseUser ||
      !isCloudSyncReady ||
      isApplyingRemoteRef.current ||
      isSigningOutRef.current ||
      isSyncQuotaPaused()
    )
      return;
    const uid = firebaseUser.uid;
    const timer = setTimeout(() => {
      if (isSyncQuotaPaused()) return;
      setCloudSyncStatus('syncing');
      void upsertAppStateDoc(
        uid,
        'dashboard',
        {
          cards: dashboardCards,
          tasks,
          planners,
          syllabusCourses,
          examSchedules,
          timetableSlots,
          localCalendarEvents,
        } satisfies DashboardStatePayload,
        knownStateKeysRef.current,
        writtenHashesRef.current
      )
        .then(() => {
          if (!isSyncQuotaPaused()) markCloudSyncOk();
        })
        .catch((err) => markCloudSyncError(err));
    }, 2000);
    pendingSyncTimersRef.current.dashboard = timer;
    return () => {
      clearTimeout(timer);
      if (pendingSyncTimersRef.current.dashboard === timer) {
        pendingSyncTimersRef.current.dashboard = undefined;
      }
    };
  }, [
    dashboardCards,
    tasks,
    planners,
    syllabusCourses,
    examSchedules,
    timetableSlots,
    localCalendarEvents,
    firebaseUser,
    isCloudSyncReady,
    markCloudSyncError,
    markCloudSyncOk,
  ]);

  // Continuous debounced Cloud Sync: Folders, Library, Active Workspace & Study Analytics
  useEffect(() => {
    if (
      !firebaseUser ||
      !isCloudSyncReady ||
      isApplyingRemoteRef.current ||
      isSigningOutRef.current ||
      isSyncQuotaPaused()
    )
      return;
    const uid = firebaseUser.uid;
    const timer = setTimeout(() => {
      if (isSyncQuotaPaused()) return;
      setCloudSyncStatus('syncing');
      void upsertAppStateDoc(
        uid,
        'analytics',
        {
          dailyStudySeconds: latestSlicesRef.current.analytics.dailyStudySeconds,
          workspaceSeconds: latestSlicesRef.current.analytics.workspaceSeconds,
          workspaceInteractions: latestSlicesRef.current.analytics.workspaceInteractions,
          auditLogs: auditLogs.slice(0, 150),
          folders,
          libraryItems,
          activeWorkspaceId,
        } satisfies AnalyticsStatePayload,
        knownStateKeysRef.current,
        writtenHashesRef.current
      )
        .then(() => {
          lastAnalyticsCloudSyncAtRef.current = Date.now();
          if (!isSyncQuotaPaused()) markCloudSyncOk();
        })
        .catch((err) => markCloudSyncError(err));
    }, 5000);
    pendingSyncTimersRef.current.analytics = timer;
    return () => {
      clearTimeout(timer);
      if (pendingSyncTimersRef.current.analytics === timer) {
        pendingSyncTimersRef.current.analytics = undefined;
      }
    };
  }, [
    folders,
    libraryItems,
    auditLogs,
    activeWorkspaceId,
    firebaseUser,
    isCloudSyncReady,
    markCloudSyncError,
    markCloudSyncOk,
  ]);

  // Study timer metrics synced every 60s to prevent continuous Firestore write amplification
  useEffect(() => {
    if (!firebaseUser || !isCloudSyncReady || isSyncQuotaPaused()) return;
    const uid = firebaseUser.uid;
    const interval = setInterval(() => {
      if (
        isApplyingRemoteRef.current ||
        isSigningOutRef.current ||
        isSyncQuotaPaused() ||
        document.visibilityState === 'hidden'
      ) {
        return;
      }
      if (Date.now() - lastAnalyticsCloudSyncAtRef.current < 55_000) return;
      void upsertAppStateDoc(
        uid,
        'analytics',
        latestSlicesRef.current.analytics,
        knownStateKeysRef.current,
        writtenHashesRef.current
      )
        .then(() => {
          lastAnalyticsCloudSyncAtRef.current = Date.now();
        })
        .catch((err) => markCloudSyncError(err));
    }, 60_000);
    return () => clearInterval(interval);
  }, [firebaseUser, isCloudSyncReady, markCloudSyncError]);

  // Continuous debounced Cloud Sync: Theme, Palette, Cursor, Model & API Key Preferences
  useEffect(() => {
    if (
      !firebaseUser ||
      !isCloudSyncReady ||
      isApplyingRemoteRef.current ||
      isSigningOutRef.current ||
      isSyncQuotaPaused()
    )
      return;
    const uid = firebaseUser.uid;
    const timer = setTimeout(() => {
      if (isSyncQuotaPaused()) return;
      setCloudSyncStatus('syncing');
      void upsertAppStateDoc(
        uid,
        'preferences',
        {
          darkMode,
          activePaletteId,
          customPaletteConfig,
          selectedModel,
          enableThinking,
          cursorStyle,
          cursorColorAdapter,
          smoothScroll,
          glowMultiplier,
          geminiApiKey: syncedGeminiKey,
          customUserName: geminiPersonalization.customName,
          geminiMemoryLevel: geminiPersonalization.memoryLevel,
          geminiLearnedMemories: geminiPersonalization.memories,
          geminiCustomInstructions: geminiPersonalization.customInstructions,
        } satisfies PreferencesStatePayload,
        knownStateKeysRef.current,
        writtenHashesRef.current
      )
        .then(() => {
          if (!isSyncQuotaPaused()) markCloudSyncOk();
        })
        .catch((err) => markCloudSyncError(err));
    }, 2000);
    pendingSyncTimersRef.current.preferences = timer;
    return () => {
      clearTimeout(timer);
      if (pendingSyncTimersRef.current.preferences === timer) {
        pendingSyncTimersRef.current.preferences = undefined;
      }
    };
  }, [
    darkMode,
    activePaletteId,
    customPaletteConfig,
    selectedModel,
    enableThinking,
    cursorStyle,
    cursorColorAdapter,
    smoothScroll,
    glowMultiplier,
    syncedGeminiKey,
    geminiPersonalization,
    firebaseUser,
    isCloudSyncReady,
    markCloudSyncError,
    markCloudSyncOk,
  ]);

  // Continuous debounced Cloud Sync: Floating Gemini Neural Assistant chats
  useEffect(() => {
    if (
      !firebaseUser ||
      !isCloudSyncReady ||
      isApplyingRemoteRef.current ||
      isSigningOutRef.current ||
      isSyncQuotaPaused()
    )
      return;
    const uid = firebaseUser.uid;
    const timer = setTimeout(() => {
      if (isSyncQuotaPaused()) return;
      setCloudSyncStatus('syncing');
      void upsertAppStateDoc(
        uid,
        'floatingChat',
        { messages: floatingChatMessages } satisfies FloatingChatStatePayload,
        knownStateKeysRef.current,
        writtenHashesRef.current
      )
        .then(() => {
          if (!isSyncQuotaPaused()) markCloudSyncOk();
        })
        .catch((err) => markCloudSyncError(err));
    }, 2500);
    pendingSyncTimersRef.current.floatingChat = timer;
    return () => {
      clearTimeout(timer);
      if (pendingSyncTimersRef.current.floatingChat === timer) {
        pendingSyncTimersRef.current.floatingChat = undefined;
      }
    };
  }, [floatingChatMessages, firebaseUser, isCloudSyncReady, markCloudSyncError, markCloudSyncOk]);

  // Live 1-second active workspace study time ticker (real-time updates)
  useEffect(() => {
    if (!isAuthenticated || activeTab === 'lander') return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const key = activeWorkspaceRef.current?.id || activeWorkspaceIdRef.current || GENERAL_SESSION_KEY;
      setWorkspaceSeconds((prev) => ({
        ...prev,
        [key]: (prev[key] || 0) + 1,
      }));
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;
      setDailyStudySeconds((prev) => ({
        ...prev,
        [todayKey]: (prev[todayKey] || 0) + 1,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, activeTab]);

  // Log an audit action with workspace, folder, full timestamp, and jump navigation metadata
  const logAudit = useCallback(
    (
      action: string,
      detail: string,
      category: AuditLog['category'],
      options?: {
        workspaceId?: string;
        workspaceName?: string;
        folderName?: string;
        targetContext?: AuditLog['targetContext'];
      }
    ) => {
      const now = new Date();
      const wsId = options?.workspaceId ?? activeWorkspaceRef.current?.id ?? activeWorkspaceIdRef.current;
      const matchedWs = wsId
        ? workspacesRef.current.find((w) => w.id === wsId)
        : activeWorkspaceRef.current;
      const wsName = options?.workspaceName ?? matchedWs?.name;
      const folderName = options?.folderName ?? matchedWs?.folder;
      const defaultCtx: AuditLog['targetContext'] =
        category === 'source'
          ? 'notebooklm'
          : category === 'note'
          ? 'onenote'
          : category === 'ai'
          ? isGeminiOpenRef.current
            ? 'gemini'
            : 'notebooklm'
          : category === 'task'
          ? 'dashboard'
          : 'library';

      const newLog: AuditLog = {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        fullTimestamp: now.toLocaleString([], {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        action,
        detail,
        category,
        workspaceId: wsId || undefined,
        workspaceName: wsName || undefined,
        folderName: folderName || undefined,
        targetContext: options?.targetContext || defaultCtx,
      };

      setAuditLogs((prev) => [newLog, ...prev].slice(0, 250));

      const trackKey = wsId || GENERAL_SESSION_KEY;
      setWorkspaceInteractions((prev) => ({
        ...prev,
        [trackKey]: (prev[trackKey] || 0) + 1,
      }));
    },
    []
  );

  const handleJumpToAudit = useCallback((log: AuditLog) => {
    let targetWs = activeWorkspaceRef.current;
    if (log.workspaceId && workspacesRef.current.some((w) => w.id === log.workspaceId)) {
      targetWs = workspacesRef.current.find((w) => w.id === log.workspaceId) || targetWs;
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === log.workspaceId ? { ...w, isClosed: false, lastOpenedAt: 'Just now' } : w
        )
      );
      setActiveWorkspaceId(log.workspaceId);
    }

    const ctx = log.targetContext || 'notebooklm';
    if (ctx === 'onenote') {
      setIsGeminiWorkspaceOpen(false);
      if (targetWs?.mode === 'onenote-only') {
        setIsOneNoteOpen(false);
        setActiveTab('notebooklm');
      } else {
        setIsOneNoteOpen(true);
      }
    } else if (ctx === 'gemini') {
      setIsOneNoteOpen(false);
      setIsGeminiWorkspaceOpen(true);
    } else {
      setIsOneNoteOpen(false);
      setIsGeminiWorkspaceOpen(false);
      setActiveTab(ctx);
    }
  }, []);

  // Task actions
  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updated = !t.completed;
          logAudit(
            updated ? 'Task Completed' : 'Task Reopened',
            `Status toggled for task "${t.title}"`,
            'task'
          );
          return { ...t, completed: updated };
        }
        return t;
      })
    );
  };

  const handleAddTask = (
    title: string,
    category: string,
    priority: 'low' | 'medium' | 'high',
    dueAt?: string | null
  ) => {
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title,
      category,
      priority,
      completed: false,
      dueDate: dueAt ? 'Timed' : 'No time until completion',
      dueAt: dueAt || null,
    };
    setTasks((prev) => [newTask, ...prev]);
    logAudit('Chore Added', `Created new task in category ${category}`, 'task');
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleUpdateTask = (
    taskId: string,
    updates: Partial<Omit<TaskItem, 'id'>>
  ) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  };

  const handleAddPlanner = (entry: Omit<PlannerEntry, 'id'>) => {
    const nextEntry: PlannerEntry = {
      ...entry,
      id: `plan-${Date.now()}`,
    };
    setPlanners((prev) => [nextEntry, ...prev]);
    logAudit('Study Plan Added', `Added planner "${entry.title}"`, 'task');
  };

  const handleUpdatePlanner = (
    id: string,
    updates: Partial<Omit<PlannerEntry, 'id'>>
  ) => {
    setPlanners((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const handleUpdatePlannerProgress = (id: string, progress: number) => {
    setPlanners((prev) =>
      prev.map((p) => (p.id === id ? { ...p, progress } : p))
    );
  };

  const handleDeletePlanner = (id: string) => {
    setPlanners((prev) => prev.filter((p) => p.id !== id));
  };

  // Periodic & foreground sweep to clear payload of NotebookLM sources inactive for > 14 days (keeps cards for reupload)
  const runExpiredSourceSweep = useCallback(() => {
    const current = workspacesRef.current;
    if (!current || current.length === 0) return;
    const { workspaces: cleaned, changed, removed } = pruneExpiredWorkspaceSources(current);
    if (!changed) return;
    setWorkspaces(cleaned);
    if (removed.length > 0) {
      setExpiredSourcesNotice((prev) => {
        const existing = new Set(prev.map((r) => `${r.workspaceId}:${r.sourceId}`));
        const fresh = removed.filter((r) => !existing.has(`${r.workspaceId}:${r.sourceId}`));
        return [...fresh, ...prev].slice(0, 20);
      });
      logAudit(
        'Expired Sources Archived',
        `Auto-cleared stored data for ${removed.length} NotebookLM source${
          removed.length === 1 ? '' : 's'
        } inactive for over 14 days`,
        'source'
      );
    }
  }, [logAudit]);

  useEffect(() => {
    const interval = setInterval(runExpiredSourceSweep, 60_000);
    const handleResumeCheck = () => {
      if (document.visibilityState === 'visible') {
        runExpiredSourceSweep();
      }
    };
    window.addEventListener('focus', handleResumeCheck);
    document.addEventListener('visibilitychange', handleResumeCheck);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleResumeCheck);
      document.removeEventListener('visibilitychange', handleResumeCheck);
    };
  }, [runExpiredSourceSweep]);

  const handleDismissExpiredNotice = useCallback((workspaceId?: string) => {
    if (!workspaceId) {
      setExpiredSourcesNotice([]);
      return;
    }
    setExpiredSourcesNotice((prev) => prev.filter((item) => item.workspaceId !== workspaceId));
  }, []);

  // Source actions (synchronized to active workspace)
  const handleToggleSource = useCallback(
    (id: string) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const now = Date.now();
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                updatedAt: 'Just now',
                sources: w.sources.map((s) =>
                  s.id === id && !s.isExpired
                    ? { ...s, selected: !s.selected, lastInteractedAt: now }
                    : s
                ),
              }
            : w
        )
      );
    },
    [activeWorkspace?.id, activeWorkspaceId]
  );

  const handleTouchSources = useCallback(
    (sourceIds: string[]) => {
      if (!Array.isArray(sourceIds) || sourceIds.length === 0) return;
      const idSet = new Set(sourceIds);
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const now = Date.now();
      setWorkspaces((prev) => {
        let anyUpdated = false;
        const next = prev.map((w) => {
          if (w.id !== targetId) return w;
          let wsUpdated = false;
          const nextSources = w.sources.map((s) => {
            if (!idSet.has(s.id) || s.isExpired) return s;
            const prevAt = s.lastInteractedAt || 0;
            if (prevAt > 0 && now - prevAt < SOURCE_TOUCH_DEBOUNCE_MS) {
              return s;
            }
            wsUpdated = true;
            anyUpdated = true;
            return { ...s, lastInteractedAt: now };
          });
          return wsUpdated ? { ...w, sources: nextSources } : w;
        });
        return anyUpdated ? next : prev;
      });
    },
    [activeWorkspace?.id, activeWorkspaceId]
  );

  const handleReuploadSource = useCallback(
    (id: string, restored: Omit<NotebookSource, 'id' | 'dateAdded'>) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const now = Date.now();
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                updatedAt: 'Just now',
                sources: w.sources.map((s) =>
                  s.id === id
                    ? {
                        ...s,
                        ...restored,
                        id: s.id,
                        dateAdded: 'Just now',
                        lastInteractedAt: now,
                        isExpired: false,
                        expiredAt: undefined,
                        expiredReason: undefined,
                        selected: true,
                      }
                    : s
                ),
              }
            : w
        )
      );
      setExpiredSourcesNotice((prev) =>
        prev.filter((item) => !(item.workspaceId === targetId && item.sourceId === id))
      );
      logAudit(
        'Source Reuploaded',
        `Reuploaded "${restored.title}" (${restored.words} words)`,
        'source'
      );
    },
    [activeWorkspace?.id, activeWorkspaceId, logAudit]
  );

  const handleAddSource = useCallback(
    (sourceData: Omit<NotebookSource, 'id' | 'dateAdded'>) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const now = Date.now();
      const newSource: NotebookSource = {
        ...sourceData,
        id: `src-${now}-${Math.random().toString(36).slice(2, 6)}`,
        dateAdded: 'Just now',
        lastInteractedAt: sourceData.lastInteractedAt ?? now,
        isExpired: false,
      };
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                updatedAt: 'Just now',
                sources: [newSource, ...w.sources],
              }
            : w
        )
      );
      logAudit('Source Indexed', `Added "${newSource.title}" (${newSource.words} words)`, 'source');
    },
    [activeWorkspace?.id, activeWorkspaceId, logAudit]
  );

  const handleDeleteSource = useCallback(
    (id: string, permanent: boolean = false) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const s = sources.find((item) => item.id === id);
      const shouldSoftDelete = Boolean(s && !s.isExpired && !permanent);
      const now = Date.now();

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                updatedAt: 'Just now',
                sources: shouldSoftDelete
                  ? w.sources.map((item) =>
                      item.id === id
                        ? {
                            ...item,
                            isExpired: true,
                            expiredAt: now,
                            expiredReason: 'manual',
                            selected: false,
                            dataUrl: undefined,
                            fullContent: '',
                            excerpt: MANUAL_DELETED_SOURCE_EXCERPT,
                          }
                        : item
                    )
                  : w.sources.filter((item) => item.id !== id),
              }
            : w
        )
      );

      if (!shouldSoftDelete) {
        setExpiredSourcesNotice((prev) =>
          prev.filter((item) => !(item.workspaceId === targetId && item.sourceId === id))
        );
      }

      if (s) {
        if (shouldSoftDelete) {
          logAudit(
            'Source Deleted',
            `Cleared stored content for "${s.title}" (card kept for reupload)`,
            'source'
          );
        } else {
          logAudit('Source Card Removed', `Permanently removed source "${s.title}"`, 'source');
        }
      }
    },
    [activeWorkspace?.id, activeWorkspaceId, sources, logAudit]
  );

  // Synchronized OneNote & Gemini handlers for active workspace
  const handleUpdateActiveNotebooks = useCallback(
    (updated: OneNoteNotebook[]) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const ws = workspacesRef.current.find((w) => w.id === targetId);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                updatedAt: 'Just now',
                notebooks: updated,
              }
            : w
        )
      );
      if (oneNoteAuditTimerRef.current) clearTimeout(oneNoteAuditTimerRef.current);
      oneNoteAuditTimerRef.current = setTimeout(() => {
        const nbCount = updated.length;
        const pageCount = updated.reduce(
          (sum, nb) => sum + nb.sections.reduce((sSum, sec) => sSum + sec.pages.length, 0),
          0
        );
        logAudit(
          'OneNote Canvas Updated',
          `Edited notes across ${nbCount} notebook${nbCount !== 1 ? 's' : ''} (${pageCount} page${pageCount !== 1 ? 's' : ''})`,
          'note',
          {
            workspaceId: targetId,
            workspaceName: ws?.name,
            folderName: ws?.folder,
            targetContext: 'onenote',
          }
        );
      }, 2200);
    },
    [activeWorkspace?.id, activeWorkspaceId, logAudit]
  );

  const handleUpdateActiveConversations = useCallback(
    (updated: GeminiConversation[]) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const ws = workspacesRef.current.find((w) => w.id === targetId);
      const prevMsgs = (ws?.conversations || []).reduce((s, c) => s + (c.messages?.length || 0), 0);
      const nextMsgs = updated.reduce((s, c) => s + (c.messages?.length || 0), 0);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                updatedAt: 'Just now',
                conversations: updated,
              }
            : w
        )
      );
      if (nextMsgs > prevMsgs) {
        const latestConv = updated.find((c) => (c.messages?.length || 0) > 0) || updated[0];
        const lastMsg = latestConv?.messages?.[latestConv.messages.length - 1];
        if (lastMsg) {
          logAudit(
            lastMsg.role === 'user' ? 'Gemini Workspace Prompt' : 'Gemini Workspace Reply',
            `${lastMsg.role === 'user' ? 'Sent prompt' : 'Generated reply'} in "${latestConv?.title || 'Gemini Dialog'}": ${lastMsg.content.slice(0, 90)}${lastMsg.content.length > 90 ? '…' : ''}`,
            'ai',
            {
              workspaceId: targetId,
              workspaceName: ws?.name,
              folderName: ws?.folder,
              targetContext: 'gemini',
            }
          );
        }
      }
    },
    [activeWorkspace?.id, activeWorkspaceId, logAudit]
  );

  const handleUpdateActiveChatMessages = useCallback(
    (updated: any[]) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const ws = workspacesRef.current.find((w) => w.id === targetId);
      const prevCount = ws?.chatMessages?.length || 0;
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                updatedAt: 'Just now',
                chatMessages: updated,
              }
            : w
        )
      );
      if (updated.length > prevCount) {
        const latest = updated[updated.length - 1];
        if (latest?.content) {
          logAudit(
            latest.role === 'user' ? 'NotebookLM Prompt Sent' : 'NotebookLM Grounded Synthesis',
            `${latest.role === 'user' ? 'Asked' : 'Synthesized'} (${ws?.sources?.filter((s) => s.selected).length || 0} active sources): ${String(latest.content).slice(0, 90)}${String(latest.content).length > 90 ? '…' : ''}`,
            'ai',
            {
              workspaceId: targetId,
              workspaceName: ws?.name,
              folderName: ws?.folder,
              targetContext: 'notebooklm',
            }
          );
        }
      }
    },
    [activeWorkspace?.id, activeWorkspaceId, logAudit]
  );

  const handleUpdateWorkspace = useCallback((workspaceId: string, updates: Partial<Workspace>) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === workspaceId ? { ...w, ...updates, updatedAt: 'Just now' } : w))
    );
    logAudit('Workspace Updated', `Modified settings for workspace`, 'system');
  }, []);

  // Close workspace tab (saved in Library, not deleted)
  const handleCloseWorkspace = useCallback((workspaceId: string) => {
    setWorkspaces((prev) => {
      const next = prev.map((w) => (w.id === workspaceId ? { ...w, isClosed: true } : w));
      const stillOpen = next.filter((w) => !w.isClosed);
      if (activeWorkspaceId === workspaceId) {
        setActiveWorkspaceId(stillOpen[0]?.id || next[0]?.id || '');
      }
      return next;
    });
    logAudit('Workspace Closed', `Closed workspace tab (saved in Library)`, 'system');
  }, [activeWorkspaceId]);

  const handleReorderWorkspaces = useCallback((reorderedOpen: Workspace[]) => {
    setWorkspaces((prev) => {
      const closed = prev.filter((w) => w.isClosed);
      return [...reorderedOpen, ...closed];
    });
  }, []);

  // Permanently delete workspace from Library
  const handleDeleteWorkspacePermanently = useCallback((workspaceId: string) => {
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== workspaceId);
      if (activeWorkspaceId === workspaceId) {
        const stillOpen = next.filter((w) => !w.isClosed);
        setActiveWorkspaceId(stillOpen[0]?.id || next[0]?.id || '');
      }
      return next;
    });
    setLibraryItems((prev) => prev.filter((it) => it.workspaceId !== workspaceId));
    logAudit('Workspace Deleted', `Permanently deleted workspace from Library`, 'system');
  }, [activeWorkspaceId]);

  // Remove workspace from folder (moves back to Assorted Workspaces)
  const handleRemoveWorkspaceFromFolder = useCallback((workspaceId: string) => {
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === workspaceId ? { ...w, folder: 'Assorted Workspaces', updatedAt: 'Just now' } : w
      )
    );
    setLibraryItems((prev) =>
      prev.map((it) =>
        it.workspaceId === workspaceId ? { ...it, folder: 'Assorted Workspaces', updatedAt: 'Just now' } : it
      )
    );
    logAudit('Workspace Moved', `Moved workspace back to Assorted Workspaces`, 'system');
  }, []);

  // Delete folder permanently from Library
  const handleDeleteFolder = useCallback((folderName: string) => {
    setFolders((prev) => prev.filter((f) => f !== folderName));
    setWorkspaces((prev) =>
      prev.map((w) => (w.folder === folderName ? { ...w, folder: 'Assorted Workspaces' } : w))
    );
    setLibraryItems((prev) =>
      prev.map((it) => (it.folder === folderName ? { ...it, folder: 'Assorted Workspaces' } : it))
    );
    logAudit('Folder Deleted', `Deleted folder ${folderName}`, 'system');
  }, []);

  // Workspace management & switching
  const handleSelectWorkspace = useCallback((workspaceId: string) => {
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === workspaceId
          ? { ...w, isClosed: false, lastOpenedAt: 'Just now', updatedAt: 'Just now' }
          : w
      )
    );
    setActiveWorkspaceId(workspaceId);
    setIsOneNoteOpen(false);
    setIsGeminiWorkspaceOpen(false);
    setActiveTab('notebooklm');
    setIsWorkspaceSelectorOpen(false);
  }, []);

  const handleOpenFolderInLibrary = useCallback((folderName: string) => {
    setLibraryFolderSignal({ folder: folderName || 'all', nonce: Date.now() });
    setIsOneNoteOpen(false);
    setIsGeminiWorkspaceOpen(false);
    setIsWorkspaceSelectorOpen(false);
    setActiveTab('library');
  }, []);

  const handleCreateNewWorkspace = useCallback(
    (
      targetFolder = 'Assorted Workspaces',
      customName?: string,
      customDesc?: string,
      mode: 'full' | 'onenote-only' = 'full'
    ) => {
      const newId = `ws-${Date.now()}`;
      const count = workspaces.length + 1;
      const isOneNoteOnly = mode === 'onenote-only';
      const newWs: Workspace = {
        id: newId,
        name:
          customName ||
          (isOneNoteOnly ? `OneNote Notebook ${count}` : `Assorted Workspace ${count}`),
        description:
          customDesc ||
          (isOneNoteOnly
            ? 'Standalone multi-tab OneNote notebook workspace with rich block editing.'
            : 'Synchronized workspace with exclusive NotebookLM sources, OneNote canvas, and Gemini AI.'),
        folder: targetFolder,
        mode,
        createdAt: 'Just now',
        updatedAt: 'Just now',
        lastOpenedAt: 'Just now',
        isClosed: false,
        color: activePalette.primary,
        sources: [],
        notebooks: [
          {
            id: `nb-${Date.now()}`,
            title: `Notebook 1`,
            description: isOneNoteOnly
              ? 'Standalone multi-tab notebook'
              : 'Dedicated notebook for this workspace',
            sections: [
              {
                id: `sec-${Date.now()}`,
                title: '01. Notes',
                color: activePalette.primary,
                pages: [
                  {
                    id: `p-${Date.now()}`,
                    title: 'Untitled Page',
                    updatedAt: 'Just now',
                    blocks: [
                      { id: `b-${Date.now()}`, type: 'paragraph', content: '' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        conversations: [],
      };

      setWorkspaces((prev) => [newWs, ...prev]);
      setActiveWorkspaceId(newId);
      setIsOneNoteOpen(false);
      setIsGeminiWorkspaceOpen(false);
      setActiveTab('notebooklm');
      setIsWorkspaceSelectorOpen(false);
      logAudit(
        isOneNoteOnly ? 'OneNote Workspace Created' : 'Workspace Created',
        `Created ${newWs.name} in folder "${targetFolder}"`,
        isOneNoteOnly ? 'note' : 'system',
        {
          workspaceId: newId,
          workspaceName: newWs.name,
          folderName: targetFolder,
          targetContext: isOneNoteOnly ? 'onenote' : 'notebooklm',
        }
      );
    },
    [workspaces.length, activePalette.primary, logAudit]
  );

  const handleAssignWorkspaceToFolder = useCallback((workspaceId: string, folder: string) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === workspaceId ? { ...w, folder, updatedAt: 'Just now' } : w))
    );
    logAudit('Workspace Moved', `Moved workspace to "${folder}"`, 'system');
  }, []);

  // Folder actions
  const handleAddFolder = (name: string) => {
    if (!folders.includes(name)) {
      setFolders((prev) => [...prev, name]);
      logAudit('Folder Created', `Added folder "${name}" to Library`, 'system');
    }
  };

  const handleToggleStar = (id: string) => {
    setLibraryItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, star: !i.star } : i))
    );
  };

  const handleOpenLibraryItem = (item: LibraryItem) => {
    if (item.type === 'workspace' && item.workspaceId) {
      handleSelectWorkspace(item.workspaceId);
    } else if (item.type === 'notebook') {
      setActiveTab('notebooklm');
    } else if (item.type === 'onenote') {
      setIsOneNoteOpen(true);
    } else {
      setActiveTab('dashboard');
    }
    logAudit('Item Opened', `Accessed library asset "${item.title}"`, 'system');
  };

  // Creation Studio router
  const handleCreateNewItem = (type: CreationItemType) => {
    if (type === 'onenote') {
      handleCreateNewWorkspace('Assorted Workspaces', undefined, undefined, 'onenote-only');
    } else if (type === 'notebook') {
      handleCreateNewWorkspace('Assorted Workspaces', undefined, undefined, 'full');
    }
  };

  // Reset data handler
  const handleResetData = () => {
    const preservedAuth = localStorage.getItem('aether_auth_user');
    const preservedKey = localStorage.getItem('aether_gemini_api_key');
    const preservedGoogleKeys = localStorage.getItem('aether_google_api_keys_v1');
    localStorage.clear();
    if (preservedAuth) localStorage.setItem('aether_auth_user', preservedAuth);
    if (preservedKey) localStorage.setItem('aether_gemini_api_key', preservedKey);
    if (preservedGoogleKeys) localStorage.setItem('aether_google_api_keys_v1', preservedGoogleKeys);
    localStorage.setItem('aether_analytics_reset_v1', 'true');
    localStorage.setItem('aether_dashboard_reset_v1', 'true');
    setTasks([]);
    setPlanners([]);
    setDashboardCards(DEFAULT_DASHBOARD_CARDS);
    setSyllabusCourses([]);
    setExamSchedules([]);
    setTimetableSlots([]);
    setLocalCalendarEvents([]);
    setDailyStudySeconds({});
    setWorkspaces([]);
    setExpiredSourcesNotice([]);
    setActiveWorkspaceId('');
    setLibraryItems([]);
    setFolders(['Assorted Workspaces']);
    setWorkspaceSeconds({});
    setWorkspaceInteractions({});
    setAuditLogs([]);
    setFloatingChatMessages(DEFAULT_FLOATING_MESSAGES);
    setActivePaletteId('gold-obsidian');
    setDarkMode(true);
    setCursorStyle('circle');
    setCursorColorAdapter(70);
    setGeminiPersonalization(DEFAULT_GEMINI_PERSONALIZATION, { silent: true });
    setGeminiPersonalizationState(DEFAULT_GEMINI_PERSONALIZATION);
    if (!preservedAuth) {
      setActiveTab('lander');
    }
  };

  const accountBaseName =
    firebaseUser?.displayName ||
    authProfile.name ||
    (firebaseUser?.email ? firebaseUser.email.split('@')[0] : undefined);
  const { effectiveFullName, firstName: activeFirstName } = resolvePreferredNames(
    accountBaseName,
    geminiPersonalization.customName
  );
  const activeUserName = activeFirstName || undefined;
  useEffect(() => {
    setActiveAccountBaseName(accountBaseName);
  }, [accountBaseName]);
  const activeUserEmail =
    firebaseUser?.email || (!authProfile.isGuest ? authProfile.email : undefined);
  const isGuestSession = !firebaseUser && Boolean(authProfile.isGuest || !activeUserEmail);

  return (
    <div
      className={`relative ${
        activeTab === 'notebooklm' || activeTab === 'lander' ? 'h-[100dvh] md:h-screen overflow-hidden' : 'min-h-[100dvh] md:min-h-screen overflow-x-clip'
      } flex flex-col font-sans ${activeTab === 'lander' ? '' : 'transition-colors duration-300'} ${
        darkMode ? 'dark text-slate-100' : 'text-slate-900'
      }`}
      style={{
        backgroundColor: activeTab === 'lander' || darkMode ? activePalette.bgDark : '#f8fafc',
        color: activeTab === 'lander' || darkMode ? '#f8fafc' : '#0f172a',
      }}
    >
      {/* Dynamic theme-reactive Topographic Background Canvas Layer fitted to entire screen (skipped on lander) */}
      {activeTab !== 'lander' && (
        <div className="fixed inset-0 pointer-events-none bg-topo z-0" aria-hidden="true" />
      )}

      {/* Dynamic Hardware Cursor Style Injection */}
      {cursorCss && <style id="aether-custom-cursor" dangerouslySetInnerHTML={{ __html: cursorCss }} />}

      {/* Physics-based SmoothCursor with smooth edges (disabled on touch devices) */}
      <SmoothCursor
        cursorStyle={cursorStyle}
        activePalette={activePalette}
        cursorColorAdapter={cursorColorAdapter}
        darkMode={darkMode}
      />

      {/* Isolated GPU transition overlay — handles window, tab, workspace, and mode transitions */}
      <WindowTransitionOverlay
        activeTab={activeTab}
        isOneNoteOpen={isOneNoteOpen}
        isGeminiWorkspaceOpen={isGeminiWorkspaceOpen}
        activeWorkspaceId={activeWorkspaceId}
        transitionNonce={transitionNonce}
      />

      {/* Top-to-Bottom Glowing Blur Morph Animation on Color Theme Change (Disabled on lander page) */}
      {paletteMorph && activeTab !== 'lander' && (
        <div
          key={`palette-morph-${paletteMorph.id}`}
          className="fixed inset-0 z-[75] pointer-events-none overflow-hidden palette-morph-container"
          aria-hidden="true"
        >
          {/* Top-to-bottom expanding aura curtain */}
          <div
            className="palette-morph-curtain"
            style={{
              ['--morph-primary' as any]: paletteMorph.palette.primary,
              ['--morph-accent' as any]: paletteMorph.palette.accent,
            }}
          />

          {/* Traveling Glowing Blur Beam Wave */}
          <div
            className="palette-morph-wave"
            style={{
              ['--morph-primary' as any]: paletteMorph.palette.primary,
              ['--morph-accent' as any]: paletteMorph.palette.accent,
            }}
          >
            {/* Upper ambient diffusion halo */}
            <div className="palette-morph-halo-top" />

            {/* Center Liquid Glass Frosted Blur Core */}
            <div className="palette-morph-blur-core" />

            {/* Intense Laser Beam Crest with Chromatic Glow */}
            <div className="palette-morph-crest" />

            {/* Lower forward glowing flare */}
            <div className="palette-morph-halo-bottom" />
          </div>
        </div>
      )}

      {/* Dedicated Sliding Workspace Selector Bar */}
      <WorkspaceSelectorBar
        isOpen={isWorkspaceSelectorOpen}
        onClose={() => setIsWorkspaceSelectorOpen(false)}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={(name, desc) => handleCreateNewWorkspace('Assorted Workspaces', name, desc)}
        onUpdateWorkspace={handleUpdateWorkspace}
        onCloseWorkspace={handleCloseWorkspace}
        onDeleteWorkspace={handleDeleteWorkspacePermanently}
        onReorderWorkspaces={handleReorderWorkspaces}
        activePalette={activePalette}
        darkMode={darkMode}
      />

      {/* Primary Workspace Stage (Slides out full-width during OneNote / Gemini workspace transition) */}
      <div
        aria-hidden={isOneNoteOpen || isGeminiWorkspaceOpen}
        className={`${
          activeTab === 'notebooklm' || activeTab === 'lander' ? 'h-[100dvh] md:h-screen overflow-hidden' : 'min-h-[100dvh] md:min-h-screen'
        } flex flex-col w-full hyprland-slide relative z-10 origin-top ${
          isOneNoteOpen
            ? '-translate-x-[100%] opacity-0 pointer-events-none select-none invisible'
            : isGeminiWorkspaceOpen
            ? 'translate-x-[100%] opacity-0 pointer-events-none select-none invisible'
            : 'translate-x-0 opacity-100 pointer-events-auto visible'
        }`}
      >
        {/* Top Floating Centered Header (Dominating '+' icon, active palette colors, liquid glass accent) */}
        <Header
          isAuthenticated={isAuthenticated}
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === 'settings' && activeTab !== 'settings') {
              previousTabBeforeSettingsRef.current = activeTab === 'lander' ? 'dashboard' : activeTab;
            }
            if (tab === 'notebooklm' && activeTab !== 'notebooklm') {
              previousTabBeforeWorkspaceRef.current =
                activeTab === 'lander' || activeTab === 'settings' ? 'dashboard' : activeTab;
            }
            setActiveTab(tab);
            if (tab !== 'onenote') setIsOneNoteOpen(false);
            if (tab !== 'gemini') setIsGeminiWorkspaceOpen(false);
            setIsWorkspaceSelectorOpen(false);
          }}
          onToggleMobileSettings={() => {
            if (activeTab === 'settings') {
              const prev = previousTabBeforeSettingsRef.current;
              setActiveTab(prev && prev !== 'settings' ? prev : 'dashboard');
            } else {
              previousTabBeforeSettingsRef.current = activeTab === 'lander' ? 'dashboard' : activeTab;
              setActiveTab('settings');
            }
            setIsOneNoteOpen(false);
            setIsGeminiWorkspaceOpen(false);
            setIsWorkspaceSelectorOpen(false);
          }}
          onOpenCreate={() => setIsCreateModalOpen(true)}
          onOpenNotebookLM={() => {
            setIsWorkspaceSelectorOpen((prev) => !prev);
          }}
          darkMode={darkMode}
          activePalette={activePalette}
          isWorkspaceSelectorOpen={isWorkspaceSelectorOpen}
          isStageHidden={isOneNoteOpen || isGeminiWorkspaceOpen || isMetaverseEdit || activeTab === 'notebooklm'}
          autoHideOnTopEdge={activeTab === 'notebooklm'}
        />

        {/* Main Tab View Switcher — content fades in after frost peak for a seamless reveal */}
        <main key={activeTab} className={`flex-1 w-full tab-content-reveal ${activeTab === 'notebooklm' || activeTab === 'lander' ? 'h-full overflow-hidden flex flex-col' : 'min-h-[100dvh] md:min-h-screen'}`}>
              {activeTab === 'lander' && (
                <PolygonCanvas
                  isLoggedIn={Boolean(firebaseUser) || (isAuthenticated && Boolean(authProfile.isGuest))}
                  onEnterApp={() => {
                    if (
                      (firebaseUser && getActiveGeminiApiKey()) ||
                      (isAuthenticated && authProfile.isGuest && getActiveGeminiApiKey())
                    ) {
                      setIsAuthenticated(true);
                      setActiveTab('dashboard');
                    } else {
                      setIsAuthModalOpen(true);
                    }
                  }}
                  activePalette={activePalette}
                  onPaletteChange={handleLanderPaletteChange}
                />
              )}

              {activeTab === 'dashboard' && (
                <Dashboard
                  studyDays={studyDays}
                  tasks={tasks}
                  planners={planners}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onAddPlanner={handleAddPlanner}
                  onUpdatePlanner={handleUpdatePlanner}
                  onUpdatePlannerProgress={handleUpdatePlannerProgress}
                  onDeletePlanner={handleDeletePlanner}
                  onOpenNotebookLM={() => setActiveTab('notebooklm')}
                  onOpenOneNote={() => {
                    if (activeWorkspace?.mode === 'onenote-only') {
                      setActiveTab('notebooklm');
                    } else {
                      setIsOneNoteOpen(true);
                    }
                  }}
                  onSearchSelect={(q) => {
                    logAudit('Search Performed', `Queried for "${q}" across knowledge store`, 'system');
                  }}
                  onMetaverseEditChange={setIsMetaverseEdit}
                  activePalette={activePalette}
                  darkMode={darkMode}
                  cards={dashboardCards}
                  onUpdateCards={setDashboardCards}
                  syllabusCourses={syllabusCourses}
                  onUpdateSyllabusCourses={setSyllabusCourses}
                  examSchedules={examSchedules}
                  onUpdateExamSchedules={setExamSchedules}
                  timetableSlots={timetableSlots}
                  onUpdateTimetableSlots={setTimetableSlots}
                  localCalendarEvents={localCalendarEvents}
                  onUpdateLocalCalendarEvents={setLocalCalendarEvents}
                  userName={activeUserName}
                />
              )}

              {activeTab === 'notebooklm' &&
                (activeWorkspace?.mode === 'onenote-only' ? (
                  <OneNoteWorkspace
                    key={activeWorkspace.id}
                    standalone={true}
                    isOpen={true}
                    notebooks={oneNoteNotebooks}
                    onCloseBack={() => setActiveTab('library')}
                    onUpdateNotebooks={handleUpdateActiveNotebooks}
                    activePalette={activePalette}
                    darkMode={darkMode}
                    smoothScroll={smoothScroll}
                  />
                ) : (
                  <NotebookLMView
                    key={activeWorkspace?.id || 'ws-default'}
                    workspaceId={activeWorkspace?.id}
                    chatMessages={activeWorkspace?.chatMessages}
                    onUpdateChatMessages={handleUpdateActiveChatMessages}
                    sources={sources}
                    onToggleSource={handleToggleSource}
                    onAddSource={handleAddSource}
                    onDeleteSource={handleDeleteSource}
                    onReuploadSource={handleReuploadSource}
                    onTouchSources={handleTouchSources}
                    expiredSourcesNotice={expiredSourcesNotice.filter(
                      (item) => !activeWorkspace?.id || item.workspaceId === activeWorkspace.id
                    )}
                    onDismissExpiredNotice={() => handleDismissExpiredNotice(activeWorkspace?.id)}
                    onOpenOneNoteNotes={() => setIsOneNoteOpen(true)}
                    onOpenGeminiWorkspace={() => setIsGeminiWorkspaceOpen(true)}
                    onBack={() => {
                      const prev = previousTabBeforeWorkspaceRef.current;
                      setActiveTab(prev && prev !== 'notebooklm' ? prev : 'dashboard');
                    }}
                    selectedModel={selectedModel}
                    onChangeModel={(m) => {
                      setSelectedModel(m);
                      logAudit('Model Changed', `Switched AI model to ${m}`, 'ai');
                    }}
                    enableThinking={enableThinking}
                    activePalette={activePalette}
                    darkMode={darkMode}
                    userName={activeUserName}
                  />
                ))}

              {activeTab === 'library' && (
                <LibraryView
                  items={libraryItems}
                  folders={folders}
                  workspaces={workspaces}
                  onOpenItem={handleOpenLibraryItem}
                  onAddFolder={handleAddFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onReorderFolders={(newFolders) => setFolders(newFolders)}
                  onToggleStar={handleToggleStar}
                  onSelectWorkspace={handleSelectWorkspace}
                  onAssignWorkspaceToFolder={handleAssignWorkspaceToFolder}
                  onRemoveWorkspaceFromFolder={handleRemoveWorkspaceFromFolder}
                  onDeleteWorkspacePermanently={handleDeleteWorkspacePermanently}
                  onCreateWorkspaceInFolder={(folder) => handleCreateNewWorkspace(folder)}
                  folderSignal={libraryFolderSignal}
                  activePalette={activePalette}
                  darkMode={darkMode}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsView
                  workspaces={workspaces}
                  folders={folders}
                  activeWorkspaceId={activeWorkspace?.id || activeWorkspaceId}
                  workspaceSeconds={workspaceSeconds}
                  workspaceInteractions={workspaceInteractions}
                  auditLogs={auditLogs}
                  onJumpToAudit={handleJumpToAudit}
                  onOpenFolderInLibrary={handleOpenFolderInLibrary}
                  activePalette={activePalette}
                  darkMode={darkMode}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  darkMode={darkMode}
                  onToggleDarkMode={handleToggleDarkMode}
                  activePaletteId={activePaletteId}
                  activePalette={activePalette}
                  onSelectPalette={handleSelectPalette}
                  customPaletteConfig={customPaletteConfig}
                  onUpdateCustomPalette={handleUpdateCustomPalette}
                  selectedModel={selectedModel}
                  onChangeModel={(m) => {
                    setSelectedModel(m);
                    logAudit('Model Changed', `Switched AI co-pilot model to ${m}`, 'ai');
                  }}
                  enableThinking={enableThinking}
                  onToggleThinking={(t) => {
                    setEnableThinking(t);
                    logAudit('Thinking Mode', `High thinking reasoning set to ${t ? 'ON' : 'OFF'}`, 'ai');
                  }}
                  onResetData={handleResetData}
                  cursorStyle={cursorStyle}
                  onChangeCursorStyle={(s) => {
                    setCursorStyle(s);
                    logAudit('Cursor Style Changed', `Set pointer cursor style to ${s}`, 'system');
                  }}
                  cursorColorAdapter={cursorColorAdapter}
                  onChangeCursorColorAdapter={setCursorColorAdapter}
                  smoothScroll={smoothScroll}
                  onToggleSmoothScroll={(val) => {
                    setSmoothScroll(val);
                    logAudit('Smooth Scrolling', `Smooth momentum scrolling set to ${val ? 'ON' : 'OFF'}`, 'system');
                  }}
                  onSignOut={handleSignOut}
                  authenticatedEmail={activeUserEmail}
                  authenticatedName={effectiveFullName || accountBaseName}
                  accountBaseName={accountBaseName}
                  isGuestSession={isGuestSession}
                  personalization={geminiPersonalization}
                  onUpdatePersonalization={handleUpdatePersonalization}
                  cloudSyncStatus={cloudSyncStatus}
                  cloudSyncError={cloudSyncError}
                  lastCloudSyncAt={lastCloudSyncAt}
                  onForceCloudSync={handleForceCloudSync}
                  onConnectGoogleAccount={handleConnectGoogleFromSettings}
                  isSigningOut={isSigningOut}
                  workspaceCount={workspaces.length}
                  folderCount={folders.length}
                />
              )}
        </main>
      </div>

      {/* Workspace Transition Scrim Curtain */}
      {(isOneNoteOpen || isGeminiWorkspaceOpen) && (
        <div
          onClick={() => {
            setIsOneNoteOpen(false);
            setIsGeminiWorkspaceOpen(false);
          }}
          className="fixed inset-0 z-40 bg-slate-950/40 pointer-events-auto transition-opacity duration-[360ms] ease-out"
        />
      )}

      {/* FULLSCREEN ONENOTE WORKSPACE (SLIDES IN HORIZONTALLY FROM RIGHT IN HYPRLAND STYLE for full workspaces) */}
      {activeWorkspace?.mode !== 'onenote-only' && (
        <OneNoteWorkspace
          notebooks={oneNoteNotebooks}
          isOpen={isOneNoteOpen}
          onCloseBack={() => {
            setIsOneNoteOpen(false);
          }}
          onUpdateNotebooks={handleUpdateActiveNotebooks}
          activePalette={activePalette}
          darkMode={darkMode}
          smoothScroll={smoothScroll}
        />
      )}

      {/* FULLSCREEN GEMINI WORKSPACE (SLIDES IN HORIZONTALLY FROM LEFT IN HYPRLAND STYLE) */}
      <GeminiWorkspace
        isOpen={isGeminiWorkspaceOpen}
        onCloseBack={() => {
          setIsGeminiWorkspaceOpen(false);
        }}
        activePalette={activePalette}
        darkMode={darkMode}
        conversations={geminiConversations}
        onUpdateConversations={handleUpdateActiveConversations}
        selectedModel={selectedModel}
        onChangeModel={(m) => {
          setSelectedModel(m);
          logAudit('Model Changed', `Switched AI model to ${m}`, 'ai');
        }}
        smoothScroll={smoothScroll}
        userName={activeUserName}
      />

      {/* Floating Gemini Chatbox on the Right with Liquid Glass Accent (Floats over OneNote window) */}
      {isAuthenticated && (
        <FloatingGeminiChat
          selectedModel={selectedModel}
          onChangeModel={(m) => {
            setSelectedModel(m);
            logAudit('Model Changed', `Switched AI model to ${m}`, 'ai');
          }}
          enableThinking={enableThinking}
          activePalette={activePalette}
          darkMode={darkMode}
          hidden={isGeminiWorkspaceOpen || activeTab === 'lander' || isMetaverseEdit || isWorkspaceSelectorOpen}
          settingsHiddenOnMobile={activeTab === 'notebooklm' || isOneNoteOpen}
          messages={floatingChatMessages}
          onUpdateMessages={setFloatingChatMessages}
          userName={activeUserName}
        />
      )}

      {/* Creation Modal Triggered by Dominant '+' Header Button */}
      <CreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateItem={handleCreateNewItem}
        darkMode={darkMode}
        activePalette={activePalette}
      />

      {/* Google Auth & Gemini Key Onboarding Modal triggered by "Launch Aether" */}
      <AuthOnboardingModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleAuthenticated={(user) => hydrateAndSubscribeUser(user, { force: true })}
        onComplete={(authData) => {
          if (authData?.apiKey) {
            const cleanKey = authData.apiKey.trim();
            setSyncedGeminiKey(cleanKey);
            latestSlicesRef.current.preferences.geminiApiKey = cleanKey;
            const targetUid = authData.uid || firebaseUser?.uid || auth.currentUser?.uid;
            if (targetUid && !authData.isGuest) {
              setRememberedGoogleApiKey(targetUid, cleanKey);
              void upsertAppStateDoc(
                targetUid,
                'preferences',
                {
                  ...latestSlicesRef.current.preferences,
                  geminiApiKey: cleanKey,
                },
                knownStateKeysRef.current,
                writtenHashesRef.current
              ).catch(() => {});
            }
          }
          if (authData) {
            setAuthProfile({
              email: authData.email,
              name: authData.displayName,
              isGuest: Boolean(authData.isGuest),
            });
          } else {
            setAuthProfile(getSavedAuthProfile());
          }
          setIsAuthenticated(true);
          setIsAuthModalOpen(false);
          setActiveTab('dashboard');
        }}
        activePalette={activePalette}
        darkMode={darkMode}
      />

      {/* Floating Dynamic Glow Opacity HUD & Slider */}
      {activeTab !== 'lander' && !isMetaverseEdit && isHudMounted && (
        <div
          className={`glow-hud-wrapper ${isHudVisible ? 'hud-visible' : 'hud-hidden'}`}
          onPointerEnter={() => {
            if (isHudMountedRef.current) {
              if (hideHudTimerRef.current) {
                clearTimeout(hideHudTimerRef.current);
                hideHudTimerRef.current = null;
              }
              if (unmountHudTimerRef.current) {
                clearTimeout(unmountHudTimerRef.current);
                unmountHudTimerRef.current = null;
              }
              setIsHudVisible(true);
            }
          }}
          onPointerLeave={() => {
            if (isHudMountedRef.current && !isRightClickHeldRef.current && !isAdjustingGlow) {
              dismissHud(1800);
            }
          }}
        >
          <div
            className={`liquid-glass no-lift px-3.5 py-2.5 md:px-5 md:py-3.5 rounded-2xl shadow-2xl backdrop-blur-2xl flex items-center gap-3 md:gap-4 border border-white/60 dark:border-white/15 bg-white/85 dark:bg-slate-900/90 text-xs shadow-black/20 transition-all duration-200 ease-out ${
              isAdjustingGlow
                ? 'scale-[1.05] shadow-2xl shadow-black/40 ring-1 ring-white/30 dark:ring-white/15'
                : 'scale-100'
            }`}
          >
            <div
              className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 transition-transform duration-150"
              style={{
                background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                boxShadow: '0 4px 14px var(--palette-shadow)',
                transform: isAdjustingGlow ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              <Sliders className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
            </div>

            <div className="flex flex-col gap-1.5 min-w-0 flex-1 md:flex-none md:min-w-[240px]">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 text-xs">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                  Glow Opacity
                </span>
                <span
                  ref={hudBadgeRef}
                  className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-700"
                >
                  {Math.round(glowMultiplier * 100)}%
                </span>
              </div>

              {/* Interactive Opacity Slider */}
              <div className="relative flex items-center w-full">
                <input
                  ref={hudInputRef}
                  type="range"
                  min="0.15"
                  max="2.5"
                  step="0.05"
                  value={glowMultiplier}
                  onPointerDown={() => {
                    // Temporarily disable card CSS transitions while adjusting slider
                    document.body.classList.add('glow-tuning-active');
                    setIsAdjustingGlow(true);
                    showHud();
                  }}
                  onInput={(e) => {
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    const clamped = Math.max(0.15, Math.min(2.5, Math.round(val * 100) / 100));
                    glowMultiplierRef.current = clamped;
                    // Directly update root CSS variable for zero-lag GPU compositor updates
                    document.documentElement.style.setProperty('--glow-opacity-multiplier', String(clamped));
                    if (hudBadgeRef.current) {
                      hudBadgeRef.current.textContent = `${Math.round(clamped * 100)}%`;
                    }
                    const pct = Math.round(((clamped - 0.15) / 2.35) * 100);
                    (e.target as HTMLInputElement).style.background = `linear-gradient(to right, ${activePalette.primary} 0%, ${activePalette.accent} ${pct}%, rgba(100, 116, 139, 0.25) ${pct}%)`;
                  }}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const clamped = Math.max(0.15, Math.min(2.5, Math.round(val * 100) / 100));
                    setGlowMultiplier(clamped);
                  }}
                  onPointerUp={(e) => {
                    document.body.classList.remove('glow-tuning-active');
                    setIsAdjustingGlow(false);
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    const clamped = Math.max(0.15, Math.min(2.5, Math.round(val * 100) / 100));
                    setGlowMultiplier(clamped);
                    // Persist to localStorage ONCE on release, eliminating blocking disk I/O during drag
                    localStorage.setItem('aether_glow_multiplier_v3', String(clamped));
                    dismissHud(2200);
                  }}
                  className="glow-opacity-slider w-full h-2 bg-slate-200/60 dark:bg-slate-700/60 rounded-full appearance-none cursor-pointer focus:outline-none"
                  style={{
                    background: `linear-gradient(to right, ${activePalette.primary} 0%, ${activePalette.accent} ${Math.round(
                      ((glowMultiplier - 0.15) / 2.35) * 100
                    )}%, rgba(100, 116, 139, 0.25) ${Math.round(
                      ((glowMultiplier - 0.15) / 2.35) * 100
                    )}%)`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-0.5">▼ Softer (15%)</span>
                <span className="text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1">
                  <MoveVertical className="w-2.5 h-2.5" style={{ color: activePalette.primary }} /> Right-Click Drag ↕
                </span>
                <span className="flex items-center gap-0.5">▲ Brighter (250%)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

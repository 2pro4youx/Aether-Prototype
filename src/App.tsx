/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sliders, Sparkles, MoveVertical } from 'lucide-react';
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
import { Dashboard } from './components/Dashboard';
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
import { useSmoothScroll, getLenis, resizeLenis } from './hooks/useSmoothScroll';

export default function App() {
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

  const [isOneNoteOpen, setIsOneNoteOpen] = useState(false);
  const [isGeminiWorkspaceOpen, setIsGeminiWorkspaceOpen] = useState(false);
  const [isMetaverseEdit, setIsMetaverseEdit] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem('aether_auth_user');
    localStorage.removeItem('aether_gemini_api_key');
    setIsAuthenticated(false);
    setActiveTab('lander');
    setIsWorkspaceSelectorOpen(false);
    setIsOneNoteOpen(false);
    setIsGeminiWorkspaceOpen(false);
    setWindowChangeCount((c) => c + 1);
  }, []);

  // Dominant frost sweep counter when entering OneNote workspace (especially from Google Notebook)
  const [oneNoteOpenCount, setOneNoteOpenCount] = useState(0);
  const prevOverlayWindowRef = useRef({ oneNote: false, gemini: false });

  useEffect(() => {
    const prev = prevOverlayWindowRef.current;
    if (isOneNoteOpen && !prev.oneNote) {
      setOneNoteOpenCount((c) => c + 1);
    } else if ((!isOneNoteOpen && prev.oneNote) || isGeminiWorkspaceOpen !== prev.gemini) {
      setWindowChangeCount((c) => c + 1);
    }
    prevOverlayWindowRef.current = { oneNote: isOneNoteOpen, gemini: isGeminiWorkspaceOpen };
  }, [isOneNoteOpen, isGeminiWorkspaceOpen]);


  // Frost sweep overlay — increments on every tab change to re-trigger CSS animation
  const [windowChangeCount, setWindowChangeCount] = useState(0);
  const isInitialMount = useRef(true);

  // Smooth scroll to top when changing windows/tabs (except full-height canvases)
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
    // Trigger frost sweep overlay on every tab change (skip the very first mount)
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      setWindowChangeCount((c) => c + 1);
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
    localStorage.setItem('aether_tasks', JSON.stringify(tasks));
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
    localStorage.setItem('aether_planners_v1', JSON.stringify(planners));
  }, [planners]);

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

  // Synchronized Multi-Workspace Studio Store
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem('aether_workspaces_v2');
    return saved ? JSON.parse(saved) : INITIAL_WORKSPACES;
  });
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
    localStorage.setItem('aether_active_workspace_v2', activeWorkspaceId);
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
    const saved = localStorage.getItem('aether_library_v2');
    return saved ? JSON.parse(saved) : INITIAL_LIBRARY;
  });
  const [folders, setFolders] = useState<string[]>(() => {
    const saved = localStorage.getItem('aether_folders_v3');
    return saved ? JSON.parse(saved) : ['Assorted Workspaces'];
  });

  useEffect(() => {
    localStorage.setItem('aether_folders_v3', JSON.stringify(folders));
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
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [workspaceInteractions, setWorkspaceInteractions] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('aether_workspace_interactions_v1');
      return saved ? JSON.parse(saved) : {};
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
    localStorage.setItem('aether_workspace_seconds_v1', JSON.stringify(workspaceSeconds));
  }, [workspaceSeconds]);

  useEffect(() => {
    localStorage.setItem('aether_workspace_interactions_v1', JSON.stringify(workspaceInteractions));
  }, [workspaceInteractions]);

  useEffect(() => {
    localStorage.setItem('aether_audit_logs_v2', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const [libraryFolderSignal, setLibraryFolderSignal] = useState<{ folder: string; nonce: number } | null>(null);

  // Settings, Theme & Palettes
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('aether_dark_mode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const handleToggleDarkMode = useCallback(
    (newDark: boolean) => {
      if (newDark === darkMode) return;

      // Pull out the standard window change animation on mode toggle
      setWindowChangeCount((c) => c + 1);
      setTimeout(() => {
        setDarkMode(newDark);
      }, 160);
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

  const handleUpdateCustomPalette = useCallback(
    (updates: Partial<CustomPaletteConfig>, activate: boolean = true) => {
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
    const r = parseInt(hex.substring(0, 2), 16) || 245;
    const g = parseInt(hex.substring(2, 4), 16) || 158;
    const b = parseInt(hex.substring(4, 6), 16) || 11;
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

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      if (activeTabRef.current === 'lander') {
        return;
      }

      // Windows Start Menu hit animation: maintain & transfer pressed state as user hovers while holding left click
      if ((e.buttons & 1) && !isRightClickHeldRef.current) {
        const isInteractiveInput = Boolean(
          (e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]')
        );
        const tileUnderCursor = isInteractiveInput
          ? null
          : ((e.target as HTMLElement | null)?.closest?.(
              '.liquid-glass-tile'
            ) as HTMLElement | null);

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
      if (isRightClickHeldRef.current) {
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

          const targetEl = pos.target as HTMLElement | null;
          if (!targetEl) return;

          // O(1) single-lookup for closest tile, card, or button under cursor
          const tile = targetEl.closest?.(
            '.liquid-glass-tile, .liquid-glass, .glow-button'
          ) as HTMLElement | null;

          if (activeHoverTileRef.current && activeHoverTileRef.current !== tile) {
            if (!tile || !activeHoverTileRef.current.contains(tile)) {
              activeHoverTileRef.current.style.setProperty('--tilt-x', '0deg');
              activeHoverTileRef.current.style.setProperty('--tilt-y', '0deg');
              activeHoverTileRef.current.style.setProperty('--pointer-x', '-999px');
              activeHoverTileRef.current.style.setProperty('--pointer-y', '-999px');
            }
          }
          activeHoverTileRef.current = tile;

          if (tile) {
            const rect = tile.getBoundingClientRect();
            const x = pos.clientX - rect.left;
            const y = pos.clientY - rect.top;
            const ratio = Math.max(0, Math.min(1, x / rect.width));

            tile.style.setProperty('--pointer-x', `${Math.round(x)}px`);
            tile.style.setProperty('--pointer-y', `${Math.round(y)}px`);
            tile.style.setProperty('--pointer-ratio', `${Math.round(ratio * 1000) / 1000}`);

            // 3D Fluent Tilt Displacement: only takes place when the user is HOLDING left click
            const isLeftClickHeld = Boolean(
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

              // 3D tile tilt: 0.5deg
              const maxAngle = 0.5;

              // Cursor at top (normY < 0) -> top lifts up (+Z) -> negative rotateX
              // Cursor at bottom (normY > 0) -> bottom lifts up (+Z) -> positive rotateX
              const tiltX = Math.round(normY * maxAngle * 1000) / 1000;

              // Cursor at right (normX > 0) -> right lifts up (+Z) -> negative rotateY
              // Cursor at left (normX < 0) -> left lifts up (+Z) -> positive rotateY
              const tiltY = Math.round(-normX * maxAngle * 1000) / 1000;

              tile.style.setProperty('--tilt-x', `${tiltX}deg`);
              tile.style.setProperty('--tilt-y', `${tiltY}deg`);
            } else {
              tile.style.setProperty('--tilt-x', '0deg');
              tile.style.setProperty('--tilt-y', '0deg');
            }

            // Propagate to outer card if hovering inside an inner sub-tile
            const parentCard = tile.parentElement?.closest?.('.liquid-glass') as HTMLElement | null;
            activeParentCardRef.current = parentCard && parentCard !== tile ? parentCard : null;
            if (activeParentCardRef.current) {
              const pRect = activeParentCardRef.current.getBoundingClientRect();
              activeParentCardRef.current.style.setProperty('--pointer-x', `${Math.round(pos.clientX - pRect.left)}px`);
              activeParentCardRef.current.style.setProperty('--pointer-y', `${Math.round(pos.clientY - pRect.top)}px`);
            }
          } else {
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
          const ratio = Math.max(0, Math.min(1, x / rect.width));

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
      document.querySelectorAll<HTMLElement>('.card-pressed').forEach((el) => {
        el.classList.remove('card-pressed');
        el.style.setProperty('--tilt-x', '0deg');
        el.style.setProperty('--tilt-y', '0deg');
      });
    };

    const handleContextMenu = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      const isTable = Boolean(
        targetEl?.closest?.('.onenote-table-block, [data-table-block]')
      );
      if (isTable) {
        // Prevent browser native menu so custom OneNote cell highlight context menu displays cleanly
        e.preventDefault();
        return;
      }

      // Allow right-click on Dashboard cards to reach React's onContextMenu (delete confirmation modal)
      const isInput = targetEl?.closest?.('input, textarea');
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
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('scroll', handleScrollGlow);
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerCancel, { capture: true });
      window.removeEventListener('blur', handlePointerCancel);
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
    localStorage.setItem('aether_tasks', JSON.stringify(tasks));
  }, [tasks]);

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
    localStorage.setItem('aether_library_v2', JSON.stringify(libraryItems));
  }, [libraryItems]);

  // Refs to detect meaningful deltas in chats and OneNote for live audit logging
  const oneNoteAuditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const activeWorkspaceRef = useRef(activeWorkspace);
  activeWorkspaceRef.current = activeWorkspace;
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  activeWorkspaceIdRef.current = activeWorkspaceId;
  const isGeminiOpenRef = useRef(isGeminiWorkspaceOpen);
  isGeminiOpenRef.current = isGeminiWorkspaceOpen;

  // Live 1-second active workspace study time ticker (real-time updates)
  useEffect(() => {
    if (!isAuthenticated || activeTab === 'lander') return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const key = activeWorkspaceRef.current?.id || activeWorkspaceIdRef.current || '__general__';
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

      const trackKey = wsId || '__general__';
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
        setOneNoteOpenCount((c) => c + 1);
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

  // Source actions (synchronized to active workspace)
  const handleToggleSource = useCallback(
    (id: string) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                updatedAt: 'Just now',
                sources: w.sources.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
              }
            : w
        )
      );
    },
    [activeWorkspace?.id, activeWorkspaceId]
  );

  const handleAddSource = useCallback(
    (sourceData: Omit<NotebookSource, 'id' | 'dateAdded'>) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const newSource: NotebookSource = {
        ...sourceData,
        id: `src-${Date.now()}`,
        dateAdded: 'Just now',
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
    [activeWorkspace?.id, activeWorkspaceId]
  );

  const handleDeleteSource = useCallback(
    (id: string) => {
      const targetId = activeWorkspace?.id || activeWorkspaceId;
      const s = sources.find((item) => item.id === id);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                updatedAt: 'Just now',
                sources: w.sources.filter((item) => item.id !== id),
              }
            : w
        )
      );
      if (s) {
        logAudit('Source Removed', `Deleted source "${s.title}"`, 'source');
      }
    },
    [activeWorkspace?.id, activeWorkspaceId, sources]
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
    setWindowChangeCount((c) => c + 1);
  }, []);

  const handleOpenFolderInLibrary = useCallback((folderName: string) => {
    setLibraryFolderSignal({ folder: folderName || 'all', nonce: Date.now() });
    setIsOneNoteOpen(false);
    setIsGeminiWorkspaceOpen(false);
    setIsWorkspaceSelectorOpen(false);
    setActiveTab('library');
    setWindowChangeCount((c) => c + 1);
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
      setWindowChangeCount((c) => c + 1);
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
    localStorage.clear();
    localStorage.setItem('aether_analytics_reset_v1', 'true');
    localStorage.setItem('aether_dashboard_reset_v1', 'true');
    setTasks([]);
    setPlanners([]);
    setDailyStudySeconds({});
    setWorkspaces([]);
    setActiveWorkspaceId('');
    setLibraryItems([]);
    setFolders(['Assorted Workspaces']);
    setWorkspaceSeconds({});
    setWorkspaceInteractions({});
    setAuditLogs([]);
    setActivePaletteId('gold-obsidian');
    setDarkMode(true);
    setCursorStyle('circle');
    setCursorColorAdapter(70);
    setActiveTab('lander');
  };

  return (
    <div
      className={`relative ${
        activeTab === 'notebooklm' || activeTab === 'lander' ? 'h-[100dvh] md:h-screen overflow-hidden' : 'min-h-[100dvh] md:min-h-screen overflow-x-clip'
      } flex flex-col font-sans transition-colors duration-300 ${
        darkMode ? 'dark text-slate-100' : 'text-slate-900'
      }`}
      style={{
        backgroundColor: darkMode ? activePalette.bgDark : '#f8fafc',
        color: darkMode ? '#f8fafc' : '#0f172a',
      }}
    >
      {/* Dynamic theme-reactive Topographic Background Canvas Layer fitted to entire screen */}
      <div className="fixed inset-0 pointer-events-none bg-topo z-0" aria-hidden="true" />

      {/* Dynamic Hardware Cursor Style Injection */}
      {cursorCss && <style id="aether-custom-cursor" dangerouslySetInnerHTML={{ __html: cursorCss }} />}

      {/* Physics-based SmoothCursor with smooth edges (disabled on touch devices) */}
      <SmoothCursor
        cursorStyle={cursorStyle}
        activePalette={activePalette}
        cursorColorAdapter={cursorColorAdapter}
        darkMode={darkMode}
      />

      {/* Fullscreen frost sweep overlay — long blur reveal on window change & mode toggle */}
      {windowChangeCount > 0 && (
        <div
          key={`frost-${windowChangeCount}`}
          className="fixed inset-0 z-[160] pointer-events-none fullscreen-frost-sweep"
          aria-hidden="true"
        />
      )}

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
            setActiveTab(tab);
            if (tab !== 'onenote') setIsOneNoteOpen(false);
            if (tab !== 'gemini') setIsGeminiWorkspaceOpen(false);
            setIsWorkspaceSelectorOpen(false);
          }}
          onOpenCreate={() => setIsCreateModalOpen(true)}
          onOpenNotebookLM={() => {
            setIsWorkspaceSelectorOpen((prev) => !prev);
          }}
          darkMode={darkMode}
          activePalette={activePalette}
          isWorkspaceSelectorOpen={isWorkspaceSelectorOpen}
          autoHideOnTopEdge={
            activeTab === 'notebooklm' && activeWorkspace?.mode === 'onenote-only'
          }
        />

        {/* Main Tab View Switcher — content fades in after frost peak for a seamless reveal */}
        <main key={activeTab} className={`flex-1 w-full tab-content-reveal ${activeTab === 'notebooklm' || activeTab === 'lander' ? 'h-full overflow-hidden flex flex-col' : 'min-h-[100dvh] md:min-h-screen'}`}>
              {activeTab === 'lander' && (
                <PolygonCanvas
                  onEnterApp={() => setIsAuthModalOpen(true)}
                  activePalette={activePalette}
                  onPaletteChange={setActivePaletteId}
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
                    onOpenOneNoteNotes={() => setIsOneNoteOpen(true)}
                    onOpenGeminiWorkspace={() => setIsGeminiWorkspaceOpen(true)}
                    selectedModel={selectedModel}
                    onChangeModel={(m) => {
                      setSelectedModel(m);
                      logAudit('Model Changed', `Switched AI model to ${m}`, 'ai');
                    }}
                    enableThinking={enableThinking}
                    activePalette={activePalette}
                    darkMode={darkMode}
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
                  authenticatedEmail={localStorage.getItem('aether_auth_user') || undefined}
                />
              )}
        </main>
      </div>

      {/* Dominant Entrance Frost Sweep Overlay when sliding into OneNote (especially from Google Notebook) */}
      {oneNoteOpenCount > 0 && isOneNoteOpen && (
        <div
          key={`onenote-frost-${oneNoteOpenCount}`}
          className="onenote-enter-frost-sweep"
          aria-hidden="true"
        />
      )}

      {/* Workspace Transition Scrim Curtain */}
      {(isOneNoteOpen || isGeminiWorkspaceOpen) && (
        <div
          onClick={() => {
            setIsOneNoteOpen(false);
            setIsGeminiWorkspaceOpen(false);
          }}
          className="fixed inset-0 z-40 bg-slate-950/40 pointer-events-auto transition-opacity duration-500 ease-out"
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
          hidden={isGeminiWorkspaceOpen || activeTab === 'lander' || isMetaverseEdit}
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
        onComplete={() => {
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

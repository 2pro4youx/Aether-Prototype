import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sun,
  Moon,
  Palette,
  Cpu,
  Brain,
  Check,
  Sparkles,
  RefreshCw,
  MousePointer,
  Sliders,
  Waves,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bot,
  ChevronDown,
  ExternalLink,
  Wand2,
  Shuffle,
  Copy,
  User,
  Trash2,
  Plus,
  RotateCcw,
  FileText,
  Save,
} from 'lucide-react';
import { PALETTES } from '../data/mockData';
import { ColorPaletteId, ColorPalette, CustomPaletteConfig, CursorStyleId } from '../types';
import { CURSOR_OPTIONS, CursorOption, getCursorGradient, generateCursorSvg, normalizeCursorStyle } from '../utils/cursorUtils';
import { getLenis } from '../hooks/useSmoothScroll';
import { getActiveGeminiApiKey, setActiveGeminiApiKey, verifyGeminiApiKey, AVAILABLE_GEMINI_MODELS } from '../utils/geminiClient';
import {
  extractFirstName,
  GEMINI_INSTRUCTION_STARTERS,
  GeminiPersonalizationConfig,
  getGeminiPersonalization,
  getMemoryTierInfo,
  MemoryCategory,
  resolvePreferredNames,
  setGeminiPersonalization,
} from '../utils/personalization';
import { getQuotaUpgradeUrl, isQuotaExceededError } from '../utils/firebaseSync';

interface SettingsViewProps {
  darkMode: boolean;
  onToggleDarkMode: (dark: boolean) => void;
  activePaletteId: ColorPaletteId;
  activePalette: ColorPalette;
  onSelectPalette: (id: ColorPaletteId) => void;
  customPaletteConfig: CustomPaletteConfig;
  onUpdateCustomPalette: (updates: Partial<CustomPaletteConfig>, activate?: boolean) => void;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  enableThinking: boolean;
  onToggleThinking: (enable: boolean) => void;
  onResetData: () => void;
  cursorStyle: CursorStyleId;
  onChangeCursorStyle: (style: CursorStyleId) => void;
  cursorColorAdapter: number;
  onChangeCursorColorAdapter: (adapter: number) => void;
  smoothScroll: boolean;
  onToggleSmoothScroll: (enabled: boolean) => void;
  onSignOut?: () => void | Promise<void>;
  authenticatedEmail?: string;
  authenticatedName?: string;
  accountBaseName?: string;
  isGuestSession?: boolean;
  personalization?: GeminiPersonalizationConfig;
  onUpdatePersonalization?: (
    updater:
      | Partial<GeminiPersonalizationConfig>
      | ((prev: GeminiPersonalizationConfig) => GeminiPersonalizationConfig)
  ) => void;
  cloudSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  cloudSyncError?: string | null;
  lastCloudSyncAt?: string | null;
  onForceCloudSync?: () => Promise<void>;
  onConnectGoogleAccount?: () => Promise<{ ok: boolean; error?: string }>;
  isSigningOut?: boolean;
  workspaceCount?: number;
  folderCount?: number;
}

interface PrecisionCursorSectionProps {
  cursorStyle: CursorStyleId;
  onChangeCursorStyle: (style: CursorStyleId) => void;
  activePalette: ColorPalette;
  cursorColorAdapter: number;
  onChangeCursorColorAdapter: (adapter: number) => void;
  darkMode: boolean;
}

const PrecisionCursorSection: React.FC<PrecisionCursorSectionProps> = React.memo(({
  cursorStyle,
  onChangeCursorStyle,
  activePalette,
  cursorColorAdapter,
  onChangeCursorColorAdapter,
  darkMode,
}) => {
  const sliderRef = useRef<HTMLInputElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const headerBadgeRef = useRef<HTMLSpanElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const testZoneDotRef = useRef<HTMLSpanElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastCommittedRef = useRef(cursorColorAdapter);

  const activeCursorOption = CURSOR_OPTIONS.find((c) => c.id === normalizeCursorStyle(cursorStyle));

  // SVGs are generated ONCE using CSS custom property bindings (--cursor-color-1 & --cursor-color-2).
  // Zero string generation or DOM innerHTML replacements while dragging!
  const cursorPreviews = useMemo(() => {
    return CURSOR_OPTIONS.map((opt: CursorOption) => ({
      ...opt,
      svgCode: generateCursorSvg(opt.id, 'var(--cursor-color-1, #ffffff)', 'var(--cursor-color-2, #ffffff)'),
    }));
  }, []);

  const commitValue = useCallback(
    (val: number) => {
      document.body.classList.remove('glow-tuning-active', 'cursor-tuning-active');
      const { color1, color2 } = getCursorGradient(activePalette, val);
      document.documentElement.style.setProperty('--cursor-color-1', color1);
      document.documentElement.style.setProperty('--cursor-color-2', color2);
      if (lastCommittedRef.current !== val) {
        lastCommittedRef.current = val;
        onChangeCursorColorAdapter(val);
      }
    },
    [activePalette, onChangeCursorColorAdapter]
  );

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      document.body.classList.remove('glow-tuning-active', 'cursor-tuning-active');
    };
  }, []);

  // Global pointer release listener ensures value commits cleanly even if cursor releases outside the slider
  useEffect(() => {
    const handleGlobalRelease = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        if (sliderRef.current) {
          commitValue(Number(sliderRef.current.value));
        }
      }
    };
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('pointercancel', handleGlobalRelease);
    return () => {
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('pointercancel', handleGlobalRelease);
    };
  }, [commitValue]);

  // Sync native input & text when cursorColorAdapter or activePalette changes externally
  useEffect(() => {
    // If user is actively dragging the slider, do not overwrite the native input value
    if (isDraggingRef.current) return;

    if (sliderRef.current && Number(sliderRef.current.value) !== cursorColorAdapter) {
      sliderRef.current.value = String(cursorColorAdapter);
    }
    lastCommittedRef.current = cursorColorAdapter;

    const { color1, color2 } = getCursorGradient(activePalette, cursorColorAdapter);
    document.documentElement.style.setProperty('--cursor-color-1', color1);
    document.documentElement.style.setProperty('--cursor-color-2', color2);

    const stop1 = document.getElementById('smoothCursorStop1');
    const stop2 = document.getElementById('smoothCursorStop2');
    if (stop1) stop1.setAttribute('stop-color', color1);
    if (stop2) stop2.setAttribute('stop-color', color2);

    if (sectionRef.current) {
      sectionRef.current.style.setProperty('--cursor-color-1', color1);
      sectionRef.current.style.setProperty('--cursor-color-2', color2);
    }

    if (testZoneDotRef.current) {
      testZoneDotRef.current.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
    }

    if (badgeRef.current) {
      badgeRef.current.textContent =
        cursorColorAdapter === 0
          ? '0% · Pure White'
          : cursorColorAdapter === 100
          ? '100% · Full Gradient'
          : `${cursorColorAdapter}% · Curated Blend`;
    }
    if (headerBadgeRef.current) {
      headerBadgeRef.current.textContent = `${activeCursorOption?.name || cursorStyle} (${cursorColorAdapter}%)`;
    }
  }, [cursorColorAdapter, activePalette, activeCursorOption, cursorStyle]);

  // Zero-latency native input handler: coalesces GPU updates to VSYNC frame rate with ZERO React re-renders
  const handleSliderInput = (e: React.FormEvent<HTMLInputElement>) => {
    const val = Number(e.currentTarget.value);

    // 1. Instant text update
    if (badgeRef.current) {
      badgeRef.current.textContent =
        val === 0 ? '0% · Pure White' : val === 100 ? '100% · Full Gradient' : `${val}% · Curated Blend`;
    }
    if (headerBadgeRef.current) {
      headerBadgeRef.current.textContent = `${activeCursorOption?.name || cursorStyle} (${val}%)`;
    }

    // 2. Coalesce GPU visual updates to exactly 1 per VSYNC display frame (60Hz / 120Hz / 144Hz)
    // Runs in sub-millisecond time by avoiding global CSS recalculations on document root
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!sliderRef.current) return;
        const curVal = Number(sliderRef.current.value);
        const { color1, color2 } = getCursorGradient(activePalette, curVal);

        // A. Ultra-fast direct SVG stop-color manipulation for live cursor (0.001ms execution)
        const stop1 = document.getElementById('smoothCursorStop1');
        const stop2 = document.getElementById('smoothCursorStop2');
        if (stop1) stop1.setAttribute('stop-color', color1);
        if (stop2) stop2.setAttribute('stop-color', color2);

        // B. Update local section CSS variables only (isolated sub-tree, zero global style recalculation)
        if (sectionRef.current) {
          sectionRef.current.style.setProperty('--cursor-color-1', color1);
          sectionRef.current.style.setProperty('--cursor-color-2', color2);
        }

        // C. Update live preview dot directly
        if (testZoneDotRef.current) {
          testZoneDotRef.current.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
        }
      });
    }
  };

  const handlePointerDown = () => {
    isDraggingRef.current = true;
    document.body.classList.add('glow-tuning-active', 'cursor-tuning-active');
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    isDraggingRef.current = false;
    const val = Number(e.currentTarget.value);
    commitValue(val);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const val = Number(e.currentTarget.value);
    commitValue(val);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isDraggingRef.current = false;
    const val = Number(e.currentTarget.value);
    commitValue(val);
  };

  const handlePresetClick = (val: number) => {
    if (sliderRef.current) {
      sliderRef.current.value = String(val);
    }
    const { color1, color2 } = getCursorGradient(activePalette, val);
    document.documentElement.style.setProperty('--cursor-color-1', color1);
    document.documentElement.style.setProperty('--cursor-color-2', color2);

    const stop1 = document.getElementById('smoothCursorStop1');
    const stop2 = document.getElementById('smoothCursorStop2');
    if (stop1) stop1.setAttribute('stop-color', color1);
    if (stop2) stop2.setAttribute('stop-color', color2);

    if (sectionRef.current) {
      sectionRef.current.style.setProperty('--cursor-color-1', color1);
      sectionRef.current.style.setProperty('--cursor-color-2', color2);
    }

    if (testZoneDotRef.current) {
      testZoneDotRef.current.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
    }

    if (badgeRef.current) {
      badgeRef.current.textContent =
        val === 0 ? '0% · Pure White' : val === 100 ? '100% · Full Gradient' : `${val}% · Curated Blend`;
    }
    if (headerBadgeRef.current) {
      headerBadgeRef.current.textContent = `${activeCursorOption?.name || cursorStyle} (${val}%)`;
    }
    commitValue(val);
  };

  return (
    <div ref={sectionRef} className="liquid-glass rounded-2xl p-3.5 md:p-6 shadow-xl flex flex-col gap-3.5 md:gap-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 md:gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <MousePointer className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: activePalette.primary }} />
            <h3 className={`text-sm md:text-base font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Precision Cursor Selector & Dynamic Color Adapter
            </h3>
          </div>
          <p className={`hidden sm:block text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Select your preferred pointer style and calibrate the dynamic color adapter to match the curated gradient.
          </p>
        </div>

        {/* Active status pill */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] md:text-[11px] font-mono font-semibold px-2.5 py-0.5 md:px-3 md:py-1 rounded-full border flex items-center gap-1.5 shadow-sm"
            style={{
              backgroundColor: `${activePalette.primary}20`,
              borderColor: `${activePalette.primary}50`,
              color: darkMode ? '#ffffff' : activePalette.primary,
            }}
          >
            <span
              className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full animate-pulse"
              style={{ backgroundColor: activePalette.primary }}
            />
            <span ref={headerBadgeRef}>
              {activeCursorOption?.name || cursorStyle} ({cursorColorAdapter}%)
            </span>
          </span>
        </div>
      </div>

      {/* 6 Precision Cursor Choice Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
        {cursorPreviews.map((opt: CursorOption & { svgCode: string }) => {
          const isSelected = normalizeCursorStyle(cursorStyle) === opt.id;

          return (
            <div
              key={opt.id}
              onClick={() => onChangeCursorStyle(opt.id)}
              style={
                isSelected
                  ? {
                      borderColor: activePalette.primary,
                      backgroundColor: darkMode ? `${activePalette.primary}18` : `${activePalette.primary}12`,
                      boxShadow: `0 0 18px ${activePalette.primary}30`,
                    }
                  : {}
              }
              className={`p-2.5 md:p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between group liquid-glass-tile relative overflow-hidden ${
                isSelected ? 'ring-1 ring-offset-1 ring-amber-400/50' : ''
              }`}
            >
              {/* Active indicator dot */}
              {isSelected && (
                <div
                  className="absolute top-2 right-2 md:top-2.5 md:right-2.5 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shadow"
                  style={{ backgroundColor: activePalette.primary }}
                />
              )}

              {/* Top preview box */}
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div
                  className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)',
                    borderColor: isSelected
                      ? `${activePalette.primary}80`
                      : darkMode
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div
                    className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center pointer-events-none"
                    dangerouslySetInnerHTML={{ __html: opt.svgCode }}
                  />
                </div>

                <div
                  className={`w-4 h-4 md:w-5 md:h-5 rounded-full border flex items-center justify-center shrink-0 transition ${
                    isSelected
                      ? 'text-slate-950 font-bold'
                      : darkMode
                      ? 'border-slate-600 bg-transparent'
                      : 'border-slate-400 bg-transparent'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: activePalette.primary,
                          borderColor: activePalette.primary,
                        }
                      : {}
                  }
                >
                  {isSelected && <Check className="w-3 h-3 md:w-3.5 md:h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* Info */}
              <div className="space-y-0.5 md:space-y-1">
                <h4
                  className={`text-[11px] md:text-xs font-bold truncate ${
                    isSelected
                      ? darkMode
                        ? 'text-white'
                        : 'text-slate-900'
                      : darkMode
                      ? 'text-slate-200 group-hover:text-white'
                      : 'text-slate-800 group-hover:text-slate-950'
                  }`}
                >
                  {opt.name}
                </h4>
                <p
                  className={`hidden sm:block text-[11px] leading-tight line-clamp-2 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {opt.description}
                </p>
              </div>

              {/* Bottom badge */}
              <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-white/5 flex items-center justify-between">
                <span
                  className="text-[9px] font-mono font-bold uppercase px-1.5 md:px-2 py-0.5 rounded-md border truncate max-w-full"
                  style={{
                    backgroundColor: isSelected ? `${activePalette.primary}20` : 'transparent',
                    borderColor: isSelected
                      ? `${activePalette.primary}40`
                      : darkMode
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)',
                    color: isSelected ? activePalette.primary : darkMode ? '#94a3b8' : '#64748b',
                  }}
                >
                  {opt.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Color Adapter Slider */}
      <div
        className={`p-3 md:p-4 rounded-xl border flex flex-col gap-2.5 md:gap-3.5 transition-colors ${
          darkMode ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50/80 border-slate-200'
        }`}
      >
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <Sliders className="w-3.5 h-3.5 shrink-0" style={{ color: activePalette.primary }} />
              <h4 className={`text-xs font-bold truncate ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                Dynamic Color Adapter Slider
              </h4>
            </div>
            <p className={`hidden sm:block text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Blends the cursor hue from crisp pure white (0%) to your active curated color gradient (100%).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              ref={badgeRef}
              className="text-[11px] md:text-xs font-mono font-bold px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg border shadow-sm"
              style={{
                backgroundColor: `${activePalette.primary}20`,
                borderColor: `${activePalette.primary}50`,
                color: darkMode ? '#ffffff' : activePalette.primary,
              }}
            >
              {cursorColorAdapter === 0
                ? '0% · Pure White'
                : cursorColorAdapter === 100
                ? '100% · Full Gradient'
                : `${cursorColorAdapter}% · Curated Blend`}
            </span>
          </div>
        </div>

        {/* Native Hardware-Accelerated Slider */}
        <div className="space-y-1.5 md:space-y-2">
          <div className="relative flex items-center">
            <input
              ref={sliderRef}
              type="range"
              min="0"
              max="100"
              step="1"
              defaultValue={cursorColorAdapter}
              onInput={handleSliderInput}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onKeyUp={handleKeyUp}
              onBlur={handleBlur}
              className="smooth-adapter-slider w-full h-6 md:h-7 rounded-lg appearance-none cursor-pointer focus:outline-none select-none touch-none"
              style={{
                '--slider-track-bg': `linear-gradient(to right, #ffffff 0%, ${activePalette.primary} 50%, ${activePalette.accent} 100%)`,
              } as React.CSSProperties}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white border border-slate-400 inline-block" />
              <span>0% Pure White</span>
            </span>
            <span className="hidden sm:flex items-center gap-1 text-center">
              <Sparkles className="w-3 h-3" style={{ color: activePalette.primary }} />
              <span>Dynamic Adapter Interpolator</span>
            </span>
            <span className="flex items-center gap-1">
              <span>100% Theme Gradient</span>
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                }}
              />
            </span>
          </div>
        </div>

        {/* Quick Presets & Live Sandbox Preview */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 md:gap-3 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
            <span className={`text-[10px] font-semibold mr-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Presets:
            </span>
            {[
              { label: 'Pure White (0%)', val: 0 },
              { label: 'Subtle (35%)', val: 35 },
              { label: 'Vibrant (70%)', val: 70 },
              { label: 'Full Theme (100%)', val: 100 },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => handlePresetClick(p.val)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition ${
                  cursorColorAdapter === p.val
                    ? 'border-transparent font-bold shadow-sm'
                    : darkMode
                    ? 'bg-slate-800 text-slate-300 border-white/10 hover:text-white'
                    : 'bg-white text-slate-700 border-slate-300 hover:text-slate-900'
                }`}
                style={
                  cursorColorAdapter === p.val
                    ? {
                        background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                        color: '#0f172a',
                      }
                    : {}
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Interactive Cursor Test Playground Area with live CSS variable gradient */}
          <div
            className="hidden md:flex w-full sm:w-auto px-4 py-2 rounded-xl border items-center justify-center gap-2.5 text-xs font-medium transition"
            style={{
              borderColor: `${activePalette.primary}40`,
              backgroundColor: darkMode ? `${activePalette.primary}10` : `${activePalette.primary}08`,
            }}
          >
            <span
              ref={testZoneDotRef}
              className="w-3 h-3 rounded-full shadow-sm"
              style={{
                background: 'linear-gradient(135deg, var(--cursor-color-1, #ffffff), var(--cursor-color-2, #ffffff))',
              }}
            />
            <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
              Live Hover Zone · Test current cursor here!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export const SettingsView: React.FC<SettingsViewProps> = ({
  darkMode,
  onToggleDarkMode,
  activePaletteId,
  activePalette,
  onSelectPalette,
  customPaletteConfig,
  onUpdateCustomPalette,
  selectedModel,
  onChangeModel,
  enableThinking,
  onToggleThinking,
  onResetData,
  cursorStyle,
  onChangeCursorStyle,
  cursorColorAdapter,
  onChangeCursorColorAdapter,
  smoothScroll,
  onToggleSmoothScroll,
  onSignOut,
  authenticatedEmail,
  authenticatedName,
  accountBaseName,
  isGuestSession = false,
  personalization: controlledPersonalization,
  onUpdatePersonalization,
  cloudSyncStatus = 'idle',
  cloudSyncError = null,
  lastCloudSyncAt = null,
  onForceCloudSync,
  onConnectGoogleAccount,
  isSigningOut = false,
  workspaceCount = 0,
  folderCount = 1,
}) => {
  type SettingsTabId = 'general' | 'gemini-model' | 'gemini-personalization';
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabId>('general');
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(null);
  const [confirmGuestSignOut, setConfirmGuestSignOut] = useState(false);
  const [internalPersonalization, setInternalPersonalization] = useState<GeminiPersonalizationConfig>(() =>
    getGeminiPersonalization()
  );
  const activePersonalization = controlledPersonalization || internalPersonalization;

  const updatePersonalization = useCallback(
    (
      updater:
        | Partial<GeminiPersonalizationConfig>
        | ((prev: GeminiPersonalizationConfig) => GeminiPersonalizationConfig)
    ) => {
      if (onUpdatePersonalization) {
        onUpdatePersonalization(updater);
      } else {
        setInternalPersonalization((prev) => {
          const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
          return setGeminiPersonalization(next);
        });
      }
    },
    [onUpdatePersonalization]
  );

  // Personalization draft state for responsive typing and smooth slider dragging
  const [draftCustomName, setDraftCustomName] = useState(activePersonalization.customName);
  const [nameSavedBadge, setNameSavedBadge] = useState(false);
  const [sliderMemoryLevel, setSliderMemoryLevel] = useState(activePersonalization.memoryLevel);
  const memoryCommitTimerRef = useRef<number | null>(null);
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>('preference');
  const [confirmClearMemories, setConfirmClearMemories] = useState(false);
  const [draftInstructions, setDraftInstructions] = useState(activePersonalization.customInstructions);
  const [instructionsSavedBadge, setInstructionsSavedBadge] = useState(false);

  useEffect(() => {
    setDraftCustomName(activePersonalization.customName);
  }, [activePersonalization.customName]);

  useEffect(() => {
    setSliderMemoryLevel(activePersonalization.memoryLevel);
  }, [activePersonalization.memoryLevel]);

  useEffect(() => {
    setDraftInstructions(activePersonalization.customInstructions);
  }, [activePersonalization.customInstructions]);

  useEffect(() => {
    return () => {
      if (memoryCommitTimerRef.current !== null) {
        window.clearTimeout(memoryCommitTimerRef.current);
      }
    };
  }, []);

  const [isCustomBuilderOpen, setIsCustomBuilderOpen] = useState(activePaletteId === 'custom');
  const [apiKeyInput, setApiKeyInput] = useState(() => getActiveGeminiApiKey());
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [isJustReset, setIsJustReset] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const syncKeyInput = (e: Event) => {
      const custom = e as CustomEvent<string>;
      const next = typeof custom.detail === 'string' ? custom.detail : getActiveGeminiApiKey();
      if (next) {
        setApiKeyInput(next);
      }
    };
    window.addEventListener('aether-gemini-key-updated', syncKeyInput);
    return () => window.removeEventListener('aether-gemini-key-updated', syncKeyInput);
  }, []);

  const handleSaveAndTestKey = async () => {
    const trimmedKey = apiKeyInput.trim();
    setIsTestingKey(true);
    setKeyStatus(null);
    setActiveGeminiApiKey(trimmedKey);

    try {
      const res = await verifyGeminiApiKey(trimmedKey);

      if (res.valid) {
        setKeyStatus({
          tested: true,
          success: true,
          message: `Live Connection Confirmed · ${res.model || selectedModel} ready`,
        });
      } else {
        setKeyStatus({
          tested: true,
          success: false,
          message: res.error || 'Failed to verify key. Please check key format.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setKeyStatus({
        tested: true,
        success: false,
        message: msg,
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const modelOptions = AVAILABLE_GEMINI_MODELS;
  const activeModelObj = AVAILABLE_GEMINI_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_GEMINI_MODELS[0];

  return (
    <div className="relative min-h-[100dvh] md:min-h-screen pt-4 pb-10 md:pt-28 md:pb-16 px-3.5 md:px-8 lg:px-12 max-w-[1560px] w-full mx-auto space-y-4 md:space-y-8 select-none transition-colors duration-300">
      {/* Title */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-2.5 md:gap-4">
        <div className="pr-28 md:pr-0">
          <h1
            className={`text-2xl md:text-4xl font-extrabold tracking-tight ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            Settings & Model Hub
          </h1>
          <p className={`hidden md:block text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Customize visual themes, Gemini models, and how Gemini remembers & addresses you.
          </p>
        </div>

        {/* Clean Settings Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className={`grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 md:p-1.5 rounded-xl md:rounded-2xl border liquid-glass w-full sm:w-auto self-start lg:self-auto ${
            darkMode ? 'bg-slate-900/75 border-white/10' : 'bg-white/85 border-slate-300/80'
          }`}
        >
          {(
            [
              { id: 'general' as SettingsTabId, label: 'Studio & Theme', shortLabel: 'Theme', icon: Sliders },
              { id: 'gemini-model' as SettingsTabId, label: 'Gemini Model & API', shortLabel: 'Model & API', icon: Cpu },
              { id: 'gemini-personalization' as SettingsTabId, label: 'Gemini Personalization', shortLabel: 'Personalize', icon: Sparkles },
            ]
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSettingsTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSettingsTab(tab.id)}
                style={
                  isActive
                    ? {
                        background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                        color: '#0f172a',
                      }
                    : {}
                }
                className={`px-2 py-1.5 md:px-3.5 md:py-2 rounded-lg md:rounded-xl text-[11px] md:text-xs font-bold flex items-center justify-center gap-1 md:gap-1.5 transition-all cursor-pointer min-w-0 ${
                  isActive
                    ? 'shadow-md'
                    : darkMode
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden truncate">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === 'gemini-personalization' && activePersonalization.memories.length > 0 && (
                  <span
                    className={`ml-0.5 text-[10px] font-mono px-1 md:px-1.5 py-0.2 rounded-md shrink-0 ${
                      isActive
                        ? 'bg-slate-950/20 text-slate-950'
                        : darkMode
                        ? 'bg-white/10 text-slate-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {activePersonalization.memories.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeSettingsTab === 'general' && (
      <div className="space-y-3.5 md:space-y-8 onenote-page-content-reveal">

      {/* Live Active Theme & Palette Status Banner */}
      <div
        className="p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all duration-300 flex flex-row items-center justify-between gap-2.5 md:gap-3 shadow-lg"
        style={{
          background: darkMode
            ? `linear-gradient(135deg, ${activePalette.primary}18, ${activePalette.accent}12)`
            : `linear-gradient(135deg, ${activePalette.primary}20, ${activePalette.accent}10)`,
          borderColor: `${activePalette.primary}50`,
        }}
      >
        <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
          <div
            className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-slate-950 font-bold shadow shrink-0"
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
          >
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 fill-slate-950" />
          </div>
          <div className="min-w-0">
            <h4
              className={`text-xs md:text-sm font-bold truncate ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              Active: {activePalette.name}
            </h4>
            <p
              className={`text-[11px] md:text-xs truncate ${
                darkMode ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Mode: <strong className="uppercase font-mono">{darkMode ? 'Dark / Night' : 'Light / Day'}</strong> · Model: <strong className="font-mono">{selectedModel}</strong>
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span
            className="text-xs font-mono font-bold px-3 py-1 rounded-full border"
            style={{
              backgroundColor: `${activePalette.primary}25`,
              borderColor: `${activePalette.primary}60`,
              color: darkMode ? '#ffffff' : activePalette.primary,
            }}
          >
            Live Theme Active
          </span>
        </div>
      </div>

      {/* Theme: Dark or Light Mode */}
      <div className="liquid-glass rounded-2xl p-3.5 md:p-6 shadow-xl flex flex-col gap-2.5 md:gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 md:gap-4">
          <div className="space-y-0.5">
            <h3
              className={`text-sm md:text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {darkMode ? (
                <Moon className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: activePalette.primary }} />
              ) : (
                <Sun className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: activePalette.primary }} />
              )}
              <span>Theme Appearance (Dark & Light Mode)</span>
            </h3>
            <p className={`hidden sm:block text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Instantly toggle between obsidian night mode and crisp editorial day mode.
            </p>
          </div>

          <div
            className={`grid grid-cols-2 sm:flex items-center gap-1 p-1 rounded-xl border w-full sm:w-auto ${
              darkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-300'
            }`}
          >
            <button
              onClick={() => onToggleDarkMode(false)}
              style={
                !darkMode
                  ? {
                      background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                      color: '#0f172a',
                    }
                  : {}
              }
              className={`px-3 py-1.5 md:px-3.5 md:py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                !darkMode ? 'shadow-md' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sun className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>Light Mode</span>
            </button>
            <button
              onClick={() => onToggleDarkMode(true)}
              style={
                darkMode
                  ? {
                      background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                      color: '#0f172a',
                    }
                  : {}
              }
              className={`px-3 py-1.5 md:px-3.5 md:py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                darkMode ? 'shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>Dark Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Curated Color Palettes + Make Your Own Custom Theme */}
      <div className="liquid-glass rounded-2xl p-3.5 md:p-6 shadow-xl flex flex-col gap-2.5 md:gap-4">
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <h3
              className={`text-sm md:text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              <Palette className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: activePalette.primary }} />
              <span className="truncate">Color Themes &amp; Custom Palette</span>
            </h3>
            <p className={`hidden sm:block text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Click any curated gradient or design your own custom theme with primary, accent, and canvas base colors.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCustomBuilderOpen((prev) => !prev);
              if (activePaletteId !== 'custom') {
                onSelectPalette('custom');
              }
            }}
            style={{
              backgroundColor: `${activePalette.primary}18`,
              borderColor: `${activePalette.primary}45`,
              color: darkMode ? '#ffffff' : activePalette.primary,
            }}
            className="px-2.5 py-1 md:px-3 md:py-1.5 rounded-xl border text-[11px] md:text-xs font-semibold flex items-center gap-1 md:gap-1.5 transition hover:opacity-90 shrink-0 cursor-pointer"
          >
            <Wand2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span className="sm:hidden">{isCustomBuilderOpen ? 'Hide Studio' : 'Custom'}</span>
            <span className="hidden sm:inline">{isCustomBuilderOpen ? 'Hide Palette Studio' : 'Make Your Own Theme'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3.5 pt-1 md:pt-2">
          {PALETTES.map((pal) => {
            const isSelected = activePaletteId === pal.id;
            return (
              <div
                key={pal.id}
                onClick={() => onSelectPalette(pal.id)}
                style={
                  isSelected
                    ? {
                        borderColor: pal.primary,
                        backgroundColor: darkMode ? `${pal.primary}18` : `${pal.primary}15`,
                        boxShadow: `0 0 16px ${pal.primary}30`,
                      }
                    : {}
                }
                className={`p-2.5 md:p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between group liquid-glass-tile ${
                  isSelected ? 'ring-1 ring-offset-1 ring-amber-400/50' : ''
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  {/* Color Swatch */}
                  <div
                    className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl shrink-0 shadow-md border border-white/30 flex items-center justify-center text-white"
                    style={{
                      background: `linear-gradient(135deg, ${pal.primary}, ${pal.accent})`,
                    }}
                  >
                    {isSelected && <Check className="w-4 h-4 md:w-5 md:h-5 drop-shadow-md stroke-[3]" />}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <h4
                      className={`text-[11px] md:text-xs font-bold truncate ${
                        isSelected
                          ? darkMode
                            ? 'text-white'
                            : 'text-slate-900'
                          : darkMode
                          ? 'text-slate-200 group-hover:text-white'
                          : 'text-slate-800 group-hover:text-slate-950'
                      }`}
                    >
                      {pal.name}
                    </h4>
                    <p className={`hidden md:block text-[10px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {pal.description}
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 pl-2 shrink-0">
                  <span
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: pal.primary }}
                    title="Primary"
                  />
                  <span
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: pal.accent }}
                    title="Accent"
                  />
                </div>
              </div>
            );
          })}

          {/* 12th Card: Make Your Own Theme (Custom Palette Card) */}
          {(() => {
            const isCustomSelected = activePaletteId === 'custom';
            return (
              <div
                onClick={() => {
                  onSelectPalette('custom');
                  setIsCustomBuilderOpen(true);
                }}
                style={
                  isCustomSelected
                    ? {
                        borderColor: customPaletteConfig.primary,
                        backgroundColor: darkMode
                          ? `${customPaletteConfig.primary}18`
                          : `${customPaletteConfig.primary}15`,
                        boxShadow: `0 0 18px ${customPaletteConfig.primary}35`,
                      }
                    : {}
                }
                className={`p-2.5 md:p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between group liquid-glass-tile ${
                  isCustomSelected ? 'ring-1 ring-offset-1 ring-white/40' : 'border-dashed'
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <div
                    className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl shrink-0 shadow-md border border-white/30 flex items-center justify-center text-white"
                    style={{
                      background: `linear-gradient(135deg, ${customPaletteConfig.primary}, ${customPaletteConfig.accent})`,
                    }}
                  >
                    {isCustomSelected ? (
                      <Check className="w-4 h-4 md:w-5 md:h-5 drop-shadow-md stroke-[3]" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5 md:w-4 md:h-4 drop-shadow-md" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <h4
                        className={`text-[11px] md:text-xs font-bold truncate ${
                          isCustomSelected
                            ? darkMode
                              ? 'text-white'
                              : 'text-slate-900'
                            : darkMode
                            ? 'text-slate-200 group-hover:text-white'
                            : 'text-slate-800 group-hover:text-slate-950'
                        }`}
                      >
                        {customPaletteConfig.name || 'Custom Studio'}
                      </h4>
                      <span
                        className="hidden sm:inline-block text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full border shrink-0"
                        style={{
                          borderColor: `${customPaletteConfig.primary}50`,
                          color: darkMode ? '#ffffff' : customPaletteConfig.primary,
                          backgroundColor: `${customPaletteConfig.primary}18`,
                        }}
                      >
                        Custom
                      </span>
                    </div>
                    <p className={`hidden md:block text-[10px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Make your own theme · Click to customize colors
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 pl-2 shrink-0">
                  <span
                    className="w-3 h-3 rounded-full border border-white/25"
                    style={{ backgroundColor: customPaletteConfig.primary }}
                    title="Custom Primary"
                  />
                  <span
                    className="w-3 h-3 rounded-full border border-white/25"
                    style={{ backgroundColor: customPaletteConfig.accent }}
                    title="Custom Accent"
                  />
                  <span
                    className="w-3 h-3 rounded-full border border-white/25"
                    style={{ backgroundColor: customPaletteConfig.bgDark }}
                    title="Custom Dark Canvas"
                  />
                </div>
              </div>
            );
          })()}
        </div>

        {/* Custom Theme Palette Builder Studio */}
        {(isCustomBuilderOpen || activePaletteId === 'custom') && (
          <div
            className={`mt-1.5 md:mt-2 p-3.5 md:p-5 rounded-xl md:rounded-2xl border space-y-3 md:space-y-4 transition-colors ${
              darkMode
                ? 'bg-slate-950/60 border-white/10'
                : 'bg-white/80 border-slate-200/90 shadow-sm'
            }`}
            style={{
              borderColor: `${customPaletteConfig.primary}45`,
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${customPaletteConfig.primary}, ${customPaletteConfig.accent})`,
                  }}
                >
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    Custom Palette Studio
                  </h4>
                  <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Pick primary, accent, and canvas base colors — changes apply live across the workspace.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activePaletteId !== 'custom' && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCustomPalette(
                        {
                          name: `${activePalette.name.split(' ')[0]} Remix`,
                          primary: activePalette.primary,
                          accent: activePalette.accent,
                          bgDark: activePalette.bgDark,
                        },
                        true
                      )
                    }
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      darkMode
                        ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    title="Copy currently active preset colors into your custom palette"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Clone Current</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const hue = Math.floor(Math.random() * 360);
                    const hue2 = (hue + 38 + Math.floor(Math.random() * 45)) % 360;
                    const hslToHex = (h: number, s: number, l: number) => {
                      s /= 100;
                      l /= 100;
                      const a = s * Math.min(l, 1 - l);
                      const f = (n: number) => {
                        const k = (n + h / 30) % 12;
                        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                        return Math.round(255 * color)
                          .toString(16)
                          .padStart(2, '0');
                      };
                      return `#${f(0)}${f(8)}${f(4)}`;
                    };
                    onUpdateCustomPalette(
                      {
                        primary: hslToHex(hue, 84, 58),
                        accent: hslToHex(hue2, 82, 56),
                        bgDark: hslToHex(hue, 38, 6),
                      },
                      true
                    );
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    darkMode
                      ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Generate a fresh harmonious color combination"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Randomize</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
              {/* Theme Name */}
              <div className="space-y-1.5">
                <label className={`block text-[11px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Theme Name
                </label>
                <input
                  type="text"
                  maxLength={28}
                  value={customPaletteConfig.name}
                  onChange={(e) => onUpdateCustomPalette({ name: e.target.value }, true)}
                  placeholder="My Custom Theme"
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 ${
                    darkMode
                      ? 'bg-slate-900/80 border-white/15 text-white focus:ring-white/20'
                      : 'bg-white border-slate-300 text-slate-900 focus:ring-slate-300'
                  }`}
                />
              </div>

              {/* Primary Color Picker */}
              <div className="space-y-1.5">
                <label className={`block text-[11px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Primary Color
                </label>
                <div
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${
                    darkMode ? 'bg-slate-900/80 border-white/15' : 'bg-white border-slate-300'
                  }`}
                >
                  <input
                    type="color"
                    value={customPaletteConfig.primary}
                    onChange={(e) => onUpdateCustomPalette({ primary: e.target.value }, true)}
                    className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer shrink-0 p-0"
                    aria-label="Pick primary color"
                  />
                  <input
                    type="text"
                    value={customPaletteConfig.primary.toUpperCase()}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        onUpdateCustomPalette({ primary: val }, true);
                      } else if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        onUpdateCustomPalette({ primary: val }, false);
                      }
                    }}
                    className={`w-full bg-transparent text-xs font-mono focus:outline-none ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Accent Color Picker */}
              <div className="space-y-1.5">
                <label className={`block text-[11px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Accent Color
                </label>
                <div
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${
                    darkMode ? 'bg-slate-900/80 border-white/15' : 'bg-white border-slate-300'
                  }`}
                >
                  <input
                    type="color"
                    value={customPaletteConfig.accent}
                    onChange={(e) => onUpdateCustomPalette({ accent: e.target.value }, true)}
                    className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer shrink-0 p-0"
                    aria-label="Pick accent color"
                  />
                  <input
                    type="text"
                    value={customPaletteConfig.accent.toUpperCase()}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        onUpdateCustomPalette({ accent: val }, true);
                      } else if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        onUpdateCustomPalette({ accent: val }, false);
                      }
                    }}
                    className={`w-full bg-transparent text-xs font-mono focus:outline-none ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Dark Canvas Base Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Canvas Dark Base
                  </label>
                  <div className="flex items-center gap-1">
                    {['#090d16', '#050507', '#060b19', '#12081c'].map((bgHex) => (
                      <button
                        key={bgHex}
                        type="button"
                        onClick={() => onUpdateCustomPalette({ bgDark: bgHex }, true)}
                        className="w-3.5 h-3.5 rounded-full border border-white/30 cursor-pointer hover:scale-110 transition-transform"
                        style={{ backgroundColor: bgHex }}
                        title={`Set base ${bgHex}`}
                      />
                    ))}
                  </div>
                </div>
                <div
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${
                    darkMode ? 'bg-slate-900/80 border-white/15' : 'bg-white border-slate-300'
                  }`}
                >
                  <input
                    type="color"
                    value={customPaletteConfig.bgDark}
                    onChange={(e) => onUpdateCustomPalette({ bgDark: e.target.value }, true)}
                    className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer shrink-0 p-0"
                    aria-label="Pick dark background base color"
                  />
                  <input
                    type="text"
                    value={customPaletteConfig.bgDark.toUpperCase()}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        onUpdateCustomPalette({ bgDark: val }, true);
                      } else if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        onUpdateCustomPalette({ bgDark: val }, false);
                      }
                    }}
                    className={`w-full bg-transparent text-xs font-mono focus:outline-none ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Live Gradient & Surface Preview */}
            <div
              className="rounded-xl p-3 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{
                backgroundColor: darkMode ? customPaletteConfig.bgDark : '#f8fafc',
                borderColor: `${customPaletteConfig.primary}45`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-7 w-24 rounded-lg shadow-sm border border-white/25"
                  style={{
                    background: `linear-gradient(135deg, ${customPaletteConfig.primary}, ${customPaletteConfig.accent})`,
                  }}
                />
                <span className={`text-xs font-medium ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  Live preview · Primary glow + Gradient accent
                </span>
              </div>

              {activePaletteId === 'custom' ? (
                <span
                  className="px-3 py-1 rounded-lg text-[11px] font-bold text-slate-950 shadow-sm self-start sm:self-auto"
                  style={{
                    background: `linear-gradient(135deg, ${customPaletteConfig.primary}, ${customPaletteConfig.accent})`,
                  }}
                >
                  Active Custom Theme
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectPalette('custom')}
                  className="px-3 py-1 rounded-lg text-[11px] font-bold text-slate-950 shadow-sm self-start sm:self-auto hover:opacity-90 transition cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${customPaletteConfig.primary}, ${customPaletteConfig.accent})`,
                  }}
                >
                  Apply Custom Theme
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Precision Cursor Selector & Dynamic Color Adapter */}
      <PrecisionCursorSection
        cursorStyle={cursorStyle}
        onChangeCursorStyle={onChangeCursorStyle}
        activePalette={activePalette}
        cursorColorAdapter={cursorColorAdapter}
        onChangeCursorColorAdapter={onChangeCursorColorAdapter}
        darkMode={darkMode}
      />

      {/* Smooth Scrolling Support (Momentum & Inertia) */}
      <div className="liquid-glass rounded-2xl p-3.5 md:p-6 shadow-xl flex flex-col gap-2.5 md:gap-4">
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h3
              className={`text-sm md:text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              <Waves className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: activePalette.primary }} />
              <span className="truncate">Smooth Scrolling Support (Lenis Engine)</span>
            </h3>
            <p className={`hidden sm:block text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Powered by Studio Freight Lenis. Delivers buttery-smooth momentum inertia and exponential easing across all study tabs, documents, and feeds.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span
              className="hidden sm:flex text-[11px] font-mono font-bold px-3 py-1 rounded-full border shadow-sm items-center gap-1.5"
              style={{
                backgroundColor: smoothScroll ? `${activePalette.primary}20` : 'transparent',
                borderColor: smoothScroll
                  ? `${activePalette.primary}50`
                  : darkMode
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.1)',
                color: smoothScroll
                  ? darkMode
                    ? '#ffffff'
                    : activePalette.primary
                  : darkMode
                  ? '#94a3b8'
                  : '#64748b',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: smoothScroll ? activePalette.primary : '#94a3b8',
                }}
              />
              <span>{smoothScroll ? 'ON · Momentum Enabled' : 'OFF · Native Instant'}</span>
            </span>

            {/* Accessible Pill Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={smoothScroll}
              onClick={() => onToggleSmoothScroll(!smoothScroll)}
              className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                smoothScroll ? '' : darkMode ? 'bg-slate-800' : 'bg-slate-300'
              }`}
              style={
                smoothScroll
                  ? {
                      background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                      boxShadow: `0 0 16px ${activePalette.primary}40`,
                    }
                  : {}
              }
              title={`Toggle Smooth Scrolling ${smoothScroll ? 'OFF' : 'ON'}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  smoothScroll ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Live Scroll Testing Strip */}
        <div
          className={`hidden md:flex p-3.5 rounded-xl border flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
            darkMode
              ? 'bg-slate-900/60 border-white/10 text-slate-300'
              : 'bg-slate-50/80 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: activePalette.primary }}
            />
            <span className="text-[11px]">
              {smoothScroll
                ? 'Smooth scrolling is active by default. Wheel gestures glide with physics deceleration.'
                : 'Smooth scrolling is disabled. Wheel events respond with raw 1:1 instantaneous increments.'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const targetY = window.scrollY > 200 ? 0 : document.documentElement.scrollHeight;
              const lenis = getLenis();
              if (lenis && smoothScroll) {
                lenis.scrollTo(targetY, { duration: 1.25 });
              } else {
                window.scrollTo({
                  top: targetY,
                  behavior: smoothScroll ? 'smooth' : 'auto',
                });
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition shrink-0 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              borderColor: `${activePalette.primary}40`,
              backgroundColor: `${activePalette.primary}15`,
              color: darkMode ? '#ffffff' : activePalette.primary,
            }}
          >
            {window.scrollY > 200 ? 'Scroll to Top ↑' : 'Scroll to Bottom ↓'}
          </button>
        </div>
      </div>
      </div>
      )}

      {activeSettingsTab === 'gemini-model' && (
      <div className="space-y-3.5 md:space-y-8 onenote-page-content-reveal">
      {/* Gemini AI Model Changer & Thinking Mode */}
      <div className="liquid-glass rounded-2xl p-3.5 md:p-6 shadow-xl flex flex-col gap-3.5 md:gap-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 md:gap-3">
          <div className="space-y-0.5">
            <h3
              className={`text-sm md:text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: activePalette.primary }} />
              <span>Gemini Intelligence Model Engine</span>
            </h3>
            <p className={`hidden sm:block text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Select the active generative model for grounded research queries and AI synthesis.
            </p>
          </div>

          <div className="flex items-center gap-2 md:gap-2.5 flex-wrap w-full sm:w-auto">
            {/* Quick On-the-Go Model Selector Dropdown */}
            <div className="relative z-50" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className={`px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold flex items-center gap-1.5 md:gap-2 border transition select-none liquid-glass-tile cursor-pointer shadow-sm ${
                  darkMode
                    ? 'bg-slate-900 border-white/15 text-slate-100 hover:bg-slate-800'
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                }`}
                style={{
                  borderColor: isModelDropdownOpen ? `${activePalette.primary}80` : undefined,
                }}
                title="Change active Gemini model on the go"
              >
                <Bot className="w-4 h-4" style={{ color: activePalette.primary }} />
                <span>{activeModelObj.name}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 opacity-60 ${
                    isModelDropdownOpen ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>

              {/* Dropdown Options Popup */}
              {isModelDropdownOpen && (
                <div
                  style={{ zIndex: 100 }}
                  className={`absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border p-2 shadow-2xl z-[100] space-y-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
                    darkMode
                      ? 'bg-slate-900 border-white/20 text-slate-100 shadow-2xl shadow-black/80 ring-1 ring-white/10'
                      : 'bg-white border-slate-300 text-slate-900 shadow-2xl shadow-slate-400/50 ring-1 ring-black/5'
                  }`}
                >
                  <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/10 dark:border-white/10 border-slate-200 flex items-center justify-between">
                    <span>Quick Select Model</span>
                    <span className="text-[9px] text-cyan-400 font-bold">{modelOptions.length} Available</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                    {modelOptions.map((m) => {
                      const isSelected = selectedModel === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            onChangeModel(m.id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`p-2.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition select-none border ${
                            isSelected
                              ? darkMode
                                ? 'bg-slate-800/90 border-white/25 text-white font-semibold shadow-xs'
                                : 'bg-slate-100 border-slate-300 text-slate-950 font-semibold shadow-xs'
                              : darkMode
                              ? 'border-transparent text-slate-300 hover:bg-white/10 hover:text-white'
                              : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: isSelected ? activePalette.primary : 'rgba(255,255,255,0.2)',
                              }}
                            />
                            <div className="truncate">
                              <p className="font-semibold truncate">{m.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{m.tag || m.badge}</p>
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* High Thinking Mode Toggle */}
            <button
              onClick={() => onToggleThinking(!enableThinking)}
              style={
                enableThinking
                  ? {
                      background: `linear-gradient(135deg, ${activePalette.accent}, ${activePalette.primary})`,
                      color: '#0f172a',
                    }
                  : {}
              }
              className={`px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl border text-[11px] md:text-xs font-bold flex items-center gap-1.5 md:gap-2 transition ${
                enableThinking
                  ? 'shadow-md border-transparent'
                  : darkMode
                  ? 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:text-slate-900'
              }`}
            >
              <Brain className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>High Thinking: {enableThinking ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* API Key Connection & Live Verification Card */}
        <div
          className={`p-3 md:p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 md:gap-3 ${
            darkMode
              ? 'bg-slate-900/70 border-white/10'
              : 'bg-white/80 border-slate-300/80 shadow-xs'
          }`}
          style={{ borderColor: `${activePalette.primary}35` }}
        >
          <div className="flex-1 w-full space-y-1">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" style={{ color: activePalette.primary }} />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Gemini API Key Connection
              </h4>
              {apiKeyInput.trim() ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Key Loaded
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" />
                  Required
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Loaded automatically from <code className="text-white font-mono">.env</code> or customizable below.
            </p>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 pt-1">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Paste your Gemini API key (AQ... or AIza...)"
                className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-mono focus:outline-none focus:ring-1 ${
                  darkMode
                    ? 'bg-slate-950 border-white/15 text-slate-100 placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={handleSaveAndTestKey}
                disabled={isTestingKey}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  color: '#0f172a',
                }}
              >
                {isTestingKey ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save & Test</span>
                  </>
                )}
              </button>
            </div>

            {/* Helper text link directly underneath the input box */}
            <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5 flex-wrap">
              <span>Don&apos;t have a key?</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline hover:brightness-125 transition inline-flex items-center gap-1"
                style={{ color: activePalette.primary }}
              >
                <span>Get your free Gemini API key from Google AI Studio.</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            {keyStatus && (
              <p
                className={`text-[11px] font-mono mt-1 flex items-center gap-1.5 ${
                  keyStatus.success ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {keyStatus.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{keyStatus.message}</span>
              </p>
            )}
          </div>
        </div>

        {/* Model Options */}
        <div className="space-y-2 md:space-y-3">
          {modelOptions.map((opt) => {
            const isSelected = selectedModel === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => onChangeModel(opt.id)}
                style={
                  isSelected
                    ? {
                        borderColor: activePalette.primary,
                        backgroundColor: darkMode ? `${activePalette.primary}15` : `${activePalette.primary}10`,
                      }
                    : {}
                }
                className="p-3 md:p-4 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2.5 md:gap-4 liquid-glass-tile"
              >
                <div className="space-y-0.5 md:space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    <h4
                      className={`text-xs md:text-sm font-bold ${
                        darkMode ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      {opt.name}
                    </h4>
                    <span
                      className="text-[9px] md:text-[10px] font-mono font-bold uppercase px-1.5 md:px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: `${activePalette.primary}20`,
                        borderColor: `${activePalette.primary}40`,
                        color: activePalette.primary,
                      }}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] md:text-xs leading-snug md:leading-relaxed max-w-xl line-clamp-2 md:line-clamp-none ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {opt.description}
                  </p>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition ${
                    isSelected
                      ? 'text-slate-950 font-bold'
                      : darkMode
                      ? 'border-slate-600 bg-transparent'
                      : 'border-slate-400 bg-transparent'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: activePalette.primary,
                          borderColor: activePalette.primary,
                        }
                      : {}
                  }
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      )}

      {activeSettingsTab === 'gemini-personalization' && (() => {
        const tierInfo = getMemoryTierInfo(sliderMemoryLevel);
        const { firstName: previewFirstName } = resolvePreferredNames(
          accountBaseName || authenticatedName,
          draftCustomName
        );
        const { firstName: savedFirstName } = resolvePreferredNames(
          accountBaseName || authenticatedName,
          activePersonalization.customName
        );
        const hasUnsavedInstructions =
          draftInstructions !== activePersonalization.customInstructions;
        const hasUnsavedName =
          draftCustomName.trim() !== activePersonalization.customName.trim();

        const handleCommitMemoryLevel = (level: number) => {
          const clamped = Math.max(0, Math.min(100, Math.round(level)));
          setSliderMemoryLevel(clamped);
          if (memoryCommitTimerRef.current !== null) {
            window.clearTimeout(memoryCommitTimerRef.current);
          }
          memoryCommitTimerRef.current = window.setTimeout(() => {
            updatePersonalization({ memoryLevel: clamped });
          }, 90);
        };

        const handleSaveCustomName = (e?: React.FormEvent) => {
          if (e) e.preventDefault();
          const cleaned = draftCustomName.trim().slice(0, 80);
          setDraftCustomName(cleaned);
          updatePersonalization({ customName: cleaned });
          setNameSavedBadge(true);
          window.setTimeout(() => setNameSavedBadge(false), 1800);
        };

        const handleAddManualMemory = (e: React.FormEvent) => {
          e.preventDefault();
          const clean = newMemoryInput.trim().slice(0, 220);
          if (clean.length < 3) return;
          updatePersonalization((prev) => ({
            ...prev,
            memories: [
              {
                id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                text: clean,
                category: newMemoryCategory,
                createdAt: new Date().toISOString(),
                source: 'manual' as const,
              },
              ...prev.memories.filter(
                (m) => m.text.toLowerCase() !== clean.toLowerCase()
              ),
            ].slice(0, 40),
          }));
          setNewMemoryInput('');
        };

        const handleDeleteMemory = (id: string) => {
          updatePersonalization((prev) => ({
            ...prev,
            memories: prev.memories.filter((m) => m.id !== id),
          }));
        };

        const handleSaveInstructions = () => {
          const trimmed = draftInstructions.slice(0, 4000);
          setDraftInstructions(trimmed);
          updatePersonalization({ customInstructions: trimmed });
          setInstructionsSavedBadge(true);
          window.setTimeout(() => setInstructionsSavedBadge(false), 1800);
        };

        const handleAppendStarter = (starterText: string) => {
          setDraftInstructions((prev) => {
            const current = prev.trim();
            if (current.toLowerCase().includes(starterText.toLowerCase())) return prev;
            const next = current ? `${current}\n- ${starterText}` : `- ${starterText}`;
            return next.slice(0, 4000);
          });
        };

        return (
          <div className="space-y-3.5 md:space-y-6 onenote-page-content-reveal">
            {/* 1. Customize Name Card */}
            <div className="liquid-glass rounded-2xl p-3.5 md:p-6 shadow-xl space-y-3 md:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3">
                <div className="space-y-0.5">
                  <h3
                    className={`text-sm md:text-base font-bold flex items-center gap-2 ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: activePalette.primary }} />
                    <span>1. Customize Name</span>
                  </h3>
                  <p className={`hidden sm:block text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Choose what Aether &amp; Gemini should call you. We always address you by your first name.
                  </p>
                </div>

                {savedFirstName && (
                  <div
                    className="px-2.5 py-1 md:px-3 md:py-1.5 rounded-xl border text-[11px] md:text-xs font-mono font-semibold flex items-center gap-2 self-start sm:self-auto"
                    style={{
                      backgroundColor: `${activePalette.primary}18`,
                      borderColor: `${activePalette.primary}45`,
                      color: darkMode ? '#ffffff' : activePalette.primary,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full"
                      style={{ backgroundColor: activePalette.primary }}
                    />
                    <span>Calling you: {savedFirstName}</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveCustomName} className="space-y-2.5 md:space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-2.5">
                  <input
                    type="text"
                    maxLength={80}
                    value={draftCustomName}
                    onChange={(e) => setDraftCustomName(e.target.value)}
                    placeholder={
                      accountBaseName
                        ? `Account name: ${accountBaseName} (enter custom name to override)`
                        : 'Enter your preferred name...'
                    }
                    className={`flex-1 px-3 py-2 md:px-4 md:py-2.5 rounded-xl border text-xs md:text-sm font-medium focus:outline-none transition ${
                      darkMode
                        ? 'bg-slate-950/75 border-white/15 text-slate-100 placeholder-slate-500 focus:border-white/35'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500'
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer hover:brightness-105"
                      style={{
                        background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                        color: '#0f172a',
                      }}
                    >
                      {nameSavedBadge ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{nameSavedBadge ? 'Saved' : hasUnsavedName ? 'Save Name' : 'Save'}</span>
                    </button>

                    {(draftCustomName.trim() || activePersonalization.customName.trim()) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftCustomName('');
                          updatePersonalization({ customName: '' });
                        }}
                        title="Revert to account profile name"
                        className={`px-3 py-2 md:py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          darkMode
                            ? 'bg-slate-900/70 border-white/10 text-slate-300 hover:bg-white/10'
                            : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Use Account Name</span>
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className={`p-2.5 md:p-3 rounded-xl border text-[11px] md:text-xs flex items-center justify-between gap-2 ${
                    darkMode
                      ? 'bg-slate-900/55 border-white/10 text-slate-300'
                      : 'bg-slate-50/90 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="truncate">
                    Greeting preview:{' '}
                    <strong className={darkMode ? 'text-white' : 'text-slate-950'}>
                      {previewFirstName
                        ? `"Hey ${previewFirstName}, what are we mastering today?"`
                        : '"Hey, what are we mastering today?"'}
                    </strong>
                  </span>
                  <span className="hidden sm:inline text-[11px] font-mono text-slate-400 shrink-0">
                    {extractFirstName(accountBaseName) ? `Account: ${extractFirstName(accountBaseName)}` : 'First-name mode'}
                  </span>
                </div>
              </form>
            </div>

            {/* 2. Functional Memory Slider Card */}
            <div className="liquid-glass rounded-2xl p-3.5 md:p-6 shadow-xl space-y-3.5 md:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3">
                <div className="space-y-0.5">
                  <h3
                    className={`text-sm md:text-base font-bold flex items-center gap-2 ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    <Brain className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: activePalette.primary }} />
                    <span>2. Adaptive Memory (Gemini Learns From You)</span>
                  </h3>
                  <p className={`text-[11px] md:text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {tierInfo.description}
                  </p>
                </div>

                <div
                  className="px-2.5 py-1 md:px-3 md:py-1.5 rounded-xl border text-[11px] md:text-xs font-mono font-bold flex items-center gap-2 self-start sm:self-auto"
                  style={{
                    backgroundColor: sliderMemoryLevel > 0 ? `${activePalette.primary}20` : undefined,
                    borderColor:
                      sliderMemoryLevel > 0
                        ? `${activePalette.primary}50`
                        : darkMode
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.12)',
                    color:
                      sliderMemoryLevel > 0
                        ? darkMode
                          ? '#ffffff'
                          : activePalette.primary
                        : undefined,
                  }}
                >
                  <span>{tierInfo.label}</span>
                  <span className="opacity-70">· {sliderMemoryLevel}%</span>
                </div>
              </div>

              {/* Interactive Range Slider */}
              <div
                className={`p-3 md:p-4 rounded-xl border space-y-2.5 md:space-y-3 ${
                  darkMode ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50/90 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>
                    Learning &amp; Recall Depth
                  </span>
                  <span style={{ color: activePalette.primary }} className="font-bold">
                    {sliderMemoryLevel === 0
                      ? 'Paused (0 memories injected)'
                      : `Up to ${tierInfo.maxRecallCount} learned facts injected into Gemini context`}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  aria-label="Gemini memory level"
                  value={sliderMemoryLevel}
                  onChange={(e) => handleCommitMemoryLevel(Number(e.target.value))}
                  className="w-full h-2.5 rounded-lg appearance-none cursor-pointer accent-current"
                  style={{
                    color: activePalette.primary,
                    background: `linear-gradient(to right, ${activePalette.primary} 0%, ${activePalette.accent} ${sliderMemoryLevel}%, ${
                      darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.14)'
                    } ${sliderMemoryLevel}%, ${
                      darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.14)'
                    } 100%)`,
                  }}
                />

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  {[
                    { val: 0, text: '0% Off' },
                    { val: 25, text: '25% Light' },
                    { val: 65, text: '65% Balanced' },
                    { val: 100, text: '100% Deep' },
                  ].map((mark) => (
                    <button
                      key={mark.val}
                      type="button"
                      onClick={() => handleCommitMemoryLevel(mark.val)}
                      className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                        Math.abs(sliderMemoryLevel - mark.val) <= 8
                          ? 'font-bold text-white'
                          : 'hover:text-slate-200'
                      }`}
                      style={
                        Math.abs(sliderMemoryLevel - mark.val) <= 8
                          ? { backgroundColor: `${activePalette.primary}30`, color: activePalette.primary }
                          : {}
                      }
                    >
                      {mark.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Learned Memory Bank + Manual Add */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      What Gemini Has Learned About You ({activePersonalization.memories.length}/40)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Automatically updated as you chat in Gemini Workspace, NotebookLM, and the Floating Assistant.
                    </p>
                  </div>

                  {activePersonalization.memories.length > 0 && (
                    confirmClearMemories ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            updatePersonalization({ memories: [] });
                            setConfirmClearMemories(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold cursor-pointer"
                        >
                          Confirm Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearMemories(false)}
                          className="px-2 py-1 rounded-lg border border-white/10 text-[11px] text-slate-400 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClearMemories(true)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                          darkMode
                            ? 'border-white/10 text-slate-400 hover:text-rose-300 hover:border-rose-500/30'
                            : 'border-slate-300 text-slate-600 hover:text-rose-600 hover:border-rose-300'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear All</span>
                      </button>
                    )
                  )}
                </div>

                {/* Add a memory manually */}
                <form onSubmit={handleAddManualMemory} className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newMemoryCategory}
                    onChange={(e) => setNewMemoryCategory(e.target.value as MemoryCategory)}
                    className={`px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none ${
                      darkMode
                        ? 'bg-slate-950/75 border-white/15 text-slate-200'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="preference">Preference</option>
                    <option value="study">Study Topic</option>
                    <option value="goal">Goal</option>
                    <option value="background">Background</option>
                    <option value="context">Context</option>
                  </select>
                  <input
                    type="text"
                    maxLength={220}
                    value={newMemoryInput}
                    onChange={(e) => setNewMemoryInput(e.target.value)}
                    placeholder="Add something you want Gemini to remember (e.g. Preparing for OS final exam)..."
                    className={`flex-1 px-3.5 py-2 rounded-xl border text-xs focus:outline-none ${
                      darkMode
                        ? 'bg-slate-950/75 border-white/15 text-slate-100 placeholder-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={newMemoryInput.trim().length < 3}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                    style={{
                      background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                      color: '#0f172a',
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Fact</span>
                  </button>
                </form>

                {activePersonalization.memories.length === 0 ? (
                  <div
                    className={`p-5 rounded-xl border border-dashed text-center text-xs ${
                      darkMode
                        ? 'border-white/15 bg-slate-950/40 text-slate-400'
                        : 'border-slate-300 bg-slate-50/70 text-slate-500'
                    }`}
                  >
                    No learned memories saved yet. Chat naturally with Gemini about your courses, goals, or preferred learning style and memories will appear here automatically.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {activePersonalization.memories.map((mem, idx) => {
                      const isActiveInRecall =
                        sliderMemoryLevel > 0 && idx < tierInfo.maxRecallCount;
                      return (
                        <div
                          key={mem.id}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition ${
                            darkMode
                              ? 'bg-slate-900/65 border-white/10'
                              : 'bg-white/90 border-slate-200'
                          } ${!isActiveInRecall && sliderMemoryLevel > 0 ? 'opacity-55' : ''}`}
                        >
                          <div className="space-y-1 min-w-0">
                            <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              {mem.text}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 flex-wrap">
                              <span
                                className="px-1.5 py-0.5 rounded-md uppercase font-semibold"
                                style={{
                                  backgroundColor: `${activePalette.primary}18`,
                                  color: activePalette.primary,
                                }}
                              >
                                {mem.category}
                              </span>
                              <span>{mem.source === 'manual' ? 'Added by you' : 'Learned from chat'}</span>
                              <span>·</span>
                              <span>{isActiveInRecall ? 'Active in prompt' : sliderMemoryLevel === 0 ? 'Paused' : 'Queued'}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteMemory(mem.id)}
                            title="Forget this memory"
                            className={`p-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
                              darkMode
                                ? 'border-white/10 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10'
                                : 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Instructions for Gemini Card (Gemini Webapp Style) */}
            <div className="liquid-glass rounded-2xl p-3.5 md:p-6 shadow-xl space-y-3 md:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3">
                <div className="space-y-0.5">
                  <h3
                    className={`text-sm md:text-base font-bold flex items-center gap-2 ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: activePalette.primary }} />
                    <span>3. Instructions for Gemini</span>
                  </h3>
                  <p className={`hidden sm:block text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Share persistent info, formatting rules, tone, or academic background so Gemini automatically tailors every response—just like Gemini&apos;s Saved Info.
                  </p>
                </div>

                <span
                  className={`text-[10px] md:text-[11px] font-mono px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg border self-start sm:self-auto ${
                    activePersonalization.customInstructions.trim()
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                      : darkMode
                      ? 'bg-slate-900 text-slate-400 border-white/10'
                      : 'bg-slate-100 text-slate-500 border-slate-300'
                  }`}
                >
                  {activePersonalization.customInstructions.trim()
                    ? hasUnsavedInstructions
                      ? 'Unsaved Edits'
                      : 'Instructions Active'
                    : 'No Instructions Set'}
                </span>
              </div>

              {/* Starter Prompt Chips */}
              <div className="space-y-1.5 md:space-y-2">
                <span className="text-[10px] md:text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Quick Starters (Click to add)
                </span>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {GEMINI_INSTRUCTION_STARTERS.map((starter) => (
                    <button
                      key={starter.id}
                      type="button"
                      onClick={() => handleAppendStarter(starter.instruction)}
                      className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-xl border text-[11px] md:text-xs font-semibold flex items-center gap-1 md:gap-1.5 transition cursor-pointer ${
                        darkMode
                          ? 'bg-slate-900/75 border-white/10 text-slate-300 hover:text-white hover:border-white/25'
                          : 'bg-white border-slate-300 text-slate-700 hover:text-slate-950 hover:border-slate-400'
                      }`}
                    >
                      <Plus className="w-3 h-3" style={{ color: activePalette.primary }} />
                      <span>{starter.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={4}
                  maxLength={4000}
                  value={draftInstructions}
                  onChange={(e) => setDraftInstructions(e.target.value)}
                  placeholder="Examples:&#10;- I'm a second-year Computer Science & Physics student.&#10;- Always explain math step-by-step using LaTeX equations.&#10;- Keep summaries concise unless I ask for an exhaustive deep dive.&#10;- Use Python and TypeScript for coding examples."
                  className={`w-full p-3 md:p-4 rounded-xl border text-xs sm:text-sm leading-relaxed focus:outline-none transition resize-y min-h-[100px] md:min-h-[140px] ${
                    darkMode
                      ? 'bg-slate-950/75 border-white/15 text-slate-100 placeholder-slate-500 focus:border-white/35'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500'
                  }`}
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 md:gap-3 pt-1">
                  <span className="text-[10px] md:text-[11px] font-mono text-slate-400">
                    {draftInstructions.length} / 4000 characters
                  </span>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {(draftInstructions.trim() || activePersonalization.customInstructions.trim()) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftInstructions('');
                          updatePersonalization({ customInstructions: '' });
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          darkMode
                            ? 'border-white/10 text-slate-300 hover:bg-white/10'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Clear
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveInstructions}
                      className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer hover:brightness-105"
                      style={{
                        background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                        color: '#0f172a',
                      }}
                    >
                      {instructionsSavedBadge ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {instructionsSavedBadge
                          ? 'Instructions Saved'
                          : hasUnsavedInstructions
                          ? 'Save Instructions'
                          : 'Save'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Account Session & Reset Controls (Visible cleanly across Settings) */}
      {activeSettingsTab !== 'gemini-personalization' && (
      <>
      {/* Authenticated Account & Session Management */}
      <div className="p-3.5 md:p-5 rounded-2xl liquid-glass flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
          <div className={`text-xs space-y-1 md:space-y-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: isGuestSession
                    ? '#f59e0b'
                    : cloudSyncStatus === 'error'
                    ? '#f43f5e'
                    : cloudSyncStatus === 'synced'
                    ? '#10b981'
                    : activePalette.primary,
                }}
              />
              <p className={`text-xs md:text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                Authenticated Studio Session
              </p>

              {!isGuestSession ? (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                    cloudSyncStatus === 'error'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : cloudSyncStatus === 'syncing'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {cloudSyncStatus === 'syncing' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Syncing to Cloud...</span>
                    </>
                  ) : cloudSyncStatus === 'error' ? (
                    <>
                      <AlertCircle className="w-2.5 h-2.5" />
                      <span>
                        {cloudSyncError && isQuotaExceededError(cloudSyncError)
                          ? 'Sync Paused (Quota)'
                          : 'Cloud Sync Issue'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>
                        Cloud Synced{lastCloudSyncAt ? ` · ${lastCloudSyncAt}` : ''}
                      </span>
                    </>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border bg-amber-500/10 text-amber-400 border-amber-500/30">
                  Local Browser Only (Guest)
                </span>
              )}
            </div>

            <p className="text-[11px] md:text-xs">
              Connected as{' '}
              <span className={`font-mono font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                {authenticatedEmail
                  ? authenticatedName
                    ? `${authenticatedName} (${authenticatedEmail})`
                    : authenticatedEmail
                  : authenticatedName
                  ? `${authenticatedName} · Guest Session`
                  : 'Guest Session'}
              </span>
            </p>

            {isGuestSession && (
              <p className="hidden sm:block text-[11px] leading-relaxed text-amber-400/90">
                Guest sessions only stay in this browser and reset if you sign out. Connect your Google mail account below to keep all workspaces, folders, sources &amp; chats synced across sign-outs and devices.
              </p>
            )}

            {!isGuestSession && cloudSyncStatus === 'error' && cloudSyncError && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-mono text-rose-400 leading-relaxed">
                  {cloudSyncError}
                </p>
                {isQuotaExceededError(cloudSyncError) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <a
                      href={getQuotaUpgradeUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2"
                    >
                      <span>Open Firestore Console</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://firebase.google.com/pricing#cloud-firestore"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 underline underline-offset-2 ${
                        darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <span>View Quota &amp; Plans</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isGuestSession && onConnectGoogleAccount && (
              <button
                type="button"
                disabled={isConnectingGoogle}
                onClick={async () => {
                  setIsConnectingGoogle(true);
                  setGoogleConnectError(null);
                  const res = await onConnectGoogleAccount();
                  if (!res.ok && res.error) {
                    setGoogleConnectError(res.error);
                  }
                  setIsConnectingGoogle(false);
                }}
                style={{
                  background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                  color: '#0f172a',
                }}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[11px] md:text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer hover:brightness-105 disabled:opacity-50"
              >
                {isConnectingGoogle ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting Google...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Connect Google Mail to Sync</span>
                  </>
                )}
              </button>
            )}

            {!isGuestSession && onForceCloudSync && (
              <button
                type="button"
                disabled={cloudSyncStatus === 'syncing'}
                onClick={() => void onForceCloudSync()}
                className={`px-3 py-1.5 md:px-3.5 md:py-2 rounded-xl text-[11px] md:text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  darkMode
                    ? 'bg-slate-900/70 hover:bg-white/10 text-slate-200 border-white/15'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                <span>{cloudSyncStatus === 'error' ? 'Retry Sync' : 'Sync Now'}</span>
              </button>
            )}

            {onSignOut && (
              <button
                type="button"
                disabled={isSigningOut}
                onClick={() => {
                  if (isGuestSession && (workspaceCount > 0 || folderCount > 1) && !confirmGuestSignOut) {
                    setConfirmGuestSignOut(true);
                    return;
                  }
                  setConfirmGuestSignOut(false);
                  void onSignOut();
                }}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[11px] md:text-xs font-semibold border transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60 ${
                  confirmGuestSignOut
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                    : darkMode
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                }`}
              >
                {isSigningOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving &amp; Signing Out...</span>
                  </>
                ) : confirmGuestSignOut ? (
                  <span>Confirm Wipe &amp; Sign Out</span>
                ) : (
                  <span>Sign Out &amp; Disconnect</span>
                )}
              </button>
            )}
          </div>
        </div>

        {confirmGuestSignOut && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-rose-300">
            <span>
              You are in Guest mode with {workspaceCount} {workspaceCount === 1 ? 'workspace' : 'workspaces'}. Signing out clears local browser data — click &ldquo;Connect Google Mail to Sync&rdquo; first to keep them.
            </span>
            <button
              type="button"
              onClick={() => setConfirmGuestSignOut(false)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {googleConnectError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{googleConnectError}</span>
          </div>
        )}
      </div>

      {/* Reset & Storage info */}
      <div className="p-3.5 md:p-4 rounded-2xl liquid-glass flex flex-row items-center justify-between gap-2.5 md:gap-3">
        <div className={`text-xs space-y-0.5 min-w-0 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <p className={`font-semibold truncate ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            Cloud &amp; Local State Management
          </p>
          <p className="hidden sm:block">
            {isGuestSession
              ? 'Your guest session stays saved locally on this browser. Resetting clears your workspace data while keeping your login.'
              : 'Your notes, chats, workspaces, themes, and study logs sync automatically to your Google account across devices.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onResetData();
            setIsJustReset(true);
            setTimeout(() => setIsJustReset(false), 1800);
          }}
          className={`px-3 py-1.5 rounded-xl text-[11px] md:text-xs border transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
            isJustReset
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35'
              : darkMode
              ? 'bg-slate-900 hover:bg-red-950/60 hover:text-red-300 text-slate-400 border-white/10'
              : 'bg-white hover:bg-red-50 hover:text-red-600 text-slate-600 border-slate-200'
          }`}
        >
          {isJustReset ? <Check className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>{isJustReset ? 'Account Reset' : 'Reset Account'}</span>
        </button>
      </div>
      </>
      )}
    </div>
  );
};

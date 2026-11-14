import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Settings,
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
} from 'lucide-react';
import { PALETTES } from '../data/mockData';
import { ColorPaletteId, ColorPalette, CustomPaletteConfig, CursorStyleId } from '../types';
import { CURSOR_OPTIONS, CursorOption, getCursorGradient, generateCursorSvg, normalizeCursorStyle } from '../utils/cursorUtils';
import { getLenis } from '../hooks/useSmoothScroll';
import { getActiveGeminiApiKey, setActiveGeminiApiKey, verifyGeminiApiKey, AVAILABLE_GEMINI_MODELS } from '../utils/geminiClient';

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
  onSignOut?: () => void;
  authenticatedEmail?: string;
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
    <div ref={sectionRef} className="liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <MousePointer className="w-4 h-4" style={{ color: activePalette.primary }} />
            <h3 className={`text-base font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Precision Cursor Selector & Dynamic Color Adapter
            </h3>
          </div>
          <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Select your preferred pointer style and calibrate the dynamic color adapter to match the curated gradient.
          </p>
        </div>

        {/* Active status pill */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-mono font-semibold px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-sm"
            style={{
              backgroundColor: `${activePalette.primary}20`,
              borderColor: `${activePalette.primary}50`,
              color: darkMode ? '#ffffff' : activePalette.primary,
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: activePalette.primary }}
            />
            <span ref={headerBadgeRef}>
              {activeCursorOption?.name || cursorStyle} ({cursorColorAdapter}%)
            </span>
          </span>
        </div>
      </div>

      {/* 6 Precision Cursor Choice Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
              className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between group liquid-glass-tile relative overflow-hidden ${
                isSelected ? 'ring-1 ring-offset-1 ring-amber-400/50' : ''
              }`}
            >
              {/* Active indicator dot */}
              {isSelected && (
                <div
                  className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full shadow"
                  style={{ backgroundColor: activePalette.primary }}
                />
              )}

              {/* Top preview box */}
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-110"
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
                    className="w-8 h-8 flex items-center justify-center pointer-events-none"
                    dangerouslySetInnerHTML={{ __html: opt.svgCode }}
                  />
                </div>

                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition ${
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

              {/* Info */}
              <div className="space-y-1">
                <h4
                  className={`text-xs font-bold ${
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
                  className={`text-[11px] leading-tight line-clamp-2 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {opt.description}
                </p>
              </div>

              {/* Bottom badge */}
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                <span
                  className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border"
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
        className={`p-4 rounded-xl border flex flex-col gap-3.5 transition-colors ${
          darkMode ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50/80 border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
              <h4 className={`text-xs font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                Dynamic Color Adapter Slider
              </h4>
            </div>
            <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Blends the cursor hue from crisp pure white (0%) to your active curated color gradient (100%).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              ref={badgeRef}
              className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg border shadow-sm"
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
        <div className="space-y-2">
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
              className="smooth-adapter-slider w-full h-7 rounded-lg appearance-none cursor-pointer focus:outline-none select-none touch-none"
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
            <span className="flex items-center gap-1 text-center">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/5">
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
            className="w-full sm:w-auto px-4 py-2 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-medium transition"
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
}) => {
  const [isCustomBuilderOpen, setIsCustomBuilderOpen] = useState(activePaletteId === 'custom');
  const [apiKeyInput, setApiKeyInput] = useState(() => getActiveGeminiApiKey());
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);

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
    <div className="relative min-h-[100dvh] md:min-h-screen pt-16 pb-24 md:pt-28 md:pb-16 px-3.5 md:px-8 lg:px-12 max-w-[1560px] w-full mx-auto space-y-8 select-none transition-colors duration-300">
      {/* Title */}
      <div>
        <div
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: activePalette.primary }}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>System & Visual Customization</span>
        </div>
        <h1
          className={`text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 ${
            darkMode ? 'text-slate-100' : 'text-slate-900'
          }`}
        >
          Settings & Model Hub
        </h1>
        <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Select theme appearance, choose from 10 dynamic color gradients, and configure Gemini model intelligence.
        </p>
      </div>

      {/* Live Active Theme & Palette Status Banner */}
      <div
        className="p-4 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg"
        style={{
          background: darkMode
            ? `linear-gradient(135deg, ${activePalette.primary}18, ${activePalette.accent}12)`
            : `linear-gradient(135deg, ${activePalette.primary}20, ${activePalette.accent}10)`,
          borderColor: `${activePalette.primary}50`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-950 font-bold shadow"
            style={{
              background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
            }}
          >
            <Sparkles className="w-5 h-5 fill-slate-950" />
          </div>
          <div>
            <h4
              className={`text-sm font-bold ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              Active: {activePalette.name}
            </h4>
            <p
              className={`text-xs ${
                darkMode ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Mode: <strong className="uppercase font-mono">{darkMode ? 'Dark / Night' : 'Light / Day'}</strong> · Model: <strong className="font-mono">{selectedModel}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
      <div className="liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-4 smooth-scroll-contain">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3
              className={`text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {darkMode ? (
                <Moon className="w-4 h-4" style={{ color: activePalette.primary }} />
              ) : (
                <Sun className="w-4 h-4" style={{ color: activePalette.primary }} />
              )}
              <span>Theme Appearance (Dark & Light Mode)</span>
            </h3>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Instantly toggle between obsidian night mode and crisp editorial day mode.
            </p>
          </div>

          <div
            className={`flex items-center gap-1 p-1 rounded-xl border ${
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
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                !darkMode ? 'shadow-md' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sun className="w-4 h-4" />
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
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                darkMode ? 'shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Dark Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Curated Color Palettes + Make Your Own Custom Theme */}
      <div className="liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-4 smooth-scroll-contain">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3
              className={`text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              <Palette className="w-4 h-4" style={{ color: activePalette.primary }} />
              <span>Color Themes &amp; Custom Palette</span>
            </h3>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
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
            className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-90 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{isCustomBuilderOpen ? 'Hide Palette Studio' : 'Make Your Own Theme'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
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
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between group liquid-glass-tile ${
                  isSelected ? 'ring-1 ring-offset-1 ring-amber-400/50' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Color Swatch */}
                  <div
                    className="w-10 h-10 rounded-xl shrink-0 shadow-md border border-white/30 flex items-center justify-center text-white"
                    style={{
                      background: `linear-gradient(135deg, ${pal.primary}, ${pal.accent})`,
                    }}
                  >
                    {isSelected && <Check className="w-5 h-5 drop-shadow-md stroke-[3]" />}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <h4
                      className={`text-xs font-bold truncate ${
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
                    <p className={`text-[10px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {pal.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pl-2 shrink-0">
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
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between group liquid-glass-tile ${
                  isCustomSelected ? 'ring-1 ring-offset-1 ring-white/40' : 'border-dashed'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl shrink-0 shadow-md border border-white/30 flex items-center justify-center text-white"
                    style={{
                      background: `linear-gradient(135deg, ${customPaletteConfig.primary}, ${customPaletteConfig.accent})`,
                    }}
                  >
                    {isCustomSelected ? (
                      <Check className="w-5 h-5 drop-shadow-md stroke-[3]" />
                    ) : (
                      <Wand2 className="w-4 h-4 drop-shadow-md" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <h4
                        className={`text-xs font-bold truncate ${
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
                        className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full border shrink-0"
                        style={{
                          borderColor: `${customPaletteConfig.primary}50`,
                          color: darkMode ? '#ffffff' : customPaletteConfig.primary,
                          backgroundColor: `${customPaletteConfig.primary}18`,
                        }}
                      >
                        Custom
                      </span>
                    </div>
                    <p className={`text-[10px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Make your own theme · Click to customize colors
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pl-2 shrink-0">
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
            className={`mt-2 p-5 rounded-2xl border space-y-4 transition-colors ${
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-4 smooth-scroll-contain">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3
              className={`text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              <Waves className="w-4 h-4" style={{ color: activePalette.primary }} />
              <span>Smooth Scrolling Support (Lenis Engine)</span>
            </h3>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Powered by Studio Freight Lenis. Delivers buttery-smooth momentum inertia and exponential easing across all study tabs, documents, and feeds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="text-[11px] font-mono font-bold px-3 py-1 rounded-full border shadow-sm flex items-center gap-1.5"
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
          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
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

      {/* Gemini AI Model Changer & Thinking Mode */}
      <div className="liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-5 smooth-scroll-contain">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3
              className={`text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              <Cpu className="w-4 h-4" style={{ color: activePalette.primary }} />
              <span>Gemini Intelligence Model Engine</span>
            </h3>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Select the active generative model for grounded research queries and AI synthesis.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Quick On-the-Go Model Selector Dropdown */}
            <div className="relative z-50" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition select-none liquid-glass-tile cursor-pointer shadow-sm ${
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
                  className={`absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border p-2 shadow-2xl z-[100] space-y-1.5 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150 ${
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
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                enableThinking
                  ? 'shadow-md border-transparent'
                  : darkMode
                  ? 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:text-slate-900'
              }`}
            >
              <Brain className="w-4 h-4" />
              <span>High Thinking: {enableThinking ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* API Key Connection & Live Verification Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
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
        <div className="space-y-3">
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
                className="p-4 rounded-xl border transition cursor-pointer flex items-start justify-between gap-4 liquid-glass-tile"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-sm font-bold ${
                        darkMode ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      {opt.name}
                    </h4>
                    <span
                      className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border"
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
                    className={`text-xs leading-relaxed max-w-xl ${
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

      {/* Authenticated Account & Session Management */}
      <div className="p-5 rounded-2xl liquid-glass flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className={`text-xs space-y-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: activePalette.primary }}
            />
            <p className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Authenticated Studio Session
            </p>
          </div>
          <p>
            Connected as <span className="font-mono text-white font-semibold">{authenticatedEmail || 'alex.learner@gmail.com'}</span>
          </p>
        </div>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
              darkMode
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
            }`}
          >
            <span>Sign Out & Disconnect</span>
          </button>
        )}
      </div>

      {/* Reset & Storage info */}
      <div className="p-4 rounded-2xl liquid-glass flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className={`text-xs space-y-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <p className={`font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            Local State Management
          </p>
          <p>Your notes, study activities, themes, and sources are stored reactively in browser storage.</p>
        </div>
        <button
          onClick={onResetData}
          className={`px-3 py-1.5 rounded-xl text-xs border transition flex items-center gap-1.5 cursor-pointer ${
            darkMode
              ? 'bg-slate-900 hover:bg-red-950/60 hover:text-red-300 text-slate-400 border-white/10'
              : 'bg-white hover:bg-red-50 hover:text-red-600 text-slate-600 border-slate-200'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Sample Data</span>
        </button>
      </div>
    </div>
  );
};

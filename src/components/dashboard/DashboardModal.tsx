import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { ColorPalette } from '../../types';
import { LiquidGlassSvgFilter } from '../LiquidGlassFilter';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  activePalette: ColorPalette;
  darkMode: boolean;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  activePalette,
  darkMode,
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  const pointerRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (pointerRafRef.current) cancelAnimationFrame(pointerRafRef.current);
    };
  }, []);

  const handleTilePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (!pointerRafRef.current) {
      pointerRafRef.current = requestAnimationFrame(() => {
        pointerRafRef.current = null;
        const rect = el.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const ratio = Math.max(0, Math.min(1, x / (rect.width || 1)));
        el.style.setProperty('--pointer-x', `${Math.round(x)}px`);
        el.style.setProperty('--pointer-y', `${Math.round(y)}px`);
        el.style.setProperty('--pointer-ratio', `${Math.round(ratio * 1000) / 1000}`);
      });
    }
  };

  const handleTilePointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    if (pointerRafRef.current) {
      cancelAnimationFrame(pointerRafRef.current);
      pointerRafRef.current = null;
    }
    const el = e.currentTarget;
    el.style.setProperty('--pointer-x', '-999px');
    el.style.setProperty('--pointer-y', '-999px');
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          data-lenis-prevent
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-8 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* SVG Chromatic Aberration & Liquid Glass Filter */}
          <LiquidGlassSvgFilter />

          {/* Full-page frosted backdrop covering 100% of viewport including header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-md cursor-pointer"
            aria-hidden="true"
          />

          {/* Floating Glass Panel matching Workspace Studio & Gemini Neural Assistant */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{
              scale: { type: 'spring', stiffness: 380, damping: 28 },
              y: { type: 'spring', stiffness: 380, damping: 28 },
              opacity: { duration: 0.22, ease: 'easeOut' },
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerMove={handleTilePointerMove}
            onPointerLeave={handleTilePointerLeave}
            data-lenis-prevent
            className={`creation-frost-panel floating-gemini-tile no-lift no-tilt relative z-10 w-full ${maxWidthClass} max-h-[88vh] my-auto flex flex-col overflow-hidden rounded-3xl border shadow-2xl transition-[box-shadow,border-color,background-color] duration-300 ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
            style={{
              borderColor: `${activePalette.primary}55`,
              boxShadow: `0 24px 64px -12px rgba(0,0,0,0.65), 0 0 32px ${activePalette.primary}22`,
              willChange: 'transform, opacity',
              transform: 'translateZ(0)',
            }}
          >
            {/* Liquid Glass Chromatic Filter Layer (strictly positioned behind content) */}
            <div
              className="liquidglass pointer-events-none absolute inset-0 z-0"
              style={{ opacity: 0.45 }}
              aria-hidden="true"
            />

            {/* Studio / Assistant Tinted Glass Header */}
            <div
              className={`px-6 py-4 flex items-center justify-between gap-4 relative z-10 shrink-0 ${
                darkMode
                  ? 'border-b border-white/10 bg-white/[0.04]'
                  : 'border-b border-slate-200/70 bg-white/45'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {icon && (
                  <div
                    className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm"
                    style={{
                      backgroundColor: `${activePalette.primary}20`,
                      borderColor: `${activePalette.primary}40`,
                    }}
                  >
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  <h3
                    className={`text-base sm:text-lg font-bold truncate ${
                      darkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    {title}
                  </h3>
                  {subtitle && (
                    <p
                      className={`text-xs mt-0.5 truncate ${
                        darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-xl transition shrink-0 cursor-pointer ${
                  darkMode
                    ? 'text-slate-400 hover:text-white hover:bg-white/10'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div
              data-lenis-prevent
              className="p-6 relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4"
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

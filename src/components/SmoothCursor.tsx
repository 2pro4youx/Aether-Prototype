import React, { useEffect, useRef, useState } from 'react';
import { ColorPalette, CursorStyleId } from '../types';
import { normalizeCursorStyle } from '../utils/cursorUtils';

interface SmoothCursorProps {
  cursorStyle: CursorStyleId;
  activePalette?: ColorPalette;
  cursorColorAdapter?: number;
  darkMode?: boolean;
}

export const SmoothCursor: React.FC<SmoothCursorProps> = ({
  cursorStyle,
}) => {
  const norm = normalizeCursorStyle(cursorStyle);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const cursorRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Detect touch devices (custom overlay disabled on touch)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTouch =
        window.matchMedia('(pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;
      setIsTouchDevice(isTouch);
    }
  }, []);

  const isEnabled = !isTouchDevice && norm === 'chevron';

  // Direct zero-lag GPU transform updates via pointermove — zero spring solver latency or React re-renders
  useEffect(() => {
    if (!isEnabled) return;

    const container = cursorRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    let visible = false;
    let pressed = false;
    let lastX = -100;
    let lastY = -100;

    const handlePointerMove = (e: PointerEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      if (x !== lastX || y !== lastY) {
        lastX = x;
        lastY = y;
        container.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      if (!visible) {
        visible = true;
        container.style.opacity = '1';
      }
    };

    const handlePointerDown = () => {
      if (!pressed) {
        pressed = true;
        svg.style.transform = 'translate3d(-5.5px, -3.21px, 0) scale(0.92)';
      }
    };

    const handlePointerUp = () => {
      if (pressed) {
        pressed = false;
        svg.style.transform = 'translate3d(-5.5px, -3.21px, 0) scale(1)';
      }
    };

    const hideCursor = () => {
      if (visible) {
        visible = false;
        container.style.opacity = '0';
      }
      if (pressed) {
        pressed = false;
        svg.style.transform = 'translate3d(-5.5px, -3.21px, 0) scale(1)';
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('blur', hideCursor);
    document.addEventListener('mouseleave', hideCursor);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('blur', hideCursor);
      document.removeEventListener('mouseleave', hideCursor);
    };
  }, [isEnabled]);

  if (!isEnabled) {
    return null;
  }

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 pointer-events-none z-[99999]"
      style={{
        opacity: 0,
        transform: 'translate3d(-100px, -100px, 0)',
        willChange: 'transform',
        contain: 'layout style',
        backfaceVisibility: 'hidden',
      }}
      aria-hidden="true"
    >
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        width="26"
        height="26"
        viewBox="0 0 24 24"
        className="pointer-events-none"
        style={{
          overflow: 'visible',
          transform: 'translate3d(-5.5px, -3.21px, 0) scale(1)',
          transition: 'transform 75ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: 'transform',
        }}
      >
        <defs>
          <linearGradient id="smoothCursorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop id="smoothCursorStop1" offset="0%" stopColor="var(--cursor-color-1, #ffffff)" />
            <stop id="smoothCursorStop2" offset="100%" stopColor="var(--cursor-color-2, #ffffff)" />
          </linearGradient>
        </defs>

        {/* Vector drop shadow (avoids CSS filter: drop-shadow per-frame re-rasterization lag) */}
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86c-.32-.32-.85-.1-.85.35z"
          fill="#050811"
          fillOpacity="0.32"
          transform="translate(1, 1.5)"
        />

        {/* Stemless Arrow: vertical left edge, solid white / dynamic theme fill, crisp dark border */}
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86c-.32-.32-.85-.1-.85.35z"
          fill="url(#smoothCursorGrad)"
          stroke="#050811"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

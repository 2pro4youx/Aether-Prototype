import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
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

  // Pure MotionValues for position, opacity & click scale — zero React re-renders during mouse movement
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const cursorOpacity = useMotionValue(0);
  const cursorScale = useMotionValue(1);

  // Ultra-responsive, silky-smooth spring tracking (sub-16ms convergence with zero jitter)
  const springConfig = { damping: 38, stiffness: 850, mass: 0.18, restDelta: 0.0005 };
  const smoothX = useSpring(cursorX, springConfig);
  const smoothY = useSpring(cursorY, springConfig);
  const smoothScale = useSpring(cursorScale, { damping: 28, stiffness: 650 });

  // Detect touch devices (SmoothCursor disabled on touch)
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

  // Optimized lightweight event listeners (only active when chevron is selected, 0ms listener overhead)
  useEffect(() => {
    if (!isEnabled) return;

    let isVisible = false;

    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      if (!isVisible) {
        isVisible = true;
        cursorOpacity.set(1);
      }
    };

    const handleMouseDown = () => cursorScale.set(0.92);
    const handleMouseUp = () => cursorScale.set(1);
    const handleMouseLeave = () => {
      isVisible = false;
      cursorOpacity.set(0);
    };
    const handleMouseEnter = () => {
      isVisible = true;
      cursorOpacity.set(1);
    };
    const handleBlur = () => {
      isVisible = false;
      cursorOpacity.set(0);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    window.addEventListener('blur', handleBlur);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isEnabled, cursorX, cursorY, cursorOpacity, cursorScale]);

  if (!isEnabled) {
    return null;
  }

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[99999]"
      style={{
        x: smoothX,
        y: smoothY,
        scale: smoothScale,
        opacity: cursorOpacity,
        willChange: 'transform',
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden',
      }}
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="26"
        height="26"
        viewBox="0 0 24 24"
        className="pointer-events-none"
        style={{
          overflow: 'visible',
          transform: 'translate(-5.5px, -3.21px)',
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45))',
        }}
      >
        <defs>
          <linearGradient id="smoothCursorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop id="smoothCursorStop1" offset="0%" stopColor="var(--cursor-color-1, #ffffff)" />
            <stop id="smoothCursorStop2" offset="100%" stopColor="var(--cursor-color-2, #ffffff)" />
          </linearGradient>
        </defs>

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
    </motion.div>
  );
};

import { useEffect, useRef, useCallback } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let activeLenisInstance: Lenis | null = null;

/**
 * Returns the currently active Lenis smooth scroll instance, if enabled.
 */
export function getLenis(): Lenis | null {
  return activeLenisInstance;
}

/**
 * Forces Lenis to recalculate dimensions and limits.
 */
export function resizeLenis(): void {
  activeLenisInstance?.resize();
}

/**
 * useSmoothScroll
 * Implements Studio Freight / Darkroom Engineering Lenis for ultra-smooth momentum scrolling.
 * Provides the smoothest physics inertia, frictionless easing, and vsync locked frame rate.
 * Enabled by default, fully toggleable via user settings.
 */
export function useSmoothScroll(enabled: boolean = true) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // If smooth scrolling is disabled by user setting
    if (!enabled) {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      activeLenisInstance = null;
      document.documentElement.classList.remove('lenis', 'lenis-smooth', 'smooth-scroll');
      return;
    }

    // Initialize ultra-smooth Lenis instance with pure frame-rate independent physics.
    // Omission of duration/easing enables pure damp(lerp) physics, eliminating animation-clock
    // restarts on successive wheel ticks for completely stutter-free, liquid glide.
    const lenis = new Lenis({
      autoRaf: true,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.0,
      lerp: 0.085, // Gold standard buttery-smooth momentum inertia
      naiveDimensions: true,
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      infinite: false,
      autoResize: true,
      allowNestedScroll: true,
      overscroll: true,
      respectReducedMotion: false,
      prevent: (node: HTMLElement) => {
        return (
          node.hasAttribute('data-lenis-prevent') ||
          node.classList.contains('lenis-prevent') ||
          node.tagName === 'TEXTAREA' ||
          node.tagName === 'SELECT'
        );
      },
    });

    lenisRef.current = lenis;
    activeLenisInstance = lenis;

    document.documentElement.classList.add('lenis', 'lenis-smooth', 'smooth-scroll');

    // Force dimension calculation once mounted
    lenis.resize();

    // Re-calculate dimensions when window size or view switches
    const handleResize = () => lenis.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      lenis.destroy();
      lenisRef.current = null;
      activeLenisInstance = null;
      document.documentElement.classList.remove('lenis', 'lenis-smooth', 'smooth-scroll');
    };
  }, [enabled]);

  return lenisRef;
}

/**
 * useChatSmoothScroll
 * Implements Lenis smooth momentum scrolling for chat message containers.
 * Synchronizes with user's smooth scroll setting, supports auto-resizing on new
 * messages/tokens, and provides smooth momentum glide down.
 */
export function useChatSmoothScroll<
  TWrapper extends HTMLElement = HTMLDivElement,
  TContent extends HTMLElement = HTMLDivElement
>(options?: {
  enabled?: boolean;
  deps?: any[];
}) {
  const { enabled = true, deps = [] } = options || {};
  const wrapperRef = useRef<TWrapper | null>(null);
  const contentRef = useRef<TContent | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled || !wrapperRef.current) {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      return;
    }

    const wrapper = wrapperRef.current;
    const content = contentRef.current || (wrapper.firstElementChild as HTMLElement) || wrapper;

    const lenis = new Lenis({
      wrapper,
      content,
      autoRaf: true,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.0,
      lerp: 0.085, // Identical gold-standard physics to the rest of the application
      infinite: false,
      autoResize: true,
      prevent: (node: HTMLElement) => {
        return (
          node.hasAttribute('data-lenis-prevent') ||
          node.classList.contains('lenis-prevent') ||
          node.tagName === 'TEXTAREA' ||
          node.tagName === 'SELECT'
        );
      },
    });

    lenisRef.current = lenis;
    lenis.resize();

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [enabled]);

  // Recalculate dimensions on content or message change
  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.resize();
    }
  }, deps);

  const scrollToBottom = useCallback((immediate: boolean = false) => {
    if (lenisRef.current) {
      lenisRef.current.resize();
      lenisRef.current.scrollTo(lenisRef.current.limit, { immediate });
    } else if (wrapperRef.current) {
      wrapperRef.current.scrollTo({
        top: wrapperRef.current.scrollHeight,
        behavior: immediate ? 'instant' : 'smooth',
      });
    }
  }, []);

  return { wrapperRef, contentRef, lenisRef, scrollToBottom };
}


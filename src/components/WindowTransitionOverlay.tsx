import React, { useEffect, useRef, useState } from 'react';

interface WindowTransitionOverlayProps {
  activeTab: string;
  isOneNoteOpen: boolean;
  isGeminiWorkspaceOpen: boolean;
  activeWorkspaceId: string;
  transitionNonce: number;
}

type TransitionVariant = 'window' | 'onenote' | 'gemini';

interface ActiveEffect {
  key: number;
  variant: TransitionVariant;
}

/**
 * Isolated window/workspace transition sheen overlay.
 * Runs locally without re-rendering <App /> and unmounts itself on animation completion
 * so zero inactive overlay layers remain in the DOM.
 */
export const WindowTransitionOverlay: React.FC<WindowTransitionOverlayProps> = React.memo(
  ({ activeTab, isOneNoteOpen, isGeminiWorkspaceOpen, activeWorkspaceId, transitionNonce }) => {
    const [effect, setEffect] = useState<ActiveEffect | null>(null);
    const counterRef = useRef(0);
    const prevRef = useRef({
      mounted: false,
      activeTab,
      isOneNoteOpen,
      isGeminiWorkspaceOpen,
      activeWorkspaceId,
      transitionNonce,
    });

    useEffect(() => {
      const prev = prevRef.current;
      if (!prev.mounted) {
        prevRef.current = {
          mounted: true,
          activeTab,
          isOneNoteOpen,
          isGeminiWorkspaceOpen,
          activeWorkspaceId,
          transitionNonce,
        };
        return;
      }

      const tabChanged = prev.activeTab !== activeTab;
      const enteredOneNote = isOneNoteOpen && !prev.isOneNoteOpen;
      const exitedOneNote = !isOneNoteOpen && prev.isOneNoteOpen;
      const enteredGemini = isGeminiWorkspaceOpen && !prev.isGeminiWorkspaceOpen;
      const exitedGemini = !isGeminiWorkspaceOpen && prev.isGeminiWorkspaceOpen;
      const workspaceChanged = prev.activeWorkspaceId !== activeWorkspaceId;
      const nonceChanged = prev.transitionNonce !== transitionNonce;

      prevRef.current = {
        mounted: true,
        activeTab,
        isOneNoteOpen,
        isGeminiWorkspaceOpen,
        activeWorkspaceId,
        transitionNonce,
      };

      if (enteredOneNote) {
        setEffect({ key: ++counterRef.current, variant: 'onenote' });
      } else if (enteredGemini) {
        setEffect({ key: ++counterRef.current, variant: 'gemini' });
      } else if (
        tabChanged ||
        exitedOneNote ||
        exitedGemini ||
        workspaceChanged ||
        nonceChanged
      ) {
        setEffect({ key: ++counterRef.current, variant: 'window' });
      }
    }, [activeTab, isOneNoteOpen, isGeminiWorkspaceOpen, activeWorkspaceId, transitionNonce]);

    // Safety cleanup if CSS animations are reduced/disabled by OS accessibility settings
    useEffect(() => {
      if (!effect) return;
      const activeKey = effect.key;
      const timer = window.setTimeout(() => {
        setEffect((cur) => (cur?.key === activeKey ? null : cur));
      }, 560);
      return () => window.clearTimeout(timer);
    }, [effect]);

    if (!effect) return null;

    const className =
      effect.variant === 'onenote'
        ? 'onenote-enter-frost-sweep'
        : effect.variant === 'gemini'
        ? 'onenote-enter-frost-sweep gemini-enter-frost-sweep'
        : 'fullscreen-frost-sweep';

    return (
      <div
        key={`window-fx-${effect.key}`}
        className={className}
        aria-hidden="true"
        onAnimationEnd={() => {
          const activeKey = effect.key;
          setEffect((cur) => (cur?.key === activeKey ? null : cur));
        }}
      />
    );
  }
);

WindowTransitionOverlay.displayName = 'WindowTransitionOverlay';

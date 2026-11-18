// Shared, pre-allocated motion presets for Dashboard card items
// Uses `layout="position"` (GPU translate3d only) + AnimatePresence `mode="popLayout"`
// so removed items blur out while sibling items immediately glide into place with spring physics.

export const CARD_ITEM_INITIAL = {
  opacity: 0,
  filter: 'blur(8px)',
  scale: 0.97,
  y: 6,
} as const;

export const CARD_ITEM_ANIMATE = {
  opacity: 1,
  filter: 'blur(0px)',
  scale: 1,
  y: 0,
} as const;

export const CARD_ITEM_EXIT = {
  opacity: 0,
  filter: 'blur(10px)',
  scale: 0.94,
  y: -4,
  transition: {
    duration: 0.22,
    ease: [0.22, 1, 0.36, 1] as const,
  },
} as const;

export const CARD_ITEM_TRANSITION = {
  layout: {
    type: 'spring' as const,
    stiffness: 460,
    damping: 34,
    mass: 0.72,
  },
  opacity: {
    duration: 0.2,
    ease: [0.22, 1, 0.36, 1] as const,
  },
  filter: {
    duration: 0.22,
    ease: [0.22, 1, 0.36, 1] as const,
  },
  scale: {
    type: 'spring' as const,
    stiffness: 460,
    damping: 32,
    mass: 0.7,
  },
  y: {
    type: 'spring' as const,
    stiffness: 460,
    damping: 32,
    mass: 0.7,
  },
} as const;

export const CARD_CHIP_INITIAL = {
  opacity: 0,
  filter: 'blur(6px)',
  scale: 0.9,
} as const;

export const CARD_CHIP_ANIMATE = {
  opacity: 1,
  filter: 'blur(0px)',
  scale: 1,
} as const;

export const CARD_CHIP_EXIT = {
  opacity: 0,
  filter: 'blur(8px)',
  scale: 0.88,
  transition: {
    duration: 0.18,
    ease: [0.22, 1, 0.36, 1] as const,
  },
} as const;

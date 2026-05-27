/** Landing-specific motion — diary archive beats and hotspots */

export const spreadHotspot = {
  rest: { scale: 1, opacity: 0.92 },
  hover: { scale: 1.06, opacity: 1 },
  tap: { scale: 0.98 },
}

export const spreadFloat = {
  animate: { y: [0, -4, 0] },
  transition: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
}

export const beatReveal = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
  },
}

export const beatVisualReveal = {
  hidden: { opacity: 0, x: 32, scale: 0.98 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.08 },
  },
}

export const beatVisualRevealLeft = {
  hidden: { opacity: 0, x: -32, scale: 0.98 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.08 },
  },
}

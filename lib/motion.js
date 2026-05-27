/** Shared motion tokens — fluid, weighty easing inspired by golden-hour calm */

export const spring = {
  gentle: { type: 'spring', stiffness: 85, damping: 22, mass: 1.05 },
  snappy: { type: 'spring', stiffness: 180, damping: 26, mass: 0.85 },
  float: { type: 'spring', stiffness: 55, damping: 18, mass: 1.25 },
  page: { type: 'spring', stiffness: 72, damping: 24, mass: 1.15 },
  breath: { type: 'spring', stiffness: 48, damping: 16, mass: 1.35 },
  modal: { type: 'spring', stiffness: 110, damping: 24, mass: 0.95 },
}

export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.45, 0, 0.2, 1],
  drift: [0.37, 0, 0.2, 1],
}

export const fadeUp = {
  initial: { opacity: 0, y: 28, scale: 0.97, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -14, scale: 0.985, filter: 'blur(6px)' },
}

export const stagger = {
  container: {
    initial: {},
    animate: { transition: { staggerChildren: 0.09, delayChildren: 0.06 } },
  },
  item: {
    initial: { opacity: 0, y: 24, filter: 'blur(6px)' },
    animate: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { ...spring.gentle, opacity: { duration: 0.5 } },
    },
  },
}

export const pageTransition = {
  initial: { opacity: 0, y: 24, scale: 0.988, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { ...spring.page, opacity: { duration: 0.45 } },
  },
  exit: {
    opacity: 0,
    y: -16,
    scale: 0.992,
    filter: 'blur(4px)',
    transition: { duration: 0.32, ease: ease.out },
  },
}

export const hoverLift = {
  whileHover: {
    y: -3,
    scale: 1.008,
    transition: spring.breath,
  },
  whileTap: {
    scale: 0.988,
    y: 0,
    transition: spring.snappy,
  },
}

export const hoverGlow = {
  whileHover: {
    y: -2,
    scale: 1.006,
    transition: spring.breath,
  },
  whileTap: {
    scale: 0.99,
    transition: spring.snappy,
  },
}

export const floatLoop = (duration = 6, distance = 6) => ({
  animate: { y: [0, -distance, 0] },
  transition: { duration, repeat: Infinity, ease: ease.inOut },
})

/** Moon story — gentle vertical drift */
export const moonFloat = {
  animate: { y: [0, -8, 0] },
  transition: { duration: 14, repeat: Infinity, ease: ease.inOut },
}

export const moonGlowPulse = {
  animate: {
    opacity: [0.5, 0.82, 0.5],
    scale: [1, 1.05, 1],
  },
  transition: { duration: 8, repeat: Infinity, ease: ease.inOut },
}

/** Notebook opening entrance — scales and fades in from slightly small */
export const notebookOpen = {
  initial: { opacity: 0, scale: 0.88, y: 40, filter: 'blur(12px)' },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { ...spring.float, opacity: { duration: 0.6 } },
  },
}

/** SVG ink-draw variant — path draws itself in */
export const inkDraw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (delay = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { delay, duration: 1.4, ease: ease.out },
      opacity: { delay, duration: 0.3 },
    },
  }),
}

/** Stagger container for scroll-triggered chapter reveals */
export const chapterStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
}

/** Short supportive copy beats (hero, moon, features) */
export const journeyBeat = {
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { ...spring.gentle, opacity: { duration: 0.5 } },
  },
}

/** Individual item inside a chapter stagger */
export const chapterItem = {
  hidden: { opacity: 0, y: 32, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { ...spring.gentle, opacity: { duration: 0.5 } },
  },
}

/** Chat bubble entrance for the chat chapter */
export const bubbleEntrance = {
  hidden: { opacity: 0, scale: 0.88, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...spring.snappy, delay: i * 0.18 },
  }),
}

/** Sticky note fan-out for the quotes chapter */
export const noteFanOut = {
  hidden: { opacity: 0, scale: 0.85, rotate: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    rotate: [-8, -4, 2, 5, -3][i % 5],
    transition: { ...spring.breath, delay: i * 0.1 },
  }),
}

/** Feature panel slides in from the right */
export const panelSlideRight = {
  hidden: { opacity: 0, x: 80, filter: 'blur(12px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { ...spring.float, opacity: { duration: 0.55 } },
  },
  exit: {
    opacity: 0,
    x: -40,
    filter: 'blur(8px)',
    transition: { duration: 0.4, ease: [0.45, 0, 0.2, 1] },
  },
}

/** Feature panel slides in from the left */
export const panelSlideLeft = {
  hidden: { opacity: 0, x: -80, filter: 'blur(12px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { ...spring.float, opacity: { duration: 0.55 } },
  },
  exit: {
    opacity: 0,
    x: 40,
    filter: 'blur(8px)',
    transition: { duration: 0.4, ease: [0.45, 0, 0.2, 1] },
  },
}

/** Panel fades up from below — used for CTA */
export const panelRise = {
  hidden: { opacity: 0, y: 60, scale: 0.94, filter: 'blur(14px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { ...spring.float, opacity: { duration: 0.6 } },
  },
}

/** Cinematic darkness-lifts reveal — used for the hero scene entry */
export const sceneReveal = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 2.2, ease: [0.22, 1, 0.36, 1] },
  },
}

/** Journal page drawer — paper slide from right */
export const journalPageReveal = {
  hidden: {
    x: '102%',
    rotateY: -6,
    transformPerspective: 1200,
    transformOrigin: 'right center',
  },
  visible: {
    x: 0,
    rotateY: 0,
    transition: { ...spring.modal, rotateY: { duration: 0.5, ease: ease.out } },
  },
  exit: {
    x: '102%',
    rotateY: -4,
    transition: { duration: 0.38, ease: ease.out },
  },
}

/** Drawer content after page lands */
export const journalContentStagger = {
  container: {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.09, delayChildren: 0.22 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { ...spring.gentle, opacity: { duration: 0.4 } },
    },
  },
}

/** @deprecated use journalPageReveal */
export const drawerReveal = journalPageReveal

/** Staggered links inside journal drawer */
export const drawerLinkStagger = journalContentStagger

/** Scroll-triggered landing section reveal */
export const sectionReveal = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...spring.float, opacity: { duration: 0.6 } },
  },
}

/** Hero copy stagger container */
export const heroStagger = {
  container: {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.12, delayChildren: 0.08 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { ...spring.gentle, opacity: { duration: 0.55 } },
    },
  },
}

/** Individual firefly / particle float loop (for non-Framer usage) */
export const particleFloat = (dy = -40, dx = 8, dur = 8) => ({
  animate: {
    y: [0, dy * 0.4, dy, dy * 0.5, 0],
    x: [0, dx * 0.5, dx, dx * 0.3, 0],
    opacity: [0, 0.85, 0.6, 0.9, 0],
  },
  transition: { duration: dur, repeat: Infinity, ease: 'easeInOut' },
})

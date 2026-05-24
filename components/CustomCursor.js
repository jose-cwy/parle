import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/**
 * Candle-flame custom cursor for desktop.
 * Hides on touch devices and falls back gracefully.
 */
export default function CustomCursor() {
  const [visible, setVisible] = useState(false)
  const [isPointer, setIsPointer] = useState(false)
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)

  const springX = useSpring(cursorX, { stiffness: 160, damping: 28, mass: 0.6 })
  const springY = useSpring(cursorY, { stiffness: 160, damping: 28, mass: 0.6 })

  useEffect(() => {
    /* Only activate on pointer: fine (mouse/trackpad) */
    const mq = window.matchMedia('(pointer: fine)')
    if (!mq.matches) return

    document.body.classList.add('cinematic-cursor')
    setVisible(true)

    const onMove = (e) => {
      cursorX.set(e.clientX - 10)
      cursorY.set(e.clientY - 20)
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (el) {
        const style = window.getComputedStyle(el).cursor
        setIsPointer(style === 'pointer')
      }
    }

    const onLeave = () => setVisible(false)
    const onEnter = () => setVisible(true)

    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)
    document.documentElement.addEventListener('mouseenter', onEnter)

    return () => {
      document.body.classList.remove('cinematic-cursor')
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      document.documentElement.removeEventListener('mouseenter', onEnter)
    }
  }, [cursorX, cursorY])

  if (!visible) return null

  return (
    <motion.div
      style={{
        position: 'fixed',
        left: springX,
        top: springY,
        zIndex: 9999,
        pointerEvents: 'none',
        width: 20,
        height: 28,
      }}
      animate={{ scale: isPointer ? 1.4 : 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <svg
        width="20"
        height="28"
        viewBox="0 0 20 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="flame-glow" cx="50%" cy="80%" r="60%">
            <stop offset="0%" stopColor="#fff8c0" />
            <stop offset="40%" stopColor="#ffb030" />
            <stop offset="100%" stopColor="#e05010" stopOpacity="0" />
          </radialGradient>
          <filter id="flame-blur">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Glow halo */}
        <ellipse cx="10" cy="14" rx="12" ry="16" fill="rgba(255,160,40,0.18)" filter="url(#flame-blur)" />

        {/* Outer flame */}
        <motion.path
          d="M10,26 C6,26 2,22 2,16 C2,10 6,6 10,2 C14,6 18,10 18,16 C18,22 14,26 10,26 Z"
          fill="url(#flame-glow)"
          animate={{
            d: [
              'M10,26 C6,26 2,22 2,16 C2,10 6,6 10,2 C14,6 18,10 18,16 C18,22 14,26 10,26 Z',
              'M10,26 C5,26 2,21 3,15 C4,9 7,5 10,1 C13,5 16,9 17,15 C18,21 15,26 10,26 Z',
              'M10,26 C6,26 1,22 2,16 C3,10 7,6 10,2 C13,6 17,10 18,16 C19,22 14,26 10,26 Z',
            ],
          }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Inner bright core */}
        <motion.path
          d="M10,24 C8,24 6,21 6,18 C6,14 8,11 10,8 C12,11 14,14 14,18 C14,21 12,24 10,24 Z"
          fill="#fff5a0"
          opacity="0.85"
          animate={{ scaleX: [1, 0.85, 1.1, 0.9, 1], scaleY: [1, 1.1, 0.9, 1.05, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '10px 20px' }}
        />
      </svg>
    </motion.div>
  )
}

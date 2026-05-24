import { motion } from 'framer-motion'

/**
 * DoodleField — floating hand-drawn SVG doodles scattered in the dark margins
 * around the notebook. Each doodle animates with a slow float loop.
 */

const doodles = [
  // Heart
  {
    id: 'heart',
    x: '3%', y: '18%',
    size: 44,
    delay: 0,
    duration: 7,
    path: 'M12,6 C12,3 10,1 7,1 C4,1 2,3 2,6 C2,9 7,14 12,18 C17,14 22,9 22,6 C22,3 20,1 17,1 C14,1 12,3 12,6 Z',
    viewBox: '0 0 24 22',
  },
  // Star
  {
    id: 'star',
    x: '91%', y: '12%',
    size: 38,
    delay: 1.2,
    duration: 8.5,
    path: 'M12,2 L14.5,9 L22,9 L16,13.5 L18.5,21 L12,16.5 L5.5,21 L8,13.5 L2,9 L9.5,9 Z',
    viewBox: '0 0 24 24',
  },
  // Music note
  {
    id: 'music',
    x: '5%', y: '55%',
    size: 36,
    delay: 0.6,
    duration: 9,
    path: 'M9,18 L9,6 L19,4 L19,16 M9,18 C9,20 7,22 5,21 C3,20 3,17 5,16 C7,15 9,16 9,18 Z M19,16 C19,18 17,20 15,19 C13,18 13,15 15,14 C17,13 19,14 19,16 Z',
    viewBox: '0 0 24 24',
  },
  // Crumpled paper
  {
    id: 'paper',
    x: '88%', y: '40%',
    size: 40,
    delay: 2,
    duration: 6.5,
    path: 'M4,2 L20,2 L20,22 L4,22 Z M8,8 L16,8 M8,12 L14,12 M8,16 L12,16',
    viewBox: '0 0 24 24',
  },
  // Small flower
  {
    id: 'flower',
    x: '4%', y: '78%',
    size: 42,
    delay: 1.8,
    duration: 7.8,
    path: 'M12,12 C12,12 8,8 8,5 C8,3 10,2 12,4 C14,2 16,3 16,5 C16,8 12,12 12,12 Z M12,12 C12,12 16,8 19,8 C21,8 22,10 20,12 C22,14 21,16 19,16 C16,16 12,12 12,12 Z M12,12 C12,12 16,16 16,19 C16,21 14,22 12,20 C10,22 8,21 8,19 C8,16 12,12 12,12 Z M12,12 C12,12 8,16 5,16 C3,16 2,14 4,12 C2,10 3,8 5,8 C8,8 12,12 12,12 Z',
    viewBox: '0 0 24 24',
  },
  // Arrow doodle
  {
    id: 'arrow',
    x: '92%', y: '68%',
    size: 34,
    delay: 0.4,
    duration: 10,
    path: 'M2,12 Q8,8 14,12 Q8,10 14,12 M14,12 L10,8 M14,12 L10,16',
    viewBox: '0 0 18 24',
  },
  // Leaf
  {
    id: 'leaf',
    x: '7%', y: '36%',
    size: 38,
    delay: 3,
    duration: 8,
    path: 'M12,22 C12,22 4,16 4,9 C4,5 8,2 12,2 C16,2 20,5 20,9 C20,16 12,22 12,22 Z M12,2 L12,22',
    viewBox: '0 0 24 24',
  },
  // Crescent moon
  {
    id: 'moon',
    x: '89%', y: '82%',
    size: 36,
    delay: 1.5,
    duration: 9.5,
    path: 'M20,14 C16,18 10,18 6,14 C2,10 4,4 8,2 C5,8 7,14 12,16 C16,18 20,14 20,14 Z',
    viewBox: '0 0 24 24',
  },
  // Spiral
  {
    id: 'spiral',
    x: '5%', y: '92%',
    size: 36,
    delay: 2.4,
    duration: 11,
    path: 'M12,12 C12,10 14,8 16,10 C18,12 16,16 12,18 C8,20 4,16 6,12 C8,8 14,6 18,9 C22,12 20,20 14,22',
    viewBox: '0 0 24 24',
  },
  // Cross-hatch star
  {
    id: 'xstar',
    x: '91%', y: '28%',
    size: 30,
    delay: 0.9,
    duration: 7.2,
    path: 'M12,2 L12,22 M2,12 L22,12 M5,5 L19,19 M19,5 L5,19',
    viewBox: '0 0 24 24',
  },
  // Small envelope
  {
    id: 'envelope',
    x: '3%', y: '65%',
    size: 46,
    delay: 1.1,
    duration: 8.2,
    path: 'M2,4 L22,4 L22,20 L2,20 Z M2,4 L12,13 L22,4',
    viewBox: '0 0 24 24',
  },
  // Sparkle
  {
    id: 'sparkle',
    x: '87%', y: '56%',
    size: 32,
    delay: 2.8,
    duration: 6.8,
    path: 'M12,2 L13.5,10.5 L22,12 L13.5,13.5 L12,22 L10.5,13.5 L2,12 L10.5,10.5 Z',
    viewBox: '0 0 24 24',
  },
]

export default function DoodleField() {
  return (
    <div className="doodle-field" aria-hidden="true">
      {doodles.map((d) => (
        <motion.div
          key={d.id}
          className="doodle"
          style={{
            position: 'absolute',
            left: d.x,
            top: d.y,
            width: d.size,
            height: d.size,
          }}
          animate={{ y: [0, -8, 0], rotate: [0, d.delay % 2 === 0 ? 4 : -4, 0] }}
          transition={{
            duration: d.duration,
            repeat: Infinity,
            ease: [0.22, 1, 0.36, 1],
            delay: d.delay,
          }}
        >
          <svg
            viewBox={d.viewBox}
            width={d.size}
            height={d.size}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={d.path} />
          </svg>
        </motion.div>
      ))}
    </div>
  )
}
